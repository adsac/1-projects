package com.partygames.app.games.hexduel

import androidx.lifecycle.ViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import java.util.LinkedList

/** Possible states for each cell on the hex board. */
enum class HexCell { Empty, Player1, Player2 }

/** High-level game phase. */
sealed class GamePhase {
    data object Playing : GamePhase()
    data class GameOver(val winner: Int) : GamePhase()
}

/** Full observable UI state for the Hex Duel game. */
data class HexDuelState(
    val boardSize: Int = 7,
    val board: List<List<HexCell>> = List(7) { List(7) { HexCell.Empty } },
    val currentPlayer: Int = 1,
    val phase: GamePhase = GamePhase.Playing,
    val moveCount: Int = 0,
    /** Swap is available only right after Player 1's very first move, on Player 2's turn. */
    val swapAvailable: Boolean = false,
    /** The position of Player 1's first move (needed for swap). */
    val firstMovePos: Pair<Int, Int>? = null
)

class HexDuelViewModel : ViewModel() {

    private val _state = MutableStateFlow(HexDuelState())
    val state: StateFlow<HexDuelState> = _state.asStateFlow()

    /** Claim a hex for the current player. Ignores taps when the game is over or the cell is taken. */
    fun claimHex(row: Int, col: Int) {
        _state.update { current ->
            if (current.phase is GamePhase.GameOver) return@update current
            if (row !in 0 until current.boardSize || col !in 0 until current.boardSize) return@update current
            if (current.board[row][col] != HexCell.Empty) return@update current

            val cell = if (current.currentPlayer == 1) HexCell.Player1 else HexCell.Player2
            val newBoard = current.board.mapIndexed { r, rowList ->
                if (r == row) rowList.toMutableList().also { it[col] = cell } else rowList
            }
            val newMoveCount = current.moveCount + 1

            // Check for a win by the player who just moved.
            val winner = if (checkWin(newBoard, current.boardSize, cell)) current.currentPlayer else null

            if (winner != null) {
                current.copy(
                    board = newBoard,
                    moveCount = newMoveCount,
                    phase = GamePhase.GameOver(winner),
                    swapAvailable = false
                )
            } else {
                val nextPlayer = if (current.currentPlayer == 1) 2 else 1
                // Swap is available only when P1 just made the very first move of the game.
                val swapAvailable = current.moveCount == 0 && current.currentPlayer == 1
                current.copy(
                    board = newBoard,
                    currentPlayer = nextPlayer,
                    moveCount = newMoveCount,
                    swapAvailable = swapAvailable,
                    firstMovePos = if (current.moveCount == 0 && current.currentPlayer == 1) Pair(row, col) else current.firstMovePos
                )
            }
        }
    }

    /** Player 2 steals Player 1's first hex. Only valid when [HexDuelState.swapAvailable] is true. */
    fun swapMove() {
        _state.update { current ->
            if (!current.swapAvailable) return@update current
            val pos = current.firstMovePos ?: return@update current

            // Replace P1's first hex with P2's color.
            val newBoard = current.board.mapIndexed { r, rowList ->
                if (r == pos.first) rowList.toMutableList().also { it[pos.second] = HexCell.Player2 } else rowList
            }

            // After swap, it becomes Player 1's turn (P2 used their turn to swap).
            current.copy(
                board = newBoard,
                currentPlayer = 1,
                moveCount = current.moveCount + 1,
                swapAvailable = false
            )
        }
    }

    /** Reset the game to a fresh state. */
    fun resetGame() {
        _state.value = HexDuelState()
    }

    // ----- Win detection via BFS -----

    /**
     * Player 1 wins by connecting top row (row 0) to bottom row (row boardSize-1).
     * Player 2 wins by connecting left column (col 0) to right column (col boardSize-1).
     *
     * Performs BFS from the starting edge and checks if any cell on the ending edge is reached.
     */
    private fun checkWin(board: List<List<HexCell>>, boardSize: Int, player: HexCell): Boolean {
        val visited = Array(boardSize) { BooleanArray(boardSize) }
        val queue = LinkedList<Pair<Int, Int>>()

        if (player == HexCell.Player1) {
            // Start from top row.
            for (col in 0 until boardSize) {
                if (board[0][col] == player) {
                    queue.add(Pair(0, col))
                    visited[0][col] = true
                }
            }
        } else {
            // Start from left column.
            for (row in 0 until boardSize) {
                if (board[row][0] == player) {
                    queue.add(Pair(row, 0))
                    visited[row][0] = true
                }
            }
        }

        while (queue.isNotEmpty()) {
            val (r, c) = queue.poll()

            // Check if we reached the opposite edge.
            if (player == HexCell.Player1 && r == boardSize - 1) return true
            if (player == HexCell.Player2 && c == boardSize - 1) return true

            for ((nr, nc) in hexNeighbors(r, c)) {
                if (nr in 0 until boardSize && nc in 0 until boardSize
                    && !visited[nr][nc] && board[nr][nc] == player
                ) {
                    visited[nr][nc] = true
                    queue.add(Pair(nr, nc))
                }
            }
        }

        return false
    }

    /**
     * Returns the six hex neighbors of (row, col) in an offset-coordinate system
     * where odd rows are shifted right by half a hex width.
     *
     * For even rows the neighbors are:
     *   (r-1, c-1), (r-1, c), (r, c-1), (r, c+1), (r+1, c-1), (r+1, c)
     *
     * For odd rows the neighbors are:
     *   (r-1, c), (r-1, c+1), (r, c-1), (r, c+1), (r+1, c), (r+1, c+1)
     */
    private fun hexNeighbors(row: Int, col: Int): List<Pair<Int, Int>> {
        return if (row % 2 == 0) {
            listOf(
                Pair(row - 1, col - 1), Pair(row - 1, col),
                Pair(row, col - 1), Pair(row, col + 1),
                Pair(row + 1, col - 1), Pair(row + 1, col)
            )
        } else {
            listOf(
                Pair(row - 1, col), Pair(row - 1, col + 1),
                Pair(row, col - 1), Pair(row, col + 1),
                Pair(row + 1, col), Pair(row + 1, col + 1)
            )
        }
    }
}
