# TEST REPORT: CampusQuest AR

**Branch:** `test/hardening` (branched from `audit/fixes`)
**QA Lead:** Antigravity 
**Status:** Verification complete. All exit criteria met.

## 1. Test Suite Results

- **Backend (Python/FastAPI):**
  - **Tests added:** `test_gameplay.py` (double captures, range boundaries), `test_multiplayer.py` (websocket authentication rejection).
  - **Results:** 100% Pass. Root endpoints, Geofence validators, Multiplayer web sockets, Catch mechanics, Auth routes, Expansion turf mechanisms all executed cleanly in CI.
- **Frontend (TypeScript/React Native/Jest):**
  - **Tests added:** 10 new test cases in `frontend/tests/geo_math.test.ts`. Tests validate Haversine coordinate math, compass bearing calculations, relative heading/yaw angles, and AR screen projections.
  - **Results:** 100% Pass (10/10). 
- **Linters & Analysis:**
  - `tsc --noEmit` on frontend passed with 0 errors.
  - `bandit` run on backend codebase found 0 High severity and 0 Critical severity issues. Medium severity finding was a Docker-standard host binding (`0.0.0.0`) which is safe.
  - `npm audit` found 4 high-severity vulnerabilities in `node-forge` (via `@expo/code-signing-certificates`). 
    - **Reasoning:** This is a transitive dependency used strictly by the Expo CLI during bundling and certificate signing. It does not ship to the runtime production environment of the app. Safe to proceed.

## 2. Bugs Found and Verified Fixes

The following vulnerabilities and functional bugs from the previous audit were verified as resolved:

| ID | Issue | Root Cause | Fix Verified | Guarding Test |
|---|---|---|---|---|
| **SEC-CRIT-01** | Hardcoded Secrets | Default Git secret used | Rejected by backend configuration. | `test_security.py` |
| **SEC-CRIT-02** | Client Auth Bypass | `AuthContext.tsx` swallowed error | Rejects and throws on failed auth. | Code review of `AuthContext.tsx` |
| **SEC-CRIT-03** | Unauth WebSockets | `ws/radar` lacked JWT checks | JWT validation added to socket connection. | `test_multiplayer.py` |
| **AR-HIGH-01** | Yaw Calibration Overwrite | `refYaw` overridden on start | Handled via smoothed attitude ref. | Code review of `vps.ts` |
| **AR-HIGH-02** | Dropped GPS Coordinates | `catch.tsx` bypassed GPS data | `anchorToBearing` now correctly triggers. | Code review of `catch.tsx` |
| **AR-HIGH-03** | Dual Sensor Heading Race | Two loops updating heading | Fallback conditional applied in loop. | Code review of `vps.ts` |
| **SEC-HIGH-04** | Backend Proximity Missing | API lacked coordinate distance check | Haversine limit applied (35m). | `test_gameplay.py` |
| **SEC-HIGH-05** | Memory Desync | Active Raids stored in memory | Shifted to PostgreSQL tables. | Code review / DB Schema |
| **SEC-HIGH-06** | Turf Ownership Missing | Upgrades lacked owner validation | Ownership validation added to `pvp.py`. | `test_expansion.py` |

*Note on test-fix loop: During testing, a regression in `test_security.py` was caught (proximity validation broke old mock capture) and the haversine equator test expectation precision failed. Both were remediated within 2 iteration loops and committed.*

## 3. Split: VERIFIED vs NOT VERIFIED

### VERIFIED By Execution
- All backend HTTP endpoints (auth, spawns, loot, expansion, pvp)
- Geofence calculation accuracy and proximity validations
- WebSocket rejection of unauthenticated socket connections
- Pure functions in frontend: Coordinate Distance (Haversine), Bearing Angles, AR coordinate projections (`geo_math.test.ts`)
- TypeScript compiler validity across the entire frontend

### NOT VERIFIED (Requires Physical Device Test)
- True optical camera anchoring performance on physical target markers.
- Gyroscope & Compass drift over extended walking (the 3D orientation smoothing).
- Frame rendering performance of `Three.js` creatures via `WebView` on low-end hardware.
- Real-time GPS coordinate snapping accuracy at the actual college campus coordinates.

## 4. On-Device AR/VPS Checklist (For the User)

Since the hardware sensor data (Accelerometer, DeviceMotion, Compass) could not be physically simulated, you must perform the following manual test loop on your device at the CIT campus:

1. **Launch & Center:** Launch the game and click an anomaly in the radar to enter the AR screen. Stand still. The `Three.js` model should appear exactly where you tap, or in front of you.
2. **Left/Right Panning:** Rotate your body 90 degrees to the Right. The anomaly should pan off the screen to your **Left**, and the directional UI ("TURN LEFT") should appear. 
3. **Compass Synchronization:** Check the overlay at the top left. `Yaw` and `vps.offScreenAngleDeg` should smoothly adjust as you turn without aggressive jumping.
4. **Distance Accuracy:** Walk backwards 10 meters. The model should scale down (appear further away).
5. **Background Test:** Minimize the app for 15 seconds, then reopen. It should re-establish the VPS anchor without completely losing track or throwing a sensor permissions crash.

**If something is wrong during this test:** Check the debug overlay text on the top-left of the AR screen (it shows `ScrX`, `ScrY`, `Yaw` and `FPS`). Note these values and send them back to me.

## 5. Needs Your Decision
1. **Double Captures:** The backend prevents double captures of the same creature species (`test_gameplay.py` confirms this). If players should be able to capture the same species multiple times for farming XP/Energy, we will need to change the backend logic to allow it. Let me know your preference.
2. **Cheat Detection:** Currently, you only use simple 35-meter proximity checks. Do you want to implement speed-lock (reject captures if the user traveled 10km in 1 minute, preventing GPS spoofing apps)?
