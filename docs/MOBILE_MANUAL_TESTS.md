# Mobile manual tests (iOS and Android, development build)

Run on one real iPhone and one real Android phone. Record device, OS version, app commit and result (pass / fail / note) for every line. Automated checks (`pnpm --filter @symbiomed/mobile test`) do not replace these: they cannot see the real keychain, biometrics, the app switcher, BLE or system text scaling.

## Setup
1. Start the backend: `pnpm dev:mock` (no Docker) or `docker compose up -d && pnpm seed && pnpm --filter @symbiomed/web dev`.
2. Copy `apps/mobile/.env.example` to `apps/mobile/.env`. Set `EXPO_PUBLIC_BFF_URL` to the computer's LAN address (for example `http://192.168.1.20:3000`). Use `EXPO_PUBLIC_MOCK=1` with mock mode, `0` with Keycloak.
3. Build and install a development build: `cd apps/mobile && npx expo run:ios --device` / `npx expo run:android --device`, or `eas build --profile development`.
4. Start Metro: `pnpm --filter @symbiomed/mobile start`.

## Checks (iOS | Android)
| # | Check | Expected | iOS | Android |
|---|---|---|---|---|
| M-01 | Fresh install, open the app | Sign-in screen; research-prototype banner at the top | | |
| M-02 | Sign in (mock: one tap; Keycloak: `patient.demo` / `demo-patient` in the system browser) | Today screen with the approved plan | | |
| M-03 | Settings → turn on fingerprint/face unlock, send the app to background, return | Lock screen; unlock with biometrics works; "Sign in again" signs out | | |
| M-04 | App switcher while the app is open | Snapshot shows "Content hidden", no plan values | | |
| M-05 | System text size at maximum (iOS: Larger Accessibility Sizes; Android: font size max + display size max) | Every screen readable, nothing cut off, all screens scroll | | |
| M-06 | Settings → text size Larger, together with M-05 | Still readable, no overlap | | |
| M-07 | VoiceOver / TalkBack through every screen | Every control has a spoken name; status chips read their text; checkboxes say checked or not checked | | |
| M-08 | Touch targets | Every button, checkbox and comfort choice is easy to hit (at least 44 pt) | | |
| M-09 | Plan expired (mock: approve nothing for SYN-04 or sign in as a patient whose plan expired) | "Plan expired", contact the physiotherapist; no plan numbers shown | | |
| M-10 | No plan | "No plan yet", contact the physiotherapist | | |
| M-11 | Countdown | "Valid for … more" goes down minute by minute | | |
| M-12 | Checklist: tick 3 of 4 | "I am ready" stays disabled; ticking all enables it; it only changes the screen, the brace does nothing | | |
| M-13 | After session: comfort large buttons, pain slider and Lower/Higher | Readout shows 0–10 only; Send is disabled until both are chosen; pain ≥ 4 shows the STOP guidance | | |
| M-14 | Note field | Stops at 200 characters; warning about personal details is visible and read out | | |
| M-15 | Airplane mode, open Emergency | All four instructions and the STOP guidance shown, in large text | | |
| M-16 | Language → Français | Every screen in French, including Emergency offline | | |
| M-17 | Sign out, kill the app, reopen | Sign-in screen; no plan or session data visible anywhere | | |
| M-18 | Notifications | The app never asks for notification permission and never shows one | | |
| M-19 | Network inspection (proxy) during use | Only the BFF and Keycloak hosts are contacted; no analytics hosts | | |
| M-20 | Uninstall without signing out (iOS), reinstall | Record what happens: the iOS keychain can outlive the app (open question 27) | | |
