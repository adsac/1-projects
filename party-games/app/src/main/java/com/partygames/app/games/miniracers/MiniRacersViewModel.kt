package com.partygames.app.games.miniracers

import androidx.lifecycle.ViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Total laps required to win. */
const val LAPS_TO_WIN = 3

/** Maximum speed a car can reach (track-position units per second). */
const val MAX_SPEED = 0.28f

/** Acceleration when the player is holding the button (units/s^2). */
const val ACCELERATION = 0.30f

/** Friction deceleration when the player releases the button (units/s^2). */
const val FRICTION = 0.18f

/**
 * Speed threshold above which a car incurs a curve penalty.
 * If the car is going faster than this while on a curve section it will
 * lose speed and drift outward.
 */
const val CURVE_SPEED_THRESHOLD = 0.16f

/** How quickly the car loses speed when skidding on a curve (units/s^2). */
const val CURVE_SPEED_PENALTY = 0.35f

/** How quickly lateral offset grows while skidding (units/s). */
const val LATERAL_DRIFT_RATE = 80f

/** How quickly lateral offset recovers back to zero (units/s). */
const val LATERAL_RECOVERY_RATE = 120f

/** Maximum lateral offset in pixels before clamping. */
const val MAX_LATERAL_OFFSET = 30f

// ---------------------------------------------------------------------------
// Data classes
// ---------------------------------------------------------------------------

data class CarState(
    /** Position along the track path, 0.0 (start/finish) to 1.0. Wraps. */
    val trackPosition: Float = 0f,
    /** Current speed in track-position-units per second. */
    val speed: Float = 0f,
    /** Visual offset perpendicular to the track centre-line (pixels). */
    val lateralOffset: Float = 0f,
    /** Number of completed laps. */
    val lapCount: Int = 0,
    /** True while the player is holding the accelerate button. */
    val isAccelerating: Boolean = false,
    /** True while the car is skidding on a curve. */
    val isSkidding: Boolean = false
)

enum class RacePhase {
    Countdown,
    Racing,
    Finished
}

data class MiniRacersState(
    val phase: RacePhase = RacePhase.Countdown,
    val countdownValue: Int = 3,
    val cars: List<CarState> = emptyList(),
    val playerCount: Int = 2,
    /** Index of the winner, or -1 if no winner yet. */
    val winnerIndex: Int = -1,
    /**
     * Ranking list – player indices sorted from first to last.
     * Updated every frame while racing.
     */
    val rankings: List<Int> = emptyList()
)

// ---------------------------------------------------------------------------
// Track geometry helpers
// ---------------------------------------------------------------------------

/**
 * The track is an ellipse. These fractions describe the parametric-angle
 * ranges that count as "curves". The ellipse is parameterised so that
 * t = 0 is the right-most point and it proceeds counter-clockwise:
 *
 *  t ∈ [0.00, 0.20] → top-right curve
 *  t ∈ [0.20, 0.50] → left straight (top-left curve at 0.20-0.30, left straight 0.30-0.50 — simplified below)
 *
 * For a simple oval we treat the left and right halves as curves and the
 * top and bottom as straights:
 *
 *  Straight: t ∈ [0.00, 0.15] and [0.35, 0.65] and [0.85, 1.00]
 *  Curve   : t ∈ [0.15, 0.35] and [0.65, 0.85]
 *
 * The car starts at t = 0 (right-centre of the ellipse, i.e. the "finish
 * line").
 */
fun isCurve(t: Float): Boolean {
    val tn = ((t % 1f) + 1f) % 1f // normalise to [0, 1)
    return (tn in 0.15f..0.35f) || (tn in 0.65f..0.85f)
}

/**
 * Return the curvature intensity at position [t]. 0 = straight, 1 = peak
 * curve. This makes the penalty smooth rather than a hard step.
 */
fun curvature(t: Float): Float {
    val tn = ((t % 1f) + 1f) % 1f
    // Distance to the nearest curve centre (0.25 or 0.75)
    val d1 = abs(tn - 0.25f)
    val d2 = abs(tn - 0.75f)
    val d = min(d1, d2)
    // Within 0.10 of centre → fully curved, fading to 0 at 0.10 out
    return max(0f, 1f - d / 0.10f)
}

/**
 * Convert a track-position [t] (0-1) to an (x, y) point on the ellipse.
 *
 * The ellipse is centred at ([cx], [cy]) with semi-axes [rx] and [ry].
 * t = 0 is the right-most point; the path proceeds **clockwise** (which on
 * screen with y-down means the standard math-positive direction maps to
 * screen-clockwise if we negate the sin component for y).
 */
fun trackPoint(t: Float, cx: Float, cy: Float, rx: Float, ry: Float): Pair<Float, Float> {
    val angle = t * 2f * Math.PI.toFloat()
    val x = cx + rx * cos(angle)
    val y = cy - ry * sin(angle)
    return x to y
}

/**
 * Return the **outward** normal direction at position [t] on the ellipse.
 * This is used to apply lateral offsets (drift/lane offset) perpendicular
 * to the track.
 */
fun trackNormal(t: Float): Pair<Float, Float> {
    val angle = t * 2f * Math.PI.toFloat()
    // The outward normal on an ellipse parameterised as (cos θ, −sin θ)
    // points in the (cos θ, −sin θ) direction itself (for a circle they are
    // equal; for an ellipse this is a good-enough visual approximation).
    val nx = cos(angle)
    val ny = -sin(angle)
    val len = kotlin.math.sqrt(nx * nx + ny * ny)
    return (nx / len) to (ny / len)
}

