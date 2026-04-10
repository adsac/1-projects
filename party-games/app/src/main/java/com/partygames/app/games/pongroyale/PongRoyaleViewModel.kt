package com.partygames.app.games.pongroyale

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.sqrt
import kotlin.random.Random

/** Phases the game transitions through. */
enum class PongPhase {
    Countdown,
    Playing,
    GameOver
}

/** Which side of the arena a player occupies. */
enum class Side {
    Bottom, // Player 0 – horizontal paddle at y = 1
    Top,    // Player 1 – horizontal paddle at y = 0
    Left,   // Player 2 – vertical paddle at x = 0
    Right   // Player 3 – vertical paddle at x = 1
}

data class PongRoyaleState(
    val phase: PongPhase = PongPhase.Countdown,
    val countdownValue: Int = 3,
    val playerCount: Int = 2,
    /** Ball centre position in 0-1 arena space. */
    val ballX: Float = 0.5f,
    val ballY: Float = 0.5f,
    /** Ball velocity in arena-units per second. */
    val ballVx: Float = 0f,
    val ballVy: Float = 0f,
    /** Paddle positions: fraction 0-1 along the player's edge (centre of paddle). */
    val paddlePositions: List<Float> = listOf(0.5f, 0.5f, 0.5f, 0.5f),
    /** Lives remaining per player slot (0-3). */
    val lives: List<Int> = listOf(3, 3, 3, 3),
    /** Whether each player slot is active in this match. */
    val active: List<Boolean> = listOf(true, true, false, false),
    /** Whether each player has been fully eliminated (0 lives). */
    val eliminated: List<Boolean> = listOf(false, false, false, false),
    /** Index of the winning player, or -1. */
    val winnerIndex: Int = -1
)

class PongRoyaleViewModel : ViewModel() {

    private val _state = MutableStateFlow(PongRoyaleState())
    val state: StateFlow<PongRoyaleState> = _state.asStateFlow()

