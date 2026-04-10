package com.partygames.app.games.fingertwister

import androidx.compose.ui.geometry.Offset
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlin.math.hypot
import kotlin.random.Random

/** Phases the game transitions through. */
enum class GamePhase {
    Countdown,
    Playing,
    GameOver
}

/**
 * A circle target that a player must touch and hold.
 * Positions are stored as fractions (0..1) of the screen dimensions.
 */
data class TargetCircle(
    val id: Long,
    val playerIndex: Int,
    val x: Float,       // 0-1 fraction of width
    val y: Float,       // 0-1 fraction of height
    val radius: Float,  // 0-1 fraction of min(width, height)
    val spawnTimeMs: Long
)

data class FingerTwisterState(
    val phase: GamePhase = GamePhase.Countdown,
    val countdownValue: Int = 3,
    val circles: List<TargetCircle> = emptyList(),
    val eliminatedPlayers: Set<Int> = emptySet(),
    val winnerIndex: Int = -1,
    val playerCount: Int = 2
)

class FingerTwisterViewModel : ViewModel() {

    private val _state = MutableStateFlow(FingerTwisterState())
    val state: StateFlow<FingerTwisterState> = _state.asStateFlow()

    // Maps pointer ID -> circle ID that the pointer is currently covering.
    private val pointerToCircle = mutableMapOf<Long, Long>()

    private var nextCircleId = 1L
    private var spawnJob: Job? = null
    private var gameStartTimeMs = 0L

    // Grace period (ms) after a circle spawns before it can eliminate the owner.
    private val gracePeriodMs = 2_000L

    // Minimum distance (in 0-1 fraction space) between circle centres.
    private val minCircleDistance = 0.15f

    // Circle radius in fraction space.
    private val circleRadius = 0.055f

    // Edge margin – circles stay this far from screen edges (fraction).
    private val edgeMargin = 0.08f

    // Time between spawns (ms).
    private val spawnIntervalMs = 3_000L

    // Which player index gets the next spawned circle (cycles through active players).
    private var nextPlayerCycle = 0

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /** Call once from the composable to kick off the game. */
    fun startGame(playerCount: Int) {
        // Guard against double-start.
        if (_state.value.phase != GamePhase.Countdown || _state.value.playerCount == playerCount && gameStartTimeMs != 0L) return

        _state.value = FingerTwisterState(
            phase = GamePhase.Countdown,
            countdownValue = 3,
            playerCount = playerCount
        )
        nextCircleId = 1L
        pointerToCircle.clear()
        nextPlayerCycle = 0

        viewModelScope.launch {
            // Countdown: 3 -> 2 -> 1 -> GO
            for (tick in 3 downTo 1) {
                _state.value = _state.value.copy(countdownValue = tick)
                delay(1_000L)
            }
            // Brief "GO!" display
            _state.value = _state.value.copy(countdownValue = 0)
            delay(500L)

            gameStartTimeMs = System.currentTimeMillis()
            _state.value = _state.value.copy(phase = GamePhase.Playing)
            startSpawning()
        }
    }

    /**
     * Called every frame from the composable. [touchPoints] maps pointer IDs
     * (stable across frames for the same finger) to their current position
     * **in fraction space (0-1)**.
     */
    fun update(touchPoints: Map<Long, Offset>) {
        val current = _state.value
        if (current.phase != GamePhase.Playing) return
        val now = System.currentTimeMillis()

        // ---- 1. Match pointers to circles ----
        pointerToCircle.clear()
        val circlesCopy = current.circles.toList()

        // For every active pointer find the closest circle it covers.
        for ((pointerId, pos) in touchPoints) {
            var bestCircle: TargetCircle? = null
            var bestDist = Float.MAX_VALUE
            for (circle in circlesCopy) {
                val dist = hypot(pos.x - circle.x, pos.y - circle.y)
                if (dist <= circle.radius && dist < bestDist) {
                    // Only allow if no other pointer already claims this circle.
                    if (pointerToCircle.values.contains(circle.id).not()) {
                        bestDist = dist
                        bestCircle = circle
                    }
                }
            }
            if (bestCircle != null) {
                pointerToCircle[pointerId] = bestCircle.id
            }
        }

        // ---- 2. Check for eliminations ----
        val touchedCircleIds = pointerToCircle.values.toSet()
        val newlyEliminated = mutableSetOf<Int>()

        for (circle in circlesCopy) {
            val ageMs = now - circle.spawnTimeMs
            if (ageMs < gracePeriodMs) continue // Still in grace period.
            if (current.eliminatedPlayers.contains(circle.playerIndex)) continue
            if (!touchedCircleIds.contains(circle.id)) {
                newlyEliminated.add(circle.playerIndex)
            }
        }

        if (newlyEliminated.isNotEmpty()) {
            val allEliminated = current.eliminatedPlayers + newlyEliminated
            // Remove circles belonging to eliminated players.
            val remainingCircles = circlesCopy.filter { it.playerIndex !in allEliminated }

            val activePlayers = (0 until current.playerCount).filter { it !in allEliminated }

            if (activePlayers.size <= 1) {
                val winner = activePlayers.firstOrNull() ?: 0
                spawnJob?.cancel()
                _state.value = current.copy(
                    phase = GamePhase.GameOver,
                    eliminatedPlayers = allEliminated,
                    circles = remainingCircles,
                    winnerIndex = winner
                )
                return
            }

            _state.value = current.copy(
                eliminatedPlayers = allEliminated,
                circles = remainingCircles
            )
        }
    }

