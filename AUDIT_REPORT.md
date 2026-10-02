# CampusQuest Comprehensive Codebase Audit & Security Assessment Report

**Audit Target:** CampusQuest (AR Geolocation MMORPG for Coimbatore Institute of Technology)  
**Auditor Role:** Senior Software Engineer & Security Auditor  
**Audit Date:** October 2026  
**Git Branch:** `audit/fixes` (Created from `main`; 0 source code modifications applied in this stage)  
**Audit Status:** COMPLETE — Awaiting User Approval  

---

## 1. Executive Summary

CampusQuest is an ambitious campus-scale augmented reality geolocation game built for the Coimbatore Institute of Technology (CIT). It blends real-world GPS navigation, Three.js 3D entity rendering, simulated Visual Positioning System (VPS) orientation tracking, department turf wars, and real-time multiplayer radar.

The codebase exhibits strong feature ideation and a rich visual design language ("Liquid Glass" UI, procedural audio synthesis, Leaflet map theming). However, the application currently suffers from two primary debilitating bugs reported by the team:
1. **Entities are placed at incorrect positions in AR/VPS space.**
2. **AR camera movement pans in the reverse/incorrect direction.**

In addition to these AR pipeline defects, this comprehensive audit identified critical security vulnerabilities—including **client-side authentication bypass**, **unauthenticated WebSocket multiplayer tracking**, **secrets committed to git history**, **unvalidated server-side catch mechanics**, and **in-memory race conditions in multi-worker production deployments**.

This document outlines the complete architectural mapping, deep-dive root-cause analysis of the AR/VPS pipeline, verified audit findings triaged by severity, a "Needs My Decision" architectural review, and a physical device verification roadmap.

---

## 2. Project Stack & Architecture Mapping (Phase 1)

### 2.1 Detected Technology Stack
| Layer | Technologies & Libraries |
| :--- | :--- |
| **Mobile Frontend** | React Native `0.76.7`, Expo SDK `52.0.38` / Expo Router `4.0.17`, TypeScript `5.3.3` |
| **AR & 3D Engine** | Three.js `0.174.0`, `@react-three/fiber` `8.17.14`, Expo GL (`expo-gl` `15.0.3`) |
| **Device Sensors** | `expo-sensors` `14.0.2` (DeviceMotion, Accelerometer, Magnetometer), `expo-location` `18.0.7` |
| **Mapping Engine** | React Native WebView (`react-native-webview` `14.4.5`) rendering Leaflet.js `1.9.4` with CartoDB DarkMatter tiles |
| **Backend API** | Python `3.12`, FastAPI `0.115.11`, Uvicorn `0.34.0`, Pydantic `2.10.6` |
| **Database & ORM** | PostgreSQL (Production) / SQLite3 (Local Dev Fallback), SQLAlchemy `2.0.38`, Alembic |
| **Security & Auth** | Passlib (`bcrypt`), PyJWT `2.10.1`, OAuth2 Bearer Tokens |
| **Deployment & Infra**| Docker, Docker Compose, Nginx (Web export reverse proxy), multi-stage Dockerfiles |

