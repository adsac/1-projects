package com.partygames.app.games.bombtag

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
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
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.runtime.withFrameMillis
import androidx.lifecycle.viewmodel.compose.viewModel
import com.partygames.app.ui.theme.Player1Color
import com.partygames.app.ui.theme.Player2Color
import com.partygames.app.ui.theme.Player3Color
import com.partygames.app.ui.theme.Player4Color

private val playerColors = listOf(Player1Color, Player2Color, Player3Color, Player4Color)
private val playerNames = listOf("P1", "P2", "P3", "P4")

@Composable
fun BombTagScreen(
    playerCount: Int,
    onGameEnd: (winnerIndex: Int) -> Unit,
    viewModel: BombTagViewModel = viewModel()
) {
    val state by viewModel.state.collectAsState()

    // Initialise the game once.
    LaunchedEffect(Unit) {
        viewModel.startGame(playerCount)
    }

    // Game loop: drive update() every frame.
    var lastFrameTime by remember { mutableLongStateOf(0L) }
    LaunchedEffect(state.phase) {
        if (state.phase == BombTagPhase.GameOver) return@LaunchedEffect
        lastFrameTime = 0L
        while (true) {
            withFrameMillis { frameTimeMs ->
                if (lastFrameTime != 0L) {
                    val dt = ((frameTimeMs - lastFrameTime) / 1000f).coerceIn(0f, 0.05f)
                    viewModel.update(dt)
                }
                lastFrameTime = frameTimeMs
            }
        }
    }

    // When game is over, notify after a short delay.
    LaunchedEffect(state.phase) {
        if (state.phase == BombTagPhase.GameOver) {
            kotlinx.coroutines.delay(2_500L)
            onGameEnd(state.winnerIndex)
        }
    }

    // Pulsing animation for bomb holder. Speed increases with bombTimerFraction.
    val pulseTransition = rememberInfiniteTransition(label = "bomb_pulse")
    val baseDuration = lerpInt(800, 150, state.bombTimerFraction)
    val pulseAlpha by pulseTransition.animateFloat(
        initialValue = 0.3f,
        targetValue = 1.0f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = baseDuration, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulse_alpha"
    )
    val pulseScale by pulseTransition.animateFloat(
        initialValue = 1.0f,
        targetValue = 1.5f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = baseDuration, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulse_scale"
    )

    // Explosion flash: bright when explosion phase starts, fading out.
    val explosionAlpha = if (state.phase == BombTagPhase.Explosion) {
        (state.explosionTimer / 2f).coerceIn(0f, 1f) * 0.7f
    } else 0f

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF1A1A2E))
    ) {
        // ---- Player status bar ----
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 12.dp, start = 8.dp, end = 8.dp, bottom = 4.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            for (i in 0 until playerCount) {
                val charSnapshot = state.characters.getOrNull(i)
                val alive = charSnapshot?.alive != false
                val hasBomb = charSnapshot?.hasBomb == true
                val color = playerColors.getOrElse(i) { Color.Gray }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(horizontal = 8.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(14.dp)
                            .background(
                                color = if (alive) color else Color.DarkGray,
                                shape = CircleShape
                            )
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = if (hasBomb && alive) "P${i + 1} \uD83D\uDCA3" else "P${i + 1}",
                        color = if (alive) Color.White else Color.Gray,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        textDecoration = if (!alive) TextDecoration.LineThrough else TextDecoration.None
                    )
                }
            }
        }

        // ---- Arena ----
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .padding(horizontal = 12.dp, vertical = 4.dp),
            contentAlignment = Alignment.Center
        ) {
            Canvas(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(1f)
            ) {
                val arenaSize = size.width // square
                val arenaPx = arenaSize

                // Arena background.
                drawRect(
                    color = Color(0xFF0F0F23),
                    topLeft = Offset.Zero,
                    size = Size(arenaPx, arenaPx)
                )
                // Arena border.
                drawRect(
                    color = Color(0xFF444466),
                    topLeft = Offset.Zero,
                    size = Size(arenaPx, arenaPx),
                    style = Stroke(width = 3.dp.toPx())
                )

                // Draw characters.
                for (charSnap in state.characters) {
                    val cx = charSnap.x * arenaPx
                    val cy = charSnap.y * arenaPx
                    val r = charSnap.radius * arenaPx
                    val color = playerColors.getOrElse(charSnap.playerIndex) { Color.Gray }

                    if (!charSnap.alive) {
                        // Faded ghost for eliminated players.
                        drawCircle(
                            color = color.copy(alpha = 0.15f),
                            radius = r,
                            center = Offset(cx, cy)
                        )
                        // X mark.
                        drawLine(
                            color = Color.Red.copy(alpha = 0.4f),
                            start = Offset(cx - r * 0.5f, cy - r * 0.5f),
                            end = Offset(cx + r * 0.5f, cy + r * 0.5f),
                            strokeWidth = 3.dp.toPx()
                        )
                        drawLine(
                            color = Color.Red.copy(alpha = 0.4f),
                            start = Offset(cx + r * 0.5f, cy - r * 0.5f),
                            end = Offset(cx - r * 0.5f, cy + r * 0.5f),
                            strokeWidth = 3.dp.toPx()
                        )
                        continue
                    }

                    // Bomb holder glow.
                    if (charSnap.hasBomb) {
                        // Outer pulsing glow.
                        drawCircle(
                            color = Color(0xFFFF6600).copy(alpha = pulseAlpha * 0.5f),
                            radius = r * pulseScale * 1.3f,
                            center = Offset(cx, cy)
                        )
                        drawCircle(
                            color = Color.Red.copy(alpha = pulseAlpha * 0.7f),
                            radius = r * pulseScale,
                            center = Offset(cx, cy)
                        )
                    }

                    // Player circle fill.
                    drawCircle(
                        color = color,
                        radius = r,
                        center = Offset(cx, cy)
                    )
                    // Outline.
                    drawCircle(
                        color = Color.White.copy(alpha = 0.6f),
                        radius = r,
                        center = Offset(cx, cy),
                        style = Stroke(width = 2.dp.toPx())
                    )

                    // Player label.
                    val label = playerNames.getOrElse(charSnap.playerIndex) { "?" }
                    drawPlayerLabel(cx, cy, r, label, charSnap.hasBomb)
                }
            }

            // ---- Explosion flash overlay ----
            if (explosionAlpha > 0f) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(1f)
                        .background(Color.Red.copy(alpha = explosionAlpha))
                )
            }

            // ---- Countdown overlay ----
            if (state.phase == BombTagPhase.Countdown) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(1f)
                        .background(Color.Black.copy(alpha = 0.7f)),
                    contentAlignment = Alignment.Center
                ) {
                    val displayText = if (state.countdownValue > 0) {
                        "${state.countdownValue}"
                    } else {
                        "GO!"
                    }
                    Text(
                        text = displayText,
                        color = if (state.countdownValue == 0) Color(0xFF00E676) else Color.White,
                        fontSize = 72.sp,
                        fontWeight = FontWeight.ExtraBold,
                        textAlign = TextAlign.Center
                    )
                }
            }

            // ---- Explosion BOOM overlay ----
            if (state.phase == BombTagPhase.Explosion) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(1f),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "\uD83D\uDCA5 BOOM! \uD83D\uDCA5",
                            color = Color(0xFFFF4444),
                            fontSize = 48.sp,
                            fontWeight = FontWeight.ExtraBold,
                            textAlign = TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        if (state.eliminatedIndex >= 0) {
                            val elimColor = playerColors.getOrElse(state.eliminatedIndex) { Color.Gray }
                            Text(
                                text = "Player ${state.eliminatedIndex + 1} eliminated!",
                                color = elimColor,
                                fontSize = 24.sp,
                                fontWeight = FontWeight.Bold,
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                }
            }

            // ---- Round start overlay ----
            if (state.phase == BombTagPhase.RoundStart) {
                val bombHolder = state.characters.firstOrNull { it.hasBomb && it.alive }
                if (bombHolder != null) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .aspectRatio(1f)
                            .background(Color.Black.copy(alpha = 0.5f)),
                        contentAlignment = Alignment.Center
                    ) {
                        val holderColor = playerColors.getOrElse(bombHolder.playerIndex) { Color.White }
                        Text(
                            text = "\uD83D\uDCA3 Player ${bombHolder.playerIndex + 1} has the bomb!",
                            color = holderColor,
                            fontSize = 28.sp,
                            fontWeight = FontWeight.ExtraBold,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }

            // ---- Game Over overlay ----
            if (state.phase == BombTagPhase.GameOver) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(1f)
                        .background(Color.Black.copy(alpha = 0.75f)),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "Player ${state.winnerIndex + 1} wins!",
                            color = playerColors.getOrElse(state.winnerIndex) { Color.White },
                            fontSize = 48.sp,
                            fontWeight = FontWeight.ExtraBold,
                            textAlign = TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = "\uD83C\uDFC6",
                            fontSize = 64.sp
                        )
                    }
                }
            }
        }

        // ---- Dash buttons at the bottom ----
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            for (i in 0 until playerCount) {
                val charSnap = state.characters.getOrNull(i)
                val alive = charSnap?.alive != false
                val color = playerColors.getOrElse(i) { Color.Gray }
                val isPlaying = state.phase == BombTagPhase.Playing || state.phase == BombTagPhase.RoundStart

                Button(
                    onClick = { viewModel.dash(i) },
                    enabled = alive && isPlaying,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (alive) color else Color.DarkGray,
                        contentColor = Color.White,
                        disabledContainerColor = Color(0xFF333333),
                        disabledContentColor = Color(0xFF666666)
                    ),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .weight(1f)
                        .height(56.dp)
                        .padding(horizontal = 4.dp)
                ) {
                    Text(
                        text = if (alive) "P${i + 1}\nDASH" else "P${i + 1}\nOUT",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center,
                        lineHeight = 14.sp
                    )
                }
            }
        }
    }
}

// -------------------------------------------------------------------------
// Draw helpers
// -------------------------------------------------------------------------

/** Draw the player label (and bomb emoji if applicable) on the canvas. */
private fun DrawScope.drawPlayerLabel(
    cx: Float,
    cy: Float,
    radius: Float,
    label: String,
    hasBomb: Boolean
) {
    val textToDraw = if (hasBomb) "\uD83D\uDCA3" else label
    val textSizeSp = if (hasBomb) radius * 1.2f else radius * 0.9f

    drawContext.canvas.nativeCanvas.drawText(
        textToDraw,
        cx,
        cy + textSizeSp * 0.35f, // vertical centering offset
        android.graphics.Paint().apply {
            textAlign = android.graphics.Paint.Align.CENTER
            textSize = textSizeSp
            color = if (hasBomb) android.graphics.Color.WHITE else android.graphics.Color.WHITE
            isFakeBoldText = true
            isAntiAlias = true
        }
    )
}

/** Linear interpolation between two Int values based on a 0..1 fraction. */
private fun lerpInt(a: Int, b: Int, fraction: Float): Int {
    return (a + (b - a) * fraction.coerceIn(0f, 1f)).toInt()
}
