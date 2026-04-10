package com.partygames.app.navigation

sealed class Screen(val route: String) {
    data object Home : Screen("home")
    data object GameSelect : Screen("game_select")
    data object PlayerSetup : Screen("player_setup/{gameId}") {
        fun createRoute(gameId: String) = "player_setup/$gameId"
    }
    data object Results : Screen("results/{gameId}/{winnerIndex}") {
        fun createRoute(gameId: String, winnerIndex: Int) = "results/$gameId/$winnerIndex"
    }

    // Game screens
    data object MiniRacers : Screen("game_mini_racers/{playerCount}") {
        fun createRoute(playerCount: Int) = "game_mini_racers/$playerCount"
    }
    data object SumoShowdown : Screen("game_sumo/{playerCount}") {
        fun createRoute(playerCount: Int) = "game_sumo/$playerCount"
    }
    data object PocketSoccer : Screen("game_soccer/{playerCount}") {
        fun createRoute(playerCount: Int) = "game_soccer/$playerCount"
    }
    data object FingerTwister : Screen("game_finger_twister/{playerCount}") {
        fun createRoute(playerCount: Int) = "game_finger_twister/$playerCount"
    }
    data object HexDuel : Screen("game_hex_duel/{playerCount}") {
        fun createRoute(playerCount: Int) = "game_hex_duel/$playerCount"
    }
    data object PongRoyale : Screen("game_pong_royale/{playerCount}") {
        fun createRoute(playerCount: Int) = "game_pong_royale/$playerCount"
    }
    data object BombTag : Screen("game_bomb_tag/{playerCount}") {
        fun createRoute(playerCount: Int) = "game_bomb_tag/$playerCount"
    }
    data object AvalancheRun : Screen("game_avalanche/{playerCount}") {
        fun createRoute(playerCount: Int) = "game_avalanche/$playerCount"
    }
    data object SnakeArena : Screen("game_snake/{playerCount}") {
        fun createRoute(playerCount: Int) = "game_snake/$playerCount"
    }
    data object TowerStack : Screen("game_tower_stack/{playerCount}") {
        fun createRoute(playerCount: Int) = "game_tower_stack/$playerCount"
    }
}

data class GameInfo(
    val id: String,
    val title: String,
    val description: String,
    val emoji: String,
    val minPlayers: Int,
    val maxPlayers: Int
)

val allGames = listOf(
    GameInfo("mini_racers", "Mini Racers", "Hold to accelerate, release to brake. Don't skid on curves!", "\uD83C\uDFCE\uFE0F", 2, 4),
    GameInfo("sumo", "Sumo Showdown", "Tap to lunge! Knock opponents out of the ring.", "\uD83E\uDD3C", 2, 4),
    GameInfo("soccer", "Pocket Soccer", "Auto-rotating players. Tap to dash and score goals!", "\u26BD", 2, 2),
    GameInfo("finger_twister", "Finger Twister", "Hold all your colored circles. Don't lift a finger!", "\uD83D\uDD75\uFE0F", 2, 4),
    GameInfo("hex_duel", "Hex Duel", "Claim hexes to build a path across the board.", "\u2B22", 2, 2),
    GameInfo("pong_royale", "Pong Royale", "Slide your paddle. Don't let the ball past you!", "\uD83C\uDFD3", 2, 4),
    GameInfo("bomb_tag", "Bomb Tag", "Pass the bomb before it explodes! Tap to dash.", "\uD83D\uDCA3", 2, 4),
    GameInfo("avalanche", "Avalanche Run", "Jump between platforms as lava rises. Don't fall!", "\uD83C\uDF0B", 2, 4),
    GameInfo("snake", "Snake Arena", "Grow your snake. Don't crash into walls or tails!", "\uD83D\uDC0D", 2, 4),
    GameInfo("tower_stack", "Tower Stack", "Drop blocks precisely. Don't let the tower collapse!", "\uD83C\uDFD7\uFE0F", 2, 4)
)
