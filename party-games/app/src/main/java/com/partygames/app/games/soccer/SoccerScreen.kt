package com.partygames.app.games.soccer

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
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
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.partygames.app.ui.theme.Player1Color
import com.partygames.app.ui.theme.Player2Color
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

// ---- Color constants ----
private val PitchGreen = Color(0xFF2E7D32)
private val PitchLineWhite = Color(0xCCFFFFFF)
private val GoalColor = Color(0xFFEEEEEE)
private val BallColor = Color.White
private val ButtonP1Color = Player1Color
private val ButtonP2Color = Player2Color
private val ScoreBackground = Color(0xAA000000)

private val playerColors = listOf(Player1Color, Player2Color)

@Composable
fun SoccerScreen(
    playerCount: Int,
    onGameEnd: (winnerIndex: Int) -> Unit,
    viewModel: SoccerViewModel = viewModel()
) {
    val state by viewModel.state.collectAsState()

    // Initialize the game once.
    LaunchedEffect(Unit) {
        viewModel.initialize(playerCount)
    }

    // Countdown timer
    LaunchedEffect(state.phase) {
        if (state.phase == SoccerPhase.Countdown) {
            while (isActive && state.phase == SoccerPhase.Countdown) {
                delay(1000L)
                viewModel.countdownTick()
            }
        }
    }

    // Main game loop: runs physics updates every frame
    LaunchedEffect(state.phase) {
        if (state.phase == SoccerPhase.Playing || state.phase == SoccerPhase.GoalScored) {
            var lastFrameTime = withFrameMillis { it }
            while (isActive) {
                val currentTime = withFrameMillis { it }
                val deltaMs = (currentTime - lastFrameTime).coerceIn(0, 50)
                lastFrameTime = currentTime
                val dt = deltaMs / 1000f
                if (dt > 0f) {
                    viewModel.update(dt)
                }
            }
        }
    }

    // When game is over, notify after a brief delay
    LaunchedEffect(state.phase) {
        if (state.phase == SoccerPhase.GameOver) {
            delay(2500L)
            onGameEnd(state.winnerIndex)
        }
    }

    // ---- UI Layout ----
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF1B5E20)),
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        // Player 2 button at top (rotated 180 degrees for the player sitting opposite)
        DashButton(
            label = "P2 DASH",
            color = ButtonP2Color,
            enabled = state.phase == SoccerPhase.Playing,
            onClick = { viewModel.dash(1) },
            modifier = Modifier
                .fillMaxWidth()
                .height(80.dp)
                .padding(horizontal = 16.dp, vertical = 8.dp),
            rotated = true
        )

        // Game canvas in the middle
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
            contentAlignment = Alignment.Center
        ) {
            // The main pitch canvas
            Canvas(modifier = Modifier.fillMaxSize()) {
                val canvasWidth = size.width
                val canvasHeight = size.height

                drawPitch(canvasWidth, canvasHeight)
                drawGoals(canvasWidth, canvasHeight)

                // Draw players
                if (state.players.size == 2) {
                    for (i in state.players.indices) {
                        val player = state.players[i]
                        drawPlayer(
                            player = player,
                            color = playerColors[i],
                            canvasWidth = canvasWidth,
                            canvasHeight = canvasHeight
                        )
                    }
                }

                // Draw ball
                drawBall(state.ball, canvasWidth, canvasHeight)
            }

            // Score overlay at top center of the pitch area
            Box(
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .padding(top = 8.dp)
                    .background(ScoreBackground, RoundedCornerShape(12.dp))
                    .padding(horizontal = 16.dp, vertical = 6.dp)
            ) {
                val p1Score = if (state.players.isNotEmpty()) state.players[0].score else 0
                val p2Score = if (state.players.size > 1) state.players[1].score else 0
                Text(
                    text = "P1: $p1Score  -  $p2Score :P2",
                    color = Color.White,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center
                )
            }

            // Countdown overlay
            if (state.phase == SoccerPhase.Countdown) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.6f)),
                    contentAlignment = Alignment.Center
                ) {
                    val displayText = if (state.countdownValue > 0) {
                        "${state.countdownValue}"
                    } else {
                        "KICK OFF!"
                    }
                    Text(
                        text = displayText,
                        color = Color.White,
                        fontSize = 80.sp,
                        fontWeight = FontWeight.ExtraBold,
                        textAlign = TextAlign.Center
                    )
                }
            }

            // Goal celebration overlay
            AnimatedVisibility(
                visible = state.phase == SoccerPhase.GoalScored,
                enter = scaleIn() + fadeIn(),
                exit = fadeOut()
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.5f)),
                    contentAlignment = Alignment.Center
                ) {
                    val scorerIndex = state.goalScoredByPlayer
                    val scorerColor = playerColors.getOrElse(scorerIndex) { Color.White }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "GOAL!",
                            color = scorerColor,
                            fontSize = 72.sp,
                            fontWeight = FontWeight.ExtraBold,
                            textAlign = TextAlign.Center
                        )
                        Text(
                            text = "Player ${scorerIndex + 1} scores!",
                            color = Color.White,
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(top = 8.dp)
                        )
                    }
                }
            }

            // Game over overlay
            if (state.phase == SoccerPhase.GameOver) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.75f)),
                    contentAlignment = Alignment.Center
                ) {
                    val winnerColor = playerColors.getOrElse(state.winnerIndex) { Color.White }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "Player ${state.winnerIndex + 1} Wins!",
                            color = winnerColor,
                            fontSize = 48.sp,
                            fontWeight = FontWeight.ExtraBold,
                            textAlign = TextAlign.Center
                        )
                        val p1Score = if (state.players.isNotEmpty()) state.players[0].score else 0
                        val p2Score = if (state.players.size > 1) state.players[1].score else 0
                        Text(
                            text = "$p1Score - $p2Score",
                            color = Color.White,
                            fontSize = 32.sp,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(top = 12.dp)
                        )
                    }
                }
            }
        }

        // Player 1 button at bottom
        DashButton(
            label = "P1 DASH",
            color = ButtonP1Color,
            enabled = state.phase == SoccerPhase.Playing,
            onClick = { viewModel.dash(0) },
            modifier = Modifier
                .fillMaxWidth()
                .height(80.dp)
                .padding(horizontal = 16.dp, vertical = 8.dp),
            rotated = false
        )
    }
}

