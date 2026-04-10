package com.partygames.app.games.fingertwister

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.partygames.app.ui.theme.Player1Color
import com.partygames.app.ui.theme.Player2Color
import com.partygames.app.ui.theme.Player3Color
import com.partygames.app.ui.theme.Player4Color
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlin.math.min

private val playerColors = listOf(Player1Color, Player2Color, Player3Color, Player4Color)
private val playerNames = listOf("P1", "P2", "P3", "P4")

@Composable
fun FingerTwisterScreen(
    playerCount: Int,
    onGameEnd: (winnerIndex: Int) -> Unit,
    viewModel: FingerTwisterViewModel = viewModel()
) {
    val state by viewModel.state.collectAsState()

    // Start the game once.
    LaunchedEffect(Unit) {
        viewModel.startGame(playerCount)
    }

    // When game is over, call onGameEnd after a short celebration delay.
    LaunchedEffect(state.phase) {
        if (state.phase == GamePhase.GameOver) {
            delay(2_500L)
            onGameEnd(state.winnerIndex)
        }
    }

    // Track screen size for coordinate conversion.
    val sizeState = remember { mutableStateMapOf("w" to 0, "h" to 0) }
    val screenWidth = sizeState["w"] ?: 0
    val screenHeight = sizeState["h"] ?: 0

    // Active pointer positions in *pixel* coordinates keyed by pointer ID.
    val activePointers = remember { mutableStateMapOf<Long, Offset>() }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF121212))
            .onSizeChanged { size: IntSize ->
                sizeState["w"] = size.width
                sizeState["h"] = size.height
            }
            .pointerInput(Unit) {
                awaitPointerEventScope {
                    while (true) {
                        val event = awaitPointerEvent()
                        // Rebuild the full pointer map each event.
                        val current = mutableMapOf<Long, Offset>()
                        for (change in event.changes) {
                            if (change.pressed) {
                                current[change.id.value] = change.position
                            }
                            // Consume all changes to prevent parent interception.
                            if (event.type == PointerEventType.Move ||
                                event.type == PointerEventType.Press
                            ) {
                                change.consume()
                            }
                        }
                        // Remove pointers that were lifted.
                        val liftedIds = activePointers.keys - current.keys
                        for (id in liftedIds) {
                            activePointers.remove(id)
                        }
                        // Update / add active pointers.
                        for ((id, pos) in current) {
                            activePointers[id] = pos
                        }
                    }
                }
            }
    ) {
        // Continuously push touch data to ViewModel (~60 fps via recomposition driven loop).
        LaunchedEffect(state.phase) {
            while (isActive && state.phase == GamePhase.Playing) {
                if (screenWidth > 0 && screenHeight > 0) {
                    // Convert pixel positions to fraction space (0-1).
                    val fractionMap = activePointers.mapValues { (_, pos) ->
                        Offset(
                            x = (pos.x / screenWidth).coerceIn(0f, 1f),
                            y = (pos.y / screenHeight).coerceIn(0f, 1f)
                        )
                    }
                    viewModel.update(fractionMap)
                }
                delay(16L) // ~60 fps
            }
        }

        // ---- Draw game circles on a full-screen Canvas ----
        Canvas(modifier = Modifier.fillMaxSize()) {
            val w = size.width
            val h = size.height
            val minDim = min(w, h)

            for (circle in state.circles) {
                val cx = circle.x * w
                val cy = circle.y * h
                val r = circle.radius * minDim

                val color = playerColors.getOrElse(circle.playerIndex) { Color.Gray }

                // Filled circle with some transparency.
                drawCircle(
                    color = color.copy(alpha = 0.35f),
                    radius = r,
                    center = Offset(cx, cy)
                )
                // Border ring.
                drawCircle(
                    color = color,
                    radius = r,
                    center = Offset(cx, cy),
                    style = Stroke(width = 4.dp.toPx())
                )

                // Draw player label in the centre.
                val label = playerNames.getOrElse(circle.playerIndex) { "?" }
                drawContext.canvas.nativeCanvas.drawText(
                    label,
                    cx,
                    cy + 6.dp.toPx(), // slight vertical offset for visual centering
                    android.graphics.Paint().apply {
                        textAlign = android.graphics.Paint.Align.CENTER
                        textSize = 14.sp.toPx()
                        this.color = android.graphics.Color.WHITE
                        isFakeBoldText = true
                        isAntiAlias = true
                    }
                )
            }
        }

        // ---- Player status bar at the top ----
        Row(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .padding(top = 16.dp, start = 8.dp, end = 8.dp)
        ) {
            for (i in 0 until playerCount) {
                val eliminated = state.eliminatedPlayers.contains(i)
                val color = playerColors.getOrElse(i) { Color.Gray }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(horizontal = 8.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(14.dp)
                            .background(
                                color = if (eliminated) Color.DarkGray else color,
                                shape = CircleShape
                            )
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "P${i + 1}",
                        color = if (eliminated) Color.Gray else Color.White,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        textDecoration = if (eliminated) TextDecoration.LineThrough else TextDecoration.None
                    )
                }
            }
        }

        // ---- Countdown overlay ----
        if (state.phase == GamePhase.Countdown) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.7f)),
                contentAlignment = Alignment.Center
            ) {
                val displayText = if (state.countdownValue > 0) {
                    "${state.countdownValue}"
                } else {
                    "GO!"
                }

                val pulse = rememberInfiniteTransition(label = "countdown_pulse")
                val scale by pulse.animateFloat(
                    initialValue = 0.9f,
                    targetValue = 1.1f,
                    animationSpec = infiniteRepeatable(
                        animation = tween(durationMillis = 500),
                        repeatMode = RepeatMode.Reverse
                    ),
                    label = "countdown_scale"
                )

                Text(
                    text = displayText,
                    color = if (state.countdownValue == 0) Color(0xFF00E676) else Color.White,
                    fontSize = (96 * scale).sp,
                    fontWeight = FontWeight.ExtraBold,
                    textAlign = TextAlign.Center
                )
            }
        }

        // ---- Eliminated flash overlay ----
        val justEliminated = state.eliminatedPlayers
        if (state.phase == GamePhase.Playing && justEliminated.isNotEmpty()) {
            Column(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 32.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                for (idx in justEliminated.sorted()) {
                    AnimatedVisibility(
                        visible = true,
                        enter = fadeIn() + scaleIn(),
                        exit = fadeOut()
                    ) {
                        Text(
                            text = "Player ${idx + 1} eliminated!",
                            color = playerColors.getOrElse(idx) { Color.Gray },
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(vertical = 2.dp)
                        )
                    }
                }
            }
        }

        // ---- Game Over overlay ----
        if (state.phase == GamePhase.GameOver) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
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
                        text = "\uD83C\uDFC6", // trophy emoji
                        fontSize = 64.sp
                    )
                }
            }
        }
    }
}
