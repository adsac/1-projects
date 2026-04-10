package com.partygames.app.games.sumo

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
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
import kotlinx.coroutines.isActive
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

private val playerColors = listOf(Player1Color, Player2Color, Player3Color, Player4Color)
private val playerLabels = listOf("P1", "P2", "P3", "P4")

@Composable
fun SumoScreen(
    playerCount: Int,
    onGameEnd: (winnerIndex: Int) -> Unit,
    viewModel: SumoViewModel = viewModel()
) {
    val state by viewModel.state.collectAsState()

    // Start game once.
    LaunchedEffect(Unit) {
        viewModel.startGame(playerCount)
    }

    // Game loop: advance simulation every frame.
    LaunchedEffect(state.phase) {
        if (state.phase != SumoPhase.Fighting) return@LaunchedEffect
        var lastFrameTime = withFrameMillis { it }
        while (isActive && state.phase == SumoPhase.Fighting) {
            val currentTime = withFrameMillis { it }
            val dt = ((currentTime - lastFrameTime) / 1000f).coerceIn(0f, 0.05f)
            lastFrameTime = currentTime
            viewModel.update(dt)
        }
    }

    // When the game is over, notify the parent after a short delay.
    LaunchedEffect(state.phase) {
        if (state.phase == SumoPhase.GameOver) {
            delay(3_000L)
            onGameEnd(state.gameWinner)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF1A1A2E)),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // ---- Top bar: round info and win counters ----
        RoundInfoBar(state)

        // ---- Arena canvas ----
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
            contentAlignment = Alignment.Center
        ) {
            ArenaCanvas(state)

            // Overlay for countdown / round-over / game-over
            when (state.phase) {
                SumoPhase.Countdown -> CountdownOverlay(state.countdownValue)
                SumoPhase.RoundOver -> RoundOverOverlay(state)
                SumoPhase.GameOver -> GameOverOverlay(state)
                SumoPhase.Fighting -> { /* no overlay */ }
            }
        }

        // ---- Bottom: lunge buttons ----
        LungeButtons(
            state = state,
            onLunge = { viewModel.lunge(it) }
        )
    }
}

// ---------------------------------------------------------------------------
// Sub-composables
// ---------------------------------------------------------------------------

@Composable
private fun RoundInfoBar(state: SumoState) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 16.dp, bottom = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = "Round ${state.currentRound}",
            color = Color.White,
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(4.dp))
        Row(
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            for (i in 0 until state.playerCount) {
                if (i > 0) Spacer(modifier = Modifier.width(16.dp))
                val color = playerColors.getOrElse(i) { Color.Gray }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(12.dp)
                            .background(color, CircleShape)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "${state.winsPerPlayer.getOrElse(i) { 0 }}W",
                        color = color,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }
    }
}

@Composable
private fun ArenaCanvas(state: SumoState) {
    Canvas(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(1f)
            .padding(8.dp)
    ) {
        val canvasW = size.width
        val canvasH = size.height
        val canvasMin = min(canvasW, canvasH)

        // Convert normalised arena coordinates to pixel coordinates.
        // The arena uses a coordinate system where x=[0..1] maps to [0..canvasW]
        // and y=[0..1] maps proportionally with the arena centred.
        // Because we use aspectRatio(1f), canvasW ~ canvasH.

        val arenaCx = state.arenaCenterX * canvasW
        val arenaCy = state.arenaCenterY * canvasH
        val arenaR = state.arenaRadius * canvasMin

        // Draw dohyo: sand fill
        drawCircle(
            color = Color(0xFFD2B48C), // Tan / sand
            radius = arenaR,
            center = Offset(arenaCx, arenaCy)
        )
        // Inner ring line (tawara)
        drawCircle(
            color = Color(0xFF5C3D2E),
            radius = arenaR,
            center = Offset(arenaCx, arenaCy),
            style = Stroke(width = 6.dp.toPx())
        )
        // Outer decorative ring
        drawCircle(
            color = Color(0xFF3E2723),
            radius = arenaR + 4.dp.toPx(),
            center = Offset(arenaCx, arenaCy),
            style = Stroke(width = 2.dp.toPx())
        )
        // Cross lines on the dohyo (starting marks)
        val lineLen = arenaR * 0.15f
        val lineOffset = arenaR * 0.15f
        // Left line
        drawLine(
            color = Color(0xFF5C3D2E),
            start = Offset(arenaCx - lineOffset, arenaCy - lineLen),
            end = Offset(arenaCx - lineOffset, arenaCy + lineLen),
            strokeWidth = 3.dp.toPx()
        )
        // Right line
        drawLine(
            color = Color(0xFF5C3D2E),
            start = Offset(arenaCx + lineOffset, arenaCy - lineLen),
            end = Offset(arenaCx + lineOffset, arenaCy + lineLen),
            strokeWidth = 3.dp.toPx()
        )

        // Draw characters.
        val charR = state.characterRadius * canvasMin

        for (i in state.characters.indices) {
            val c = state.characters[i]
            val color = playerColors.getOrElse(i) { Color.Gray }
            val px = c.x * canvasW
            val py = c.y * canvasH

            if (c.alive) {
                // Body circle
                drawCircle(
                    color = color,
                    radius = charR,
                    center = Offset(px, py)
                )
                // Darker outline
                drawCircle(
                    color = color.darken(0.3f),
                    radius = charR,
                    center = Offset(px, py),
                    style = Stroke(width = 2.dp.toPx())
                )

                // Direction indicator: small wedge/triangle in the facing direction.
                drawFacingIndicator(
                    center = Offset(px, py),
                    radius = charR,
                    angle = c.facingAngle,
                    color = Color.White
                )

                // Player label
                drawContext.canvas.nativeCanvas.drawText(
                    playerLabels.getOrElse(i) { "?" },
                    px,
                    py + 5.dp.toPx(),
                    android.graphics.Paint().apply {
                        textAlign = android.graphics.Paint.Align.CENTER
                        textSize = 12.sp.toPx()
                        this.color = android.graphics.Color.WHITE
                        isFakeBoldText = true
                        isAntiAlias = true
                        setShadowLayer(2f, 1f, 1f, android.graphics.Color.BLACK)
                    }
                )
            } else {
                // Eliminated: faded, smaller
                drawCircle(
                    color = color.copy(alpha = 0.25f),
                    radius = charR * 0.6f,
                    center = Offset(px, py)
                )
            }
        }
    }
}

