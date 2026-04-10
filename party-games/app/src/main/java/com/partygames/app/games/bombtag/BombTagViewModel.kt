package com.partygames.app.games.bombtag

import androidx.lifecycle.ViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlin.math.hypot
import kotlin.random.Random

/** Phases the Bomb Tag game transitions through. */
enum class BombTagPhase {
    Countdown,
    Playing,
    Explosion,
    RoundStart,
    GameOver
}

/** Mutable state for a single player character in the arena. */
data class BombCharacter(
    val playerIndex: Int,
    var x: Float,
    var y: Float,
    var vx: Float = 0f,
    var vy: Float = 0f,
    val radius: Float = 0.04f,
    var alive: Boolean = true,
    var hasBomb: Boolean = false,
    var dashCooldown: Float = 0f
)

/** Immutable snapshot exposed to the UI. */
data class BombTagState(
    val phase: BombTagPhase = BombTagPhase.Countdown,
    val countdownValue: Int = 3,
    val characters: List<BombCharacterSnapshot> = emptyList(),
    val playerCount: Int = 2,
    val winnerIndex: Int = -1,
    val eliminatedIndex: Int = -1,
    val explosionTimer: Float = 0f,
    /** 0..1 fraction representing how close the hidden bomb timer is to expiring.
     *  Used by the UI to speed up the pulse animation. */
    val bombTimerFraction: Float = 0f
)

/** Read-only snapshot of a character for the UI layer. */
data class BombCharacterSnapshot(
    val playerIndex: Int,
    val x: Float,
    val y: Float,
    val radius: Float,
    val alive: Boolean,
    val hasBomb: Boolean
)

class BombTagViewModel : ViewModel() {

    private val _state = MutableStateFlow(BombTagState())
    val state: StateFlow<BombTagState> = _state.asStateFlow()

    // Internal mutable character list (not exposed directly).
    private val characters = mutableListOf<BombCharacter>()

    // Hidden bomb countdown in seconds.
    private var bombTimer = 0f
    private var bombTimerTotal = 0f

    // Countdown ticks remaining before the game/round starts.
    private var countdownRemaining = 3f

    // Brief pause duration after explosion before next round.
    private var explosionPauseRemaining = 0f
    private val explosionPauseDuration = 2.0f

    // Round-start pause (shows who gets the bomb).
    private var roundStartRemaining = 0f
    private val roundStartDuration = 1.5f

    // Track who was just eliminated (for the explosion overlay).
    private var lastEliminatedIndex = -1

    // Has the game been initialised?
    private var initialised = false

    // Arena bounds (characters live in 0..1 square).
    private val arenaMin = 0f
    private val arenaMax = 1f

    // Physics constants.
    private val friction = 0.96f
    private val dashImpulse = 1.8f
    private val dashCooldownDuration = 1.0f // seconds
    private val idleDriftStrength = 0.08f
    private val idleChangeInterval = 1.5f // seconds between random direction changes

    // Track when each character should next change idle direction.
    private val idleTimers = mutableListOf<Float>()
    private val idleDirX = mutableListOf<Float>()
    private val idleDirY = mutableListOf<Float>()

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /** Initialise the game with the given player count. Call once. */
    fun startGame(playerCount: Int) {
        if (initialised) return
        initialised = true

        characters.clear()
        idleTimers.clear()
        idleDirX.clear()
        idleDirY.clear()

        val startPositions = when (playerCount) {
            2 -> listOf(0.25f to 0.25f, 0.75f to 0.75f)
            3 -> listOf(0.25f to 0.25f, 0.75f to 0.25f, 0.5f to 0.75f)
            else -> listOf(0.25f to 0.25f, 0.75f to 0.25f, 0.25f to 0.75f, 0.75f to 0.75f)
        }

        for (i in 0 until playerCount) {
            val (sx, sy) = startPositions[i]
            characters.add(
                BombCharacter(
                    playerIndex = i,
                    x = sx,
                    y = sy
                )
            )
            idleTimers.add(0f)
            idleDirX.add(randomDir())
            idleDirY.add(randomDir())
        }

        countdownRemaining = 3f
        _state.value = BombTagState(
            phase = BombTagPhase.Countdown,
            countdownValue = 3,
            characters = snapshot(),
            playerCount = playerCount
        )
    }

    /** Player taps their dash button. */
    fun dash(playerIndex: Int) {
        val current = _state.value
        if (current.phase != BombTagPhase.Playing) return

        val char = characters.getOrNull(playerIndex) ?: return
        if (!char.alive) return
        if (char.dashCooldown > 0f) return

        // Find the nearest alive opponent.
        var nearest: BombCharacter? = null
        var nearestDist = Float.MAX_VALUE
        for (other in characters) {
            if (other.playerIndex == playerIndex) continue
            if (!other.alive) continue
            val dist = hypot(other.x - char.x, other.y - char.y)
            if (dist < nearestDist) {
                nearestDist = dist
                nearest = other
            }
        }

        if (nearest != null && nearestDist > 0.001f) {
            val dx = nearest.x - char.x
            val dy = nearest.y - char.y
            val len = hypot(dx, dy)
            char.vx += (dx / len) * dashImpulse
            char.vy += (dy / len) * dashImpulse
            char.dashCooldown = dashCooldownDuration
        }
    }

