# NIGHTFALL LEGENDS — Android Build & Installation Guide

- **App Name:** NIGHTFALL LEGENDS
- **Developer:** NEPALCMD
- **Creator:** RAJ KUMAR MAHATO
- **Package ID:** `com.nepalcmd.nightfalllegends`
- **Orientation:** Landscape (`sensorLandscape`)

## Installing the APK on an Android Phone

1. Download **`NightfallLegends-v1.0.0-release.apk`** (recommended for regular play) or **`NightfallLegends-v1.0.0-debug.apk`** onto your Android phone.
2. Open your phone's **Files** / **Downloads** app and tap the downloaded `.apk` file.
3. If prompted with *"For your security, your phone currently isn't allowed to install unknown apps from this source"*, tap **Settings** and enable **Allow from this source** for your browser or Files app.
4. Tap **Install**, then **Open** once installation finishes.
5. Note on Google Play Protect: Since the release APK is self-signed directly by NEPALCMD outside Google Play, Play Protect may ask you to tap **More details -> Install anyway**.

## Rebuilding from Source (Android Studio / Gradle)

1. Build and stage the clean Android web bundle and sync Capacitor:
   ```bash
   npm run build:android
   npx cap sync android
   ```
2. Open the `android/` folder in **Android Studio**, or build from the command line:
   ```bash
   cd android
   ./gradlew assembleDebug
   ./gradlew assembleRelease
   ./gradlew bundleRelease
   ```
3. Generated outputs:
   - Signed Release APK: `android/app/build/outputs/apk/release/app-release.apk`
   - Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`
   - Signed Release AAB (Google Play): `android/app/build/outputs/bundle/release/app-release.aab`
