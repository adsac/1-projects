package com.partygames.app.games.snake

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.partygames.app.ui.theme.Player1Color
import com.partygames.app.ui.theme.Player2Color
import com.partygames.app.ui.theme.Player3Color
import com.partygames.app.ui.theme.Player4Color
import kotlinx.coroutines.delay

val playerColors = listOf(Player1Color, Player2Color, Player3Color, Player4Color)

private val gridBackground = Color(0xFF1A1A2E)
private val gridLineColor = Color(0xFF16213E)
private val wallColor = Color(0xFF444466)
private val foodColor = Color(0xFFFF5252)

@Composable
fun SnakeScreen(
    playerCount: Int,
    onGameEnd: (winnerIndex: Int) -> Unit,
    viewModel: SnakeViewModel = viewModel()
) {
    val gameState by viewModel.state.collectAsState()

    // Initialize the game
    LaunchedEffect(playerCount) {
        viewModel.initialize(playerCount)
    }

    // Countdown timer
    LaunchedEffect(gameState.phase) {
        if (gameState.phase == GamePhase.COUNTDOWN) {
            while (gameState.phase == GamePhase.COUNTDOWN) {
                delay(1000L)
                viewModel.countdownTick()
            }
        }
    }

    // Game tick loop
    LaunchedEffect(gameState.phase) {
        if (gameState.phase == GamePhase.PLAYING) {
            while (gameState.phase == GamePhase.PLAYING) {
                delay(150L)
                viewModel.tick()
            }
        }
    }

    // Game over callback
    LaunchedEffect(gameState.phase) {
        if (gameState.phase == GamePhase.GAME_OVER) {
            delay(1500L)
            onGameEnd(gameState.winnerIndex)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black),
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        // Game arena
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .padding(8.dp),
            contentAlignment = Alignment.Center
        ) {
            GameArena(gameState = gameState)

            // Countdown overlay
            if (gameState.phase == GamePhase.COUNTDOWN) {
                Text(
                    text = if (gameState.countdownValue > 0) "${gameState.countdownValue}" else "GO!",
                    fontSize = 72.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            }

            // Game over overlay
            if (gameState.phase == GamePhase.GAME_OVER) {
                val winnerText = if (gameState.winnerIndex >= 0) {
                    "Player ${gameState.winnerIndex + 1} Wins!"
                } else {
                    "Draw!"
                }
                Text(
                    text = winnerText,
                    fontSize = 48.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (gameState.winnerIndex >= 0) {
                        playerColors[gameState.winnerIndex]
                    } else {
                        Color.White
                    }
                )
            }
        }

        // Player control buttons at the bottom
        PlayerControls(
            playerCount = playerCount,
            gameState = gameState,
            onTurnLeft = { viewModel.turnLeft(it) },
            onTurnRight = { viewModel.turnRight(it) }
        )
    }
}

@Composable
private fun GameArena(gameState: SnakeGameState) {
    Canvas(
        modifier = Modifier
            .aspectRatio(
                SnakeViewModel.GRID_WIDTH.toFloat() / SnakeViewModel.GRID_HEIGHT.toFloat()
            )
            .fillMaxSize()
    ) {
        val cellWidth = size.width / SnakeViewModel.GRID_WIDTH
        val cellHeight = size.height / SnakeViewModel.GRID_HEIGHT

        // Background
        drawRect(color = gridBackground, size = size)

        // Grid lines
        for (x in 0..SnakeViewModel.GRID_WIDTH) {
            drawLine(
                color = gridLineColor,
                start = Offset(x * cellWidth, 0f),
                end = Offset(x * cellWidth, size.height),
                strokeWidth = 1f
            )
        }
        for (y in 0..SnakeViewModel.GRID_HEIGHT) {
            drawLine(
                color = gridLineColor,
                start = Offset(0f, y * cellHeight),
                end = Offset(size.width, y * cellHeight),
                strokeWidth = 1f
            )
        }

        // Wall border
        val borderWidth = 3f
        drawRect(color = wallColor, size = size, style = androidx.compose.ui.graphics.drawscope.Stroke(borderWidth))

        // Food
        for (f in gameState.food) {
            val centerX = f.x * cellWidth + cellWidth / 2
            val centerY = f.y * cellHeight + cellHeight / 2
            val radius = cellWidth.coerceAtMost(cellHeight) * 0.35f
            drawCircle(
                color = foodColor,
                radius = radius,
                center = Offset(centerX, centerY)
            )
        }

        // Snakes
        for ((index, snake) in gameState.snakes.withIndex()) {
            val color = playerColors[index]
            val alpha = if (snake.alive) 1f else 0.3f

            drawSnake(
                snake = snake,
                color = color.copy(alpha = alpha),
                cellWidth = cellWidth,
                cellHeight = cellHeight
            )
        }
    }
}

