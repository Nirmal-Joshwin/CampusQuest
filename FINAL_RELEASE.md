# FINAL DEPLOYMENT STATUS: `v0.1.0-pilot`

## 1. Outcome & Deployment Overview
- **Outcome:** **NO-GO (Human Deployment Required)** 
- **Version:** `v0.1.0-pilot` (Commit `1dbed385`)
- **Rollout Target:** 
  - Backend: Production VPS Server via `docker-compose`
  - Frontend: Expo EAS Preview track (closed pilot group).
- **Reason:** Both deployment paths require authenticated credentials (SSH keys to the VPS, Expo account credentials for EAS) which are outside this environment. You must execute the deployment manually.

## 2. Files Cleaned Up
- **Deleted:** `frontend/test_haversine.js` (1.05 KB). **Evidence:** Unreferenced standalone script. Validated that all its functionality is now thoroughly covered inside the standard test suite (`frontend/tests/geo_math.test.ts`). Rebuilt and tested with 0 errors.
- **Kept (Needs Your Decision):**
  - `backend/generate_pins.py`: While not invoked by the backend process, it generates assets currently in use. I kept it in case you need to regenerate AR map pins.
  - `docs/SRS_CampusQuest.md`: A 61KB duplicate of the root `SRS_CampusQuest.md`. Left untouched to avoid accidentally breaking external documentation links.

## 3. Gate Results
- **Pre-Flight (Step 0):** PASSED. Backend Bandit scan (0 High/Critical). Frontend dependency audit (passed with known `node-forge` bypass). Test suite: 100% (10 Frontend / All Backend).
- **Post-Cleanup (Step 3):** PASSED. Test count identical. Coverage maintained.
- **CI/CD (Step 4):** PENDING. GitHub Actions triggered on push to `main`. 

## 4. Verification Matrix
- **VERIFIED (Locally):** Tests, linters, schemas, database models, API endpoint structures. Debug overlays correctly disabled via `__DEV__`. 
- **INFERRED:** The Docker network binds and PostgreSQL startup (read from `docker-compose.yml`).
- **NOT VERIFIABLE:** GitHub Actions CI completion (no `gh` CLI access). Real-world production smoke test (awaiting manual deploy).

## 5. Human Actions Required (Deployment Execution)

**Step A: Verify CI/CD**
1. Navigate to the **Actions** tab on your GitHub repository. Ensure the workflow for `v0.1.0-pilot` is completely green.

**Step B: Backend Deployment**
1. SSH into your VPS.
2. Pull the latest `main` branch.
3. Edit your `.env` file to rotate the dummy secret: `JWT_SECRET_KEY=$(openssl rand -hex 32)`
4. Deploy using Docker:
   ```bash
   docker-compose down
   docker-compose up -d --build
   ```
5. **Smoke Test:** Run `curl -f http://localhost:8000/health/ready` to verify the DB and API are connected.

**Step C: Frontend Deployment**
1. Run `eas login` on your local terminal.
2. Run `eas build -p android --profile preview` to generate the APK. 
3. Distribute the generated link to your 10 CIT pilot testers.

## 6. Rollback Instructions
If the backend crashes on deployment, instantly execute this on your local machine and re-push:

```bash
git checkout main
# Reset main back to the pre-cleanup commit, throwing away subsequent commits
git reset --hard pre-final-cleanup
git push origin main --force
```

After pushing, SSH into your VPS, pull the repo, and run `docker-compose up -d --build` to restore the working version.

## 7. Known Remaining Risks (Ranked by Severity)
1. **[Medium] Missing Remote Crashlytics:** We do not have Sentry or Firebase configured yet. If the app crashes on tester devices, you will not receive automated stack traces.
2. **[Medium] Hardware Gyro Drift:** If a student's phone has a poorly calibrated compass, the AR anomaly will slowly slide out of view.
3. **[Low] Manual Database Wipe:** Currently, to delete a user's account for privacy compliance, you must run SQL queries manually. No admin UI exists for this yet.
