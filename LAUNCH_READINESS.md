# LAUNCH READINESS REPORT
**Target:** Pilot Release `v0.1.0-pilot`

## 1. Recommendation
**Status:** **GO FOR PILOT** (Conditionally)

**Reasoning:** The application is functionally complete for a closed beta. Security hardening (JWT validation, coordinate proximity checks, speed checks) successfully prevents basic cheating and API abuse. The codebase is clean, tested, and CI/CD integrated. However, the final "Go" depends entirely on you performing the `ON_DEVICE_CHECKLIST.md` in the physical world, as AR hardware tracking cannot be conclusively validated on an emulator.

## 2. What Was Changed (Task Summary)
- **Task 1 (Merge Prep):** Created `PULL_REQUEST.md`, hid VPS debug telemetry behind `__DEV__` flag for production, and prepared branch `release/prep`.
- **Task 2 (CI/CD):** Implemented GitHub Actions (`.github/workflows/ci.yml`) for automated testing, dependency audits, Bandit security scans, and Gitleaks. Configured Dependabot.
- **Task 3 (Keys & Hardening):** Moved secrets out of code into `.env` (provided `.env.example`). Added anti-spoofing telemetry (speed limits and teleportation locks) to the `/catch` API to block GPS spoofers.
- **Task 4 (Privacy):** Drafted `PRIVACY_NOTE.md` clarifying data collection (no continuous tracking, no photos stored).
- **Task 5 & 6 (Safety & Reliability):** Established incident plan (kill switch procedures via env vars/DB), confirmed backend geofence limits, and documented safe play rules for the pilot.
- **Task 7 (Pilot Kit):** Authored `PILOT_PLAN.md` and `ON_DEVICE_CHECKLIST.md` to structure the beta launch.

## 3. Verification State

**VERIFIED (By Code & Execution):**
- Geofence bounding math and coordinate validations.
- API Endpoint authentication and WebSocket JWT strict enforcement.
- Anti-cheat mechanics: Proximity enforcement (<50m), Speed limits (<15 m/s), and duplicate catch blocking.
- Frontend React logic compilation and unit math checks.

**INFERRED (By Code Reading):**
- Data retention: Locations are only logged per-catch or briefly held in memory for multiplayer.
- Client camera handling: The Three.js WebView properly hooks to the `vps.ts` coordinate output.

**NOT VERIFIABLE (Needs Physical Device/Consoles):**
- Real-world compass/gyro drift behavior during a 30-minute walk.
- Rendering framerates and thermal throttling on older mobile phones.
- Real-world GPS jitter (whether 50m tolerance is enough near tall CIT buildings).
- Third-party console setups (Google Cloud, Expo EAS, App Stores).

## 4. Human Actions Required (Checklist)
1. **Google Maps API Key Restrictions:** In Google Cloud Console, restrict your Maps API key to your specific iOS Bundle ID and Android SHA-1 Certificate. Restrict the scope specifically to the Maps SDKs to prevent unauthorized usage.
2. **Setup Secrets for GitHub Actions:** Add `JWT_SECRET_KEY` and any backend database URLs to your GitHub repository secrets if you intend to deploy from CI.
3. **Generate Production JWT Key:** Run `openssl rand -hex 32` and place the output in your production `.env` file as `JWT_SECRET_KEY`.
4. **Crash Reporting Setup:** Register for Sentry or Firebase Crashlytics, obtain the DSN/keys, and inject them into the production `.env` (the codebase currently lacks them; must be added before wide release).
5. **Expo EAS Setup:** Run `eas build` to generate the initial test APK/TestFlight binary for the pilot group.
6. **College Clearance (Optional but Recommended):** Inform campus security that 5-10 students will be walking around scanning areas with their phones on Wed-Fri to avoid misunderstandings.

## 5. Needs Your Decision
1. **Double Captures:** By default, I locked down the `/catch` API so a user can only catch a specific anomaly once. If you prefer a "farming" style loop where creatures respawn daily, we need to alter the database unique constraint and `/catch` logic.
2. **Account Deletion UI:** The backend lacks a `/delete-account` endpoint. Currently, users must contact you to wipe their data. Do you want to build an in-app "Delete Account" button before the full public launch?
3. **Analytics/Crashlytics Privacy:** Adding Sentry/Firebase will collect device data. You must decide if you want to anonymize IP addresses in the Crashlytics console (recommended).

## 6. Remaining Risks (Ranked by Severity)
1. **[Medium] AR Sensor Drift:** If the phone's compass is uncalibrated, the 3D model may appear behind the user or slide sideways wildly. (Mitigation: Instruct testers to figure-8 calibrate their compass).
2. **[Medium] GPS Bouncing:** Near the tall Admin Tower, GPS may bounce outside the 50m tolerance, frustrating players.
3. **[Low] Expo `node-forge` Vulnerability:** Flagged by `npm audit`. Safe to ignore as it is a build-time Expo CLI dependency, but could block automated security pipelines if not explicitly bypassed.
4. **[Low] Battery Drain:** Continuous camera and GPS usage will heavily drain batteries. The 20-minute limit in the pilot will test if it's too severe.
