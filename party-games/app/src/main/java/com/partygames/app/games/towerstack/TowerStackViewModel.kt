package com.partygames.app.games.towerstack

import androidx.lifecycle.ViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

data class PlacedBlock(
    val x: Float,
    val width: Float,
    val playerIndex: Int,
    val level: Int
)

enum class GamePhase {
    Playing,
    GameOver
}

data class TowerStackState(
    val placedBlocks: List<PlacedBlock> = emptyList(),
    val swingX: Float = 0f,
    val currentBlockWidth: Float = BOARD_WIDTH,
    val currentPlayerIndex: Int = 0,
    val eliminatedPlayers: Set<Int> = emptySet(),
    val gamePhase: GamePhase = GamePhase.Playing,
    val playerScores: Map<Int, Float> = emptyMap(),
    val blocksPlaced: Int = 0,
    val totalBlocks: Int = TOTAL_BLOCKS,
    val playerCount: Int = 2,
    val swingDirection: Int = 1,
    val swingSpeed: Float = BASE_SWING_SPEED,
    val eliminationMessage: String? = null,
    val winnerIndex: Int = -1,
    val isDropping: Boolean = false,
    val dropX: Float = 0f,
    val dropY: Float = 0f,
    val dropTargetY: Float = 0f,
    val dropWidth: Float = 0f,
    val dropPlayerIndex: Int = 0
) {
    val activePlayers: List<Int>
        get() = (0 until playerCount).filter { it !in eliminatedPlayers }
}

const val BOARD_WIDTH = 300f
const val BLOCK_HEIGHT = 30f
const val BASE_SWING_SPEED = 200f
const val SWING_SPEED_INCREMENT = 12f
const val TOTAL_BLOCKS = 20
const val SWING_MARGIN = 40f
const val DROP_SPEED = 1200f

class TowerStackViewModel : ViewModel() {

    private val _state = MutableStateFlow(TowerStackState())
    val state: StateFlow<TowerStackState> = _state.asStateFlow()

    fun initialize(playerCount: Int) {
        val initialScores = (0 until playerCount).associateWith { 0f }
        _state.value = TowerStackState(
            playerCount = playerCount,
            playerScores = initialScores,
            currentBlockWidth = BOARD_WIDTH,
            swingX = 0f,
            swingDirection = 1,
            swingSpeed = BASE_SWING_SPEED
        )
    }

    fun update(deltaTime: Float) {
        val current = _state.value
        if (current.gamePhase != GamePhase.Playing) return

        if (current.isDropping) {
            // Animate the drop
            val newDropY = current.dropY + DROP_SPEED * deltaTime
            if (newDropY >= current.dropTargetY) {
                // Drop complete - resolve placement
                resolveDroppedBlock(current)
            } else {
                _state.value = current.copy(dropY = newDropY)
            }
            return
        }

        // Swing the block left-right
        val halfBoard = BOARD_WIDTH / 2f
        val swingRange = halfBoard + SWING_MARGIN
        var newX = current.swingX + current.swingSpeed * current.swingDirection * deltaTime
        var newDirection = current.swingDirection

        // Bounce at edges
        val halfBlock = current.currentBlockWidth / 2f
        val minX = -swingRange + halfBlock
        val maxX = swingRange - halfBlock

        if (newX > maxX) {
            newX = maxX
            newDirection = -1
        } else if (newX < minX) {
            newX = minX
            newDirection = 1
        }

        _state.value = current.copy(
            swingX = newX,
            swingDirection = newDirection
        )
    }

    fun dropBlock() {
        val current = _state.value
        if (current.gamePhase != GamePhase.Playing || current.isDropping) return

        val level = current.placedBlocks.size
        val swingY = (level + 1) * BLOCK_HEIGHT
        val targetY = level * BLOCK_HEIGHT

        _state.value = current.copy(
            isDropping = true,
            dropX = current.swingX,
            dropY = swingY + BLOCK_HEIGHT * 2, // Start from above (swing position)
            dropTargetY = targetY,
            dropWidth = current.currentBlockWidth,
            dropPlayerIndex = current.currentPlayerIndex
        )
    }