    // -------------------------------------------------------------------------
    // Spawning
    // -------------------------------------------------------------------------

    private fun startSpawning() {
        spawnJob?.cancel()
        spawnJob = viewModelScope.launch {
            // Spawn one circle per active player at the start.
            spawnRoundForAllPlayers()

            // Then keep spawning one at a time.
            while (true) {
                delay(spawnIntervalMs)
                val current = _state.value
                if (current.phase != GamePhase.Playing) break
                spawnNextCircle()
            }
        }
    }

    /** Initial round: one circle for every active player. */
    private suspend fun spawnRoundForAllPlayers() {
        val pc = _state.value.playerCount
        for (i in 0 until pc) {
            if (_state.value.phase != GamePhase.Playing) return
            spawnCircleForPlayer(i)
            delay(800L) // Small stagger so they don't all appear at once.
        }
    }

    /** Spawn a circle for the next active player in the cycle. */
    private fun spawnNextCircle() {
        val current = _state.value
        if (current.phase != GamePhase.Playing) return

        val activePlayers = (0 until current.playerCount).filter { it !in current.eliminatedPlayers }
        if (activePlayers.isEmpty()) return

        // Advance cycle to an active player.
        var attempts = 0
        while (nextPlayerCycle !in activePlayers && attempts < current.playerCount) {
            nextPlayerCycle = (nextPlayerCycle + 1) % current.playerCount
            attempts++
        }

        spawnCircleForPlayer(nextPlayerCycle)
        nextPlayerCycle = (nextPlayerCycle + 1) % current.playerCount
    }

    private fun spawnCircleForPlayer(playerIndex: Int) {
        val current = _state.value
        if (current.eliminatedPlayers.contains(playerIndex)) return

        val position = findValidPosition(current.circles) ?: return

        val circle = TargetCircle(
            id = nextCircleId++,
            playerIndex = playerIndex,
            x = position.x,
            y = position.y,
            radius = circleRadius,
            spawnTimeMs = System.currentTimeMillis()
        )
        _state.value = current.copy(circles = current.circles + circle)
    }

    /**
     * Find a random position that is at least [minCircleDistance] from every
     * existing circle and at least [edgeMargin] from screen edges.
     * Returns null if no position found after many attempts.
     */
    private fun findValidPosition(existing: List<TargetCircle>): Offset? {
        repeat(150) {
            val x = Random.nextFloat() * (1f - 2 * edgeMargin) + edgeMargin
            val y = Random.nextFloat() * (1f - 2 * edgeMargin) + edgeMargin
            val tooClose = existing.any { c ->
                hypot(c.x - x, c.y - y) < minCircleDistance
            }
            if (!tooClose) return Offset(x, y)
        }
        // Fallback – relax distance constraint.
        repeat(50) {
            val x = Random.nextFloat() * (1f - 2 * edgeMargin) + edgeMargin
            val y = Random.nextFloat() * (1f - 2 * edgeMargin) + edgeMargin
            val tooClose = existing.any { c ->
                hypot(c.x - x, c.y - y) < minCircleDistance * 0.5f
            }
            if (!tooClose) return Offset(x, y)
        }
        return null
    }
}
