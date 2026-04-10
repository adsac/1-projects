package com.partygames.app

import androidx.compose.runtime.Composable
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.partygames.app.games.avalanche.AvalancheScreen
import com.partygames.app.games.bombtag.BombTagScreen
import com.partygames.app.games.fingertwister.FingerTwisterScreen
import com.partygames.app.games.hexduel.HexDuelScreen
import com.partygames.app.games.miniracers.MiniRacersScreen
import com.partygames.app.games.pongroyale.PongRoyaleScreen
import com.partygames.app.games.snake.SnakeScreen
import com.partygames.app.games.soccer.SoccerScreen
import com.partygames.app.games.sumo.SumoScreen
import com.partygames.app.games.towerstack.TowerStackScreen
import com.partygames.app.navigation.Screen
import com.partygames.app.navigation.allGames
import com.partygames.app.ui.screens.GameSelectScreen
import com.partygames.app.ui.screens.HomeScreen
import com.partygames.app.ui.screens.PlayerSetupScreen
import com.partygames.app.ui.screens.ResultsScreen

@Composable
fun PartyGamesApp() {
    val navController = rememberNavController()

    NavHost(navController = navController, startDestination = Screen.Home.route) {
        composable(Screen.Home.route) {
            HomeScreen(onPlayClick = {
                navController.navigate(Screen.GameSelect.route)
            })
        }

        composable(Screen.GameSelect.route) {
            GameSelectScreen(onGameSelected = { game ->
                navController.navigate(Screen.PlayerSetup.createRoute(game.id))
            })
        }

        composable(
            route = Screen.PlayerSetup.route,
            arguments = listOf(navArgument("gameId") { type = NavType.StringType })
        ) { backStackEntry ->
            val gameId = backStackEntry.arguments?.getString("gameId") ?: return@composable
            PlayerSetupScreen(
                gameId = gameId,
                onStartGame = { playerCount ->
                    val route = when (gameId) {
                        "mini_racers" -> Screen.MiniRacers.createRoute(playerCount)
                        "sumo" -> Screen.SumoShowdown.createRoute(playerCount)
                        "soccer" -> Screen.PocketSoccer.createRoute(playerCount)
                        "finger_twister" -> Screen.FingerTwister.createRoute(playerCount)
                        "hex_duel" -> Screen.HexDuel.createRoute(playerCount)
                        "pong_royale" -> Screen.PongRoyale.createRoute(playerCount)
                        "bomb_tag" -> Screen.BombTag.createRoute(playerCount)
                        "avalanche" -> Screen.AvalancheRun.createRoute(playerCount)
                        "snake" -> Screen.SnakeArena.createRoute(playerCount)
                        "tower_stack" -> Screen.TowerStack.createRoute(playerCount)
                        else -> return@PlayerSetupScreen
                    }
                    navController.navigate(route)
                }
            )
        }

        composable(
            route = Screen.Results.route,
            arguments = listOf(
                navArgument("gameId") { type = NavType.StringType },
                navArgument("winnerIndex") { type = NavType.IntType }
            )
        ) { backStackEntry ->
            val gameId = backStackEntry.arguments?.getString("gameId") ?: return@composable
            val winnerIndex = backStackEntry.arguments?.getInt("winnerIndex") ?: 0
            ResultsScreen(
                gameId = gameId,
                winnerIndex = winnerIndex,
                onPlayAgain = {
                    navController.popBackStack(Screen.PlayerSetup.createRoute(gameId), false)
                },
                onHome = {
                    navController.popBackStack(Screen.Home.route, false)
                }
            )
        }

        // Game screens
        fun gameArgs() = listOf(navArgument("playerCount") { type = NavType.IntType })

        composable(Screen.MiniRacers.route, arguments = gameArgs()) { entry ->
            val count = entry.arguments?.getInt("playerCount") ?: 2
            MiniRacersScreen(playerCount = count, onGameEnd = { winner ->
                navController.navigate(Screen.Results.createRoute("mini_racers", winner)) {
                    popUpTo(Screen.GameSelect.route)
                }
            })
        }

        composable(Screen.SumoShowdown.route, arguments = gameArgs()) { entry ->
            val count = entry.arguments?.getInt("playerCount") ?: 2
            SumoScreen(playerCount = count, onGameEnd = { winner ->
                navController.navigate(Screen.Results.createRoute("sumo", winner)) {
                    popUpTo(Screen.GameSelect.route)
                }
            })
        }

        composable(Screen.PocketSoccer.route, arguments = gameArgs()) { entry ->
            val count = entry.arguments?.getInt("playerCount") ?: 2
            SoccerScreen(playerCount = count, onGameEnd = { winner ->
                navController.navigate(Screen.Results.createRoute("soccer", winner)) {
                    popUpTo(Screen.GameSelect.route)
                }
            })
        }

        composable(Screen.FingerTwister.route, arguments = gameArgs()) { entry ->
            val count = entry.arguments?.getInt("playerCount") ?: 2
            FingerTwisterScreen(playerCount = count, onGameEnd = { winner ->
                navController.navigate(Screen.Results.createRoute("finger_twister", winner)) {
                    popUpTo(Screen.GameSelect.route)
                }
            })
        }

        composable(Screen.HexDuel.route, arguments = gameArgs()) { entry ->
            val count = entry.arguments?.getInt("playerCount") ?: 2
            HexDuelScreen(playerCount = count, onGameEnd = { winner ->
                navController.navigate(Screen.Results.createRoute("hex_duel", winner)) {
                    popUpTo(Screen.GameSelect.route)
                }
            })
        }

        composable(Screen.PongRoyale.route, arguments = gameArgs()) { entry ->
            val count = entry.arguments?.getInt("playerCount") ?: 2
            PongRoyaleScreen(playerCount = count, onGameEnd = { winner ->
                navController.navigate(Screen.Results.createRoute("pong_royale", winner)) {
                    popUpTo(Screen.GameSelect.route)
                }
            })
        }

        composable(Screen.BombTag.route, arguments = gameArgs()) { entry ->
            val count = entry.arguments?.getInt("playerCount") ?: 2
            BombTagScreen(playerCount = count, onGameEnd = { winner ->
                navController.navigate(Screen.Results.createRoute("bomb_tag", winner)) {
                    popUpTo(Screen.GameSelect.route)
                }
            })
        }

        composable(Screen.AvalancheRun.route, arguments = gameArgs()) { entry ->
            val count = entry.arguments?.getInt("playerCount") ?: 2
            AvalancheScreen(playerCount = count, onGameEnd = { winner ->
                navController.navigate(Screen.Results.createRoute("avalanche", winner)) {
                    popUpTo(Screen.GameSelect.route)
                }
            })
        }

        composable(Screen.SnakeArena.route, arguments = gameArgs()) { entry ->
            val count = entry.arguments?.getInt("playerCount") ?: 2
            SnakeScreen(playerCount = count, onGameEnd = { winner ->
                navController.navigate(Screen.Results.createRoute("snake", winner)) {
                    popUpTo(Screen.GameSelect.route)
                }
            })
        }

        composable(Screen.TowerStack.route, arguments = gameArgs()) { entry ->
            val count = entry.arguments?.getInt("playerCount") ?: 2
            TowerStackScreen(playerCount = count, onGameEnd = { winner ->
                navController.navigate(Screen.Results.createRoute("tower_stack", winner)) {
                    popUpTo(Screen.GameSelect.route)
                }
            })
        }
    }
}
