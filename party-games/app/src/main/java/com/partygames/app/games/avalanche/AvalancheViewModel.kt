package com.partygames.app.games.avalanche

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlin.random.Random

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Radius of each player's circle in game-world pixels. */
const val CHARACTER_RADIUS = 18f

/** Width of each platform in game-world pixels. */
const val PLATFORM_WIDTH = 90f

/** Height (thickness) of each platform in game-world pixels. */
const val PLATFORM_HEIGHT = 12f

/** Vertical spacing between platform spawn rows (in game-world pixels). */
const val PLATFORM_SPACING_MIN = 140f
const val PLATFORM_SPACING_MAX = 200f

/** Gravity acceleration (pixels / sec^2, positive = downward). */
const val GRAVITY = 1200f

/** Upward impulse applied when a player jumps (pixels / sec). */
const val JUMP_IMPULSE = -620f

/** Initial lava rise speed (pixels / sec). */
const val INITIAL_LAVA_SPEED = 30f

/** How much lava speed increases per second of gameplay (pixels / sec^2). */
const val LAVA_ACCELERATION = 1.8f

/** Camera scrolls so this fraction of the screen is above the highest alive player. */
const val CAMERA_LOOK_AHEAD = 0.35f

/** How quickly the camera tracks upward (lerp factor per frame). */
const val CAMERA_SMOOTH = 3.5f

/** Y coordinate of the very first row of starting platforms (world space). */
const val STARTING_PLATFORM_Y = 0f

/** How far above the visible area new platforms are pre-spawned. */
const val SPAWN_BUFFER = 600f

// ---------------------------------------------------------------------------
// Data models
// ---------------------------------------------------------------------------

data class Platform(
    /** Left edge X in game-world coordinates. */
    val x: Float,
    /** Y position in game-world coordinates (larger = higher). */
    val y: Float,
    val width: Float = PLATFORM_WIDTH
)

data class PlayerCharacter(
    /** World Y position (centre of the circle). Larger = higher. */
    val y: Float = 0f,
    /** Vertical velocity in world units/sec. Negative = upward. */
    val vy: Float = 0f,
    /** True while the character is standing on a platform. */
    val onPlatform: Boolean = true,
    /** Index into the column's platform list, or -1 if airborne. */
    val currentPlatformIndex: Int = 0,
    /** Whether this player is still alive. */
    val alive: Boolean = true
)

enum class AvalanchePhase {
    Countdown,
    Playing,
    GameOver
}

data class AvalancheState(
    val phase: AvalanchePhase = AvalanchePhase.Countdown,
    val countdownValue: Int = 3,
    val playerCount: Int = 2,

    /** Per-column list of platforms, indexed by player index. */
    val platforms: List<List<Platform>> = emptyList(),

    /** Per-player character state. */
    val players: List<PlayerCharacter> = emptyList(),

    /** Camera Y offset – the world-Y coordinate shown at the bottom of the viewport. */
    val cameraY: Float = -200f,

    /** Current world-Y of the lava surface. Everything below this is lava. */
    val lavaY: Float = -300f,

    /** Elapsed play time in seconds (used to ramp lava speed). */
    val elapsed: Float = 0f,

    /** Index of the winning player, or -1. */
    val winnerIndex: Int = -1
)

// ---------------------------------------------------------------------------
// ViewModel
// ---------------------------------------------------------------------------

class AvalancheViewModel : ViewModel() {

    private val _state = MutableStateFlow(AvalancheState())
    val state: StateFlow<AvalancheState> = _state.asStateFlow()

    /** Tracks the highest platform Y that has been spawned in each column. */
    private var highestSpawnedY: FloatArray = floatArrayOf()

    // -----------------------------------------------------------------------
    // Initialisation
    // -----------------------------------------------------------------------

