package com.partygames.app.games.miniracers

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.partygames.app.ui.theme.Player1Color
import com.partygames.app.ui.theme.Player2Color
import com.partygames.app.ui.theme.Player3Color
import com.partygames.app.ui.theme.Player4Color
import androidx.compose.animation.core.withFrameMillis
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin

// ---------------------------------------------------------------------------
// Player colors
// ---------------------------------------------------------------------------

val playerColors = listOf(Player1Color, Player2Color, Player3Color, Player4Color)

private val playerColorNames = listOf("Pink", "Blue", "Green", "Yellow")

// ---------------------------------------------------------------------------
// Main composable
// ---------------------------------------------------------------------------

@Composable
fun MiniRacersScreen(
    playerCount: Int,
    onGameEnd: (winnerIndex: Int) -> Unit,
    viewModel: MiniRacersViewModel = viewModel()
) {
    val state by viewModel.state.collectAsState()
    val textMeasurer = rememberTextMeasurer()

    // --- Initialise once ---
    LaunchedEffect(playerCount) {
        viewModel.initialize(playerCount)
    }

    // --- Countdown ---
    LaunchedEffect(state.phase) {
        if (state.phase == RacePhase.Countdown) {
            delay(600L) // brief pause before countdown starts
            for (tick in 3 downTo 1) {
                viewModel.tickCountdown()
                delay(1_000L)
            }
            // Show "GO!" briefly then start racing
            viewModel.startRacing()
        }
    }

    // --- Game loop ---
    LaunchedEffect(state.phase) {
        if (state.phase != RacePhase.Racing) return@LaunchedEffect
        var lastFrameTime = withFrameMillis { it }
        while (isActive) {
            lastFrameTime = withFrameMillis { frameTime ->
                val dt = ((frameTime - lastFrameTime) / 1000f).coerceIn(0f, 0.05f)
                viewModel.update(dt)
                frameTime
            }
        }
    }

    // --- Navigate on finish ---
    LaunchedEffect(state.phase, state.winnerIndex) {
        if (state.phase == RacePhase.Finished && state.winnerIndex >= 0) {
            delay(1_500L) // let the player see the result briefly
            onGameEnd(state.winnerIndex)
        }
    }

    // --- UI ---
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF1A1A2E))
    ) {
        // Track canvas (takes remaining space above buttons)
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
        ) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                val canvasW = size.width
                val canvasH = size.height

                // Ellipse parameters – leave margin for cars
                val cx = canvasW / 2f
                val cy = canvasH / 2f
                val rx = canvasW * 0.40f
                val ry = canvasH * 0.38f
                val trackWidth = 60f

                // --- Draw track surface (dark gray road) ---
                drawOvalTrack(cx, cy, rx, ry, trackWidth)

                // --- Draw dashed centre line ---
                drawDashedCentreLine(cx, cy, rx, ry)

                // --- Draw start/finish line ---
                val startPt = trackPoint(0f, cx, cy, rx, ry)
                drawLine(
                    color = Color.White,
                    start = Offset(startPt.first, startPt.second - trackWidth / 2f - 4f),
                    end = Offset(startPt.first, startPt.second + trackWidth / 2f + 4f),
                    strokeWidth = 4f
                )

                // --- Draw cars ---
                val cars = state.cars
                for (i in cars.indices) {
                    val car = cars[i]
                    val laneOffset = laneOffsetForPlayer(i, state.playerCount, trackWidth)
                    drawCar(
                        car = car,
                        color = playerColors[i],
                        cx = cx, cy = cy, rx = rx, ry = ry,
                        laneOffset = laneOffset
                    )
                }

                // --- Lap counters in top-left corner ---
                for (i in cars.indices) {
                    val lapText = "P${i + 1}: LAP ${cars[i].lapCount.coerceAtMost(LAPS_TO_WIN)}/$LAPS_TO_WIN"
                    val style = TextStyle(
                        color = playerColors[i],
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold
                    )
                    val result = textMeasurer.measure(lapText, style)
                    drawText(
                        textLayoutResult = result,
                        topLeft = Offset(16f, 16f + i * 28f)
                    )
                }

                // --- Rankings on right side ---
                for ((rank, playerIdx) in state.rankings.withIndex()) {
                    val rankText = "#${rank + 1} P${playerIdx + 1}"
                    val style = TextStyle(
                        color = playerColors[playerIdx],
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium
                    )
                    val result = textMeasurer.measure(rankText, style)
                    drawText(
                        textLayoutResult = result,
                        topLeft = Offset(canvasW - result.size.width - 16f, 16f + rank * 24f)
                    )
                }

                // --- Countdown / finish overlay ---
                when (state.phase) {
                    RacePhase.Countdown -> {
                        val text = if (state.countdownValue > 0) "${state.countdownValue}" else "GO!"
                        val style = TextStyle(
                            color = Color.White,
                            fontSize = 72.sp,
                            fontWeight = FontWeight.ExtraBold
                        )
                        val result = textMeasurer.measure(text, style)
                        drawText(
                            textLayoutResult = result,
                            topLeft = Offset(
                                cx - result.size.width / 2f,
                                cy - result.size.height / 2f
                            )
                        )
                    }
                    RacePhase.Finished -> {
                        val winner = state.winnerIndex
                        val text = "P${winner + 1} WINS!"
                        val style = TextStyle(
                            color = playerColors[winner],
                            fontSize = 56.sp,
                            fontWeight = FontWeight.ExtraBold
                        )
                        val result = textMeasurer.measure(text, style)
                        // Semi-transparent backdrop
                        drawRoundRect(
                            color = Color.Black.copy(alpha = 0.6f),
                            topLeft = Offset(
                                cx - result.size.width / 2f - 24f,
                                cy - result.size.height / 2f - 12f
                            ),
                            size = Size(
                                result.size.width + 48f,
                                result.size.height + 24f
                            ),
                            cornerRadius = CornerRadius(16f, 16f)
                        )
                        drawText(
                            textLayoutResult = result,
                            topLeft = Offset(
                                cx - result.size.width / 2f,
                                cy - result.size.height / 2f
                            )
                        )
                    }
                    else -> { /* racing – nothing extra */ }
                }
            }
        }

        // --- Player acceleration buttons ---
        Spacer(modifier = Modifier.height(4.dp))
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            for (i in 0 until playerCount) {
                AccelerateButton(
                    playerIndex = i,
                    color = playerColors[i],
                    enabled = state.phase == RacePhase.Racing,
                    isAccelerating = state.cars.getOrNull(i)?.isAccelerating == true,
                    onAcceleratingChanged = { accelerating ->
                        viewModel.setAccelerating(i, accelerating)
                    },
                    modifier = Modifier.weight(1f)
                )
            }
        }
        Spacer(modifier = Modifier.height(4.dp))
    }
}

