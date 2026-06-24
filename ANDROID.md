# GYAN RISE — Android App

Production Android shell for the GYAN RISE LMS, built with **Capacitor 6** as
a thin WebView wrapper around the live Vercel web app. All Android-specific
code lives in `frontend/android/` and is generated/managed by Capacitor.

---

## 1. App Configuration

| Setting | Value |
|---|---|
| Package name | `com.gyanrise.lms` |
| Display name | `GYAN RISE` |
| Initial version | `versionCode 1`, `versionName 1.0` |
| Min Android SDK | 22 (Android 5.1, ~99.9 % device coverage) |
| Target SDK | 34 (Android 14, current Play Store requirement) |
| Architecture | `arm64-v8a`, `armeabi-v7a`, `x86_64` (universal APK) |
| Live URL loaded by WebView | Value of `CAPACITOR_LIVE_URL` env var, otherwise `REACT_APP_BACKEND_URL`, otherwise the fallback in `capacitor.config.ts` |

### Change the live URL before release

The app loads whatever is set in `frontend/capacitor.config.ts` → `server.url`.
Set it to your **real Vercel production URL** before building the release:

```bash
# Either edit the file directly:
#   server: { url: 'https://your-vercel-app.vercel.app', ... }
# Or pass it via env at build time:
export CAPACITOR_LIVE_URL=https://your-vercel-app.vercel.app
yarn build && npx cap sync android
```

---

## 2. Security Hardening — What's Already Active

All five protections requested are **implemented and enforced at the OS level**.
They are applied in `frontend/android/app/src/main/java/com/gyanrise/lms/MainActivity.java`
and the AndroidManifest, so they cover **every screen in the app** — login,
signup, forgot-password, dashboards, batches, subjects, videos, notes, tests,
live classes, admin panel — because they all render inside the same WebView
window.

| Protection | Mechanism | File |
|---|---|---|
| Block screenshots (volume-down + power) | `WindowManager.LayoutParams.FLAG_SECURE` set in `onCreate()` BEFORE `super.onCreate()`, re-applied in `onResume()` | `MainActivity.java` |
| Block screen recording (system + 3rd-party) | Same `FLAG_SECURE` — Android refuses to write secure frames to MediaProjection | `MainActivity.java` |
| Block Recent-Apps thumbnail preview | Same `FLAG_SECURE` — Recents shows a black/blurred placeholder | `MainActivity.java` |
| Block Google Assistant "What's on my screen" | Same `FLAG_SECURE` | `MainActivity.java` |
| Block external-display mirroring / Cast | Same `FLAG_SECURE` | `MainActivity.java` |
| Disable Android auto-backup of app data | `android:allowBackup="false"`, `android:fullBackupContent="false"` | `AndroidManifest.xml` |
| Disable cloud + device-transfer data extraction (Android 12+) | `<data-extraction-rules>` excludes root/file/database/sharedpref/external | `res/xml/data_extraction_rules.xml` |
| Force HTTPS-only traffic | `android:usesCleartextTraffic="false"` + `network_security_config.xml` | `AndroidManifest.xml`, `res/xml/network_security_config.xml` |
| Disable WebView debugging in release | `webContentsDebuggingEnabled: false` in `capacitor.config.ts` | `capacitor.config.ts` |
| Strip debug logs from release binary | ProGuard `-assumenosideeffects android.util.Log` | `app/proguard-rules.pro` |
| Code shrinking + resource shrinking | `minifyEnabled true`, `shrinkResources true` on `release` build type | `app/build.gradle` |

### How to verify protections after installing the APK

1. **Screenshot** — open the app, press `Volume Down + Power`. Expected: toast/notification *"Can't take screenshot due to security policy"*, no image saved.
2. **Screen record** — pull down quick settings → tap **Screen Record**. Expected: recording starts but app's WebView frames appear **black**, audio is captured but no visuals.
3. **Recent Apps** — open the app, press the recents button. Expected: the card shows a **black placeholder** (or the app icon) instead of a live preview.
4. **Cast** — try to cast the screen via quick settings. Expected: cast starts but app content shows as black.

All four are protected by the single `FLAG_SECURE` flag and verified to apply to **every Activity in the app** (there is exactly one: `MainActivity`, the BridgeActivity that hosts the WebView).

---

## 3. Local Build — Android Studio

### Prerequisites
- **Android Studio Hedgehog (2023.1.1) or later** — https://developer.android.com/studio
- **JDK 17** (bundled with Android Studio)
- **Android SDK 34** (Android Studio → SDK Manager → install)

### Open in Android Studio
```bash
cd frontend
yarn install
CI=false yarn build              # generates frontend/build
npx cap sync android             # copies web assets into android/
npx cap open android             # opens Android Studio
```

### Build a debug APK (sideload-able)
- Android Studio menu: **Build → Build Bundle(s) / APK(s) → Build APK(s)**
- Or CLI:
  ```bash
  cd frontend/android
  ./gradlew assembleDebug
  ```
- Output: `frontend/android/app/build/outputs/apk/debug/app-debug.apk`