### 2.2 Entry Points & Component Connections
- **Backend Entry Point:** [`backend/run.py`](file:///c:/Users/Joshwin/Documents/CampusQuest/backend/run.py) & [`backend/app/main.py`](file:///c:/Users/Joshwin/Documents/CampusQuest/backend/app/main.py)
  - Configured with FastAPI routers: `/api/auth`, `/api/gameplay`, `/api/spawns`, `/api/admin`, `/api/friends`, `/api/multiplayer`, `/api/pvp`, `/api/shop`, `/api/turf`.
  - Database initialized via [`backend/app/database.py`](file:///c:/Users/Joshwin/Documents/CampusQuest/backend/app/database.py).
- **Frontend Entry Point:** [`frontend/app/_layout.tsx`](file:///c:/Users/Joshwin/Documents/CampusQuest/frontend/app/_layout.tsx)
  - Wraps application in `AuthProvider` ([`frontend/context/AuthContext.tsx`](file:///c:/Users/Joshwin/Documents/CampusQuest/frontend/context/AuthContext.tsx)).
  - Routes: `/login`, `/index` (Main Map / Radar), `/catch` (AR Encounter), `/inventory`, `/profile`, `/shop`, `/friends`, `/admin`.
- **Component Interconnection:**
  - **Map & Geofence:** [`frontend/components/InteractiveLeafletMap.tsx`](file:///c:/Users/Joshwin/Documents/CampusQuest/frontend/components/InteractiveLeafletMap.tsx) receives GPS coordinates from `expo-location` and CIT spawns from backend `/api/spawns`.
  - **AR Tracking & Three.js Canvas:** [`frontend/app/catch.tsx`](file:///c:/Users/Joshwin/Documents/CampusQuest/frontend/app/catch.tsx) initializes `useVPSTracker` ([`frontend/utils/vps.ts`](file:///c:/Users/Joshwin/Documents/CampusQuest/frontend/utils/vps.ts)) and renders 3D creatures via [`frontend/components/ARCreatureModel.tsx`](file:///c:/Users/Joshwin/Documents/CampusQuest/frontend/components/ARCreatureModel.tsx).
  - **Live Multiplayer Radar:** [`frontend/utils/multiplayer.ts`](file:///c:/Users/Joshwin/Documents/CampusQuest/frontend/utils/multiplayer.ts) connects via WebSockets to `/api/multiplayer/ws/radar/{user_id}`.

### 2.3 Baseline Build, Lint, and Test Execution Results
All tests were executed on branch `audit/fixes` with the following baseline results:

1. **Backend Test Suite (Python 3.12):**
   - `python backend/test_api.py`: **PASSED** (17 API routes verified with SQLite test session).
   - `python backend/test_security_audit.py`: **PASSED** (19/19 automated security assertions verified).
   - `python backend/test_admin.py`: **PASSED**.
   - `python backend/test_expansion.py`: **PASSED**.
   - `python backend/test_friends.py`: **PASSED**.
   - `python backend/test_multiplayer.py`: **PASSED**.
   - `python backend/test_security.py`: **PASSED**.
   - `python backend/test_shop.py`: **PASSED**.
2. **Frontend Typecheck & Build (TypeScript / Expo SDK 52):**
   - `npm run typecheck` (`tsc --noEmit`): **PASSED** (0 TypeScript errors).
   - `node test_haversine.js`: **PASSED** (Haversine formula verified against CIT landmark coordinates).
   - `npm run build:web`: **PASSED** (Static web export generated to `frontend/dist/`).
3. **Dependency Vulnerability Scan:**
   - `npm audit`: **FAILED / WARNING** — 4 high-severity vulnerabilities detected in `node-forge` (via `@expo/cli` -> `@expo/code-signing-certificates`).

### 2.4 File Manifest (Reviewed Files vs Excluded Paths)
#### Excluded Paths:
- `frontend/node_modules/` (Third-party dependencies)
- `frontend/dist/` (Build output)
- `frontend/.expo/` (Local Expo cache)
- `backend/.venv/` (Python virtual environment)
- `backend/**/__pycache__/` (Python bytecode cache)
- `.git/` (Git metadata)

#### Complete Review Checklist (48 Project Files Reviewed in Full):
- [x] `README.md`
- [x] `SRS_CampusQuest.md`
- [x] `docker-compose.yml`
- [x] `.gitignore`
- [x] `.gitattributes`
- [x] `backend/Dockerfile`
- [x] `backend/run.py`
- [x] `backend/requirements.txt`
- [x] `backend/generate_pins.py`
- [x] `backend/test_api.py`
- [x] `backend/test_security_audit.py`
- [x] `backend/test_admin.py`
- [x] `backend/test_expansion.py`
- [x] `backend/test_friends.py`
- [x] `backend/test_multiplayer.py`
- [x] `backend/test_security.py`
- [x] `backend/test_shop.py`
- [x] `backend/app/__init__.py`
- [x] `backend/app/config.py`
- [x] `backend/app/database.py`
- [x] `backend/app/auth.py`
- [x] `backend/app/models.py`
- [x] `backend/app/schemas.py`
- [x] `backend/app/geofence.py`
- [x] `backend/app/main.py`
- [x] `backend/app/routers/__init__.py`
- [x] `backend/app/routers/auth.py`
- [x] `backend/app/routers/gameplay.py`
- [x] `backend/app/routers/spawns.py`
- [x] `backend/app/routers/admin.py`
- [x] `backend/app/routers/friends.py`
- [x] `backend/app/routers/multiplayer.py`
- [x] `backend/app/routers/pvp.py`
- [x] `backend/app/routers/shop.py`
- [x] `backend/app/routers/turf.py`
- [x] `frontend/Dockerfile`
- [x] `frontend/nginx.conf`
- [x] `frontend/package.json`
- [x] `frontend/app.json`
- [x] `frontend/babel.config.js`
- [x] `frontend/metro.config.js`
- [x] `frontend/patch-rn-private-fields.js`
- [x] `frontend/tsconfig.json`
- [x] `frontend/test_haversine.js`
- [x] `frontend/scratch/three_cat_test.html`
- [x] `frontend/components/ARCreatureModel.tsx`
- [x] `frontend/components/InteractiveLeafletMap.tsx`
- [x] `frontend/components/DuelModal.tsx`
- [x] `frontend/components/StrongholdModal.tsx`
- [x] `frontend/app/_layout.tsx`
- [x] `frontend/app/index.tsx`
- [x] `frontend/app/index.web.tsx`
- [x] `frontend/app/catch.tsx`
- [x] `frontend/app/catch.web.tsx`
- [x] `frontend/app/admin.tsx`
- [x] `frontend/app/friends.tsx`
- [x] `frontend/app/inventory.tsx`
- [x] `frontend/app/login.tsx`
- [x] `frontend/app/profile.tsx`
- [x] `frontend/app/shop.tsx`
- [x] `frontend/constants/challenges.ts`
- [x] `frontend/constants/mapStyle.ts`
- [x] `frontend/context/AuthContext.tsx`
- [x] `frontend/styles/liquidGlass.ts`
- [x] `frontend/utils/vps.ts`
- [x] `frontend/utils/haversine.ts`
- [x] `frontend/utils/api.ts`
- [x] `frontend/utils/buddy.ts`
- [x] `frontend/utils/friends.ts`
- [x] `frontend/utils/haptics.ts`
- [x] `frontend/utils/multiplayer.ts`
- [x] `frontend/utils/pvp.ts`
- [x] `frontend/utils/sound.ts`
- [x] `frontend/utils/turf.ts`

---

## 3. AR / VPS / Mapping Pipeline Deep Dive (Phase 1.5)

### 3.1 Pipeline Flow
The AR pipeline processes spatial transformations in four sequential stages:
$$\text{GPS Geodesic Pose } (\phi, \lambda) \longrightarrow \text{Local Tangent Plane / Bearing } (\theta, d) \longrightarrow \text{Sensor Fusion & Frame Transformation } (\Delta\psi, \Delta\theta) \longrightarrow \text{Three.js Camera / Object Space } (x, y, z)$$

### 3.2 Root Causes of Reported Primary AR Bugs

#### Bug 1: Entities Mapped to Wrong Positions in AR/VPS
There are **two distinct root causes** causing entities to be mislocated:

1. **Anchor Bearing Overwrite upon Compass Calibration (`frontend/utils/vps.ts:218-226` & `267-275`):**
   In `useVPSTracker`, when the first hardware compass heading or accelerometer pitch event arrives:
   ```typescript
   // frontend/utils/vps.ts line 218:
   if (!hasAlignedInitialHeadingRef.current) {
     hasAlignedInitialHeadingRef.current = true;
     currentAttitudeRef.current.yaw = headingRad;
     if (anchorRef.current) {
       anchorRef.current.refYaw = headingRad; // <-- CRITICAL BUG!
     }
   }
   ```
   **Why this breaks placement:** `anchorRef.current.refYaw` stores the absolute geographic bearing from the player to the entity (e.g. 1.25 rad / $71^\circ$ East-North-East). When the compass initializes, line 223 overwrites `anchorRef.current.refYaw` with `headingRad` (the phone's current facing direction). This instantly forces the creature to appear dead-center in front of the camera, destroying its true world coordinate bearing!

2. **`catch.tsx` Completely Bypasses GPS Coordinates (`frontend/app/catch.tsx:107-110`):**
   When transitioning from the map to the catch screen, `catch.tsx` receives `creature_lat`, `creature_lng`, `user_lat`, and `user_lng`. However, lines 107–110 unconditionally invoke:
   ```typescript
   // frontend/app/catch.tsx line 107:
   lockAnchorInFront(creatureName, rarity, 2.5);
   ```
   It never calculates the geodesic bearing between player and creature, and never calls `anchorToBearing(...)`. Consequently, regardless of where the creature was on the map, it is artificially anchored 2.5 meters in front of the lens.

#### Bug 2: AR Camera Movement Pans in the Wrong Direction
There are **two conflicting mathematical conventions** and a sensor update race causing camera panning inversion:

1. **Clockwise vs. Counter-Clockwise Convention Mismatch:**
   - **Compass & Geodesic Bearing:** Bearing and compass headings are navigational angles measured clockwise from True/Magnetic North ($0^\circ = \text{North}$, $90^\circ = \text{East}$, $180^\circ = \text{South}$, $270^\circ = \text{West}$).
   - **Three.js Coordinate System:** Standard Three.js uses a right-handed Cartesian coordinate system ($+X$ is right, $+Y$ is up, $+Z$ is out toward the viewer). Rotations around $+Y$ follow the right-hand rule: positive yaw rotation is counter-clockwise when viewed from above.
   - In `vps.ts:311-314`:
     ```typescript
     const dYaw = anchor.refYaw - attitude.yaw;
     const dPitch = attitude.pitch - anchor.refPitch;
     x = Math.sin(dYaw) * dist;
     z = -Math.cos(dYaw) * dist;
     ```
     When a player turns to the right (clockwise), the compass heading increases ($\Delta \text{yaw} > 0$). In the camera's local reference frame, an object at a fixed world location must appear to shift to the left ($\Delta x < 0$). Because the signs and trigonometric projections are not aligned with Three.js camera rotation conventions, rotating the device right causes the rendered entity to translate right instead of left, creating the sensation that the camera or object is moving backwards.

2. **Dual Asynchronous Heading Loops Competing in `useVPSTracker`:**
   - In `useVPSTracker`, `Location.watchHeadingAsync` is executed internally (`vps.ts:212-230`), while simultaneously `externalHeading` passed from `index.tsx` is processed in an `useEffect` (`vps.ts:166-173`).
   - Both loops independently apply exponential smoothing with different smoothing coefficients (`0.15` vs `0.20`) and mutate `currentAttitudeRef.current.yaw`. This induces severe sensor jitter, phase lag, and orientation flip-flops.

### 3.3 Boundary Coordinate & Scale Analysis
| Boundary | System A Convention | System B Convention | Conversion Status |
| :--- | :--- | :--- | :--- |
| **GPS to Local Meters** | WGS-84 Ellipsoid $(\phi, \lambda)$ | Local Tangent Plane $(E, N)$ | Correctly uses Haversine; however, bearing formula must feed AR anchor. |
| **Compass to 3D Space** | Clockwise degrees ($0^\circ-360^\circ$) | Three.js Y-up right-hand radians | **Inverted / Sign flip required.** |
| **Sensor Fusion** | DeviceMotion (Euler roll/pitch/yaw) | Three.js Object Position $(x, y, z)$ | **Distorted by premature reference overwrites.** |
| **Map Units to AR Scale**| Leaflet Web Mercator meters ($1\text{m} = 1\text{m}$) | Three.js Scene Units ($1\text{u} \approx 1\text{m}$) | 2.5m fixed clamping overrides physical distance. |

### 3.4 Verification & Telemetry Requirements
*Note: As this environment cannot run physical camera hardware, all AR findings below are categorized as `[UNVERIFIED - needs on-device test]`.*

To allow precise physical verification on an iOS or Android device during testing, an on-screen debug telemetry overlay (HUD) must be added to `catch.tsx` and `vps.ts`:
- **Compass Heading:** Raw Magnetic vs. True Heading (degrees and radians).
- **Device Attitude:** Pitch, Roll, Yaw ($\theta, \phi, \psi$).
- **Calculated Geodesic Bearing:** Bearing from GPS to Target ($\beta_{\text{rad}}$).
- **Relative Delta Yaw ($\Delta\psi$):** Difference between Target Bearing and Device Heading.
- **Computed Three.js Coordinates:** $(x, y, z)$ coordinates rendered into the R3F scene.
- **GPS Horizontal Accuracy:** Horizontal accuracy radius in meters ($r_{\text{acc}}$).

---

## 4. Comprehensive Audit Findings (Phases 2 & 3)

### Summary of Findings by Severity
| Severity | Count | Primary Impact Areas |
| :--- | :---: | :--- |
| **CRITICAL** | 3 | Authentication bypass, secrets in git history, unauthenticated location snooping |
| **HIGH** | 6 | AR anchor destruction, camera panning inversion, missing catch validation, state desync |
| **MEDIUM** | 8 | Missing mascot spawn, out-of-bounds strongholds, trivia cheating, audio leaks |
| **LOW** | 4 | CORS parameterization, unused fallbacks, SQLite concurrency limitations |

---

### 4.1 Critical Severity Findings

#### `SEC-CRIT-01`: Hardcoded Secrets in Git History, Configuration, and Docker Compose
- **Files & Lines:**
  - Git commit history: `7b302fe6` committed `backend/.env` containing production `JWT_SECRET_KEY` and PostgreSQL credentials (untracked in `262f8f73`, but permanently preserved in git history).
  - [`backend/app/config.py:17-21, 26`](file:///c:/Users/Joshwin/Documents/CampusQuest/backend/app/config.py#L17-L26): `DEFAULT_INSECURE_SECRET = "insecure-dev-secret-change-in-production-cit-2026"`, `ADMIN_REGISTRATION_KEY = "CIT-ADMIN-KEY-2026"`.
  - [`docker-compose.yml:11, 29, 31`](file:///c:/Users/Joshwin/Documents/CampusQuest/docker-compose.yml#L11-L31): Hardcoded fallback passwords for `POSTGRES_PASSWORD`, `JWT_SECRET_KEY`, and `ADMIN_REGISTRATION_KEY`.
- **What's Wrong:** Sensitive encryption keys and admin registration passcodes are hardcoded in source files and exposed in git history.
- **Why It Matters:** Anyone with access to the repository can forge administrative JWT tokens, gain unrestricted admin access, or connect to production databases.
- **Planned Fix:**
  1. Revoke and rotate all existing keys and credentials.
  2. Modify `config.py` to raise a startup exception if `JWT_SECRET_KEY` or `ADMIN_REGISTRATION_KEY` is missing or matches default fallback values in non-development environments.
  3. Ensure `.env` is permanently ignored and scrub sensitive commits if repository is shared.
- **Confidence Level:** High (Verified).

---

#### `SEC-CRIT-02`: Client-Side Authentication Bypass in `AuthContext.tsx`
- **Files & Lines:** [`frontend/context/AuthContext.tsx:73-82, 16-25`](file:///c:/Users/Joshwin/Documents/CampusQuest/frontend/context/AuthContext.tsx#L16-L82)
- **What's Wrong:** In `login(email, password)`:
  ```typescript
  // frontend/context/AuthContext.tsx lines 73-82:
  } catch (error: any) {
    console.warn('[AuthContext] Backend login failed, using guest mode fallback for offline testing:', error);
    const guestUser: UserProfile = {
      ...DEFAULT_GUEST_USER,
      email,
      username: email.split('@')[0] || 'Cadet',
    };
    setUser(guestUser);
    setIsAuthenticated(true);
    return true; // <-- Returns success on failed login!
  }
  ```
  Furthermore, lines 16–25 initialize the app pre-authenticated with `DEFAULT_GUEST_USER` and `token: 'guest-token'`.
- **Why It Matters:** An attacker or unauthorized student can enter any fictitious email with any password, and the frontend logs them in with full access. Furthermore, unauthorized users can access the Admin route (`/admin`) without ever authenticating against the backend.
- **Planned Fix:**
  1. Remove mock guest fallback from `login()`. On HTTP 401 or network failure, set appropriate error states and return `false`.
  2. Do not pre-authenticate as guest by default unless an explicit "Play as Guest" mode is deliberately selected by the user.
- **Confidence Level:** High (Verified).

---

#### `SEC-CRIT-03`: Unauthenticated WebSocket Endpoint Enables Campus-Wide Location Snooping & User Impersonation
- **Files & Lines:**
  - [`backend/app/routers/multiplayer.py:69-86`](file:///c:/Users/Joshwin/Documents/CampusQuest/backend/app/routers/multiplayer.py#L69-L86)
  - [`frontend/utils/multiplayer.ts:120-124`](file:///c:/Users/Joshwin/Documents/CampusQuest/frontend/utils/multiplayer.ts#L120-L124)
- **What's Wrong:**
  1. `/api/multiplayer/ws/radar/{user_id}` declares `token: str = Query(None)`. If `token is None`, the endpoint logs a warning but proceeds to call `await websocket.accept()`.
  2. `frontend/utils/multiplayer.ts` constructs the WebSocket URL (`getRadarWebSocketUrl`) without appending `?token=...`.
  3. No validation checks that the connecting client's token matches `user_id`.
- **Why It Matters:** Any malicious party can open a WebSocket connection specifying any student's `user_id`, spoof their location, or monitor live physical campus coordinates broadcast to that socket. This presents a severe physical safety and privacy risk for students.
- **Planned Fix:**
  1. Require valid JWT token in WebSocket query parameters or connection headers.
  2. Verify that `decoded_user_id == user_id`.
  3. Close connection immediately (`code=1008 Policy Violation`) if token is absent, expired, or invalid.
  4. Update `frontend/utils/multiplayer.ts` to transmit the active JWT token.
- **Confidence Level:** High (Verified).

---

### 4.2 High Severity Findings

#### `AR-HIGH-01`: Compass Calibration Overwrites World Anchor Bearing [PRIMARY BUG #1]
- **Category:** AR / VPS Pipeline
- **Status:** `[UNVERIFIED - needs on-device test]`
- **Files & Lines:** [`frontend/utils/vps.ts:218-226, 267-275`](file:///c:/Users/Joshwin/Documents/CampusQuest/frontend/utils/vps.ts#L218-L275)
- **What's Wrong:** When the hardware compass first activates, `vps.ts` overwrites `anchorRef.current.refYaw` with the instantaneous phone facing direction (`headingRad`), obliterating the geodesic bearing previously computed to the entity.
- **Why It Matters:** Creatures always snap directly to the center of the viewport regardless of where they actually reside geographically.
- **Planned Fix:** Preserve `anchorRef.current.refYaw`. Do not mutate anchor bearing during device orientation updates.
- **Confidence Level:** High.

---

#### `AR-HIGH-02`: `catch.tsx` Discards GPS Coordinates and Uses Hardcoded Forward Anchor [PRIMARY BUG #1]
- **Category:** AR / VPS Pipeline
- **Status:** `[UNVERIFIED - needs on-device test]`
- **Files & Lines:** [`frontend/app/catch.tsx:107-110`](file:///c:/Users/Joshwin/Documents/CampusQuest/frontend/app/catch.tsx#L107-L110)
- **What's Wrong:** `catch.tsx` ignores incoming GPS route parameters and unconditionally calls `lockAnchorInFront(creatureName, rarity, 2.5)`.
- **Why It Matters:** Physical world location is completely uncoupled from the AR rendering scene.
- **Planned Fix:** Calculate initial bearing via `calculateBearing(user_lat, user_lng, creature_lat, creature_lng)` and call `anchorToBearing(bearingRad, distance)`. Only use `lockAnchorInFront` if GPS fix is unavailable.
- **Confidence Level:** High.

---

#### `AR-HIGH-03`: Dual Sensor Heading Race and Inverted Coordinate Handedness [PRIMARY BUG #2]
- **Category:** AR / VPS Pipeline
- **Status:** `[UNVERIFIED - needs on-device test]`
- **Files & Lines:**
  - [`frontend/utils/vps.ts:166-173, 212-230, 311-318`](file:///c:/Users/Joshwin/Documents/CampusQuest/frontend/utils/vps.ts#L166-L318)
  - [`frontend/app/index.tsx:112-123`](file:///c:/Users/Joshwin/Documents/CampusQuest/frontend/app/index.tsx#L112-L123)
- **What's Wrong:**
  1. Two concurrent heading listeners mutate `currentAttitudeRef.current.yaw` with divergent filtering weights (`0.15` vs `0.20`).
  2. Compass bearing (clockwise) and Three.js right-handed rotation (counter-clockwise) are mismatched in Cartesian translation projection, causing camera rotation to translate objects in reverse.
- **Why It Matters:** Camera movement feels completely unnatural; turning right causes the 3D model to slide right rather than rotate out of view to the left.
- **Planned Fix:** Consolidate to a single heading source. Invert the delta angle sign ($-\Delta\psi$) when projecting into Three.js camera-relative coordinates.
- **Confidence Level:** High.

---

#### `SEC-HIGH-04`: Missing Server-Side Proximity and Spawn Validation in Catch Mechanic
- **Files & Lines:** [`backend/app/routers/gameplay.py:65-115`](file:///c:/Users/Joshwin/Documents/CampusQuest/backend/app/routers/gameplay.py#L65-L115)
- **What's Wrong:** `/api/gameplay/catch` validates that the submitted `(latitude, longitude)` is within the CIT campus perimeter, but **never validates**:
  1. Whether the player is within range ($\le 35\text{m}$) of the creature's actual coordinates.
  2. Whether the creature actually spawned, is currently active, or has already been captured.
- **Why It Matters:** Any player can write a simple Python script to send capture requests for every rare creature from their dorm room, completely destroying game balance.
- **Planned Fix:** Require `spawn_id`, verify spawn existence in backend cache/database, and compute Haversine distance between player's verified location and spawn location (rejecting captures $> 35\text{m}$).
- **Confidence Level:** High (Verified).

---

#### `SEC-HIGH-05`: Multi-Worker In-Memory State Desynchronization and Ephemeral Data Loss
- **Files & Lines:**
  - [`backend/Dockerfile:27`](file:///c:/Users/Joshwin/Documents/CampusQuest/backend/Dockerfile#L27): Runs Uvicorn with `--workers 2`.
  - [`backend/app/routers/gameplay.py:27, 30`](file:///c:/Users/Joshwin/Documents/CampusQuest/backend/app/routers/gameplay.py#L27-L30): `USER_LOOT_CLAIMS: dict = {}`, `USER_QR_LAST_SCAN: dict = {}`.
  - [`backend/app/routers/multiplayer.py:28, 48`](file:///c:/Users/Joshwin/Documents/CampusQuest/backend/app/routers/multiplayer.py#L28-L48): `ACTIVE_RAID_GROUPS: dict = {}`, `ConnectionManager.peer_positions: dict = {}`.
  - [`backend/app/routers/turf.py:25-72`](file:///c:/Users/Joshwin/Documents/CampusQuest/backend/app/routers/turf.py#L25-L72): `CIT_STRONGHOLDS: list = [...]`.
- **What's Wrong:** All game cooldowns, active raid lobbies, peer locations, and turf war points are stored in Python process memory. Because Docker runs 2 Uvicorn workers, requests routed to Worker A do not see cooldowns set on Worker B.
- **Why It Matters:** Users can double-claim loot crates and bypass scan cooldowns by sending parallel requests that hit alternate workers. Furthermore, restarting the container erases all turf progress and raid lobbies.
- **Planned Fix:** Migrate state dictionaries to PostgreSQL tables (or Redis cache). In development/single-container mode, run Uvicorn with `--workers 1`.
- **Confidence Level:** High (Verified).

---

#### `SEC-HIGH-06`: Missing Ownership and Proximity Checks in Turf Defense & PvP Duels
- **Files & Lines:**
  - [`backend/app/routers/turf.py:90-128`](file:///c:/Users/Joshwin/Documents/CampusQuest/backend/app/routers/turf.py#L90-L128)
  - [`backend/app/routers/pvp.py:53-108`](file:///c:/Users/Joshwin/Documents/CampusQuest/backend/app/routers/pvp.py#L53-L108)
- **What's Wrong:**
  1. `/api/turf/defend` allows any user to station any `creature_name` without checking if the user actually owns that creature in `CapturedCreature` or if they are near the stronghold.
  2. `/api/pvp/duel` accepts arbitrary `opponent_id` strings without verifying that the opponent exists in the database.
- **Why It Matters:** Players can defend strongholds with arbitrary legendary creatures they do not possess, and farm XP/credits by dueling fake user IDs.
- **Planned Fix:** Verify creature ownership in `db.query(CapturedCreature)`, verify physical distance to stronghold, and validate opponent existence in `db.query(User)`.
- **Confidence Level:** High (Verified).

---

### 4.3 Medium Severity Findings

#### `BUG-MED-01`: Canonical Spawn "Super Fluffy Cat" (`cit-story-cat`) Excluded from Spawns API
- **Files & Lines:**
  - [`backend/app/geofence.py:46-55`](file:///c:/Users/Joshwin/Documents/CampusQuest/backend/app/geofence.py#L46-L55): Defines 12 story spawns (indices 0–11). Index 11 is `cit-story-cat` ("Super Fluffy Cat").
  - [`backend/app/routers/spawns.py:15`](file:///c:/Users/Joshwin/Documents/CampusQuest/backend/app/routers/spawns.py#L15): Declares `count: int = 11`.
  - [`frontend/app/index.tsx:75`](file:///c:/Users/Joshwin/Documents/CampusQuest/frontend/app/index.tsx#L75): Calls `fetchSpawns(11)`.
  - [`frontend/utils/api.ts:80-165`](file:///c:/Users/Joshwin/Documents/CampusQuest/frontend/utils/api.ts#L80-L165): `FALLBACK_CIT_SPAWNS` has only 11 entries and omits `cit-story-cat`.
- **What's Wrong:** Due to an off-by-one default (`count=11` instead of `12`), the 12th story creature is never returned by the backend or fallback API.
- **Why It Matters:** The mascot creature "Super Fluffy Cat" never spawns on campus.
- **Planned Fix:** Update `count: int = 12` in `spawns.py`, call `fetchSpawns(12)` in `index.tsx`, and add `cit-story-cat` to `FALLBACK_CIT_SPAWNS`.
- **Confidence Level:** High (Verified).

---

#### `BUG-MED-02`: Campus Strongholds Located Outside CIT Geofence Polygon
- **Files & Lines:**
  - [`backend/app/routers/turf.py:50, 62`](file:///c:/Users/Joshwin/Documents/CampusQuest/backend/app/routers/turf.py#L50-L62)
  - [`backend/app/geofence.py:10-23`](file:///c:/Users/Joshwin/Documents/CampusQuest/backend/app/geofence.py#L10-L23)
- **What's Wrong:**
  - Stronghold 3 (Sports Stadium): Latitude `11.0296` exceeds max campus latitude (`11.0295`).
  - Stronghold 4 (Mechanical Workshop): Longitude `77.0301` exceeds max campus longitude (`77.0290`).
- **Why It Matters:** If geofence checks are strictly enforced, players physically standing at these two strongholds will be flagged as "Outside Campus".
- **Planned Fix:** Adjust coordinates in `turf.py` and `frontend/utils/turf.ts` to lie within campus boundaries (e.g. Stadium: `11.0291, 77.0283`, Workshop: `11.0275, 77.0288`).
- **Confidence Level:** High (Verified).

---

#### `SEC-MED-03`: High-Severity Vulnerabilities in Frontend NPM Dependencies
- **Files & Lines:** [`frontend/package.json`](file:///c:/Users/Joshwin/Documents/CampusQuest/frontend/package.json), `package-lock.json`
- **What's Wrong:** `npm audit` reveals 4 high-severity vulnerabilities in `node-forge` (via `@expo/cli` -> `@expo/code-signing-certificates`):
  - GHSA-8557-825v-x593, GHSA-9j76-gcp9-4j42, GHSA-m45f-6v75-45cw, GHSA-p725-m4wh-4h8p.
- **Why It Matters:** Vulnerabilities in ASN.1 parsing and RSA signature validation could affect developer build pipelines or code-signing verification.
- **Planned Fix:** Update Expo CLI or apply package override in `package.json`.
- **Confidence Level:** High.

---

#### `BUG-MED-04`: Trivia Challenge Answers Deterministically Hardcoded to First Option
- **Files & Lines:** [`frontend/constants/challenges.ts:6-45`](file:///c:/Users/Joshwin/Documents/CampusQuest/frontend/constants/challenges.ts#L6-L45)
- **What's Wrong:** In all 4 trivia challenges, `correctIndex: 0`. The first option is always the winning answer.
- **Why It Matters:** Users can spam the top button to solve every decryption mini-game without reading the questions.
- **Planned Fix:** Vary `correctIndex` across questions and shuffle options dynamically at runtime.
- **Confidence Level:** High (Verified).

---

#### `PERF-MED-05`: Native Audio Player Instance Leaks During Rapid Interactions
- **Files & Lines:** [`frontend/utils/sound.ts:180-183`](file:///c:/Users/Joshwin/Documents/CampusQuest/frontend/utils/sound.ts#L180-L183)
- **What's Wrong:** In `playSoundUri`, on native platforms:
  ```typescript
  const player = nativeCreateAudioPlayer(uri);
  player.play();
  ```
  Player instances are never released or destroyed.
- **Why It Matters:** Rapidly tapping buttons or collecting items instantiates dozens of unreleased native audio players, causing memory pressure and potential audio subsystem crashes on mobile devices.
- **Planned Fix:** Reuse a single audio player per sound effect or register an on-playback-complete listener to call `player.release()`.
- **Confidence Level:** Medium.

---

#### `SEC-MED-06`: Silent Mock Fallbacks Mask Server-Side Failures in Frontend API
- **Files & Lines:**
  - [`frontend/utils/api.ts:251-274, 303-316`](file:///c:/Users/Joshwin/Documents/CampusQuest/frontend/utils/api.ts#L251-L316)
  - [`frontend/utils/friends.ts:89-99`](file:///c:/Users/Joshwin/Documents/CampusQuest/frontend/utils/friends.ts#L89-L99)
  - [`frontend/utils/turf.ts:104-107`](file:///c:/Users/Joshwin/Documents/CampusQuest/frontend/utils/turf.ts#L104-L107)
- **What's Wrong:** When the backend is offline or returns an HTTP error, API wrappers return simulated success objects (e.g. `{ success: true, message: "Captured..." }`).
- **Why It Matters:** The client UI displays success animations and awards local items, but the action was never recorded in the database. On app restart, user progress is mysteriously missing.
- **Planned Fix:** Return explicit offline status indicator (`isOfflineFallback: true`) and notify the user via a persistent UI banner.
- **Confidence Level:** High.

---

#### `BUG-MED-07`: Leaflet WebView Inverted Pan Vector
- **Category:** Mapping / UI
- **Status:** `[UNVERIFIED - needs on-device test]`
- **Files & Lines:** [`frontend/components/InteractiveLeafletMap.tsx:112-117`](file:///c:/Users/Joshwin/Documents/CampusQuest/frontend/components/InteractiveLeafletMap.tsx#L112-L117)
- **What's Wrong:** `map.panBy([-data.dx, -data.dy], { animate: true });` inverts both delta components when processing drag messages from the WebView bridge.
- **Why It Matters:** Depending on touch event bubbling, dragging on mobile may scroll the map in the opposite direction of the finger motion.
- **Planned Fix:** Align pan delta signs with standard touch gesture physics.
- **Confidence Level:** Medium.

---

#### `PERF-MED-08`: Per-Frame Allocations and Matrix Recalculations in Three.js Render Loop
- **Files & Lines:** [`frontend/components/ARCreatureModel.tsx:192-230`](file:///c:/Users/Joshwin/Documents/CampusQuest/frontend/components/ARCreatureModel.tsx#L192-L230)
- **What's Wrong:** Inside the `useFrame` loop, multi-mesh trigonometric transformations and allocations are executed across all nodes every frame without geometry caching.
- **Why It Matters:** Can cause frame drops below 30 FPS on mid-tier mobile devices running concurrent camera video streams.
- **Planned Fix:** Cache mesh references and hoist trigonometric math outside inner loops.
- **Confidence Level:** Medium.

---

### 4.4 Low Severity Findings

#### `CODE-LOW-01`: Redundant Fallback Geometry Branches in `ARCreatureModel.tsx`
- **Files & Lines:** [`frontend/components/ARCreatureModel.tsx:135-155`](file:///c:/Users/Joshwin/Documents/CampusQuest/frontend/components/ARCreatureModel.tsx#L135-L155)
- **Description:** Redundant procedural geometry branches exist that cannot be reached given GLTF asset loading preconditions.

#### `CODE-LOW-02`: Wildcard CORS Configuration
- **Files & Lines:** [`backend/app/main.py:27-33`](file:///c:/Users/Joshwin/Documents/CampusQuest/backend/app/main.py#L27-L33)
- **Description:** `allow_origins=["*"]` is acceptable for native mobile apps, but should be restricted if web clients are hosted on a specific domain.

#### `CODE-LOW-03`: Unused Utility Functions & Imports
- **Files & Lines:** Minor unused helper exports in `frontend/utils/vps.ts` and `frontend/utils/api.ts`.

#### `CODE-LOW-04`: Test Suite Relies on SQLite in Absence of Local PostgreSQL
- **Files & Lines:** [`backend/app/database.py:16-24`](file:///c:/Users/Joshwin/Documents/CampusQuest/backend/app/database.py#L16-L24)
- **Description:** Falls back to SQLite when PostgreSQL is offline. Does not test PostgreSQL-specific concurrency or foreign key lock behaviors.

---

## 5. Needs My Decision (Architectural & Design Choices)

Before applying fixes, the following structural decisions require your explicit approval:

### Decision 1: Authentication Architecture & Guest Mode
- **Current Behavior:** The frontend automatically catches failed logins and logs the user in as a simulated "Guest Cadet" with a fake token.
- **Option A (Recommended):** Enforce strict authentication. Require valid account credentials; display clear error messages on invalid logins. Add an explicit "Explore as Guest (Offline Mode)" button on the login screen that clearly marks gameplay as unranked/offline.
- **Option B:** Keep seamless offline fallback, but add a prominent banner ("Offline Demo Mode") and disable multiplayer radar, leaderboard submissions, and stronghold defense when offline.

### Decision 2: In-Memory Game State vs. PostgreSQL / Redis Persistence
- **Current Behavior:** Raid lobbies, turf war defense scores, loot crate cooldowns, and peer radar coordinates are kept in Python memory dictionaries, which desynchronize across Uvicorn's 2 workers and reset on server restart.
- **Option A (Recommended):** Move Stronghold scores, Loot cooldowns, and Raid lobbies into PostgreSQL tables via SQLAlchemy models. Run single-worker Uvicorn (`--workers 1`) or use Redis if multi-worker scaling is required.
- **Option B:** Keep in-memory dictionaries for simplicity, but change `backend/Dockerfile` to run Uvicorn with `--workers 1` so state remains synchronized within that single process.

### Decision 3: Stronghold Coordinates vs. CIT Campus Boundary
- **Current Behavior:** Strongholds 3 & 4 (Sports Stadium and Mechanical Workshop) are placed slightly outside the CIT campus bounding box in `geofence.py`.
- **Option A (Recommended):** Adjust Stronghold coordinates inward by ~50–100 meters so they lie safely within the official CIT campus polygon.
- **Option B:** Expand the CIT geofence polygon in `backend/app/geofence.py` to encompass the outer athletic field and workshop perimeter.

### Decision 4: Catch Proximity Distance Tolerance
- **Current Behavior:** The backend only verifies that coordinates are within CIT, allowing capture from anywhere on campus.
- **Option A (Recommended):** Enforce maximum capture distance of **35 meters** between user GPS and spawn location (with a 10m buffer for indoor GPS drift).
- **Option B:** Keep loose proximity (e.g. 100 meters) to accommodate students inside thick concrete college buildings where GPS drift is high.

### Decision 5: Trivia Challenge Randomization
- **Current Behavior:** All questions have `correctIndex = 0`.
- **Option A (Recommended):** Shuffle question options at runtime and set varied `correctIndex` values across all questions.

---

## 6. Cannot Verify Without a Physical Device (AR / Hardware Findings)

Because this audit is conducted in a headless/development environment without access to physical camera hardware, gyroscopes, magnetometers, or campus GPS signals, the following findings are marked `[UNVERIFIED - needs on-device test]`:

1. **`AR-HIGH-01` (Anchor Heading Reset):** Behavior verified in code flow; requires testing on physical device to verify creature remains fixed in true compass direction.
2. **`AR-HIGH-02` (GPS Bearing Bypass in `catch.tsx`):** Requires physical device with GPS to verify entity spawns in correct world direction.
3. **`AR-HIGH-03` (Camera Rotation Inversion & Yaw Projection):** Requires physical device rotation to confirm natural left/right panning physics.
4. **`BUG-MED-07` (Leaflet WebView Pan Delta Sign):** Requires physical touchscreen gesture to verify natural map drag response.
5. **`PERF-MED-05` (Native Audio Session Leaks):** Requires physical iOS/Android audio session monitoring.

### Proposed Verification Telemetry HUD:
When fixes are ready for testing, an on-screen debug panel will be enabled in `catch.tsx` showing:
```
[CAMPUSQUEST AR TELEMETRY]
GPS Fix: 11.02720, 77.02680 (Acc: ±3.8m)
Compass Heading: 142.5° | Pitch: -12.3° | Roll: 1.2°
Target Bearing: 088.0° | Target Dist: 18.2m
Delta Yaw: -54.5° (Model to Left of Center)
R3F Position: (X: -14.8, Y: 0.2, Z: -10.5)
VPS Status: ALIGNED_STABLE
```

---

## 7. Next Steps & Fix Roadmap

1. **Awaiting User Review:** Review this report and the choices in [Section 5: Needs My Decision](#5-needs-my-decision).
2. **Approval Gate:** Once you approve the report and provide decisions on Section 5, we will begin implementing code fixes on branch `audit/fixes`.
3. **Planned Fix Phases:**
   - **Phase 1: Security Hardening** (Remove secrets, fix WebSocket auth, eliminate client-side login bypass, validate server-side proximity).
   - **Phase 2: AR / VPS Pipeline Overhaul** (Correct coordinate handedness, fix bearing calculations, remove anchor reset bug, add telemetry HUD).
   - **Phase 3: Gameplay & Reliability Fixes** (Include mascot spawn, align strongholds, randomize trivia, clean audio players).
   - **Phase 4: Verification & Regression Testing** (Run test suites, build web exports, test HUD).

*End of Audit Report.*