    /** Called every frame from the composable. [deltaTime] in seconds. */
    fun update(deltaTime: Float) {
        // Clamp to avoid physics explosion on large frame gaps.
        val dt = deltaTime.coerceAtMost(0.05f)

        when (_state.value.phase) {
            BombTagPhase.Countdown -> updateCountdown(dt)
            BombTagPhase.Playing -> updatePlaying(dt)
            BombTagPhase.Explosion -> updateExplosion(dt)
            BombTagPhase.RoundStart -> updateRoundStart(dt)
            BombTagPhase.GameOver -> { /* nothing */ }
        }
    }

    // -------------------------------------------------------------------------
    // Phase updates
    // -------------------------------------------------------------------------

    private fun updateCountdown(dt: Float) {
        countdownRemaining -= dt
        val tick = countdownRemaining.toInt().coerceAtLeast(0)
        if (countdownRemaining <= 0f) {
            // Transition: start playing.
            assignBombToRandom()
            resetBombTimer()
            _state.value = _state.value.copy(
                phase = BombTagPhase.Playing,
                countdownValue = 0,
                characters = snapshot(),
                bombTimerFraction = 0f
            )
        } else {
            _state.value = _state.value.copy(
                countdownValue = tick + 1,
                characters = snapshot()
            )
        }
    }

    private fun updatePlaying(dt: Float) {
        // Move characters.
        for (i in characters.indices) {
            val c = characters[i]
            if (!c.alive) continue

            // Idle drift: periodically pick a new random direction.
            idleTimers[i] -= dt
            if (idleTimers[i] <= 0f) {
                idleTimers[i] = idleChangeInterval * (0.5f + Random.nextFloat())
                idleDirX[i] = randomDir()
                idleDirY[i] = randomDir()
            }

            // Apply idle force.
            c.vx += idleDirX[i] * idleDriftStrength * dt
            c.vy += idleDirY[i] * idleDriftStrength * dt

            // Apply friction.
            c.vx *= friction
            c.vy *= friction

            // Integrate position.
            c.x += c.vx * dt
            c.y += c.vy * dt

            // Bounce off walls.
            val r = c.radius
            if (c.x - r < arenaMin) {
                c.x = arenaMin + r
                c.vx = -c.vx * 0.7f
                idleDirX[i] = kotlin.math.abs(idleDirX[i])
            }
            if (c.x + r > arenaMax) {
                c.x = arenaMax - r
                c.vx = -c.vx * 0.7f
                idleDirX[i] = -kotlin.math.abs(idleDirX[i])
            }
            if (c.y - r < arenaMin) {
                c.y = arenaMin + r
                c.vy = -c.vy * 0.7f
                idleDirY[i] = kotlin.math.abs(idleDirY[i])
            }
            if (c.y + r > arenaMax) {
                c.y = arenaMax - r
                c.vy = -c.vy * 0.7f
                idleDirY[i] = -kotlin.math.abs(idleDirY[i])
            }

            // Dash cooldown.
            if (c.dashCooldown > 0f) {
                c.dashCooldown = (c.dashCooldown - dt).coerceAtLeast(0f)
            }
        }

        // Check collisions and transfer bomb.
        checkCollisions()

        // Bomb timer.
        bombTimer -= dt
        val fraction = if (bombTimerTotal > 0f) {
            (1f - (bombTimer / bombTimerTotal)).coerceIn(0f, 1f)
        } else 0f

        if (bombTimer <= 0f) {
            // BOOM! Eliminate whoever holds the bomb.
            val holder = characters.firstOrNull { it.hasBomb && it.alive }
            if (holder != null) {
                holder.alive = false
                holder.hasBomb = false
                lastEliminatedIndex = holder.playerIndex

                val aliveCount = characters.count { it.alive }
                if (aliveCount <= 1) {
                    val winner = characters.firstOrNull { it.alive }?.playerIndex ?: 0
                    _state.value = _state.value.copy(
                        phase = BombTagPhase.GameOver,
                        characters = snapshot(),
                        winnerIndex = winner,
                        eliminatedIndex = lastEliminatedIndex,
                        bombTimerFraction = 1f
                    )
                } else {
                    explosionPauseRemaining = explosionPauseDuration
                    _state.value = _state.value.copy(
                        phase = BombTagPhase.Explosion,
                        characters = snapshot(),
                        eliminatedIndex = lastEliminatedIndex,
                        explosionTimer = explosionPauseDuration,
                        bombTimerFraction = 1f
                    )
                }
            }
        } else {
            _state.value = _state.value.copy(
                characters = snapshot(),
                bombTimerFraction = fraction
            )
        }
    }