// ---------------------------------------------------------------------------
// ViewModel
// ---------------------------------------------------------------------------

class MiniRacersViewModel : ViewModel() {

    private val _state = MutableStateFlow(MiniRacersState())
    val state: StateFlow<MiniRacersState> = _state.asStateFlow()

    /**
     * Initialise the game for [playerCount] players. Each car starts at
     * t = 0 with zero speed.
     */
    fun initialize(playerCount: Int) {
        val cars = List(playerCount) { CarState() }
        _state.value = MiniRacersState(
            phase = RacePhase.Countdown,
            countdownValue = 3,
            cars = cars,
            playerCount = playerCount,
            winnerIndex = -1,
            rankings = (0 until playerCount).toList()
        )
    }

    /** Called from the UI when a player presses or releases their button. */
    fun setAccelerating(playerIndex: Int, accelerating: Boolean) {
        val current = _state.value
        if (playerIndex !in current.cars.indices) return
        if (current.phase != RacePhase.Racing) return

        val updatedCars = current.cars.toMutableList()
        updatedCars[playerIndex] = updatedCars[playerIndex].copy(isAccelerating = accelerating)
        _state.value = current.copy(cars = updatedCars)
    }

    /** Advance the countdown by one tick. Returns the new countdown value. */
    fun tickCountdown(): Int {
        val current = _state.value
        if (current.phase != RacePhase.Countdown) return 0
        val next = current.countdownValue - 1
        if (next <= 0) {
            _state.value = current.copy(phase = RacePhase.Racing, countdownValue = 0)
        } else {
            _state.value = current.copy(countdownValue = next)
        }
        return next
    }

    /** Start racing immediately (called after the "GO!" display). */
    fun startRacing() {
        val current = _state.value
        if (current.phase == RacePhase.Countdown) {
            _state.value = current.copy(phase = RacePhase.Racing, countdownValue = 0)
        }
    }

    // -----------------------------------------------------------------
    // Game-loop update
    // -----------------------------------------------------------------

    /**
     * Advance the simulation by [deltaTime] seconds.
     * Called every frame from the composable game loop.
     */
    fun update(deltaTime: Float) {
        val current = _state.value
        if (current.phase != RacePhase.Racing) return

        val dt = deltaTime.coerceIn(0f, 0.05f) // cap to avoid huge jumps

        val updatedCars = current.cars.mapIndexed { index, car ->
            updateCar(car, dt)
        }

        // --- Winner detection ---
        var winnerIndex = -1
        for (i in updatedCars.indices) {
            if (updatedCars[i].lapCount >= LAPS_TO_WIN) {
                winnerIndex = i
                break
            }
        }

        // --- Rankings (descending by progress) ---
        val ranked = (0 until current.playerCount).sortedByDescending { i ->
            updatedCars[i].lapCount.toFloat() + updatedCars[i].trackPosition
        }

        val newPhase = if (winnerIndex >= 0) RacePhase.Finished else RacePhase.Racing

        _state.value = current.copy(
            cars = updatedCars,
            winnerIndex = winnerIndex,
            rankings = ranked,
            phase = newPhase
        )
    }

    private fun updateCar(car: CarState, dt: Float): CarState {
        var speed = car.speed
        var lateralOffset = car.lateralOffset
        var isSkidding = false

        // --- Acceleration / friction ---
        if (car.isAccelerating) {
            speed += ACCELERATION * dt
        } else {
            speed -= FRICTION * dt
        }
        speed = speed.coerceIn(0f, MAX_SPEED)

        // --- Curve penalty ---
        val curv = curvature(car.trackPosition)
        if (curv > 0f && speed > CURVE_SPEED_THRESHOLD) {
            isSkidding = true
            // How far over the threshold
            val excess = speed - CURVE_SPEED_THRESHOLD
            // Speed reduction proportional to curvature and excess
            speed -= CURVE_SPEED_PENALTY * curv * dt
            speed = speed.coerceAtLeast(CURVE_SPEED_THRESHOLD * 0.7f)
            // Drift outward
            lateralOffset += LATERAL_DRIFT_RATE * curv * (excess / MAX_SPEED) * dt
        }

        // --- Lateral recovery (always pull back toward centre) ---
        if (lateralOffset > 0f) {
            lateralOffset -= LATERAL_RECOVERY_RATE * dt
            lateralOffset = lateralOffset.coerceAtLeast(0f)
        } else if (lateralOffset < 0f) {
            lateralOffset += LATERAL_RECOVERY_RATE * dt
            lateralOffset = lateralOffset.coerceAtMost(0f)
        }
        lateralOffset = lateralOffset.coerceIn(-MAX_LATERAL_OFFSET, MAX_LATERAL_OFFSET)

        // --- Move along track ---
        var newPosition = car.trackPosition + speed * dt
        var newLapCount = car.lapCount

        // Lap detection: when position wraps past 1.0
        if (newPosition >= 1f) {
            newPosition -= 1f
            newLapCount++
        }

        return car.copy(
            trackPosition = newPosition,
            speed = speed,
            lateralOffset = lateralOffset,
            lapCount = newLapCount,
            isSkidding = isSkidding
        )
    }
}
