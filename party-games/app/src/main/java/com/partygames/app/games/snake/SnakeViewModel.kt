package com.partygames.app.games.snake

import androidx.lifecycle.ViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlin.random.Random

enum class Direction { UP, DOWN, LEFT, RIGHT }

enum class GamePhase { COUNTDOWN, PLAYING, GAME_OVER }

data class Point(val x: Int, val y: Int)

data class Snake(
    val segments: List<Point>,
    val direction: Direction,
    val alive: Boolean = true,
    val pendingTurn: Direction? = null
)

data class SnakeGameState(
    val snakes: List<Snake>,
    val food: Set<Point>,
    val phase: GamePhase,
    val countdownValue: Int,
    val winnerIndex: Int
)

class SnakeViewModel : ViewModel() {

    companion object {
        const val GRID_WIDTH = 20
        const val GRID_HEIGHT = 20
        const val INITIAL_LENGTH = 3
        const val MIN_FOOD = 2
        const val MAX_FOOD = 3
    }

    private var playerCount = 2

    private var snakes = mutableListOf<Snake>()
    private var food = mutableSetOf<Point>()
    private var phase = GamePhase.COUNTDOWN
    private var countdownValue = 3
    private var winnerIndex = -1

    private val _state = MutableStateFlow(buildState())
    val state: StateFlow<SnakeGameState> = _state.asStateFlow()

    fun initialize(players: Int) {
        playerCount = players.coerceIn(2, 4)
        snakes.clear()
        food.clear()
        phase = GamePhase.COUNTDOWN
        countdownValue = 3
        winnerIndex = -1

        // Create snakes in corners, facing toward center
        val startConfigs = listOf(
            // Top-left corner, facing RIGHT (toward center)
            Triple(1, 1, Direction.RIGHT),
            // Top-right corner, facing DOWN (toward center)
            Triple(GRID_WIDTH - 2, 1, Direction.DOWN),
            // Bottom-left corner, facing UP (toward center)
            Triple(1, GRID_HEIGHT - 2, Direction.UP),
            // Bottom-right corner, facing LEFT (toward center)
            Triple(GRID_WIDTH - 2, GRID_HEIGHT - 2, Direction.LEFT)
        )

        for (i in 0 until playerCount) {
            val (startX, startY, dir) = startConfigs[i]
            val segments = mutableListOf<Point>()
            // Head is at start position, tail extends behind
            for (s in 0 until INITIAL_LENGTH) {
                val segment = when (dir) {
                    Direction.RIGHT -> Point(startX - s, startY)
                    Direction.LEFT -> Point(startX + s, startY)
                    Direction.UP -> Point(startX, startY + s)
                    Direction.DOWN -> Point(startX, startY - s)
                }
                segments.add(segment)
            }
            snakes.add(Snake(segments = segments, direction = dir))
        }

        spawnFood()
        emitState()
    }

    fun turnLeft(playerIndex: Int) {
        if (playerIndex !in snakes.indices) return
        if (!snakes[playerIndex].alive) return
        if (phase != GamePhase.PLAYING) return

        val current = snakes[playerIndex].pendingTurn ?: snakes[playerIndex].direction
        val newDir = when (current) {
            Direction.UP -> Direction.LEFT
            Direction.LEFT -> Direction.DOWN
            Direction.DOWN -> Direction.RIGHT
            Direction.RIGHT -> Direction.UP
        }
        snakes[playerIndex] = snakes[playerIndex].copy(pendingTurn = newDir)
        emitState()
    }

    fun turnRight(playerIndex: Int) {
        if (playerIndex !in snakes.indices) return
        if (!snakes[playerIndex].alive) return
        if (phase != GamePhase.PLAYING) return

        val current = snakes[playerIndex].pendingTurn ?: snakes[playerIndex].direction
        val newDir = when (current) {
            Direction.UP -> Direction.RIGHT
            Direction.RIGHT -> Direction.DOWN
            Direction.DOWN -> Direction.LEFT
            Direction.LEFT -> Direction.UP
        }
        snakes[playerIndex] = snakes[playerIndex].copy(pendingTurn = newDir)
        emitState()
    }

    fun countdownTick() {
        if (phase != GamePhase.COUNTDOWN) return
        countdownValue--
        if (countdownValue <= 0) {
            phase = GamePhase.PLAYING
        }
        emitState()
    }

