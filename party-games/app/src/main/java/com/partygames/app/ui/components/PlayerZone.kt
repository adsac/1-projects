package com.partygames.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.partygames.app.ui.theme.Player1Color
import com.partygames.app.ui.theme.Player2Color
import com.partygames.app.ui.theme.Player3Color
import com.partygames.app.ui.theme.Player4Color

val playerColors = listOf(Player1Color, Player2Color, Player3Color, Player4Color)

fun getPlayerColor(index: Int): Color = playerColors[index % playerColors.size]

@Composable
fun PlayerButton(
    playerIndex: Int,
    label: String,
    height: Dp = 80.dp,
    onPress: () -> Unit,
    onRelease: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(height)
            .padding(4.dp)
            .background(
                color = getPlayerColor(playerIndex).copy(alpha = 0.8f),
                shape = RoundedCornerShape(12.dp)
            ),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            color = Color.White
        )
    }
}