    private fun resolveDroppedBlock(current: TowerStackState) {
        val level = current.placedBlocks.size
        val dropX = current.dropX
        val blockWidth = current.dropWidth
        val playerIndex = current.dropPlayerIndex

        // Block edges (center-based positioning)
        val blockLeft = dropX - blockWidth / 2f
        val blockRight = dropX + blockWidth / 2f

        if (level == 0) {
            // First block: always lands on the base platform
            val baseLeft = -BOARD_WIDTH / 2f
            val baseRight = BOARD_WIDTH / 2f

            // Trim to base bounds
            val overlapLeft = max(blockLeft, baseLeft)
            val overlapRight = min(blockRight, baseRight)
            val overlapWidth = overlapRight - overlapLeft

            if (overlapWidth <= 0f) {
                // Missed entirely
                eliminatePlayer(current, playerIndex)
                return
            }

            val overlapCenterX = (overlapLeft + overlapRight) / 2f
            val newBlock = PlacedBlock(
                x = overlapCenterX,
                width = overlapWidth,
                playerIndex = playerIndex,
                level = level
            )

            val newScores = current.playerScores.toMutableMap()
            newScores[playerIndex] = (newScores[playerIndex] ?: 0f) + overlapWidth

            val newBlocksPlaced = current.blocksPlaced + 1
            val newSpeed = BASE_SWING_SPEED + SWING_SPEED_INCREMENT * (level + 1)

            if (newBlocksPlaced >= current.totalBlocks) {
                finishGame(current.copy(
                    placedBlocks = current.placedBlocks + newBlock,
                    playerScores = newScores,
                    blocksPlaced = newBlocksPlaced,
                    isDropping = false
                ))
                return
            }

            val nextPlayer = getNextPlayer(playerIndex, current.eliminatedPlayers, current.playerCount)
            _state.value = current.copy(
                placedBlocks = current.placedBlocks + newBlock,
                swingX = 0f,
                currentBlockWidth = overlapWidth,
                currentPlayerIndex = nextPlayer,
                playerScores = newScores,
                blocksPlaced = newBlocksPlaced,
                swingSpeed = newSpeed,
                swingDirection = 1,
                eliminationMessage = null,
                isDropping = false
            )
        } else {
            // Subsequent blocks: trim overhang against top block
            val topBlock = current.placedBlocks.last()
            val topLeft = topBlock.x - topBlock.width / 2f
            val topRight = topBlock.x + topBlock.width / 2f

            val overlapLeft = max(blockLeft, topLeft)
            val overlapRight = min(blockRight, topRight)
            val overlapWidth = overlapRight - overlapLeft

            if (overlapWidth <= 0f) {
                // Missed entirely
                eliminatePlayer(current, playerIndex)
                return
            }

            val overlapCenterX = (overlapLeft + overlapRight) / 2f
            val newBlock = PlacedBlock(
                x = overlapCenterX,
                width = overlapWidth,
                playerIndex = playerIndex,
                level = level
            )

            val newScores = current.playerScores.toMutableMap()
            newScores[playerIndex] = (newScores[playerIndex] ?: 0f) + overlapWidth

            val newBlocksPlaced = current.blocksPlaced + 1
            val newSpeed = BASE_SWING_SPEED + SWING_SPEED_INCREMENT * (level + 1)

            if (newBlocksPlaced >= current.totalBlocks) {
                finishGame(current.copy(
                    placedBlocks = current.placedBlocks + newBlock,
                    playerScores = newScores,
                    blocksPlaced = newBlocksPlaced,
                    isDropping = false
                ))
                return
            }

            val nextPlayer = getNextPlayer(playerIndex, current.eliminatedPlayers, current.playerCount)
            _state.value = current.copy(
                placedBlocks = current.placedBlocks + newBlock,
                swingX = 0f,
                currentBlockWidth = overlapWidth,
                currentPlayerIndex = nextPlayer,
                playerScores = newScores,
                blocksPlaced = newBlocksPlaced,
                swingSpeed = newSpeed,
                swingDirection = 1,
                eliminationMessage = null,
                isDropping = false
            )
        }
    }

    private fun eliminatePlayer(current: TowerStackState, playerIndex: Int) {
        val newEliminated = current.eliminatedPlayers + playerIndex
        val activePlayers = (0 until current.playerCount).filter { it !in newEliminated }
        val playerLabel = "Player ${playerIndex + 1}"

        if (activePlayers.size <= 1) {
            // Game over
            val winner = activePlayers.firstOrNull() ?: playerIndex
            _state.value = current.copy(
                eliminatedPlayers = newEliminated,
                gamePhase = GamePhase.GameOver,
                winnerIndex = winner,
                eliminationMessage = "$playerLabel missed! $playerLabel eliminated!",
                isDropping = false
            )
            return
        }

        // Continue with remaining players; keep the same block width (use previous top block)
        val blockWidth = if (current.placedBlocks.isNotEmpty()) {
            current.placedBlocks.last().width
        } else {
            BOARD_WIDTH
        }

        val newBlocksPlaced = current.blocksPlaced + 1
        if (newBlocksPlaced >= current.totalBlocks) {
            finishGame(current.copy(
                eliminatedPlayers = newEliminated,
                blocksPlaced = newBlocksPlaced,
                eliminationMessage = "$playerLabel missed! $playerLabel eliminated!",
                isDropping = false
            ))
            return
        }

        val nextPlayer = getNextPlayer(playerIndex, newEliminated, current.playerCount)
        _state.value = current.copy(
            swingX = 0f,
            currentBlockWidth = blockWidth,
            currentPlayerIndex = nextPlayer,
            eliminatedPlayers = newEliminated,
            blocksPlaced = newBlocksPlaced,
            swingDirection = 1,
            eliminationMessage = "$playerLabel missed! $playerLabel eliminated!",
            isDropping = false
        )
    }

    private fun finishGame(current: TowerStackState) {
        // All blocks placed - winner is the player with most total area
        val activePlayers = (0 until current.playerCount).filter { it !in current.eliminatedPlayers }
        val winner = activePlayers.maxByOrNull { current.playerScores[it] ?: 0f } ?: 0
        _state.value = current.copy(
            gamePhase = GamePhase.GameOver,
            winnerIndex = winner
        )
    }

    private fun getNextPlayer(currentPlayer: Int, eliminated: Set<Int>, playerCount: Int): Int {
        var next = (currentPlayer + 1) % playerCount
        var attempts = 0
        while (next in eliminated && attempts < playerCount) {
            next = (next + 1) % playerCount
            attempts++
        }
        return next
    }

    fun clearEliminationMessage() {
        _state.value = _state.value.copy(eliminationMessage = null)
    }
}
