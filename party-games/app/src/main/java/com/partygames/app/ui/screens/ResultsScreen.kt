package com.partygames.app.ui.screens

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
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
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.partygames.app.navigation.allGames
import com.partygames.app.ui.components.getPlayerColor
import kotlin.random.Random

@Composable
fun ResultsScreen(
    gameId: String,
    winnerIndex: Int,
    onPlayAgain: () -> Unit,
    onHome: () -> Unit
) {
    val game = allGames.find { it.id == gameId }
    val winnerColor = getPlayerColor(winnerIndex)

    val confettiColors = remember {
        List(30) {
            Color(
                red = Random.nextFloat(),
                green = Random.nextFloat(),
                blue = Random.nextFloat(),
                alpha = 1f
            )
        }
    }
    val confettiPositions = remember {
        List(30) { Offset(Random.nextFloat(), Random.nextFloat()) }
    }

    val infiniteTransition = rememberInfiniteTransition(label = "confetti")
    val confettiOffset by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(3000),
            repeatMode = RepeatMode.Restart
        ),
        label = "confettiFall"
    )

    Box(modifier = Modifier.fillMaxSize()) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            confettiPositions.forEachIndexed { index, pos ->
                val x = pos.x * size.width
                val y = ((pos.y + confettiOffset) % 1.2f) * size.height
                drawCircle(
                    color = confettiColors[index],
                    radius = 6f,
                    center = Offset(x, y)
                )
            }
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = "\uD83C\uDFC6",
                fontSize = 80.sp
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "Player ${winnerIndex + 1} Wins!",
                style = MaterialTheme.typography.displayLarge,
                color = winnerColor,
                textAlign = TextAlign.Center
            )
            if (game != null) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = game.title,
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Spacer(modifier = Modifier.height(48.dp))
            Row(
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                OutlinedButton(onClick = onHome) {
                    Text("Home")
                }
                Button(onClick = onPlayAgain) {
                    Text("Play Again")
                }
            }
        }
    }
}
