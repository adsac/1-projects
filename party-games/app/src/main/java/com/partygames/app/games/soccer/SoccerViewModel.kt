package com.partygames.app.games.soccer

import androidx.lifecycle.ViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

// ----- Constants -----

const val PITCH_LEFT = 0.1f
const val PITCH_RIGHT = 0.9f
const val PITCH_TOP = 0.15f
const val PITCH_BOTTOM = 0.85f

const val PITCH_WIDTH = PITCH_RIGHT - PITCH_LEFT   // 0.8
const val PITCH_HEIGHT = PITCH_BOTTOM - PITCH_TOP   // 0.7

const val GOAL_WIDTH_FRACTION = 0.3f  // fraction of pitch width
val GOAL_HALF_WIDTH = (PITCH_WIDTH * GOAL_WIDTH_FRACTION) / 2f
val GOAL_CENTER_X = (PITCH_LEFT + PITCH_RIGHT) / 2f  // 0.5

val GOAL_LEFT = GOAL_CENTER_X - GOAL_HALF_WIDTH
val GOAL_RIGHT = GOAL_CENTER_X + GOAL_HALF_WIDTH

const val PLAYER_RADIUS = 0.04f
const val BALL_RADIUS = 0.025f

const val DASH_IMPULSE = 0.45f
const val ROTATION_SPEED = 2.0f  // radians per second
const val FRICTION = 0.98f
const val MAX_SPEED = 1.2f

const val WINNING_SCORE = 3

const val BALL_PLAYER_RESTITUTION = 1.1f  // slightly bouncy collisions
const val BALL_WALL_RESTITUTION = 0.85f

const val GOAL_DEPTH = 0.04f  // how far beyond the pitch line the ball must go

// ----- Data classes -----

data class PlayerState(
    val x: Float,
    val y: Float,
    val vx: Float = 0f,
    val vy: Float = 0f,
    val facingAngle: Float = 0f,
    val score: Int = 0
)

data class BallState(
    val x: Float,
    val y: Float,
    val vx: Float = 0f,
    val vy: Float = 0f
)

enum class SoccerPhase {
    Countdown,
    Playing,
    GoalScored,
    GameOver
}

data class SoccerGameState(
    val players: List<PlayerState>,
    val ball: BallState,
    val phase: SoccerPhase,
    val countdownValue: Int,
    val goalScoredByPlayer: Int,   // 0 or 1; which player scored the latest goal
    val winnerIndex: Int
)

// ----- ViewModel -----

class SoccerViewModel : ViewModel() {

    private var players = mutableListOf<PlayerState>()
    private var ball = BallState(0.5f, 0.5f)
    private var phase = SoccerPhase.Countdown
    private var countdownValue = 3
    private var goalScoredByPlayer = -1
    private var winnerIndex = -1
    private var goalCelebrationTimer = 0f

    private val _state = MutableStateFlow(buildState())
    val state: StateFlow<SoccerGameState> = _state.asStateFlow()

    fun initialize(playerCount: Int) {
        // playerCount is accepted for API compatibility but this game is always 2-player
        resetPositions()
        players[0] = players[0].copy(score = 0)
        players[1] = players[1].copy(score = 0)
        phase = SoccerPhase.Countdown
        countdownValue = 3
        goalScoredByPlayer = -1
        winnerIndex = -1
        goalCelebrationTimer = 0f
        emitState()
    }

    fun dash(playerIndex: Int) {
        if (phase != SoccerPhase.Playing) return
        if (playerIndex !in players.indices) return

        val player = players[playerIndex]
        val dvx = cos(player.facingAngle) * DASH_IMPULSE
        val dvy = sin(player.facingAngle) * DASH_IMPULSE
        val newVx = (player.vx + dvx).coerceIn(-MAX_SPEED, MAX_SPEED)
        val newVy = (player.vy + dvy).coerceIn(-MAX_SPEED, MAX_SPEED)
        players[playerIndex] = player.copy(vx = newVx, vy = newVy)
        emitState()
    }

    fun countdownTick() {
        if (phase != SoccerPhase.Countdown) return
        countdownValue--
        if (countdownValue <= 0) {
            phase = SoccerPhase.Playing
        }
        emitState()
    }

    fun update(deltaTime: Float) {
        when (phase) {
            SoccerPhase.Playing -> {
                updatePlaying(deltaTime)
            }
            SoccerPhase.GoalScored -> {
                goalCelebrationTimer -= deltaTime
                if (goalCelebrationTimer <= 0f) {
                    // Check for game over
                    val scorer = players[goalScoredByPlayer]
                    if (scorer.score >= WINNING_SCORE) {
                        phase = SoccerPhase.GameOver
                        winnerIndex = goalScoredByPlayer
                    } else {
                        // Reset for next round
                        val scores = listOf(players[0].score, players[1].score)
                        resetPositions()
                        players[0] = players[0].copy(score = scores[0])
                        players[1] = players[1].copy(score = scores[1])
                        phase = SoccerPhase.Playing
                    }
                }
                emitState()
            }
            else -> { /* Countdown and GameOver: no physics update */ }
        }
    }