    fun initialize(playerCount: Int) {
        val clamped = playerCount.coerceIn(2, 4)

        // Build initial platforms for each column.
        val allPlatforms = mutableListOf<List<Platform>>()
        highestSpawnedY = FloatArray(clamped)

        for (col in 0 until clamped) {
            val columnPlatforms = mutableListOf<Platform>()
            var y = STARTING_PLATFORM_Y
            // Pre-generate platforms from the starting position upward.
            while (y < STARTING_PLATFORM_Y + SPAWN_BUFFER + 400f) {
                val platX = randomPlatformX(col, clamped)
                columnPlatforms.add(Platform(x = platX, y = y))
                y += Random.nextFloat() * (PLATFORM_SPACING_MAX - PLATFORM_SPACING_MIN) + PLATFORM_SPACING_MIN
            }
            highestSpawnedY[col] = y
            allPlatforms.add(columnPlatforms)
        }

        // Place each player on the first platform in their column.
        val players = List(clamped) { i ->
            val firstPlatform = allPlatforms[i].first()
            PlayerCharacter(
                y = firstPlatform.y + CHARACTER_RADIUS + PLATFORM_HEIGHT / 2f,
                vy = 0f,
                onPlatform = true,
                currentPlatformIndex = 0,
                alive = true
            )
        }

        _state.value = AvalancheState(
            phase = AvalanchePhase.Countdown,
            countdownValue = 3,
            playerCount = clamped,
            platforms = allPlatforms,
            players = players,
            cameraY = -200f,
            lavaY = -300f,
            elapsed = 0f,
            winnerIndex = -1
        )

        // Run the countdown then switch to Playing.
        viewModelScope.launch {
            for (tick in 3 downTo 1) {
                _state.value = _state.value.copy(countdownValue = tick)
                delay(1000L)
            }
            _state.value = _state.value.copy(phase = AvalanchePhase.Playing)
        }
    }

    // -----------------------------------------------------------------------
    // Player action
    // -----------------------------------------------------------------------

    fun jump(playerIndex: Int) {
        val s = _state.value
        if (s.phase != AvalanchePhase.Playing) return
        if (playerIndex !in s.players.indices) return

        val player = s.players[playerIndex]
        if (!player.alive || !player.onPlatform) return

        val updatedPlayers = s.players.toMutableList()
        updatedPlayers[playerIndex] = player.copy(
            vy = JUMP_IMPULSE,
            onPlatform = false,
            currentPlatformIndex = -1
        )
        _state.value = s.copy(players = updatedPlayers)
    }

    // -----------------------------------------------------------------------
    // Per-frame update
    // -----------------------------------------------------------------------