### Build a signed release APK (for direct distribution)
- Android Studio menu: **Build → Generate Signed Bundle / APK → APK**
- Or CLI (after configuring keystore — see §5):
  ```bash
  cd frontend/android
  ./gradlew assembleRelease \
    -PKEYSTORE_PATH=/abs/path/to/gyanrise.jks \
    -PKEYSTORE_PASSWORD=••• \
    -PKEY_ALIAS=gyanrise \
    -PKEY_PASSWORD=•••
  ```
- Output: `frontend/android/app/build/outputs/apk/release/app-release.apk`

### Build a signed AAB (Google Play Store)
- Android Studio menu: **Build → Generate Signed Bundle / APK → Android App Bundle**
- Or CLI:
  ```bash
  cd frontend/android
  ./gradlew bundleRelease \
    -PKEYSTORE_PATH=/abs/path/to/gyanrise.jks \
    -PKEYSTORE_PASSWORD=••• \
    -PKEY_ALIAS=gyanrise \
    -PKEY_PASSWORD=•••
  ```
- Output: `frontend/android/app/build/outputs/bundle/release/app-release.aab`
- Upload this `.aab` to **Play Console → Production / Internal testing → Create release**.

---

## 4. CI Build — GitHub Actions

A complete CI workflow is already provided at `.github/workflows/android-build.yml`.

### What it does
- Triggers on every push to `main`, on tag pushes (`v*`), or manual dispatch.
- Sets up Node 20, JDK 17, Android SDK 34.
- Runs `yarn install && yarn build && npx cap sync android`.
- Builds **debug APK** unconditionally (uploaded as `gyanrise-debug-apk` artifact).
- If keystore secrets are configured, also builds **signed release APK** + **signed AAB** (uploaded as `gyanrise-release-apk` / `gyanrise-release-aab` artifacts, retention 90 days).

### Required GitHub Secrets (Settings → Secrets and variables → Actions)
- `ANDROID_KEYSTORE_BASE64` — base64 of your `.jks` file
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
- `CAPACITOR_LIVE_URL` (optional) — overrides the URL baked into `capacitor.config.ts`
- `REACT_APP_BACKEND_URL` (optional) — used during the CRA `yarn build` step

Download built artifacts from **GitHub → Actions → workflow run → Artifacts**.

---

## 5. Generate Your Release Keystore (one-time)

```bash
keytool -genkeypair -v \
  -keystore gyanrise.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias gyanrise
# Fill in CN, OU, O, L, ST, C when prompted.
# Choose strong passwords (16+ chars).
```

**⚠️ Critical:** the same keystore must be used for every Play Store update.
If you lose it, you cannot publish new versions of the app — Play Console
requires identical signing. Back up `gyanrise.jks` and the passwords to a
password manager and a secondary offline location.

For CI use:
```bash
base64 -w0 gyanrise.jks > gyanrise.jks.b64
# Copy contents of gyanrise.jks.b64 into the ANDROID_KEYSTORE_BASE64 secret.
```

---

## 6. Releasing to Google Play Store

1. Build a signed AAB (`./gradlew bundleRelease` or via Actions).
2. Open **Google Play Console** → your app → **Release → Production**.
3. Click **Create new release**, upload the `.aab` file.
4. Fill release notes, save, **Review release**, then **Roll out**.
5. For staged rollouts use **Internal testing** or **Closed testing** track first.

### Required Play Store assets to prepare separately
- App icon `512×512` PNG (you can re-render `ic_launcher_foreground.xml` at higher resolution)
- Feature graphic `1024×500` PNG
- 2–8 phone screenshots (minimum 320 px on shortest side)
- Short description (≤80 chars), long description (≤4000 chars)
- Privacy policy URL (required — host on your Vercel site at `/privacy`)

---

## 7. After Updating the Web App

Because the Android shell loads your live Vercel URL, **most web updates require no Android rebuild**. The app picks them up on next launch.

You only need to rebuild + re-release the Android app when:
- You change `capacitor.config.ts` (e.g., URL, icon, splash)
- You change anything in `frontend/android/`
- You update a Capacitor plugin
- You bump `versionCode` / `versionName` for a Play Store release

---

## 8. File Reference

| Path | Purpose |
|---|---|
| `frontend/capacitor.config.ts` | App ID, name, live URL, splash, status-bar config |
| `frontend/android/app/src/main/java/com/gyanrise/lms/MainActivity.java` | FLAG_SECURE applied here |
| `frontend/android/app/src/main/AndroidManifest.xml` | Permissions, backup, HTTPS-only, network config |
| `frontend/android/app/src/main/res/xml/network_security_config.xml` | HTTPS-only enforcement |
| `frontend/android/app/src/main/res/xml/data_extraction_rules.xml` | Backup / device-transfer block |
| `frontend/android/app/src/main/res/drawable/ic_launcher_foreground.xml` | Adaptive launcher icon (brand monogram) |
| `frontend/android/app/src/main/res/drawable/splash.xml` | Splash screen drawable |
| `frontend/android/app/src/main/res/values/ic_launcher_background.xml` | Launcher background color (brand navy) |
| `frontend/android/app/build.gradle` | Signing config, minify, shrink |
| `frontend/android/app/proguard-rules.pro` | Keep Capacitor classes, strip logs |
| `.github/workflows/android-build.yml` | CI build pipeline for APK + AAB |
