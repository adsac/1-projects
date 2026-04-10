# Party Games

A collection of 10 fun multiplayer mini-games playable on a single Android phone. Pass the phone around or crowd together - no WiFi, no extra devices needed!

## Games

| Game | Players | How to Play |
|------|---------|-------------|
| **Mini Racers** | 2-4 | Hold your button to accelerate around the oval track. Ease off on curves or you'll skid! First to 3 laps wins. |
| **Sumo Showdown** | 2-4 | Tap to lunge at opponents in a circular arena. Knock them out of the ring! Best of 3 rounds. |
| **Pocket Soccer** | 2 | Your player spins automatically. Tap to dash in whatever direction you're facing. First to 3 goals! |
| **Finger Twister** | 2-4 | Place and hold your finger on each circle matching your color. New circles keep appearing. Lift a finger and you're out! |
| **Hex Duel** | 2 | Take turns claiming hexagons. Build a connected path across the board before your opponent does. |
| **Pong Royale** | 2-4 | Slide your finger to move your paddle. Don't let the ball get past you! 3 lives each. |
| **Bomb Tag** | 2-4 | One player holds a ticking bomb. Dash into opponents to pass it. Whoever's holding it when it blows... loses! |
| **Avalanche Run** | 2-4 | Jump between platforms as lava rises from below. Last one alive wins! |
| **Snake Arena** | 2-4 | Control a growing snake. Turn left or right to avoid walls and other snakes. Classic battle royale! |
| **Tower Stack** | 2-4 | Drop swinging blocks onto the tower. Overhang gets trimmed. Miss entirely and you're out! |

## Download & Play

### Option 1: Download the APK (easiest)

1. Go to the **Actions** tab of this repository
2. Click the latest successful build
3. Download the **party-games-debug-apk** artifact
4. Unzip it and transfer the `.apk` file to your Android phone
5. Open the APK on your phone and install it (you may need to enable "Install from unknown sources" in Settings)

### Option 2: Build it yourself

**Requirements:** Android Studio (or Android SDK + JDK 17)

```bash
cd party-games
./gradlew assembleDebug
```

The APK will be at `party-games/app/build/outputs/apk/debug/app-debug.apk`.

Install it on your phone:
```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

### Option 3: Open in Android Studio

1. Open Android Studio
2. File > Open > select the `party-games/` folder
3. Click the green Run button
4. Select your phone or emulator

## How It Works

- **Single phone, multiple players** - everyone plays on the same screen
- **Simple controls** - each player gets a button (or touch zone) at their edge of the screen
- **Quick rounds** - most games last 30-90 seconds
- **No setup needed** - just pick a game, choose player count, and go

## Tech Stack

- Kotlin + Jetpack Compose
- Material 3 design
- Canvas-based game rendering at 60fps
- No internet connection required
- No external dependencies beyond AndroidX