    fun update(deltaTime: Float) {
        val s = _state.value
        if (s.phase != AvalanchePhase.Playing) return

        val dt = deltaTime.coerceIn(0f, 0.05f) // safety cap

        // 1. Advance elapsed time & lava
        val newElapsed = s.elapsed + dt
        val lavaSpeed = INITIAL_LAVA_SPEED + LAVA_ACCELERATION * newElapsed
        val newLavaY = s.lavaY + lavaSpeed * dt

        // 2. Update each player
        val updatedPlayers = s.players.toMutableList()
        val updatedPlatforms = s.platforms.map { it.toMutableList() }.toMutableList()

        for (i in updatedPlayers.indices) {
            var p = updatedPlayers[i]
            if (!p.alive) continue

            if (p.onPlatform) {
                // Validate that the current platform is still above lava.
                val platIdx = p.currentPlatformIndex
                if (platIdx >= 0 && platIdx < updatedPlatforms[i].size) {
                    val plat = updatedPlatforms[i][platIdx]
                    if (plat.y < newLavaY) {
                        // Platform consumed by lava – character is now airborne.
                        p = p.copy(onPlatform = false, currentPlatformIndex = -1)
                    }
                } else {
                    p = p.copy(onPlatform = false, currentPlatformIndex = -1)
                }
            }

            if (!p.onPlatform) {
                // Apply gravity
                val newVy = p.vy + GRAVITY * dt
                var newY = p.y + newVy * dt

                // Check for landing on a platform (only when falling downward)
                if (newVy > 0f) {
                    val columnPlats = updatedPlatforms[i]
                    val colLeft = columnLeftX(i, s.playerCount)
                    val colRight = colLeft + columnWidth(s.playerCount)
                    val charFeetY = newY - CHARACTER_RADIUS

                    for ((pi, plat) in columnPlats.withIndex()) {
                        if (plat.y < newLavaY) continue // below lava
                        val platTop = plat.y + PLATFORM_HEIGHT / 2f
                        val platBottom = plat.y - PLATFORM_HEIGHT / 2f

                        // Character feet pass through the platform top this frame
                        val prevFeetY = p.y - CHARACTER_RADIUS
                        if (prevFeetY >= platTop && charFeetY < platTop) {
                            // Horizontal overlap check (character centre vs platform extent)
                            // Character X is fixed to column centre, platform X is relative within column.
                            // Both are in the same column so overlap is guaranteed by spawn logic,
                            // but we still verify.
                            val charCX = columnCentreX(i, s.playerCount)
                            if (charCX + CHARACTER_RADIUS > plat.x &&
                                charCX - CHARACTER_RADIUS < plat.x + plat.width
                            ) {
                                newY = platTop + CHARACTER_RADIUS
                                p = p.copy(
                                    y = newY,
                                    vy = 0f,
                                    onPlatform = true,
                                    currentPlatformIndex = pi
                                )
                                break
                            }
                        }
                    }

                    // If still airborne after checks, update position.
                    if (!p.onPlatform) {
                        p = p.copy(y = newY, vy = newVy)
                    }
                } else {
                    // Moving upward – just update position.
                    p = p.copy(y = newY, vy = newVy)
                }
            }

            // 3. Check elimination (character below lava)
            if (p.y - CHARACTER_RADIUS < newLavaY) {
                p = p.copy(alive = false)
            }

            updatedPlayers[i] = p
        }

        // 4. Check game over
        val aliveIndices = updatedPlayers.indices.filter { updatedPlayers[it].alive }
        val phase: AvalanchePhase
        var winnerIndex = s.winnerIndex

        if (aliveIndices.size <= 1) {
            phase = AvalanchePhase.GameOver
            winnerIndex = aliveIndices.firstOrNull() ?: -1
        } else {
            phase = AvalanchePhase.Playing
        }

        // 5. Camera: track the highest alive player with some look-ahead.
        val highestAliveY = updatedPlayers
            .filter { it.alive }
            .maxOfOrNull { it.y } ?: s.cameraY
        val targetCameraY = highestAliveY - 400f // show player ~400px above screen bottom
        val newCameraY = s.cameraY + (targetCameraY - s.cameraY) * (CAMERA_SMOOTH * dt).coerceIn(0f, 1f)

        // 6. Spawn new platforms above the visible range.
        val screenTopWorld = newCameraY + 1800f // generous estimate of screen height in world coords
        for (col in 0 until s.playerCount) {
            while (highestSpawnedY[col] < screenTopWorld + SPAWN_BUFFER) {
                val spacing = Random.nextFloat() * (PLATFORM_SPACING_MAX - PLATFORM_SPACING_MIN) + PLATFORM_SPACING_MIN
                highestSpawnedY[col] += spacing
                val platX = randomPlatformX(col, s.playerCount)
                updatedPlatforms[col].add(Platform(x = platX, y = highestSpawnedY[col]))
            }
        }

        // 7. Prune platforms that are well below lava to save memory.
        for (col in updatedPlatforms.indices) {
            val before = updatedPlatforms[col]
            val pruned = before.filter { it.y + PLATFORM_HEIGHT > newLavaY - 200f }.toMutableList()
            // If we pruned platforms, we need to fix currentPlatformIndex for the player in this column.
            if (pruned.size < before.size) {
                val removed = before.size - pruned.size
                val player = updatedPlayers[col]
                if (player.onPlatform && player.currentPlatformIndex >= 0) {
                    val newIdx = player.currentPlatformIndex - removed
                    if (newIdx < 0) {
                        updatedPlayers[col] = player.copy(onPlatform = false, currentPlatformIndex = -1)
                    } else {
                        updatedPlayers[col] = player.copy(currentPlatformIndex = newIdx)
                    }
                }
            }
            updatedPlatforms[col] = pruned.toMutableList()
        }

        _state.value = s.copy(
            phase = phase,
            elapsed = newElapsed,
            lavaY = newLavaY,
            cameraY = newCameraY,
            players = updatedPlayers,
            platforms = updatedPlatforms.map { it.toList() },
            winnerIndex = winnerIndex
        )
    }

    // -----------------------------------------------------------------------
    // Helpers – column geometry (in a normalised 1000-px wide world)
    // -----------------------------------------------------------------------

    companion object {
        /** Total world width used for layout calculations. */
        const val WORLD_WIDTH = 1000f

        fun columnWidth(playerCount: Int): Float = WORLD_WIDTH / playerCount

        fun columnLeftX(columnIndex: Int, playerCount: Int): Float =
            columnIndex * columnWidth(playerCount)

        fun columnCentreX(columnIndex: Int, playerCount: Int): Float =
            columnLeftX(columnIndex, playerCount) + columnWidth(playerCount) / 2f

        /** Generate a random platform X (left-edge) that stays inside the column. */
        fun randomPlatformX(columnIndex: Int, playerCount: Int): Float {
            val colLeft = columnLeftX(columnIndex, playerCount)
            val colW = columnWidth(playerCount)
            val margin = 8f
            val minX = colLeft + margin
            val maxX = colLeft + colW - PLATFORM_WIDTH - margin
            return if (maxX <= minX) minX else Random.nextFloat() * (maxX - minX) + minX
        }
    }
}