    private fun updateExplosion(dt: Float) {
        explosionPauseRemaining -= dt
        _state.value = _state.value.copy(
            explosionTimer = explosionPauseRemaining.coerceAtLeast(0f),
            characters = snapshot()
        )
        if (explosionPauseRemaining <= 0f) {
            // Start new round.
            assignBombToRandom()
            resetBombTimer()
            roundStartRemaining = roundStartDuration
            _state.value = _state.value.copy(
                phase = BombTagPhase.RoundStart,
                characters = snapshot(),
                bombTimerFraction = 0f
            )
        }
    }

    private fun updateRoundStart(dt: Float) {
        roundStartRemaining -= dt
        // Still move characters during round start.
        updateCharacterPhysics(dt)
        if (roundStartRemaining <= 0f) {
            _state.value = _state.value.copy(
                phase = BombTagPhase.Playing,
                characters = snapshot(),
                bombTimerFraction = 0f
            )
        } else {
            _state.value = _state.value.copy(
                characters = snapshot()
            )
        }
    }

    // -------------------------------------------------------------------------
    // Physics helpers
    // -------------------------------------------------------------------------

    /** Move characters without bomb timer logic (used during RoundStart). */
    private fun updateCharacterPhysics(dt: Float) {
        for (i in characters.indices) {
            val c = characters[i]
            if (!c.alive) continue

            idleTimers[i] -= dt
            if (idleTimers[i] <= 0f) {
                idleTimers[i] = idleChangeInterval * (0.5f + Random.nextFloat())
                idleDirX[i] = randomDir()
                idleDirY[i] = randomDir()
            }

            c.vx += idleDirX[i] * idleDriftStrength * dt
            c.vy += idleDirY[i] * idleDriftStrength * dt
            c.vx *= friction
            c.vy *= friction
            c.x += c.vx * dt
            c.y += c.vy * dt

            val r = c.radius
            if (c.x - r < arenaMin) { c.x = arenaMin + r; c.vx = -c.vx * 0.7f }
            if (c.x + r > arenaMax) { c.x = arenaMax - r; c.vx = -c.vx * 0.7f }
            if (c.y - r < arenaMin) { c.y = arenaMin + r; c.vy = -c.vy * 0.7f }
            if (c.y + r > arenaMax) { c.y = arenaMax - r; c.vy = -c.vy * 0.7f }

            if (c.dashCooldown > 0f) {
                c.dashCooldown = (c.dashCooldown - dt).coerceAtLeast(0f)
            }
        }
    }

    /** Check pairwise collisions among alive characters. Transfer bomb on overlap. */
    private fun checkCollisions() {
        for (i in characters.indices) {
            for (j in i + 1 until characters.size) {
                val a = characters[i]
                val b = characters[j]
                if (!a.alive || !b.alive) continue

                val dx = b.x - a.x
                val dy = b.y - a.y
                val dist = hypot(dx, dy)
                val minDist = a.radius + b.radius

                if (dist < minDist && dist > 0.0001f) {
                    // Separate the characters.
                    val overlap = minDist - dist
                    val nx = dx / dist
                    val ny = dy / dist
                    a.x -= nx * overlap * 0.5f
                    a.y -= ny * overlap * 0.5f
                    b.x += nx * overlap * 0.5f
                    b.y += ny * overlap * 0.5f

                    // Simple elastic-ish bounce.
                    val relVx = a.vx - b.vx
                    val relVy = a.vy - b.vy
                    val relDotN = relVx * nx + relVy * ny
                    if (relDotN > 0) {
                        a.vx -= relDotN * nx * 0.8f
                        a.vy -= relDotN * ny * 0.8f
                        b.vx += relDotN * nx * 0.8f
                        b.vy += relDotN * ny * 0.8f
                    }

                    // Transfer bomb.
                    if (a.hasBomb && !b.hasBomb) {
                        a.hasBomb = false
                        b.hasBomb = true
                    } else if (b.hasBomb && !a.hasBomb) {
                        b.hasBomb = false
                        a.hasBomb = true
                    }
                }
            }
        }
    }

    // -------------------------------------------------------------------------
    // Bomb helpers
    // -------------------------------------------------------------------------

    private fun assignBombToRandom() {
        // Clear any existing bomb.
        characters.forEach { it.hasBomb = false }
        val alive = characters.filter { it.alive }
        if (alive.isNotEmpty()) {
            alive[Random.nextInt(alive.size)].hasBomb = true
        }
    }

    private fun resetBombTimer() {
        // Random between 8 and 15 seconds.
        bombTimerTotal = 8f + Random.nextFloat() * 7f
        bombTimer = bombTimerTotal
    }

    // -------------------------------------------------------------------------
    // Utility
    // -------------------------------------------------------------------------

    private fun snapshot(): List<BombCharacterSnapshot> = characters.map { c ->
        BombCharacterSnapshot(
            playerIndex = c.playerIndex,
            x = c.x,
            y = c.y,
            radius = c.radius,
            alive = c.alive,
            hasBomb = c.hasBomb
        )
    }

    private fun randomDir(): Float = (Random.nextFloat() - 0.5f) * 2f
}