    companion object {
        /** Half-width of a paddle in 0-1 space. Full paddle width ~0.2. */
        const val PADDLE_HALF_WIDTH = 0.1f

        /** Thickness of a paddle for collision detection in 0-1 space. */
        const val PADDLE_THICKNESS = 0.02f

        /** Ball radius in 0-1 space. */
        const val BALL_RADIUS = 0.015f

        /** Initial ball speed in arena-units per second. */
        const val INITIAL_BALL_SPEED = 0.45f

        /** How much to multiply speed on each paddle bounce. */
        const val SPEED_INCREASE_FACTOR = 1.06f

        /** Maximum ball speed cap. */
        const val MAX_BALL_SPEED = 1.4f

        /** Starting lives per player. */
        const val STARTING_LIVES = 3

        /** Maps player index to their side. */
        val PLAYER_SIDES = listOf(Side.Bottom, Side.Top, Side.Left, Side.Right)

        /**
         * Which player indices are active for a given player count.
         * 2 players -> bottom + top
         * 3 players -> bottom + left + right
         * 4 players -> all four
         */
        fun activePlayersForCount(count: Int): List<Boolean> = when (count) {
            2 -> listOf(true, true, false, false)
            3 -> listOf(true, false, true, true)
            4 -> listOf(true, true, true, true)
            else -> listOf(true, true, false, false)
        }
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /** Call once from the composable to kick off the game. */
    fun startGame(playerCount: Int) {
        val clamped = playerCount.coerceIn(2, 4)
        val activeFlags = activePlayersForCount(clamped)
        _state.value = PongRoyaleState(
            phase = PongPhase.Countdown,
            countdownValue = 3,
            playerCount = clamped,
            ballX = 0.5f,
            ballY = 0.5f,
            ballVx = 0f,
            ballVy = 0f,
            paddlePositions = listOf(0.5f, 0.5f, 0.5f, 0.5f),
            lives = List(4) { if (activeFlags[it]) STARTING_LIVES else 0 },
            active = activeFlags,
            eliminated = listOf(false, false, false, false),
            winnerIndex = -1
        )

        viewModelScope.launch {
            for (tick in 3 downTo 1) {
                _state.value = _state.value.copy(countdownValue = tick)
                delay(1_000L)
            }
            _state.value = _state.value.copy(countdownValue = 0)
            delay(500L)

            // Launch ball toward a random active player's side.
            val launched = launchBallTowardRandomPlayer()
            _state.value = launched.copy(phase = PongPhase.Playing)
        }
    }

    /**
     * Advance the simulation by [deltaTime] seconds.
     * Called every frame from the composable's game loop.
     */
    fun update(deltaTime: Float) {
        var s = _state.value
        if (s.phase != PongPhase.Playing) return

        // Clamp deltaTime to avoid tunnelling after a pause.
        val dt = deltaTime.coerceAtMost(0.05f)

        var bx = s.ballX + s.ballVx * dt
        var by = s.ballY + s.ballVy * dt
        var vx = s.ballVx
        var vy = s.ballVy
        var lives = s.lives.toMutableList()
        var eliminated = s.eliminated.toMutableList()
        var resetBall = false

        // --- Check each side ---

        // Bottom (Player 0) – ball exits when by + BALL_RADIUS > 1
        if (by + BALL_RADIUS > 1f) {
            if (s.active[0] && !s.eliminated[0]) {
                // Active player's side: check paddle
                if (hitsPaddle(bx, s.paddlePositions[0], horizontal = true)) {
                    by = 1f - BALL_RADIUS
                    vy = -abs(vy)
                    val result = applyPaddleDeflection(vx, vy, bx, s.paddlePositions[0], horizontal = true)
                    vx = result.first; vy = result.second
                    val sped = increaseSpeed(vx, vy)
                    vx = sped.first; vy = sped.second
                } else {
                    // Missed – lose a life
                    lives[0] = (lives[0] - 1).coerceAtLeast(0)
                    if (lives[0] == 0) eliminated[0] = true
                    resetBall = true
                }
            } else {
                // Wall (inactive or eliminated) – just bounce
                by = 1f - BALL_RADIUS
                vy = -abs(vy)
            }
        }

        // Top (Player 1) – ball exits when by - BALL_RADIUS < 0
        if (by - BALL_RADIUS < 0f) {
            if (s.active[1] && !s.eliminated[1]) {
                if (hitsPaddle(bx, s.paddlePositions[1], horizontal = true)) {
                    by = BALL_RADIUS
                    vy = abs(vy)
                    val result = applyPaddleDeflection(vx, vy, bx, s.paddlePositions[1], horizontal = true)
                    vx = result.first; vy = result.second
                    val sped = increaseSpeed(vx, vy)
                    vx = sped.first; vy = sped.second
                } else {
                    lives[1] = (lives[1] - 1).coerceAtLeast(0)
                    if (lives[1] == 0) eliminated[1] = true
                    resetBall = true
                }
            } else {
                by = BALL_RADIUS
                vy = abs(vy)
            }
        }

        // Left (Player 2) – ball exits when bx - BALL_RADIUS < 0
        if (bx - BALL_RADIUS < 0f) {
            if (s.active[2] && !s.eliminated[2]) {
                if (hitsPaddle(by, s.paddlePositions[2], horizontal = false)) {
                    bx = BALL_RADIUS
                    vx = abs(vx)
                    val result = applyPaddleDeflection(vy, vx, by, s.paddlePositions[2], horizontal = false)
                    // For vertical paddles, the deflection modifies vy via the "main" component
                    vy = result.first; vx = result.second
                    val sped = increaseSpeed(vx, vy)
                    vx = sped.first; vy = sped.second
                } else {
                    lives[2] = (lives[2] - 1).coerceAtLeast(0)
                    if (lives[2] == 0) eliminated[2] = true
                    resetBall = true
                }
            } else {
                bx = BALL_RADIUS
                vx = abs(vx)
            }
        }

        // Right (Player 3) – ball exits when bx + BALL_RADIUS > 1
        if (bx + BALL_RADIUS > 1f) {
            if (s.active[3] && !s.eliminated[3]) {
                if (hitsPaddle(by, s.paddlePositions[3], horizontal = false)) {
                    bx = 1f - BALL_RADIUS
                    vx = -abs(vx)
                    val result = applyPaddleDeflection(vy, vx, by, s.paddlePositions[3], horizontal = false)
                    vy = result.first; vx = result.second
                    val sped = increaseSpeed(vx, vy)
                    vx = sped.first; vy = sped.second
                } else {
                    lives[3] = (lives[3] - 1).coerceAtLeast(0)
                    if (lives[3] == 0) eliminated[3] = true
                    resetBall = true
                }
            } else {
                bx = 1f - BALL_RADIUS
                vx = -abs(vx)
            }
        }

        // --- Check for game over ---
        val aliveIndices = (0 until 4).filter { s.active[it] && !eliminated[it] }
        if (aliveIndices.size <= 1) {
            val winner = aliveIndices.firstOrNull() ?: -1
            _state.value = s.copy(
                phase = PongPhase.GameOver,
                ballX = bx, ballY = by, ballVx = vx, ballVy = vy,
                lives = lives, eliminated = eliminated,
                winnerIndex = winner
            )
            return
        }

        if (resetBall) {
            // Reset ball to centre, re-launch toward a random alive player.
            val tempState = s.copy(lives = lives, eliminated = eliminated)
            val launched = launchBallFromCenter(tempState)
            _state.value = launched
            return
        }

        _state.value = s.copy(
            ballX = bx, ballY = by,
            ballVx = vx, ballVy = vy,
            lives = lives, eliminated = eliminated
        )
    }

    /** Move a player's paddle. [position] is 0-1 along their edge. */
    fun movePaddle(playerIndex: Int, position: Float) {
        val s = _state.value
        if (playerIndex !in 0..3) return
        if (!s.active[playerIndex] || s.eliminated[playerIndex]) return
        val clamped = position.coerceIn(PADDLE_HALF_WIDTH, 1f - PADDLE_HALF_WIDTH)
        val updated = s.paddlePositions.toMutableList()
        updated[playerIndex] = clamped
        _state.value = s.copy(paddlePositions = updated)
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    /**
     * Check if the ball (at coordinate [ballPos] along the edge) overlaps the
     * paddle centred at [paddlePos]. [horizontal] is true for top/bottom paddles.
     */
    private fun hitsPaddle(ballPos: Float, paddlePos: Float, horizontal: Boolean): Boolean {
        // ballPos is the component of the ball position along the paddle's axis.
        return abs(ballPos - paddlePos) <= PADDLE_HALF_WIDTH + BALL_RADIUS
    }

    /**
     * Slightly deflect the ball based on where it hit the paddle.
     * For horizontal paddles: [ballAlongEdge] is ball x, [paddlePos] is paddle centre x.
     * Returns new (vAlongEdge, vPerpendicular).
     */
    private fun applyPaddleDeflection(
        vAlong: Float,
        vPerp: Float,
        ballAlongEdge: Float,
        paddlePos: Float,
        horizontal: Boolean
    ): Pair<Float, Float> {
        // Offset from paddle centre, normalised to [-1, 1].
        val offset = ((ballAlongEdge - paddlePos) / PADDLE_HALF_WIDTH).coerceIn(-1f, 1f)
        // Add some lateral velocity based on hit position.
        val deflection = offset * 0.3f
        val speed = sqrt(vAlong * vAlong + vPerp * vPerp)
        val newAlong = vAlong + deflection * speed
        // Re-normalise to maintain the same speed.
        val newSpeed = sqrt(newAlong * newAlong + vPerp * vPerp)
        return if (newSpeed > 0.001f) {
            val scale = speed / newSpeed
            Pair(newAlong * scale, vPerp * scale)
        } else {
            Pair(vAlong, vPerp)
        }
    }

    /** Multiply ball speed by the increase factor, capped at MAX_BALL_SPEED. */
    private fun increaseSpeed(vx: Float, vy: Float): Pair<Float, Float> {
        val speed = sqrt(vx * vx + vy * vy)
        if (speed >= MAX_BALL_SPEED || speed < 0.001f) return Pair(vx, vy)
        val newSpeed = (speed * SPEED_INCREASE_FACTOR).coerceAtMost(MAX_BALL_SPEED)
        val scale = newSpeed / speed
        return Pair(vx * scale, vy * scale)
    }

    /** Generate an initial velocity aimed at a random active (alive) player's side. */
    private fun launchBallTowardRandomPlayer(): PongRoyaleState {
        val s = _state.value
        return launchBallFromCenter(s)
    }

    private fun launchBallFromCenter(s: PongRoyaleState): PongRoyaleState {
        val aliveIndices = (0 until 4).filter { s.active[it] && !s.eliminated[it] }
        if (aliveIndices.isEmpty()) return s

        val targetPlayer = aliveIndices[Random.nextInt(aliveIndices.size)]
        val angle = when (PLAYER_SIDES[targetPlayer]) {
            Side.Bottom -> {
                // Aim downward: random angle between 200-340 degrees in radians (pointing down-ish)
                val spread = Random.nextFloat() * 0.8f - 0.4f // -0.4 .. +0.4
                Pair(spread * INITIAL_BALL_SPEED, INITIAL_BALL_SPEED * 0.8f)
            }
            Side.Top -> {
                val spread = Random.nextFloat() * 0.8f - 0.4f
                Pair(spread * INITIAL_BALL_SPEED, -INITIAL_BALL_SPEED * 0.8f)
            }
            Side.Left -> {
                val spread = Random.nextFloat() * 0.8f - 0.4f
                Pair(-INITIAL_BALL_SPEED * 0.8f, spread * INITIAL_BALL_SPEED)
            }
            Side.Right -> {
                val spread = Random.nextFloat() * 0.8f - 0.4f
                Pair(INITIAL_BALL_SPEED * 0.8f, spread * INITIAL_BALL_SPEED)
            }
        }

        // Normalise to INITIAL_BALL_SPEED.
        val mag = sqrt(angle.first * angle.first + angle.second * angle.second)
        val scale = if (mag > 0.001f) INITIAL_BALL_SPEED / mag else 1f

        return s.copy(
            ballX = 0.5f,
            ballY = 0.5f,
            ballVx = angle.first * scale,
            ballVy = angle.second * scale
        )
    }
}