    // ----- Private helpers -----

    private fun updatePlaying(dt: Float) {
        // 1. Auto-rotate players
        for (i in players.indices) {
            val p = players[i]
            players[i] = p.copy(facingAngle = p.facingAngle + ROTATION_SPEED * dt)
        }

        // 2. Apply velocity to players
        for (i in players.indices) {
            val p = players[i]
            var nx = p.x + p.vx * dt
            var ny = p.y + p.vy * dt
            var nvx = p.vx * FRICTION
            var nvy = p.vy * FRICTION

            // Clamp players to pitch bounds
            if (nx - PLAYER_RADIUS < PITCH_LEFT) {
                nx = PITCH_LEFT + PLAYER_RADIUS
                nvx = -nvx * 0.5f
            }
            if (nx + PLAYER_RADIUS > PITCH_RIGHT) {
                nx = PITCH_RIGHT - PLAYER_RADIUS
                nvx = -nvx * 0.5f
            }
            if (ny - PLAYER_RADIUS < PITCH_TOP) {
                ny = PITCH_TOP + PLAYER_RADIUS
                nvy = -nvy * 0.5f
            }
            if (ny + PLAYER_RADIUS > PITCH_BOTTOM) {
                ny = PITCH_BOTTOM - PLAYER_RADIUS
                nvy = -nvy * 0.5f
            }

            // Dampen tiny velocities
            if (kotlin.math.abs(nvx) < 0.001f) nvx = 0f
            if (kotlin.math.abs(nvy) < 0.001f) nvy = 0f

            players[i] = p.copy(x = nx, y = ny, vx = nvx, vy = nvy)
        }

        // 3. Apply velocity to ball
        var bx = ball.x + ball.vx * dt
        var by = ball.y + ball.vy * dt
        var bvx = ball.vx * FRICTION
        var bvy = ball.vy * FRICTION

        // 4. Ball-wall collisions (side walls only; top/bottom have goals)
        if (bx - BALL_RADIUS < PITCH_LEFT) {
            bx = PITCH_LEFT + BALL_RADIUS
            bvx = -bvx * BALL_WALL_RESTITUTION
        }
        if (bx + BALL_RADIUS > PITCH_RIGHT) {
            bx = PITCH_RIGHT - BALL_RADIUS
            bvx = -bvx * BALL_WALL_RESTITUTION
        }

        // Top wall (except goal opening)
        if (by - BALL_RADIUS < PITCH_TOP) {
            val inGoal = bx in GOAL_LEFT..GOAL_RIGHT
            if (!inGoal) {
                by = PITCH_TOP + BALL_RADIUS
                bvy = -bvy * BALL_WALL_RESTITUTION
            }
        }

        // Bottom wall (except goal opening)
        if (by + BALL_RADIUS > PITCH_BOTTOM) {
            val inGoal = bx in GOAL_LEFT..GOAL_RIGHT
            if (!inGoal) {
                by = PITCH_BOTTOM - BALL_RADIUS
                bvy = -bvy * BALL_WALL_RESTITUTION
            }
        }

        // Dampen tiny ball velocities
        if (kotlin.math.abs(bvx) < 0.001f) bvx = 0f
        if (kotlin.math.abs(bvy) < 0.001f) bvy = 0f

        ball = ball.copy(x = bx, y = by, vx = bvx, vy = bvy)

        // 5. Ball-player collisions (billiard-style elastic collision)
        for (i in players.indices) {
            val p = players[i]
            val dx = ball.x - p.x
            val dy = ball.y - p.y
            val dist = sqrt(dx * dx + dy * dy)
            val minDist = BALL_RADIUS + PLAYER_RADIUS

            if (dist < minDist && dist > 0.0001f) {
                // Normalize collision normal
                val nx = dx / dist
                val ny = dy / dist

                // Relative velocity of ball w.r.t. player
                val dvx = ball.vx - p.vx
                val dvy = ball.vy - p.vy

                // Relative velocity along collision normal
                val relVelNormal = dvx * nx + dvy * ny

                // Only resolve if objects are moving toward each other
                if (relVelNormal < 0) {
                    // Apply impulse to ball (player is much heavier, so ball gets most of the impulse)
                    val impulse = -(1f + BALL_PLAYER_RESTITUTION) * relVelNormal

                    val newBvx = (ball.vx + impulse * nx).coerceIn(-MAX_SPEED, MAX_SPEED)
                    val newBvy = (ball.vy + impulse * ny).coerceIn(-MAX_SPEED, MAX_SPEED)
                    ball = ball.copy(vx = newBvx, vy = newBvy)

                    // Small pushback on player too
                    val playerPush = 0.15f
                    players[i] = p.copy(
                        vx = (p.vx - impulse * nx * playerPush).coerceIn(-MAX_SPEED, MAX_SPEED),
                        vy = (p.vy - impulse * ny * playerPush).coerceIn(-MAX_SPEED, MAX_SPEED)
                    )
                }

                // Separate ball from player to prevent overlap
                val overlap = minDist - dist
                ball = ball.copy(
                    x = ball.x + nx * overlap * 0.7f,
                    y = ball.y + ny * overlap * 0.7f
                )
                players[i] = players[i].copy(
                    x = players[i].x - nx * overlap * 0.3f,
                    y = players[i].y - ny * overlap * 0.3f
                )
            }
        }

        // 6. Player-player collision (push apart)
        if (players.size == 2) {
            val p0 = players[0]
            val p1 = players[1]
            val dx = p1.x - p0.x
            val dy = p1.y - p0.y
            val dist = sqrt(dx * dx + dy * dy)
            val minDist = PLAYER_RADIUS * 2f

            if (dist < minDist && dist > 0.0001f) {
                val nx = dx / dist
                val ny = dy / dist
                val overlap = minDist - dist

                // Push both apart equally
                players[0] = p0.copy(
                    x = p0.x - nx * overlap * 0.5f,
                    y = p0.y - ny * overlap * 0.5f
                )
                players[1] = p1.copy(
                    x = p1.x + nx * overlap * 0.5f,
                    y = p1.y + ny * overlap * 0.5f
                )

                // Exchange some velocity along collision normal
                val relVel = (p1.vx - p0.vx) * nx + (p1.vy - p0.vy) * ny
                if (relVel < 0) {
                    val impulse = -relVel * 0.5f
                    players[0] = players[0].copy(
                        vx = players[0].vx - impulse * nx,
                        vy = players[0].vy - impulse * ny
                    )
                    players[1] = players[1].copy(
                        vx = players[1].vx + impulse * nx,
                        vy = players[1].vy + impulse * ny
                    )
                }
            }
        }

        // 7. Goal detection
        // Top goal: ball crosses PITCH_TOP going up => Player 1 scores (P1 attacks top)
        if (ball.y - BALL_RADIUS < PITCH_TOP - GOAL_DEPTH &&
            ball.x in GOAL_LEFT..GOAL_RIGHT
        ) {
            onGoalScored(0)  // Player 1 scores
            return
        }

        // Bottom goal: ball crosses PITCH_BOTTOM going down => Player 2 scores (P2 attacks bottom)
        if (ball.y + BALL_RADIUS > PITCH_BOTTOM + GOAL_DEPTH &&
            ball.x in GOAL_LEFT..GOAL_RIGHT
        ) {
            onGoalScored(1)  // Player 2 scores
            return
        }

        emitState()
    }