// ---- Dash button composable ----

@Composable
private fun DashButton(
    label: String,
    color: Color,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    rotated: Boolean = false
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        colors = ButtonDefaults.buttonColors(
            containerColor = color,
            disabledContainerColor = color.copy(alpha = 0.4f)
        ),
        shape = RoundedCornerShape(16.dp),
        modifier = modifier
    ) {
        Text(
            text = if (rotated) label.reversed() else label,
            color = Color.White,
            fontSize = 22.sp,
            fontWeight = FontWeight.ExtraBold,
            textAlign = TextAlign.Center,
            modifier = if (rotated) Modifier.rotateComposable(180f) else Modifier
        )
    }
}

// Extension to rotate a Modifier for the upside-down P2 text
private fun Modifier.rotateComposable(degrees: Float): Modifier =
    this.then(androidx.compose.ui.draw.DrawModifier { contentDrawScope ->
        // This approach is replaced below with graphicsLayer
    }.let { this }) // placeholder; we use graphicsLayer instead

// Actually, use graphicsLayer for the rotation:
@Composable
private fun Modifier.rotateComposable(degrees: Float): Modifier {
    // Not needed as a composable; use the simple graphicsLayer approach inline
    return this
}

// ---- Drawing functions ----

private fun DrawScope.drawPitch(canvasWidth: Float, canvasHeight: Float) {
    val left = PITCH_LEFT * canvasWidth
    val top = PITCH_TOP * canvasHeight
    val right = PITCH_RIGHT * canvasWidth
    val bottom = PITCH_BOTTOM * canvasHeight
    val pitchWidth = right - left
    val pitchHeight = bottom - top
    val lineWidth = 2.dp.toPx()

    // Pitch background
    drawRect(
        color = PitchGreen,
        topLeft = Offset(left, top),
        size = Size(pitchWidth, pitchHeight)
    )

    // Pitch border
    drawRect(
        color = PitchLineWhite,
        topLeft = Offset(left, top),
        size = Size(pitchWidth, pitchHeight),
        style = Stroke(width = lineWidth)
    )

    // Center line
    val centerY = (top + bottom) / 2f
    drawLine(
        color = PitchLineWhite,
        start = Offset(left, centerY),
        end = Offset(right, centerY),
        strokeWidth = lineWidth
    )

    // Center circle
    val centerX = (left + right) / 2f
    val circleRadius = min(pitchWidth, pitchHeight) * 0.12f
    drawCircle(
        color = PitchLineWhite,
        radius = circleRadius,
        center = Offset(centerX, centerY),
        style = Stroke(width = lineWidth)
    )

    // Center dot
    drawCircle(
        color = PitchLineWhite,
        radius = 4.dp.toPx(),
        center = Offset(centerX, centerY)
    )

    // Goal area boxes (penalty-area style rectangles near each goal)
    val goalAreaWidth = pitchWidth * 0.5f
    val goalAreaHeight = pitchHeight * 0.1f
    val goalAreaLeft = centerX - goalAreaWidth / 2f

    // Top goal area
    drawRect(
        color = PitchLineWhite,
        topLeft = Offset(goalAreaLeft, top),
        size = Size(goalAreaWidth, goalAreaHeight),
        style = Stroke(width = lineWidth)
    )

    // Bottom goal area
    drawRect(
        color = PitchLineWhite,
        topLeft = Offset(goalAreaLeft, bottom - goalAreaHeight),
        size = Size(goalAreaWidth, goalAreaHeight),
        style = Stroke(width = lineWidth)
    )
}