// ---------------------------------------------------------------------------
// Accelerate button with press/release detection
// ---------------------------------------------------------------------------

@Composable
private fun AccelerateButton(
    playerIndex: Int,
    color: Color,
    enabled: Boolean,
    isAccelerating: Boolean,
    onAcceleratingChanged: (Boolean) -> Unit,
    modifier: Modifier = Modifier
) {
    val bgColor = if (isAccelerating) color else color.copy(alpha = 0.5f)
    val label = "P${playerIndex + 1}"

    Box(
        modifier = modifier
            .height(80.dp)
            .background(bgColor, RoundedCornerShape(12.dp))
            .pointerInput(enabled) {
                if (!enabled) return@pointerInput
                awaitEachGesture {
                    // Wait for finger down
                    awaitFirstDown(requireUnconsumed = false)
                    onAcceleratingChanged(true)
                    // Wait until all pointers are up (finger lifted)
                    do {
                        val event = awaitPointerEvent()
                        val allUp = event.changes.all { !it.pressed }
                    } while (!allUp)
                    onAcceleratingChanged(false)
                }
            },
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = label,
                color = Color.White,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 20.sp
            )
            Text(
                text = if (isAccelerating) "HOLD" else "GAS",
                color = Color.White.copy(alpha = 0.8f),
                fontWeight = FontWeight.Medium,
                fontSize = 12.sp
            )
        }
    }
}

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------

/**
 * Returns the lane offset (in pixels, perpendicular to the track) for
 * player [index] out of [total] players. Players are spread evenly across
 * the track width.
 */
private fun laneOffsetForPlayer(index: Int, total: Int, trackWidth: Float): Float {
    if (total <= 1) return 0f
    val usable = trackWidth * 0.7f // use 70% of the width for lanes
    val step = usable / (total - 1).toFloat()
    return -usable / 2f + step * index
}

/**
 * Draw the oval track as a thick grey stroke.
 */