    private fun onGoalScored(scoringPlayerIndex: Int) {
        players[scoringPlayerIndex] = players[scoringPlayerIndex].copy(
            score = players[scoringPlayerIndex].score + 1
        )
        goalScoredByPlayer = scoringPlayerIndex
        phase = SoccerPhase.GoalScored
        goalCelebrationTimer = 1.5f  // 1.5 second celebration
        emitState()
    }

    private fun resetPositions() {
        val pitchCenterX = (PITCH_LEFT + PITCH_RIGHT) / 2f
        val pitchCenterY = (PITCH_TOP + PITCH_BOTTOM) / 2f

        // Player 1 starts in bottom half (defends bottom goal), faces up
        val p1 = PlayerState(
            x = pitchCenterX,
            y = pitchCenterY + PITCH_HEIGHT * 0.2f,
            vx = 0f,
            vy = 0f,
            facingAngle = -Math.PI.toFloat() / 2f,  // facing up
            score = if (players.size > 0) players[0].score else 0
        )

        // Player 2 starts in top half (defends top goal), faces down
        val p2 = PlayerState(
            x = pitchCenterX,
            y = pitchCenterY - PITCH_HEIGHT * 0.2f,
            vx = 0f,
            vy = 0f,
            facingAngle = Math.PI.toFloat() / 2f,  // facing down
            score = if (players.size > 1) players[1].score else 0
        )

        players.clear()
        players.add(p1)
        players.add(p2)

        ball = BallState(
            x = pitchCenterX,
            y = pitchCenterY,
            vx = 0f,
            vy = 0f
        )
    }

    private fun buildState(): SoccerGameState {
        return SoccerGameState(
            players = players.toList(),
            ball = ball.copy(),
            phase = phase,
            countdownValue = countdownValue,
            goalScoredByPlayer = goalScoredByPlayer,
            winnerIndex = winnerIndex
        )
    }

    private fun emitState() {
        _state.value = buildState()
    }
}
