package com.partygames.app.games.pongroyale

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.partygames.app.games.pongroyale.PongRoyaleViewModel.Companion.BALL_RADIUS
import com.partygames.app.games.pongroyale.PongRoyaleViewModel.Companion.PADDLE_HALF_WIDTH
import com.partygames.app.ui.theme.Player1Color
import com.partygames.app.ui.theme.Player2Color
import com.partygames.app.ui.theme.Player3Color
import com.partygames.app.ui.theme.Player4Color
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlin.math.abs
import kotlin.math.min

val playerColors = listOf(Player1Color, Player2Color, Player3Color, Player4Color)

/**
 * Full-screen composable that runs a Pong Royale game for [playerCount] players.
 * Calls [onGameEnd] with the winner's player index when the game concludes.
 */
@Composable
fun PongRoyaleScreen(
    playerCount: Int,
    onGameEnd: (winnerIndex: Int) -> Unit,
    viewModel: PongRoyaleViewModel = viewModel()
) {
    val state by viewModel.state.collectAsState()
    val textMeasurer = rememberTextMeasurer()

    // Start the game once.
    LaunchedEffect(Unit) {
        viewModel.startGame(playerCount)
    }

    // Game loop: advance simulation every frame.
    LaunchedEffect(Unit) {
        var lastFrameTime = withFrameMillis { it }
        while (isActive) {
            val frameTime = withFrameMillis { it }
            val dt = ((frameTime - lastFrameTime).coerceIn(0L, 50L)) / 1000f
            lastFrameTime = frameTime
            viewModel.update(dt)
        }
    }

    // When game ends, notify after a short delay.
    LaunchedEffect(state.phase) {
        if (state.phase == PongPhase.GameOver && state.winnerIndex >= 0) {
            delay(2_000L)
            onGameEnd(state.winnerIndex)
        }
    }

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF121218))
    ) {
        val density = LocalDensity.current
        val boxWidthPx = with(density) { maxWidth.toPx() }
        val boxHeightPx = with(density) { maxHeight.toPx() }

        // Square arena: fit in the centre with some margin.
        val margin = 48f // px margin on each side
        val arenaSize = min(boxWidthPx, boxHeightPx) - margin * 2
        val arenaLeft = (boxWidthPx - arenaSize) / 2f
        val arenaTop = (boxHeightPx - arenaSize) / 2f

        // Touch detection zone: how far from an edge a finger counts as controlling it.
        val edgeZone = arenaSize * 0.35f

        // Multi-touch input.
        val inputModifier = Modifier.pointerInput(state.phase) {
            if (state.phase != PongPhase.Playing) return@pointerInput

            coroutineScope {
                awaitPointerEventScope {
                    while (true) {
                        val event = awaitPointerEvent()
                        for (change in event.changes) {
                            if (!change.pressed) continue
                            val pos = change.position
                            // Convert to arena-relative coordinates.
                            val ax = pos.x - arenaLeft
                            val ay = pos.y - arenaTop

                            // Determine which edge this finger is nearest.
                            val distBottom = arenaSize - ay
                            val distTop = ay
                            val distLeft = ax
                            val distRight = arenaSize - ax

                            // The finger must be reasonably within/near the arena.
                            val inArenaX = ax in -edgeZone..arenaSize + edgeZone
                            val inArenaY = ay in -edgeZone..arenaSize + edgeZone

                            if (!inArenaX || !inArenaY) continue

                            // Find the closest edge.
                            data class EdgeDist(val playerIndex: Int, val dist: Float, val fraction: Float)

                            val candidates = mutableListOf<EdgeDist>()

                            // Bottom (player 0): horizontal, fraction = ax / arenaSize
                            if (state.active[0] && !state.eliminated[0]) {
                                candidates.add(EdgeDist(0, abs(distBottom), ax / arenaSize))
                            }
                            // Top (player 1): horizontal, fraction = ax / arenaSize
                            if (state.active[1] && !state.eliminated[1]) {
                                candidates.add(EdgeDist(1, abs(distTop), ax / arenaSize))
                            }
                            // Left (player 2): vertical, fraction = ay / arenaSize
                            if (state.active[2] && !state.eliminated[2]) {
                                candidates.add(EdgeDist(2, abs(distLeft), ay / arenaSize))
                            }
                            // Right (player 3): vertical, fraction = ay / arenaSize
                            if (state.active[3] && !state.eliminated[3]) {
                                candidates.add(EdgeDist(3, abs(distRight), ay / arenaSize))
                            }

                            val nearest = candidates.minByOrNull { it.dist } ?: continue
                            if (nearest.dist < edgeZone) {
                                viewModel.movePaddle(nearest.playerIndex, nearest.fraction)
                            }

                            change.consume()
                        }
                    }
                }
            }
        }

        Box(
            modifier = Modifier
                .fillMaxSize()
                .then(inputModifier),
            contentAlignment = Alignment.Center
        ) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                val s = state

                // --- Draw arena background ---
                drawRect(
                    color = Color(0xFF1A1A2E),
                    topLeft = Offset(arenaLeft, arenaTop),
                    size = Size(arenaSize, arenaSize)
                )

                // --- Draw arena border / walls ---
                val wallThickness = 3f
                val wallColor = Color(0xFF444466)

                // Bottom edge
                drawEdge(
                    arenaLeft, arenaTop, arenaSize,
                    side = Side.Bottom,
                    isWall = !s.active[0] || s.eliminated[0],
                    wallColor = wallColor,
                    playerColor = playerColors[0],
                    thickness = wallThickness
                )
                // Top edge
                drawEdge(
                    arenaLeft, arenaTop, arenaSize,
                    side = Side.Top,
                    isWall = !s.active[1] || s.eliminated[1],
                    wallColor = wallColor,
                    playerColor = playerColors[1],
                    thickness = wallThickness
                )
                // Left edge
                drawEdge(
                    arenaLeft, arenaTop, arenaSize,
                    side = Side.Left,
                    isWall = !s.active[2] || s.eliminated[2],
                    wallColor = wallColor,
                    playerColor = playerColors[2],
                    thickness = wallThickness
                )
                // Right edge
                drawEdge(
                    arenaLeft, arenaTop, arenaSize,
                    side = Side.Right,
                    isWall = !s.active[3] || s.eliminated[3],
                    wallColor = wallColor,
                    playerColor = playerColors[3],
                    thickness = wallThickness
                )

                // --- Draw paddles ---
                val paddleThicknessPx = arenaSize * 0.02f
                val paddleWidthFraction = PADDLE_HALF_WIDTH * 2f

                for (i in 0 until 4) {
                    if (!s.active[i] || s.eliminated[i]) continue
                    val pos = s.paddlePositions[i]
                    val color = playerColors[i]
                    val paddleLengthPx = arenaSize * paddleWidthFraction

                    when (PongRoyaleViewModel.PLAYER_SIDES[i]) {
                        Side.Bottom -> {
                            val px = arenaLeft + pos * arenaSize - paddleLengthPx / 2f
                            val py = arenaTop + arenaSize - paddleThicknessPx
                            drawRoundRect(
                                color = color,
                                topLeft = Offset(px, py),
                                size = Size(paddleLengthPx, paddleThicknessPx),
                                cornerRadius = androidx.compose.ui.geometry.CornerRadius(paddleThicknessPx / 2f)
                            )
                        }
                        Side.Top -> {
                            val px = arenaLeft + pos * arenaSize - paddleLengthPx / 2f
                            val py = arenaTop
                            drawRoundRect(
                                color = color,
                                topLeft = Offset(px, py),
                                size = Size(paddleLengthPx, paddleThicknessPx),
                                cornerRadius = androidx.compose.ui.geometry.CornerRadius(paddleThicknessPx / 2f)
                            )
                        }
                        Side.Left -> {
                            val px = arenaLeft
                            val py = arenaTop + pos * arenaSize - paddleLengthPx / 2f
                            drawRoundRect(
                                color = color,
                                topLeft = Offset(px, py),
                                size = Size(paddleThicknessPx, paddleLengthPx),
                                cornerRadius = androidx.compose.ui.geometry.CornerRadius(paddleThicknessPx / 2f)
                            )
                        }
                        Side.Right -> {
                            val px = arenaLeft + arenaSize - paddleThicknessPx
                            val py = arenaTop + pos * arenaSize - paddleLengthPx / 2f
                            drawRoundRect(
                                color = color,
                                topLeft = Offset(px, py),
                                size = Size(paddleThicknessPx, paddleLengthPx),
                                cornerRadius = androidx.compose.ui.geometry.CornerRadius(paddleThicknessPx / 2f)
                            )
                        }
                    }
                }

                // --- Draw lives indicators ---
                val lifeDotRadius = arenaSize * 0.012f
                val lifeDotSpacing = lifeDotRadius * 3f
                val lifeDotOffset = arenaSize * 0.05f

                for (i in 0 until 4) {
                    if (!s.active[i]) continue
                    val livesCount = s.lives[i]
                    val color = playerColors[i]

                    for (lifeIdx in 0 until PongRoyaleViewModel.STARTING_LIVES) {
                        val filled = lifeIdx < livesCount
                        val dotColor = if (filled) color else color.copy(alpha = 0.25f)
                        // Centre the dots along each edge.
                        val offsetFromCentre = (lifeIdx - (PongRoyaleViewModel.STARTING_LIVES - 1) / 2f) * lifeDotSpacing

                        val (cx, cy) = when (PongRoyaleViewModel.PLAYER_SIDES[i]) {
                            Side.Bottom -> Pair(
                                arenaLeft + arenaSize / 2f + offsetFromCentre,
                                arenaTop + arenaSize + lifeDotOffset
                            )
                            Side.Top -> Pair(
                                arenaLeft + arenaSize / 2f + offsetFromCentre,
                                arenaTop - lifeDotOffset
                            )
                            Side.Left -> Pair(
                                arenaLeft - lifeDotOffset,
                                arenaTop + arenaSize / 2f + offsetFromCentre
                            )
                            Side.Right -> Pair(
                                arenaLeft + arenaSize + lifeDotOffset,
                                arenaTop + arenaSize / 2f + offsetFromCentre
                            )
                        }

                        drawCircle(
                            color = dotColor,
                            radius = lifeDotRadius,
                            center = Offset(cx, cy)
                        )
                    }
                }

                // --- Draw ball ---
                if (s.phase == PongPhase.Playing || s.phase == PongPhase.GameOver) {
                    val ballPxRadius = arenaSize * BALL_RADIUS
                    val ballCx = arenaLeft + s.ballX * arenaSize
                    val ballCy = arenaTop + s.ballY * arenaSize
                    // Glow effect.
                    drawCircle(
                        color = Color.White.copy(alpha = 0.15f),
                        radius = ballPxRadius * 2.5f,
                        center = Offset(ballCx, ballCy)
                    )
                    drawCircle(
                        color = Color.White,
                        radius = ballPxRadius,
                        center = Offset(ballCx, ballCy)
                    )
                }

                // --- Draw centre line / decoration ---
                drawCircle(
                    color = Color(0xFF333355),
                    radius = arenaSize * 0.08f,
                    center = Offset(arenaLeft + arenaSize / 2f, arenaTop + arenaSize / 2f),
                    style = androidx.compose.ui.graphics.drawscope.Stroke(width = 2f)
                )

                // --- Draw countdown / game over text ---
                if (s.phase == PongPhase.Countdown) {
                    val text = if (s.countdownValue > 0) s.countdownValue.toString() else "GO!"
                    val style = TextStyle(
                        color = Color.White,
                        fontSize = 72.sp,
                        fontWeight = FontWeight.Bold
                    )
                    val textLayout = textMeasurer.measure(text, style)
                    drawText(
                        textLayoutResult = textLayout,
                        topLeft = Offset(
                            arenaLeft + arenaSize / 2f - textLayout.size.width / 2f,
                            arenaTop + arenaSize / 2f - textLayout.size.height / 2f
                        )
                    )
                }

                if (s.phase == PongPhase.GameOver && s.winnerIndex >= 0) {
                    val winnerColor = playerColors[s.winnerIndex]
                    val label = "Player ${s.winnerIndex + 1} Wins!"
                    val style = TextStyle(
                        color = winnerColor,
                        fontSize = 40.sp,
                        fontWeight = FontWeight.Bold
                    )
                    val textLayout = textMeasurer.measure(label, style)
                    drawText(
                        textLayoutResult = textLayout,
                        topLeft = Offset(
                            arenaLeft + arenaSize / 2f - textLayout.size.width / 2f,
                            arenaTop + arenaSize / 2f - textLayout.size.height / 2f
                        )
                    )
                }
            }
        }
    }
}