/** Draw a small triangular wedge showing which direction the character faces. */
private fun DrawScope.drawFacingIndicator(
    center: Offset,
    radius: Float,
    angle: Float,
    color: Color
) {
    val tipDist = radius * 1.35f
    val baseDist = radius * 0.7f
    val spread = (PI / 6).toFloat() // 30 degrees half-width

    val tipX = center.x + cos(angle) * tipDist
    val tipY = center.y + sin(angle) * tipDist
    val leftX = center.x + cos(angle + spread) * baseDist
    val leftY = center.y + sin(angle + spread) * baseDist
    val rightX = center.x + cos(angle - spread) * baseDist
    val rightY = center.y + sin(angle - spread) * baseDist

    val path = Path().apply {
        moveTo(tipX, tipY)
        lineTo(leftX, leftY)
        lineTo(rightX, rightY)
        close()
    }
    drawPath(path, color.copy(alpha = 0.85f), style = Fill)
}

@Composable
private fun CountdownOverlay(countdownValue: Int) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Box(
            modifier = Modifier
                .size(120.dp)
                .background(Color.Black.copy(alpha = 0.6f), CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = if (countdownValue > 0) "$countdownValue" else "GO!",
                color = Color.White,
                fontSize = if (countdownValue > 0) 64.sp else 40.sp,
                fontWeight = FontWeight.ExtraBold,
                textAlign = TextAlign.Center
            )
        }
    }
}

@Composable
private fun RoundOverOverlay(state: SumoState) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .background(Color.Black.copy(alpha = 0.65f), RoundedCornerShape(16.dp))
                .padding(horizontal = 32.dp, vertical = 24.dp)
        ) {
            if (state.roundWinner >= 0) {
                val winnerColor = playerColors.getOrElse(state.roundWinner) { Color.White }
                Text(
                    text = "Player ${state.roundWinner + 1} wins the round!",
                    color = winnerColor,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center
                )
            } else {
                Text(
                    text = "Draw!",
                    color = Color.White,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Next round starting...",
                color = Color.White.copy(alpha = 0.7f),
                fontSize = 16.sp,
                textAlign = TextAlign.Center
            )
        }
    }
}

@Composable
private fun GameOverOverlay(state: SumoState) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .background(Color.Black.copy(alpha = 0.75f), RoundedCornerShape(16.dp))
                .padding(horizontal = 40.dp, vertical = 32.dp)
        ) {
            val winnerColor = playerColors.getOrElse(state.gameWinner) { Color.White }
            Text(
                text = "Player ${state.gameWinner + 1}",
                color = winnerColor,
                fontSize = 36.sp,
                fontWeight = FontWeight.ExtraBold,
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "wins the match!",
                color = Color.White,
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(12.dp))
            // Show final scores
            Row(
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                for (i in 0 until state.playerCount) {
                    if (i > 0) Spacer(modifier = Modifier.width(12.dp))
                    val c = playerColors.getOrElse(i) { Color.Gray }
                    Text(
                        text = "P${i + 1}: ${state.winsPerPlayer.getOrElse(i) { 0 }}",
                        color = c,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }
    }
}

@Composable
private fun LungeButtons(
    state: SumoState,
    onLunge: (Int) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 16.dp),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.CenterVertically
    ) {
        for (i in 0 until state.playerCount) {
            val color = playerColors.getOrElse(i) { Color.Gray }
            val char = state.characters.getOrNull(i)
            val alive = char?.alive ?: false
            val onCooldown = (char?.lungeCooldown ?: 0f) > 0f
            val enabled = state.phase == SumoPhase.Fighting && alive && !onCooldown

            Button(
                onClick = { onLunge(i) },
                enabled = enabled,
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 4.dp)
                    .height(64.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (alive) color else color.copy(alpha = 0.3f),
                    contentColor = Color.White,
                    disabledContainerColor = color.copy(alpha = if (alive) 0.4f else 0.2f),
                    disabledContentColor = Color.White.copy(alpha = 0.5f)
                )
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "P${i + 1}",
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp
                    )
                    if (!alive) {
                        Text(text = "OUT", fontSize = 10.sp)
                    } else if (onCooldown) {
                        Text(text = "...", fontSize = 10.sp)
                    } else {
                        Text(text = "LUNGE", fontSize = 10.sp)
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Produce a darker shade of a colour by blending toward black. */
private fun Color.darken(factor: Float): Color {
    return Color(
        red = this.red * (1f - factor),
        green = this.green * (1f - factor),
        blue = this.blue * (1f - factor),
        alpha = this.alpha
    )
}

/**
 * Suspend-inline wrapper around [androidx.compose.ui.platform.AndroidUiDispatcher]'s
 * frame callback. Returns the frame time in milliseconds.
 */
private suspend fun withFrameMillis(block: (Long) -> Long): Long {
    var result = 0L
    androidx.compose.runtime.withFrameMillis { frameTimeMillis ->
        result = block(frameTimeMillis)
    }
    return result
}