private fun DrawScope.drawOvalTrack(
    cx: Float, cy: Float,
    rx: Float, ry: Float,
    trackWidth: Float
) {
    // Outer edge
    drawOval(
        color = Color(0xFF3A3A4E),
        topLeft = Offset(cx - rx - trackWidth / 2f, cy - ry - trackWidth / 2f),
        size = Size((rx + trackWidth / 2f) * 2f, (ry + trackWidth / 2f) * 2f),
        style = Fill
    )
    // Cut out inner part to create a ring
    drawOval(
        color = Color(0xFF1A1A2E),
        topLeft = Offset(cx - rx + trackWidth / 2f, cy - ry + trackWidth / 2f),
        size = Size((rx - trackWidth / 2f) * 2f, (ry - trackWidth / 2f) * 2f),
        style = Fill
    )

    // Outer and inner border lines
    drawOval(
        color = Color(0xFF5A5A6E),
        topLeft = Offset(cx - rx - trackWidth / 2f, cy - ry - trackWidth / 2f),
        size = Size((rx + trackWidth / 2f) * 2f, (ry + trackWidth / 2f) * 2f),
        style = Stroke(width = 2f)
    )
    drawOval(
        color = Color(0xFF5A5A6E),
        topLeft = Offset(cx - rx + trackWidth / 2f, cy - ry + trackWidth / 2f),
        size = Size((rx - trackWidth / 2f) * 2f, (ry - trackWidth / 2f) * 2f),
        style = Stroke(width = 2f)
    )
}

/**
 * Draw a dashed white centre line along the oval.
 */
private fun DrawScope.drawDashedCentreLine(
    cx: Float, cy: Float,
    rx: Float, ry: Float
) {
    val path = Path()
    val steps = 120
    for (i in 0..steps) {
        val t = i.toFloat() / steps
        val (px, py) = trackPoint(t, cx, cy, rx, ry)
        if (i == 0) path.moveTo(px, py) else path.lineTo(px, py)
    }
    drawPath(
        path = path,
        color = Color.White.copy(alpha = 0.5f),
        style = Stroke(
            width = 2f,
            pathEffect = PathEffect.dashPathEffect(floatArrayOf(12f, 10f), 0f)
        )
    )
}

/**
 * Draw a single car as a small coloured rectangle oriented along the track
 * direction.
 */
private fun DrawScope.drawCar(
    car: CarState,
    color: Color,
    cx: Float, cy: Float,
    rx: Float, ry: Float,
    laneOffset: Float
) {
    val t = car.trackPosition
    val (px, py) = trackPoint(t, cx, cy, rx, ry)
    val (nx, ny) = trackNormal(t)

    // Total perpendicular offset = lane + drift
    val totalOffset = laneOffset + car.lateralOffset
    val carX = px + nx * totalOffset
    val carY = py + ny * totalOffset

    // Direction: tangent to the ellipse at this point
    // The tangent for (cos θ, -sin θ) is (-sin θ, -cos θ)
    val angle = t * 2f * Math.PI.toFloat()
    val tx = -sin(angle)
    val ty = -cos(angle)
    val heading = atan2(ty, tx) * (180f / Math.PI.toFloat())

    val carWidth = 20f
    val carHeight = 12f

    rotate(degrees = heading, pivot = Offset(carX, carY)) {
        // Car body
        drawRoundRect(
            color = color,
            topLeft = Offset(carX - carWidth / 2f, carY - carHeight / 2f),
            size = Size(carWidth, carHeight),
            cornerRadius = CornerRadius(3f, 3f)
        )
        // Windshield accent (small darker rectangle at front)
        drawRoundRect(
            color = color.copy(alpha = 0.5f),
            topLeft = Offset(carX + carWidth * 0.1f, carY - carHeight * 0.3f),
            size = Size(carWidth * 0.25f, carHeight * 0.6f),
            cornerRadius = CornerRadius(1f, 1f)
        )
    }

    // Skid marks (small translucent circles behind the car when skidding)
    if (car.isSkidding) {
        val behindX = carX - tx * 14f
        val behindY = carY - ty * 14f
        drawCircle(
            color = Color.Gray.copy(alpha = 0.4f),
            radius = 4f,
            center = Offset(behindX, behindY)
        )
        val behindX2 = carX - tx * 22f
        val behindY2 = carY - ty * 22f
        drawCircle(
            color = Color.Gray.copy(alpha = 0.25f),
            radius = 3f,
            center = Offset(behindX2, behindY2)
        )
    }
}