private fun DrawScope.drawSnake(
    snake: Snake,
    color: Color,
    cellWidth: Float,
    cellHeight: Float
) {
    val bodyInset = 0.1f
    val headInset = 0.02f

    for ((segIndex, segment) in snake.segments.withIndex()) {
        val isHead = segIndex == 0
        val inset = if (isHead) headInset else bodyInset

        val left = segment.x * cellWidth + cellWidth * inset
        val top = segment.y * cellHeight + cellHeight * inset
        val segWidth = cellWidth * (1f - 2f * inset)
        val segHeight = cellHeight * (1f - 2f * inset)

        drawRoundRect(
            color = color,
            topLeft = Offset(left, top),
            size = Size(segWidth, segHeight),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(
                if (isHead) segWidth * 0.3f else segWidth * 0.15f,
                if (isHead) segHeight * 0.3f else segHeight * 0.15f
            )
        )

        // Draw eyes on the head
        if (isHead && snake.alive) {
            val eyeRadius = cellWidth.coerceAtMost(cellHeight) * 0.07f
            val centerX = segment.x * cellWidth + cellWidth / 2
            val centerY = segment.y * cellHeight + cellHeight / 2
            val eyeOffset = cellWidth.coerceAtMost(cellHeight) * 0.18f

            val (eye1, eye2) = when (snake.direction) {
                Direction.UP -> Pair(
                    Offset(centerX - eyeOffset, centerY - eyeOffset),
                    Offset(centerX + eyeOffset, centerY - eyeOffset)
                )
                Direction.DOWN -> Pair(
                    Offset(centerX - eyeOffset, centerY + eyeOffset),
                    Offset(centerX + eyeOffset, centerY + eyeOffset)
                )
                Direction.LEFT -> Pair(
                    Offset(centerX - eyeOffset, centerY - eyeOffset),
                    Offset(centerX - eyeOffset, centerY + eyeOffset)
                )
                Direction.RIGHT -> Pair(
                    Offset(centerX + eyeOffset, centerY - eyeOffset),
                    Offset(centerX + eyeOffset, centerY + eyeOffset)
                )
            }
            drawCircle(color = Color.White, radius = eyeRadius, center = eye1)
            drawCircle(color = Color.White, radius = eyeRadius, center = eye2)
        }
    }
}

@Composable
private fun PlayerControls(
    playerCount: Int,
    gameState: SnakeGameState,
    onTurnLeft: (Int) -> Unit,
    onTurnRight: (Int) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(IntrinsicSize.Min)
            .padding(horizontal = 4.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        for (i in 0 until playerCount) {
            val alive = i < gameState.snakes.size && gameState.snakes[i].alive
            val color = playerColors[i]
            val alpha = if (alive && gameState.phase == GamePhase.PLAYING) 0.85f else 0.3f

            PlayerControlButton(
                playerIndex = i,
                color = color.copy(alpha = alpha),
                alive = alive && gameState.phase == GamePhase.PLAYING,
                onTurnLeft = { onTurnLeft(i) },
                onTurnRight = { onTurnRight(i) },
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
private fun PlayerControlButton(
    playerIndex: Int,
    color: Color,
    alive: Boolean,
    onTurnLeft: () -> Unit,
    onTurnRight: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.padding(2.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Player label
        Text(
            text = "P${playerIndex + 1}",
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = if (alive) playerColors[playerIndex] else Color.Gray
        )

        // L/R button row
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(80.dp),
            horizontalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            // Left button
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .background(
                        color = color,
                        shape = RoundedCornerShape(topStart = 12.dp, bottomStart = 12.dp)
                    )
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                        enabled = alive
                    ) { onTurnLeft() },
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "\u25C0",
                    fontSize = 22.sp,
                    color = Color.White.copy(alpha = if (alive) 0.9f else 0.4f)
                )
            }

            // Right button
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .background(
                        color = color,
                        shape = RoundedCornerShape(topEnd = 12.dp, bottomEnd = 12.dp)
                    )
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                        enabled = alive
                    ) { onTurnRight() },
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "\u25B6",
                    fontSize = 22.sp,
                    color = Color.White.copy(alpha = if (alive) 0.9f else 0.4f)
                )
            }
        }
    }
}
