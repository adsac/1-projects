package com.partygames.app.games.sumo

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlin.math.PI
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.sin

/** High-level phase of a sumo match. */
enum class SumoPhase {
    /** Countdown before fighting begins. */
    Countdown,
    /** Active fighting. */
    Fighting,
    /** Brief pause after a round ends (showing result). */
    RoundOver,
    /** A player has won best-of-3 -- game is finished. */
    GameOver
}

/** Mutable state for a single sumo wrestler. */
data class SumoCharacter(
    val x: Float,
    val y: Float,
    val vx: Float = 0f,
    val vy: Float = 0f,
    val facingAngle: Float = 0f,
    val alive: Boolean = true,
    val lungeCooldown: Float = 0f
)

/** Full observable state exposed to the UI. */
data class SumoState(
    val phase: SumoPhase = SumoPhase.Countdown,
    val countdownValue: Int = 3,
    val playerCount: Int = 2,
    val characters: List<SumoCharacter> = emptyList(),
    val arenaCenterX: Float = 0.5f,
    val arenaCenterY: Float = 0.4f,
    val arenaRadius: Float = 0.3f,
    val characterRadius: Float = 0.035f,
    val currentRound: Int = 1,
    val winsPerPlayer: List<Int> = emptyList(),
    val roundWinner: Int = -1,
    val gameWinner: Int = -1,
    val roundsToWin: Int = 2
)

class SumoViewModel : ViewModel() {

    private val _state = MutableStateFlow(SumoState())
    val state: StateFlow<SumoState> = _state.asStateFlow()

    // ---- Physics constants ----
    private val friction = 0.95f
    private val lungeImpulse = 0.45f
    private val lungeCooldownTime = 0.5f // seconds
    private val knockbackStrength = 0.3f
    private val bounceRestitution = 0.8f

    // Tracks whether the game has been started.
    private var started = false

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    /** Call once from the composable to initialise and start the match. */
    fun startGame(playerCount: Int) {
        if (started) return
        started = true

        val clamped = playerCount.coerceIn(2, 4)
        val chars = buildStartPositions(clamped)
        _state.value = SumoState(
            phase = SumoPhase.Countdown,
            countdownValue = 3,
            playerCount = clamped,
            characters = chars,
            winsPerPlayer = List(clamped) { 0 }
        )
        viewModelScope.launch { runCountdown() }
    }

    /** Player taps their button -- apply a lunge impulse if cooldown is ready. */
    fun lunge(playerIndex: Int) {
        val s = _state.value
        if (s.phase != SumoPhase.Fighting) return
        val chars = s.characters.toMutableList()
        if (playerIndex !in chars.indices) return
        val c = chars[playerIndex]
        if (!c.alive || c.lungeCooldown > 0f) return

        val dx = cos(c.facingAngle) * lungeImpulse
        val dy = sin(c.facingAngle) * lungeImpulse

        chars[playerIndex] = c.copy(
            vx = c.vx + dx,
            vy = c.vy + dy,
            lungeCooldown = lungeCooldownTime
        )
        _state.value = s.copy(characters = chars)
    }

    /**
     * Advance the simulation by [dt] seconds. Called every frame from the
     * composable's game-loop coroutine.
     */
    fun update(dt: Float) {
        val s = _state.value
        if (s.phase != SumoPhase.Fighting) return

        var chars = s.characters.toMutableList()

        // 1. Auto-face nearest alive opponent.
        chars = autoFace(chars)

        // 2. Apply velocity & friction, tick cooldowns.
        for (i in chars.indices) {
            val c = chars[i]
            if (!c.alive) continue

            val newVx = c.vx * friction
            val newVy = c.vy * friction
            val newX = c.x + newVx * dt
            val newY = c.y + newVy * dt
            val newCooldown = (c.lungeCooldown - dt).coerceAtLeast(0f)

            chars[i] = c.copy(
                x = newX, y = newY,
                vx = newVx, vy = newVy,
                lungeCooldown = newCooldown
            )
        }

        // 3. Resolve collisions between alive characters.
        chars = resolveCollisions(chars, s.characterRadius)

        // 4. Check ring-out.
        for (i in chars.indices) {
            val c = chars[i]
            if (!c.alive) continue
            val dist = hypot(c.x - s.arenaCenterX, c.y - s.arenaCenterY)
            if (dist > s.arenaRadius + s.characterRadius * 0.5f) {
                chars[i] = c.copy(alive = false, vx = 0f, vy = 0f)
            }
        }

        // 5. Check for round end.
        val aliveIndices = chars.indices.filter { chars[it].alive }
        if (aliveIndices.size <= 1) {
            val winner = aliveIndices.firstOrNull() ?: -1
            val newWins = s.winsPerPlayer.toMutableList()
            if (winner >= 0) newWins[winner] = newWins[winner] + 1

            val gameWon = winner >= 0 && newWins[winner] >= s.roundsToWin

            _state.value = s.copy(
                characters = chars,
                phase = if (gameWon) SumoPhase.GameOver else SumoPhase.RoundOver,
                roundWinner = winner,
                winsPerPlayer = newWins,
                gameWinner = if (gameWon) winner else -1
            )

            // If the game is not over, schedule next round after a pause.
            if (!gameWon) {
                viewModelScope.launch {
                    delay(2_000L)
                    startNewRound()
                }
            }
            return
        }

        _state.value = s.copy(characters = chars)
    }

