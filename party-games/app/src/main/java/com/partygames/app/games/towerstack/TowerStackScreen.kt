package com.partygames.app.games.towerstack

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.partygames.app.ui.theme.Player1Color
import com.partygames.app.ui.theme.Player2Color
import com.partygames.app.ui.theme.Player3Color
import com.partygames.app.ui.theme.Player4Color
import kotlinx.coroutines.delay

val playerColors = listOf(Player1Color, Player2Color, Player3Color, Player4Color)

private val playerNames = listOf("Player 1", "Player 2", "Player 3", "Player 4")

@Composable
fun TowerStackScreen(
    playerCount: Int,
    onGameEnd: (winnerIndex: Int) -> Unit,
    viewModel: TowerStackViewModel = viewModel()
) {
    val state by viewModel.state.collectAsState()

    // Initialize once
    LaunchedEffect(Unit) {
        viewModel.initialize(playerCount)
    }

    // Game loop
    LaunchedEffect(state.gamePhase) {
        if (state.gamePhase != GamePhase.Playing) return@LaunchedEffect
        var lastFrameTime = withFrameMillis { it }
        while (state.gamePhase == GamePhase.Playing) {
            val frameTime = withFrameMillis { it }
            val delta = (frameTime - lastFrameTime).coerceIn(0, 50) / 1000f
            lastFrameTime = frameTime
            viewModel.update(delta)
        }
    }

    // Clear elimination messages after a delay
    LaunchedEffect(state.eliminationMessage) {
        if (state.eliminationMessage != null) {
            delay(1500L)
            viewModel.clearEliminationMessage()
        }
    }

    // Game over - navigate after delay
    LaunchedEffect(state.gamePhase) {
        if (state.gamePhase == GamePhase.GameOver) {
            delay(2500L)
            onGameEnd(state.winnerIndex)
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF1A1A2E))
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null
            ) {
                if (state.gamePhase == GamePhase.Playing && !state.isDropping) {
                    viewModel.dropBlock()
                }
            }
    ) {
        // Main game canvas
        Canvas(modifier = Modifier.fillMaxSize()) {
            val canvasWidth = size.width
            val canvasHeight = size.height

            // Scale factor: map game units to pixels
            // The board is BOARD_WIDTH wide in game units
            val scale = canvasWidth / (BOARD_WIDTH + SWING_MARGIN * 2 + 40f)
            val centerX = canvasWidth / 2f

            // Camera offset: auto-scroll up as tower grows
            val towerHeight = state.placedBlocks.size * BLOCK_HEIGHT
            val visibleGameHeight = canvasHeight / scale
            val cameraY = if (towerHeight > visibleGameHeight * 0.4f) {
                towerHeight - visibleGameHeight * 0.4f
            } else {
                0f
            }

            // Base Y in screen coords (bottom area)
            val baseScreenY = canvasHeight - 80f * scale

            fun gameYToScreen(gameY: Float): Float {
                return baseScreenY - (gameY - cameraY) * scale
            }

            // Draw background grid lines
            val gridColor = Color(0xFF2A2A4A)
            val gridSpacing = 50f
            var gridY = 0f
            while (gridY < towerHeight + visibleGameHeight) {
                val screenY = gameYToScreen(gridY)
                if (screenY in -10f..canvasHeight + 10f) {
                    drawLine(
                        color = gridColor,
                        start = Offset(0f, screenY),
                        end = Offset(canvasWidth, screenY),
                        strokeWidth = 1f
                    )
                }
                gridY += gridSpacing
            }

            // Draw base platform
            val baseWidth = BOARD_WIDTH * scale
            val baseLeft = centerX - baseWidth / 2f
            val baseTop = gameYToScreen(0f)
            drawRect(
                color = Color(0xFF3A3A5C),
                topLeft = Offset(baseLeft, baseTop),
                size = Size(baseWidth, 8f)
            )

            // Draw placed blocks
            for (block in state.placedBlocks) {
                val blockScreenWidth = block.width * scale
                val blockScreenHeight = BLOCK_HEIGHT * scale
                val blockScreenX = centerX + block.x * scale - blockScreenWidth / 2f
                val blockScreenY = gameYToScreen((block.level + 1) * BLOCK_HEIGHT)

                if (blockScreenY + blockScreenHeight < -blockScreenHeight ||
                    blockScreenY > canvasHeight + blockScreenHeight) continue

                val color = playerColors.getOrElse(block.playerIndex) { Player1Color }

                // Block body
                drawRect(
                    color = color,
                    topLeft = Offset(blockScreenX, blockScreenY),
                    size = Size(blockScreenWidth, blockScreenHeight)
                )

                // Block border
                drawRect(
                    color = color.copy(alpha = 0.4f),
                    topLeft = Offset(blockScreenX, blockScreenY),
                    size = Size(blockScreenWidth, blockScreenHeight),
                    style = Stroke(width = 2f)
                )

                // Highlight on top edge
                drawLine(
                    color = Color.White.copy(alpha = 0.3f),
                    start = Offset(blockScreenX + 2f, blockScreenY + 1f),
                    end = Offset(blockScreenX + blockScreenWidth - 2f, blockScreenY + 1f),
                    strokeWidth = 2f
                )
            }

            // Draw dropping block (animation)
            if (state.isDropping) {
                val dropBlockWidth = state.dropWidth * scale
                val dropBlockHeight = BLOCK_HEIGHT * scale
                val dropScreenX = centerX + state.dropX * scale - dropBlockWidth / 2f
                val dropScreenY = gameYToScreen(state.dropY + BLOCK_HEIGHT)
                val color = playerColors.getOrElse(state.dropPlayerIndex) { Player1Color }

                drawRect(
                    color = color,
                    topLeft = Offset(dropScreenX, dropScreenY),
                    size = Size(dropBlockWidth, dropBlockHeight)
                )
                drawRect(
                    color = color.copy(alpha = 0.4f),
                    topLeft = Offset(dropScreenX, dropScreenY),
                    size = Size(dropBlockWidth, dropBlockHeight),
                    style = Stroke(width = 2f)
                )
            }

            // Draw swinging block at top (only if not dropping)
            if (!state.isDropping && state.gamePhase == GamePhase.Playing) {
                val level = state.placedBlocks.size
                val swingGameY = (level + 1) * BLOCK_HEIGHT + BLOCK_HEIGHT * 2
                val swingBlockWidth = state.currentBlockWidth * scale
                val swingBlockHeight = BLOCK_HEIGHT * scale
                val swingScreenX = centerX + state.swingX * scale - swingBlockWidth / 2f
                val swingScreenY = gameYToScreen(swingGameY + BLOCK_HEIGHT)

                val color = playerColors.getOrElse(state.currentPlayerIndex) { Player1Color }

                // Ghost line showing where it will drop
                drawLine(
                    color = color.copy(alpha = 0.15f),
                    start = Offset(
                        centerX + state.swingX * scale - swingBlockWidth / 2f,
                        swingScreenY + swingBlockHeight
                    ),
                    end = Offset(
                        centerX + state.swingX * scale - swingBlockWidth / 2f,
                        baseTop
                    ),
                    strokeWidth = swingBlockWidth,
                )

                // The swinging block
                drawRect(
                    color = color,
                    topLeft = Offset(swingScreenX, swingScreenY),
                    size = Size(swingBlockWidth, swingBlockHeight)
                )
                drawRect(
                    color = Color.White.copy(alpha = 0.5f),
                    topLeft = Offset(swingScreenX, swingScreenY),
                    size = Size(swingBlockWidth, swingBlockHeight),
                    style = Stroke(width = 2f)
                )

                // Pulsing indicator line below
                drawLine(
                    color = color.copy(alpha = 0.4f),
                    start = Offset(swingScreenX, swingScreenY + swingBlockHeight + 4f),
                    end = Offset(swingScreenX + swingBlockWidth, swingScreenY + swingBlockHeight + 4f),
                    strokeWidth = 2f
                )
            }
        }

        // UI Overlay: Current player indicator
        if (state.gamePhase == GamePhase.Playing) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.TopCenter)
                    .padding(top = 48.dp, start = 16.dp, end = 16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Block counter
                Text(
                    text = "Block ${state.blocksPlaced + 1} / ${state.totalBlocks}",
                    color = Color.White.copy(alpha = 0.6f),
                    fontSize = 14.sp
                )

                Spacer(modifier = Modifier.height(8.dp))

                // Current player
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center
                ) {
                    Box(
                        modifier = Modifier
                            .size(16.dp)
                            .clip(CircleShape)
                            .background(
                                playerColors.getOrElse(state.currentPlayerIndex) { Player1Color }
                            )
                    )
                    Text(
                        text = "  ${playerNames.getOrElse(state.currentPlayerIndex) { "Player" }}'s turn",
                        color = Color.White,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Player scores row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    for (i in 0 until state.playerCount) {
                        val isEliminated = i in state.eliminatedPlayers
                        val color = if (isEliminated) Color.Gray else playerColors.getOrElse(i) { Player1Color }
                        val score = state.playerScores[i] ?: 0f

                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(12.dp)
                                    .clip(CircleShape)
                                    .background(color)
                            )
                            Text(
                                text = if (isEliminated) "OUT" else "${score.toInt()}",
                                color = color,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }
            }

            // Tap instruction
            Text(
                text = "TAP to drop!",
                color = Color.White.copy(alpha = 0.4f),
                fontSize = 16.sp,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 32.dp)
            )
        }

        // Elimination message overlay
        state.eliminationMessage?.let { message ->
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.Center)
                    .padding(horizontal = 32.dp)
            ) {
                Text(
                    text = message,
                    color = Color(0xFFFF6B6B),
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            Color.Black.copy(alpha = 0.7f),
                            shape = RoundedCornerShape(12.dp)
                        )
                        .padding(vertical = 16.dp, horizontal = 24.dp)
                )
            }
        }

        // Game over overlay
        if (state.gamePhase == GamePhase.GameOver) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.6f)),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier
                        .padding(32.dp)
                        .background(
                            Color(0xFF2A2A4A),
                            shape = RoundedCornerShape(16.dp)
                        )
                        .padding(32.dp)
                ) {
                    Text(
                        text = "Game Over!",
                        color = Color.White,
                        fontSize = 28.sp,
                        fontWeight = FontWeight.Bold
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    val winnerColor = playerColors.getOrElse(state.winnerIndex) { Player1Color }
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Box(
                            modifier = Modifier
                                .size(20.dp)
                                .clip(CircleShape)
                                .background(winnerColor)
                        )
                        Text(
                            text = "  ${playerNames.getOrElse(state.winnerIndex) { "Player" }} wins!",
                            color = winnerColor,
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Final scores
                    for (i in 0 until state.playerCount) {
                        val color = if (i in state.eliminatedPlayers) Color.Gray
                            else playerColors.getOrElse(i) { Player1Color }
                        val score = state.playerScores[i] ?: 0f
                        val label = if (i in state.eliminatedPlayers) " (eliminated)" else ""

                        Text(
                            text = "${playerNames.getOrElse(i) { "Player" }}: ${score.toInt()}$label",
                            color = color,
                            fontSize = 16.sp,
                            modifier = Modifier.padding(vertical = 2.dp)
                        )
                    }
                }
            }
        }
    }
}

private suspend fun withFrameMillis(block: (Long) -> Long): Long {
    var result = 0L
    androidx.compose.ui.platform.LocalDensity
    kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Main) {
        result = block(System.nanoTime() / 1_000_000)
    }
    return result
}
