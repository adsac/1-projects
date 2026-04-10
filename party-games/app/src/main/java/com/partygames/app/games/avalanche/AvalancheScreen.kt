package com.partygames.app.games.avalanche

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.input.pointer.pointerInput
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
import kotlin.math.sin

val playerColors = listOf(Player1Color, Player2Color, Player3Color, Player4Color)

private val playerNames = listOf("Player 1", "Player 2", "Player 3", "Player 4")

/** Height reserved at the bottom of the screen for the jump buttons. */
private const val BUTTON_AREA_HEIGHT_DP = 80

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

@Composable
fun AvalancheScreen(
    playerCount: Int,
    onGameEnd: (winnerIndex: Int) -> Unit,
    viewModel: AvalancheViewModel = viewModel()
) {
    val state by viewModel.state.collectAsState()

    // Initialise once.
    LaunchedEffect(Unit) {
        viewModel.initialize(playerCount)
    }

    // Game loop.
    LaunchedEffect(state.phase) {
        if (state.phase != AvalanchePhase.Playing) return@LaunchedEffect
        var lastFrameTime = withFrameMillis { it }
        while (state.phase == AvalanchePhase.Playing) {
            val frameTime = withFrameMillis { it }
            val delta = (frameTime - lastFrameTime).coerceIn(0, 50) / 1000f
            lastFrameTime = frameTime
            viewModel.update(delta)
        }
    }

    // Navigate away after game over.
    LaunchedEffect(state.phase) {
        if (state.phase == AvalanchePhase.GameOver) {
            delay(2500L)
            onGameEnd(state.winnerIndex)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0D0D1A))
    ) {
        // Game canvas – takes all space above the button row.
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
        ) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                drawGame(state)
            }

            // Countdown overlay
            if (state.phase == AvalanchePhase.Countdown) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = state.countdownValue.toString(),
                        color = Color.White,
                        fontSize = 72.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            // Height indicator (top-right)
            if (state.phase == AvalanchePhase.Playing || state.phase == AvalanchePhase.GameOver) {
                val maxHeight = state.players
                    .filter { it.alive }
                    .maxOfOrNull { it.y }
                    ?: state.players.maxOfOrNull { it.y }
                    ?: 0f
                val displayHeight = (maxHeight / 100f).toInt()

                Text(
                    text = "${displayHeight}m",
                    color = Color.White.copy(alpha = 0.5f),
                    fontSize = 14.sp,
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(top = 48.dp, end = 12.dp)
                )
            }

            // Alive status indicators (top-left)
            if (state.phase == AvalanchePhase.Playing) {
                Row(
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(top = 48.dp, start = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    for (i in 0 until state.playerCount) {
                        val alive = state.players.getOrNull(i)?.alive ?: false
                        Box(
                            modifier = Modifier
                                .size(14.dp)
                                .clip(CircleShape)
                                .background(
                                    if (alive) playerColors.getOrElse(i) { Player1Color }
                                    else Color.Gray
                                )
                        )
                    }
                }
            }

            // Game-over overlay
            if (state.phase == AvalanchePhase.GameOver) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.55f)),
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

                        if (state.winnerIndex >= 0) {
                            val winColor = playerColors.getOrElse(state.winnerIndex) { Player1Color }
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier
                                        .size(20.dp)
                                        .clip(CircleShape)
                                        .background(winColor)
                                )
                                Text(
                                    text = "  ${playerNames.getOrElse(state.winnerIndex) { "Player" }} wins!",
                                    color = winColor,
                                    fontSize = 24.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        } else {
                            Text(
                                text = "No survivors!",
                                color = Color(0xFFFF6B6B),
                                fontSize = 24.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        for (i in 0 until state.playerCount) {
                            val alive = state.players.getOrNull(i)?.alive ?: false
                            val color = if (alive) playerColors.getOrElse(i) { Player1Color } else Color.Gray
                            val label = if (alive) "" else " (eliminated)"
                            Text(
                                text = "${playerNames.getOrElse(i) { "Player" }}$label",
                                color = color,
                                fontSize = 16.sp,
                                modifier = Modifier.padding(vertical = 2.dp)
                            )
                        }
                    }
                }
            }
        }

        // Jump buttons row at the bottom.
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(BUTTON_AREA_HEIGHT_DP.dp)
                .background(Color(0xFF111122)),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically
        ) {
            for (i in 0 until state.playerCount) {
                val alive = state.players.getOrNull(i)?.alive ?: false
                val baseColor = playerColors.getOrElse(i) { Player1Color }
                val buttonColor = if (alive) baseColor else Color.Gray.copy(alpha = 0.3f)

                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(BUTTON_AREA_HEIGHT_DP.dp)
                        .padding(horizontal = 4.dp, vertical = 8.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(buttonColor.copy(alpha = if (alive) 0.35f else 0.15f))
                        .pointerInput(i, alive) {
                            if (!alive) return@pointerInput
                            detectTapGestures {
                                viewModel.jump(i)
                            }
                        },
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = if (alive) "P${i + 1}\nJUMP" else "P${i + 1}\nOUT",
                        color = if (alive) buttonColor else Color.Gray,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center,
                        lineHeight = 18.sp
                    )
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Canvas drawing
// ---------------------------------------------------------------------------

private fun DrawScope.drawGame(state: AvalancheState) {
    val canvasW = size.width
    val canvasH = size.height

    // Mapping from world coordinates to screen coordinates.
    // World X: 0..WORLD_WIDTH maps to 0..canvasW.
    // World Y: cameraY maps to screen bottom, cameraY + visibleHeight maps to screen top.
    val scaleX = canvasW / AvalancheViewModel.WORLD_WIDTH
    val visibleWorldHeight = canvasH / scaleX // use uniform scale
    val scaleY = scaleX // uniform

    fun worldXToScreen(wx: Float): Float = wx * scaleX
    fun worldYToScreen(wy: Float): Float = canvasH - (wy - state.cameraY) * scaleY

    // --- Background gradient ---
    drawRect(
        brush = Brush.verticalGradient(
            colors = listOf(Color(0xFF0B0B1E), Color(0xFF1A1A3A)),
            startY = 0f,
            endY = canvasH
        ),
        size = size
    )

    // --- Column dividers ---
    val dividerColor = Color.White.copy(alpha = 0.08f)
    for (col in 1 until state.playerCount) {
        val divX = worldXToScreen(AvalancheViewModel.columnLeftX(col, state.playerCount))
        drawLine(
            color = dividerColor,
            start = Offset(divX, 0f),
            end = Offset(divX, canvasH),
            strokeWidth = 1.5f
        )
    }

    // --- Platforms ---
    val platformColor = Color(0xFF6B5B4F)
    val platformHighlight = Color(0xFF8B7B6F)
    for (col in state.platforms.indices) {
        for (plat in state.platforms[col]) {
            val sx = worldXToScreen(plat.x)
            val sy = worldYToScreen(plat.y + PLATFORM_HEIGHT / 2f)
            val sw = plat.width * scaleX
            val sh = PLATFORM_HEIGHT * scaleY

            // Skip off-screen platforms.
            if (sy + sh < -sh || sy > canvasH + sh) continue

            drawRect(
                color = platformColor,
                topLeft = Offset(sx, sy),
                size = Size(sw, sh)
            )
            // Top highlight
            drawLine(
                color = platformHighlight,
                start = Offset(sx + 2f, sy + 1f),
                end = Offset(sx + sw - 2f, sy + 1f),
                strokeWidth = 2f
            )
        }
    }

    // --- Player characters ---
    for (i in state.players.indices) {
        val p = state.players[i]
        if (!p.alive) continue

        val cx = worldXToScreen(AvalancheViewModel.columnCentreX(i, state.playerCount))
        val cy = worldYToScreen(p.y)
        val sr = CHARACTER_RADIUS * scaleX

        val color = playerColors.getOrElse(i) { Player1Color }

        // Body
        drawCircle(color = color, radius = sr, center = Offset(cx, cy))
        // Highlight
        drawCircle(
            color = Color.White.copy(alpha = 0.25f),
            radius = sr * 0.55f,
            center = Offset(cx - sr * 0.2f, cy - sr * 0.25f)
        )
        // Border
        drawCircle(
            color = color.copy(alpha = 0.5f),
            radius = sr,
            center = Offset(cx, cy),
            style = androidx.compose.ui.graphics.drawscope.Stroke(width = 2f)
        )
    }

    // --- Lava ---
    val lavaScreenY = worldYToScreen(state.lavaY)
    if (lavaScreenY < canvasH + 40f) {
        // Wavy top edge
        val wavePath = Path()
        val waveAmplitude = 8f
        val waveFrequency = 0.025f
        val timeOffset = state.elapsed * 3f

        wavePath.moveTo(0f, lavaScreenY + waveAmplitude)
        var wx = 0f
        while (wx <= canvasW + 10f) {
            val waveY = lavaScreenY + sin((wx * waveFrequency + timeOffset).toDouble()).toFloat() * waveAmplitude
            wavePath.lineTo(wx, waveY)
            wx += 4f
        }
        wavePath.lineTo(canvasW, canvasH + 10f)
        wavePath.lineTo(0f, canvasH + 10f)
        wavePath.close()

        // Lava gradient fill
        drawPath(
            path = wavePath,
            brush = Brush.verticalGradient(
                colors = listOf(
                    Color(0xFFFF6600),
                    Color(0xFFFF3300),
                    Color(0xFFCC0000)
                ),
                startY = lavaScreenY - 20f,
                endY = canvasH + 10f
            )
        )

        // Bright glow on top edge
        val glowPath = Path()
        glowPath.moveTo(0f, lavaScreenY + waveAmplitude + 6f)
        wx = 0f
        while (wx <= canvasW + 10f) {
            val waveY = lavaScreenY + sin((wx * waveFrequency + timeOffset).toDouble()).toFloat() * waveAmplitude
            glowPath.lineTo(wx, waveY)
            wx += 4f
        }
        wx = canvasW
        while (wx >= -10f) {
            val waveY = lavaScreenY + sin((wx * waveFrequency + timeOffset).toDouble()).toFloat() * waveAmplitude + 6f
            glowPath.lineTo(wx, waveY)
            wx -= 4f
        }
        glowPath.close()

        drawPath(
            path = glowPath,
            brush = Brush.verticalGradient(
                colors = listOf(
                    Color(0xFFFFCC00).copy(alpha = 0.7f),
                    Color(0xFFFF6600).copy(alpha = 0.0f)
                ),
                startY = lavaScreenY - 10f,
                endY = lavaScreenY + 20f
            )
        )
    }
}

// ---------------------------------------------------------------------------
// Frame-time helper (matches existing project pattern)
// ---------------------------------------------------------------------------

private suspend fun withFrameMillis(block: (Long) -> Long): Long {
    var result = 0L
    kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Main) {
        result = block(System.nanoTime() / 1_000_000)
    }
    return result
}