    fun tick() {
        if (phase != GamePhase.PLAYING) return

        // Apply pending turns and compute new head positions
        val newHeads = mutableListOf<Point>()
        for (i in snakes.indices) {
            val snake = snakes[i]
            if (!snake.alive) {
                newHeads.add(snake.segments.first()) // placeholder
                continue
            }
            val dir = snake.pendingTurn ?: snake.direction
            snakes[i] = snake.copy(direction = dir, pendingTurn = null)
            val head = snake.segments.first()
            val newHead = when (dir) {
                Direction.UP -> Point(head.x, head.y - 1)
                Direction.DOWN -> Point(head.x, head.y + 1)
                Direction.LEFT -> Point(head.x - 1, head.y)
                Direction.RIGHT -> Point(head.x + 1, head.y)
            }
            newHeads.add(newHead)
        }

        // Determine which snakes eat food this tick
        val eatingFood = mutableSetOf<Int>()
        for (i in snakes.indices) {
            if (!snakes[i].alive) continue
            if (newHeads[i] in food) {
                eatingFood.add(i)
            }
        }

        // Move snakes: add new head, remove tail (unless eating)
        for (i in snakes.indices) {
            if (!snakes[i].alive) continue
            val snake = snakes[i]
            val newSegments = mutableListOf(newHeads[i])
            newSegments.addAll(snake.segments)
            if (i !in eatingFood) {
                newSegments.removeAt(newSegments.size - 1)
            }
            snakes[i] = snakes[i].copy(segments = newSegments)
        }

        // Remove eaten food
        for (i in eatingFood) {
            food.remove(newHeads[i])
        }

        // Check collisions
        checkCollisions()

        // Spawn food if needed
        spawnFood()

        // Check for winner
        val aliveSnakes = snakes.withIndex().filter { it.value.alive }
        if (aliveSnakes.size <= 1) {
            phase = GamePhase.GAME_OVER
            winnerIndex = if (aliveSnakes.size == 1) aliveSnakes[0].index else -1
        }

        emitState()
    }

    private fun checkCollisions() {
        val killList = mutableSetOf<Int>()

        for (i in snakes.indices) {
            if (!snakes[i].alive) continue
            val head = snakes[i].segments.first()

            // Wall collision
            if (head.x < 0 || head.x >= GRID_WIDTH || head.y < 0 || head.y >= GRID_HEIGHT) {
                killList.add(i)
                continue
            }

            // Self collision (head hitting own body, skip index 0 which is head itself)
            val body = snakes[i].segments.drop(1)
            if (head in body) {
                killList.add(i)
                continue
            }

            // Collision with other snakes (any segment including head)
            for (j in snakes.indices) {
                if (i == j) continue
                if (!snakes[j].alive) continue
                val otherSegments = snakes[j].segments
                if (head in otherSegments) {
                    killList.add(i)
                    break
                }
            }
        }

        // Handle head-on collisions: if two snakes' new heads occupy the same cell, both die
        for (i in snakes.indices) {
            if (!snakes[i].alive) continue
            for (j in i + 1 until snakes.size) {
                if (!snakes[j].alive) continue
                if (snakes[i].segments.first() == snakes[j].segments.first()) {
                    killList.add(i)
                    killList.add(j)
                }
            }
        }

        for (i in killList) {
            snakes[i] = snakes[i].copy(alive = false)
        }
    }

    private fun spawnFood() {
        val occupiedCells = mutableSetOf<Point>()
        for (snake in snakes) {
            if (snake.alive) {
                occupiedCells.addAll(snake.segments)
            }
        }
        occupiedCells.addAll(food)

        while (food.size < MIN_FOOD) {
            val empty = findEmptyCell(occupiedCells) ?: break
            food.add(empty)
            occupiedCells.add(empty)
        }

        // Randomly add up to MAX_FOOD
        if (food.size < MAX_FOOD && Random.nextFloat() < 0.3f) {
            val empty = findEmptyCell(occupiedCells)
            if (empty != null) {
                food.add(empty)
                occupiedCells.add(empty)
            }
        }
    }

    private fun findEmptyCell(occupied: Set<Point>): Point? {
        // Try random placement first for performance
        repeat(50) {
            val p = Point(Random.nextInt(GRID_WIDTH), Random.nextInt(GRID_HEIGHT))
            if (p !in occupied) return p
        }
        // Fallback: scan the grid
        val emptyCells = mutableListOf<Point>()
        for (x in 0 until GRID_WIDTH) {
            for (y in 0 until GRID_HEIGHT) {
                val p = Point(x, y)
                if (p !in occupied) emptyCells.add(p)
            }
        }
        return emptyCells.randomOrNull()
    }

    private fun buildState(): SnakeGameState {
        return SnakeGameState(
            snakes = snakes.toList(),
            food = food.toSet(),
            phase = phase,
            countdownValue = countdownValue,
            winnerIndex = winnerIndex
        )
    }

    private fun emitState() {
        _state.value = buildState()
    }
}
