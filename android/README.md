# Geek Protocol Android test package

Generated using Google Bubblewrap core 1.27.0. Run `npm ci` then `npm run generate` from this folder. The reviewed website manifest and supplied logo are the inputs; generated Android files are ignored and reproducible. Build with `cd generated && ./gradlew assembleDebug` using JDK 17 and an Android SDK. The Android test APK workflow builds the same project and retains the APK artifact for 14 days.

This is a separately identified debug test app (`xyz.geekprotocol.app.test`), not the final Play Store package or release signing identity. No production keystore or Play credentials are generated, requested or committed. The wrapper uses the live website and therefore its live account/data behavior. Use practice and private matches for device QA; do not treat this as an isolated test backend.

Without a matching certificate fingerprint in the website's Digital Asset Links, Android falls back to a browser/Custom Tab with browser UI. Do not publish placeholder fingerprints. A stable test certificate and verified domain association are a later step; Play App Signing will require its own production association. The APK does not imply fullscreen TWA verification, offline support or Play acceptance.

Phone checklist: install/launch/icon, sign-in and passkeys, Android Back, external links/wallet handoff, rotation, small screens, chess/private lobbies/reconnect, network loss/retry, exit and reopen. Founder acceptance is pending. No store submission or paid account action has been performed.