/**
 * Draw an edge of the arena. If [isWall], draw it as a solid dim line.
 * Otherwise draw a faint player-coloured line to indicate the player's side.
 */
private fun DrawScope.drawEdge(
    arenaLeft: Float,
    arenaTop: Float,
    arenaSize: Float,
    side: Side,
    isWall: Boolean,
    wallColor: Color,
    playerColor: Color,
    thickness: Float
) {
    val color = if (isWall) wallColor else playerColor.copy(alpha = 0.4f)
    when (side) {
        Side.Bottom -> drawLine(
            color = color,
            start = Offset(arenaLeft, arenaTop + arenaSize),
            end = Offset(arenaLeft + arenaSize, arenaTop + arenaSize),
            strokeWidth = thickness
        )
        Side.Top -> drawLine(
            color = color,
            start = Offset(arenaLeft, arenaTop),
            end = Offset(arenaLeft + arenaSize, arenaTop),
            strokeWidth = thickness
        )
        Side.Left -> drawLine(
            color = color,
            start = Offset(arenaLeft, arenaTop),
            end = Offset(arenaLeft, arenaTop + arenaSize),
            strokeWidth = thickness
        )
        Side.Right -> drawLine(
            color = color,
            start = Offset(arenaLeft + arenaSize, arenaTop),
            end = Offset(arenaLeft + arenaSize, arenaTop + arenaSize),
            strokeWidth = thickness
        )
    }
}
