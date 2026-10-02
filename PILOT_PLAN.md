# Pilot Release Plan: CampusQuest

## Overview
- **Participants:** 5-10 trusted CIT students (CS/Engineering cohort preferred for technical feedback).
- **Duration:** 3 Days (Wednesday to Friday).
- **Environment:** Physical CIT Campus.
- **Distribution:** Expo Go (Internal testing via Expo EAS link) or direct TestFlight/APK via EAS Build.

## Goals
1. Verify AR projection scaling and bearing accuracy on varying mobile hardware.
2. Confirm geofence boundaries and GPS jitter tolerance in real campus conditions.
3. Test backend scaling (multiplayer raid sync) under small concurrent loads.
4. Assess battery consumption and device heat during 20-30 minute gameplay sessions.

## Success Criteria
- 90% of testers successfully capture at least 3 canonical story anomalies.
- AR viewport renders the 3D target in the correct direction (relative to compass) for >80% of attempts without extreme drifting.
- No critical crashes or security bypasses detected.
- Battery drain does not exceed 15% per 20-minute session.

## Stop Criteria (Abort Pilot)
- Sustained backend downtime or unhandled 500 errors.
- Unsafe behavior: Testers having to walk onto active roads to catch anomalies due to GPS drift.
- Severe device overheating warnings reported by more than 2 testers.
- Exploitation of anti-cheat (e.g. users capturing anomalies from their hostel without walking to the academic block).

---

## Tester Guide (One-Pager)

**Welcome to CampusQuest CIT Cadet!**
Your mission is to hunt rogue anomalies across the CIT campus. We need your feedback on the AR tracking and GPS accuracy.

**What to do:**
1. Log in using your college email (`@cit.edu.in`).
2. Walk to the Academic Block, Library, or Canteen.
3. When the radar detects an anomaly, tap it.
4. Point your camera forward and physically turn left/right as instructed by the UI.
5. Tap the 3D anomaly on your screen to deploy the trap.
6. Play for at least 20 minutes and note your battery drop.

**Important:** Stay on pedestrian paths. Do not play while crossing roads. Do not enter restricted labs or staff-only areas.

---

## Bug Report Template

**Title:** [Brief description of the issue]
**Device Model:** (e.g., iPhone 13 Pro, Samsung Galaxy S22)
**OS Version:** (e.g., iOS 17.1, Android 14)
**Location & Time:** (e.g., Near Central Library, 2:30 PM)

**What Happened:**
(Describe the bug. Did the creature fly away? Did the app crash?)

**What Was Expected:**
(What should have happened instead?)

**Debug Overlay Values (If AR Issue):**
- ScrX / ScrY: 
- Yaw: 
- FPS: 

**Attachments:**
[Attach screenshots or screen recordings if possible]

---

## Incident Plan

If a critical issue occurs (e.g. server breached, unsafe spawn locations causing crowd issues):

1. **Disable AR / Captures (Remote Kill-Switch):**
   - Access the deployment environment (e.g. Railway, Render, AWS).
   - In the environment variables, set `ENVIRONMENT=maintenance` or remove the `JWT_SECRET_KEY` temporarily to lock out all endpoints.
   - To specifically stop spawns, an Admin account can delete all active `spawns` via the Admin Dashboard.

2. **Revoke Keys (If Leaked):**
   - Go to Google Cloud Console (Maps API) -> Credentials -> Regenerate API Key.
   - In your backend deployment, update the `JWT_SECRET_KEY` to a new random string. All current user sessions will instantly expire.

3. **Message Testers:**
   - Since this is a closed 5-10 person pilot, message the designated WhatsApp/Discord tester group immediately: *"Pilot paused. Please close the app until further notice."*