    // -----------------------------------------------------------------------
    // Internals
    // -----------------------------------------------------------------------

    /** Build evenly-spaced starting positions around the arena edge. */
    private fun buildStartPositions(count: Int): List<SumoCharacter> {
        val cx = 0.5f
        val cy = 0.4f
        val r = 0.3f * 0.7f // Start a bit inside the ring edge
        return List(count) { i ->
            val angle = (2.0 * PI * i / count - PI / 2).toFloat()
            SumoCharacter(
                x = cx + cos(angle) * r,
                y = cy + sin(angle) * r,
                facingAngle = angle + PI.toFloat() // Face inward
            )
        }
    }

    /** Run the 3-2-1-GO countdown and transition to Fighting. */
    private suspend fun runCountdown() {
        for (tick in 3 downTo 1) {
            _state.value = _state.value.copy(countdownValue = tick)
            delay(1_000L)
        }
        _state.value = _state.value.copy(countdownValue = 0)
        delay(500L)
        _state.value = _state.value.copy(phase = SumoPhase.Fighting)
    }

    /** Reset character positions and start a countdown for the next round. */
    private suspend fun startNewRound() {
        val s = _state.value
        val chars = buildStartPositions(s.playerCount)
        _state.value = s.copy(
            phase = SumoPhase.Countdown,
            countdownValue = 3,
            characters = chars,
            currentRound = s.currentRound + 1,
            roundWinner = -1
        )
        runCountdown()
    }

    /** Each alive character faces the nearest alive opponent. */
    private fun autoFace(chars: MutableList<SumoCharacter>): MutableList<SumoCharacter> {
        for (i in chars.indices) {
            val c = chars[i]
            if (!c.alive) continue

            var nearestDist = Float.MAX_VALUE
            var nearestAngle = c.facingAngle

            for (j in chars.indices) {
                if (j == i || !chars[j].alive) continue
                val dx = chars[j].x - c.x
                val dy = chars[j].y - c.y
                val dist = hypot(dx, dy)
                if (dist < nearestDist) {
                    nearestDist = dist
                    nearestAngle = atan2(dy, dx)
                }
            }
            chars[i] = c.copy(facingAngle = nearestAngle)
        }
        return chars
    }

    /** Elastic-ish collision: push overlapping characters apart and apply knockback. */
    private fun resolveCollisions(
        chars: MutableList<SumoCharacter>,
        charRadius: Float
    ): MutableList<SumoCharacter> {
        for (i in chars.indices) {
            if (!chars[i].alive) continue
            for (j in i + 1 until chars.size) {
                if (!chars[j].alive) continue

                val a = chars[i]
                val b = chars[j]
                val dx = b.x - a.x
                val dy = b.y - a.y
                val dist = hypot(dx, dy)
                val minDist = charRadius * 2f

                if (dist < minDist && dist > 0.0001f) {
                    // Normalised collision axis.
                    val nx = dx / dist
                    val ny = dy / dist

                    // Separate the two characters so they no longer overlap.
                    val overlap = minDist - dist
                    val halfOverlap = overlap / 2f
                    val ax = a.x - nx * halfOverlap
                    val ay = a.y - ny * halfOverlap
                    val bx = b.x + nx * halfOverlap
                    val by = b.y + ny * halfOverlap

                    // Relative velocity along collision normal.
                    val relVx = a.vx - b.vx
                    val relVy = a.vy - b.vy
                    val relDotN = relVx * nx + relVy * ny

                    // Only resolve if objects are moving toward each other.
                    if (relDotN > 0f) {
                        val impulse = relDotN * bounceRestitution
                        chars[i] = a.copy(
                            x = ax, y = ay,
                            vx = a.vx - impulse * nx - nx * knockbackStrength,
                            vy = a.vy - impulse * ny - ny * knockbackStrength
                        )
                        chars[j] = b.copy(
                            x = bx, y = by,
                            vx = b.vx + impulse * nx + nx * knockbackStrength,
                            vy = b.vy + impulse * ny + ny * knockbackStrength
                        )
                    } else {
                        // Not approaching but still overlapping -- just push apart.
                        chars[i] = a.copy(x = ax, y = ay)
                        chars[j] = b.copy(x = bx, y = by)
                    }
                }
            }
        }
        return chars
    }
}
