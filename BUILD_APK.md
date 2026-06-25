# Building a distributable Android APK (no EAS Build)

This produces a signed, installable APK locally via Gradle — no EAS Build minutes consumed. Mirrors the approach used in `florim-mobile/android`.

## One-time setup (already done as of 2026-06-25, kept here for the next time it's needed — e.g. a new machine or a new release key)

1. **Prebuild the native Android project** (only needed once, or after changing `app.json`'s `android`/`plugins` config):
   ```bash
   npx expo prebuild --platform android
   ```
   This generates the `android/` folder from `app.json`. It's gitignored by default in a managed Expo project — if you want it committed (so you don't have to regenerate it elsewhere), remove `/android` from `.gitignore`.

2. **Generate a release keystore** (do this once — losing this file means you can never publish an update under the same app identity again; back it up somewhere safe, outside git):
   ```bash
   keytool -genkeypair -v \
     -keystore android/app/keystore/bsm-release.keystore \
     -alias bsm-release \
     -keyalg RSA -keysize 2048 -validity 10000 \
     -storepass "<choose a real password>" -keypass "<same or different password>" \
     -dname "CN=BSM System, OU=BSM, O=BSM, L=Unknown, ST=Unknown, C=BR"
   ```

3. **Point Gradle at it** via `android/local.properties` (gitignored, never commit this):
   ```properties
   sdk.dir=/path/to/Android/Sdk
   BSM_STORE_FILE=keystore/bsm-release.keystore
   BSM_STORE_PASSWORD=<your store password>
   BSM_KEY_ALIAS=bsm-release
   BSM_KEY_PASSWORD=<your key password>
   ```
   `android/app/build.gradle`'s `signingConfigs.release` block already reads these properties — this is already wired up, no further Gradle changes needed unless you regenerate `android/` from scratch with `expo prebuild`.

4. **Per-ABI splitting** is already configured in `android/app/build.gradle` (the `splits { abi { ... } }` block) — without it, a release build bundles all 4 CPU architectures into one ~100MB APK. With it, you get one ~40MB APK per architecture instead. `arm64-v8a` covers virtually every Android phone from the last several years; `armeabi-v7a` covers older 32-bit devices.

## Every time you want a new build

```bash
cd android
./gradlew assembleRelease
```

Output:
- `android/app/build/outputs/apk/release/app-arm64-v8a-release.apk` — **send this one** to the client's phone.
- `android/app/build/outputs/apk/release/app-armeabi-v7a-release.apk` — only needed for very old 32-bit devices.

## Getting it onto the client's phone

The client's phone needs **"Install from unknown sources"** allowed for whatever app you use to open the APK (browser, Drive, file manager — Android asks per-app, not globally, on modern versions). Options to get the file there:
- Email/WhatsApp/Drive link → open on the phone → tap to install.
- `adb install -r app-arm64-v8a-release.apk` if the phone is plugged in via USB with debugging enabled (still requires tapping "Allow" on an on-device prompt the first time, same as any USB install).

## Updating the API URL for a real demo

`bsm_mobile/.env`'s `EXPO_PUBLIC_API_BASE_URL` is baked into the JS bundle at build time — it's not something you can change after the APK is built. Before building, point it at wherever the backend the client will actually hit is running:
- Same Wi-Fi/LAN as your dev machine: your machine's LAN IP (e.g. `http://192.168.100.101:3000`) — only works while both devices are on that exact network.
- A real deployed backend (Vercel): the production URL (e.g. `https://your-app.vercel.app`) — works from anywhere, this is what you want if the client will use the APK outside your office.

After changing `.env`, you must rebuild (`./gradlew assembleRelease` again) for the change to take effect.