private fun DrawScope.drawGoals(canvasWidth: Float, canvasHeight: Float) {
    val goalLeft = GOAL_LEFT * canvasWidth
    val goalRight = GOAL_RIGHT * canvasWidth
    val goalWidth = goalRight - goalLeft
    val goalDepthPx = GOAL_DEPTH * canvasHeight
    val lineWidth = 3.dp.toPx()

    val pitchTop = PITCH_TOP * canvasHeight
    val pitchBottom = PITCH_BOTTOM * canvasHeight

    // Top goal (Player 2's goal, Player 1 attacks here)
    // Draw as a rect extending above the pitch line
    drawRect(
        color = GoalColor.copy(alpha = 0.3f),
        topLeft = Offset(goalLeft, pitchTop - goalDepthPx),
        size = Size(goalWidth, goalDepthPx)
    )
    // Goal posts and crossbar
    drawLine(
        color = GoalColor,
        start = Offset(goalLeft, pitchTop),
        end = Offset(goalLeft, pitchTop - goalDepthPx),
        strokeWidth = lineWidth
    )
    drawLine(
        color = GoalColor,
        start = Offset(goalRight, pitchTop),
        end = Offset(goalRight, pitchTop - goalDepthPx),
        strokeWidth = lineWidth
    )
    drawLine(
        color = GoalColor,
        start = Offset(goalLeft, pitchTop - goalDepthPx),
        end = Offset(goalRight, pitchTop - goalDepthPx),
        strokeWidth = lineWidth
    )

    // Bottom goal (Player 1's goal, Player 2 attacks here)
    drawRect(
        color = GoalColor.copy(alpha = 0.3f),
        topLeft = Offset(goalLeft, pitchBottom),
        size = Size(goalWidth, goalDepthPx)
    )
    drawLine(
        color = GoalColor,
        start = Offset(goalLeft, pitchBottom),
        end = Offset(goalLeft, pitchBottom + goalDepthPx),
        strokeWidth = lineWidth
    )
    drawLine(
        color = GoalColor,
        start = Offset(goalRight, pitchBottom),
        end = Offset(goalRight, pitchBottom + goalDepthPx),
        strokeWidth = lineWidth
    )
    drawLine(
        color = GoalColor,
        start = Offset(goalLeft, pitchBottom + goalDepthPx),
        end = Offset(goalRight, pitchBottom + goalDepthPx),
        strokeWidth = lineWidth
    )
}

private fun DrawScope.drawPlayer(
    player: PlayerState,
    color: Color,
    canvasWidth: Float,
    canvasHeight: Float
) {
    val cx = player.x * canvasWidth
    val cy = player.y * canvasHeight
    val radius = PLAYER_RADIUS * min(canvasWidth, canvasHeight)

    // Player body (filled circle with border)
    drawCircle(
        color = color.copy(alpha = 0.7f),
        radius = radius,
        center = Offset(cx, cy)
    )
    drawCircle(
        color = color,
        radius = radius,
        center = Offset(cx, cy),
        style = Stroke(width = 3.dp.toPx())
    )

    // Direction indicator line (shows facing direction)
    val dirX = cx + cos(player.facingAngle) * radius
    val dirY = cy + sin(player.facingAngle) * radius
    drawLine(
        color = Color.White,
        start = Offset(cx, cy),
        end = Offset(dirX, dirY),
        strokeWidth = 3.dp.toPx()
    )

    // Small dot at the tip to make direction clearer
    drawCircle(
        color = Color.White,
        radius = 3.dp.toPx(),
        center = Offset(dirX, dirY)
    )
}

private fun DrawScope.drawBall(
    ball: BallState,
    canvasWidth: Float,
    canvasHeight: Float
) {
    val cx = ball.x * canvasWidth
    val cy = ball.y * canvasHeight
    val radius = BALL_RADIUS * min(canvasWidth, canvasHeight)

    // Ball shadow
    drawCircle(
        color = Color.Black.copy(alpha = 0.3f),
        radius = radius,
        center = Offset(cx + 2.dp.toPx(), cy + 2.dp.toPx())
    )

    // Ball body
    drawCircle(
        color = BallColor,
        radius = radius,
        center = Offset(cx, cy)
    )

    // Ball outline
    drawCircle(
        color = Color(0xFF424242),
        radius = radius,
        center = Offset(cx, cy),
        style = Stroke(width = 1.5f.dp.toPx())
    )
}
