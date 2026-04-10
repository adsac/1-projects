package com.partygames.app.games.hexduel

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.scaleIn
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.partygames.app.ui.theme.Player1Color
import com.partygames.app.ui.theme.Player2Color
import kotlinx.coroutines.delay
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt

// ---- Color constants ----
private val EmptyHexColor = Color(0xFF9E9E9E)
private val HexBorderColor = Color(0xFF616161)
private val BoardBackground = Color(0xFF263238)
private val P1EdgeColor = Player1Color.copy(alpha = 0.45f)
private val P2EdgeColor = Player2Color.copy(alpha = 0.45f)

@Composable
fun HexDuelScreen(
    playerCount: Int,
    onGameEnd: (winnerIndex: Int) -> Unit,
    viewModel: HexDuelViewModel = viewModel()
) {
    val state by viewModel.state.collectAsState()
    var showWinnerOverlay by remember { mutableStateOf(false) }

    // When game ends, show brief celebration then navigate out.
    LaunchedEffect(state.phase) {
        if (state.phase is GamePhase.GameOver) {
            showWinnerOverlay = true
            delay(2000L)
            val winner = (state.phase as GamePhase.GameOver).winner
            // winnerIndex is 0-based for the results screen
            onGameEnd(winner - 1)
        }
    }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = BoardBackground
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // ---- Turn indicator ----
            TurnIndicator(state)

            Spacer(modifier = Modifier.height(8.dp))

            // ---- Swap button ----
            if (state.swapAvailable && state.phase is GamePhase.Playing) {
                Button(
                    onClick = { viewModel.swapMove() },
                    colors = ButtonDefaults.buttonColors(containerColor = Player2Color),
                    shape = RoundedCornerShape(24.dp),
                    modifier = Modifier.padding(bottom = 8.dp)
                ) {
                    Text(
                        text = "SWAP?",
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp,
                        color = Color.White
                    )
                }
            }

            // ---- Hex board ----
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                contentAlignment = Alignment.Center
            ) {
                HexBoard(
                    state = state,
                    onHexTapped = { row, col ->
                        if (state.phase is GamePhase.Playing) {
                            viewModel.claimHex(row, col)
                        }
                    }
                )

                // ---- Winner overlay ----
                AnimatedVisibility(
                    visible = showWinnerOverlay,
                    enter = scaleIn() + fadeIn()
                ) {
                    val winner = (state.phase as? GamePhase.GameOver)?.winner ?: 1
                    val winnerColor = if (winner == 1) Player1Color else Player2Color
                    Surface(
                        shape = RoundedCornerShape(20.dp),
                        color = winnerColor.copy(alpha = 0.92f),
                        shadowElevation = 12.dp
                    ) {
                        Text(
                            text = "Player $winner Wins!",
                            color = Color.White,
                            fontSize = 32.sp,
                            fontWeight = FontWeight.ExtraBold,
                            modifier = Modifier.padding(horizontal = 36.dp, vertical = 24.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun TurnIndicator(state: HexDuelState) {
    val color = if (state.currentPlayer == 1) Player1Color else Player2Color
    val text = when (state.phase) {
        is GamePhase.Playing -> "Player ${state.currentPlayer}'s Turn"
        is GamePhase.GameOver -> "Player ${(state.phase as GamePhase.GameOver).winner} Wins!"
    }

    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
        modifier = Modifier.fillMaxWidth()
    ) {
        Canvas(modifier = Modifier.size(18.dp)) {
            drawCircle(color = color)
        }
        Text(
            text = text,
            color = Color.White,
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(start = 10.dp)
        )
    }
}

// ---- Hex Board composable ----

@Composable
private fun HexBoard(
    state: HexDuelState,
    onHexTapped: (row: Int, col: Int) -> Unit
) {
    val boardSize = state.boardSize

    Canvas(
        modifier = Modifier
            .fillMaxSize()
            .pointerInput(state.phase) {
                if (state.phase is GamePhase.GameOver) return@pointerInput
                detectTapGestures { offset ->
                    val canvasW = size.width.toFloat()
                    val canvasH = size.height.toFloat()
                    val result = findTappedHex(offset, boardSize, canvasW, canvasH)
                    if (result != null) {
                        onHexTapped(result.first, result.second)
                    }
                }
            }
    ) {
        val canvasW = size.width
        val canvasH = size.height
        val metrics = computeHexMetrics(boardSize, canvasW, canvasH)

        // Draw colored edge indicators.
        drawEdgeIndicators(metrics, boardSize)

        // Draw all hexagons.
        for (row in 0 until boardSize) {
            for (col in 0 until boardSize) {
                val center = hexCenter(row, col, metrics)
                val cell = state.board[row][col]
                val fillColor = when (cell) {
                    HexCell.Empty -> EmptyHexColor
                    HexCell.Player1 -> Player1Color
                    HexCell.Player2 -> Player2Color
                }
                drawHexagon(center, metrics.hexSize, fillColor, HexBorderColor)
            }
        }
    }
}

// ---- Hex geometry helpers ----

/**
 * Precomputed measurements for laying out the hex grid.
 * Flat-top hex: width = 2 * hexSize, height = sqrt(3) * hexSize.
 */
private data class HexMetrics(
    val hexSize: Float,
    val hexW: Float,      // full width of a hex = 2 * hexSize
    val hexH: Float,      // full height of a hex = sqrt(3) * hexSize
    val originX: Float,   // x-offset so the board is centered
    val originY: Float,   // y-offset so the board is centered
    val colStep: Float,   // horizontal distance between column centers = 1.5 * hexSize
    val rowStep: Float    // vertical distance between row centers = hexH
)

private fun computeHexMetrics(boardSize: Int, canvasW: Float, canvasH: Float): HexMetrics {
    // For flat-top hexagons in offset coordinates:
    //   Total grid width  = colStep * (boardSize - 1) + hexW  where colStep = 1.5 * s, hexW = 2 * s
    //   Plus half-hex offset for odd rows: + 0.5 * colStep
    //   Total grid height = hexH * boardSize  (roughly)  where hexH = sqrt(3) * s

    val sqrt3 = sqrt(3f)

    // Solve for hexSize given canvas dimensions (with some padding).
    val pad = 24f
    val availW = canvasW - pad * 2
    val availH = canvasH - pad * 2

    val sFromW = availW / (1.5f * (boardSize - 1) + 2f + 0.75f) // extra 0.75 for odd-row shift
    val sFromH = availH / (sqrt3 * boardSize)

    val hexSize = min(sFromW, sFromH)
    val hexW = 2f * hexSize
    val hexH = sqrt3 * hexSize
    val colStep = 1.5f * hexSize
    val rowStep = hexH

    // Grid bounding box
    val gridW = colStep * (boardSize - 1) + hexW + 0.5f * colStep  // account for odd-row shift
    val gridH = rowStep * boardSize

    val originX = (canvasW - gridW) / 2f + hexSize  // center x points to first hex center
    val originY = (canvasH - gridH) / 2f + hexH / 2f

    return HexMetrics(hexSize, hexW, hexH, originX, originY, colStep, rowStep)
}

/** Compute the pixel center of the hex at (row, col). */
private fun hexCenter(row: Int, col: Int, m: HexMetrics): Offset {
    val x = m.originX + col * m.colStep + if (row % 2 != 0) m.colStep * 0.5f else 0f
    val y = m.originY + row * m.rowStep
    return Offset(x, y)
}

/** Draw a flat-top hexagon centered at [center] with circumradius [size]. */
private fun DrawScope.drawHexagon(center: Offset, size: Float, fill: Color, border: Color) {
    val path = hexPath(center, size)
    drawPath(path, fill, style = Fill)
    drawPath(path, border, style = Stroke(width = 2f))
}

/** Build a Path for a flat-top hexagon. Vertex 0 is at 0 degrees (right). */
private fun hexPath(center: Offset, size: Float): Path {
    val path = Path()
    for (i in 0 until 6) {
        val angleDeg = 60f * i
        val angleRad = (PI / 180.0) * angleDeg
        val vx = center.x + size * cos(angleRad).toFloat()
        val vy = center.y + size * sin(angleRad).toFloat()
        if (i == 0) path.moveTo(vx, vy) else path.lineTo(vx, vy)
    }
    path.close()
    return path
}

/**
 * Draw colored edge indicators on the board borders to remind players of their connection goal.
 * Top & bottom edges: Player 1 (Pink).  Left & right edges: Player 2 (Blue).
 */
private fun DrawScope.drawEdgeIndicators(m: HexMetrics, boardSize: Int) {
    val thickness = m.hexSize * 0.32f

    // Top edge (P1)
    for (col in 0 until boardSize) {
        val center = hexCenter(0, col, m)
        val left = center.x - m.hexSize
        val right = center.x + m.hexSize
        val top = center.y - m.hexH / 2f - thickness
        drawRect(
            color = P1EdgeColor,
            topLeft = Offset(left, top),
            size = androidx.compose.ui.geometry.Size(right - left, thickness)
        )
    }

    // Bottom edge (P1)
    for (col in 0 until boardSize) {
        val center = hexCenter(boardSize - 1, col, m)
        val left = center.x - m.hexSize
        val right = center.x + m.hexSize
        val bottom = center.y + m.hexH / 2f
        drawRect(
            color = P1EdgeColor,
            topLeft = Offset(left, bottom),
            size = androidx.compose.ui.geometry.Size(right - left, thickness)
        )
    }

    // Left edge (P2)
    for (row in 0 until boardSize) {
        val center = hexCenter(row, 0, m)
        val top = center.y - m.hexH / 2f
        val bottom = center.y + m.hexH / 2f
        val left = center.x - m.hexSize - thickness
        drawRect(
            color = P2EdgeColor,
            topLeft = Offset(left, top),
            size = androidx.compose.ui.geometry.Size(thickness, bottom - top)
        )
    }

    // Right edge (P2)
    for (row in 0 until boardSize) {
        val center = hexCenter(row, boardSize - 1, m)
        val top = center.y - m.hexH / 2f
        val bottom = center.y + m.hexH / 2f
        val right = center.x + m.hexSize
        drawRect(
            color = P2EdgeColor,
            topLeft = Offset(right, top),
            size = androidx.compose.ui.geometry.Size(thickness, bottom - top)
        )
    }
}

// ---- Hit testing ----

/**
 * Given a tap [offset] in canvas coordinates, find which hex (row, col) was tapped.
 * Returns null if the tap is outside all hexagons.
 *
 * We iterate all cells and pick the one whose center is closest to the tap,
 * then verify the tap is actually inside that hexagon.
 */
private fun findTappedHex(
    offset: Offset,
    boardSize: Int,
    canvasW: Float,
    canvasH: Float
): Pair<Int, Int>? {
    val metrics = computeHexMetrics(boardSize, canvasW, canvasH)
    var bestDist = Float.MAX_VALUE
    var bestRow = -1
    var bestCol = -1

    for (row in 0 until boardSize) {
        for (col in 0 until boardSize) {
            val center = hexCenter(row, col, metrics)
            val dx = offset.x - center.x
            val dy = offset.y - center.y
            val dist = dx * dx + dy * dy
            if (dist < bestDist) {
                bestDist = dist
                bestRow = row
                bestCol = col
            }
        }
    }

    if (bestRow < 0) return null

    // Verify the tap is within the hexagon (circumradius check is sufficient for flat-top hex
    // because the inner radius = hexSize * sqrt(3)/2 is the tightest bound, but using the full
    // circumradius gives a generous tap target which feels better on mobile).
    val center = hexCenter(bestRow, bestCol, metrics)
    val dx = offset.x - center.x
    val dy = offset.y - center.y
    val distance = sqrt(dx * dx + dy * dy)
    if (distance > metrics.hexSize * 1.05f) return null

    return Pair(bestRow, bestCol)
}
