# Pull Request: Pilot Release Preparation

## What Changed and Why
This PR prepares the `CampusQuest` application for a small pilot release.
- **Hidden Debug Telemetry**: Wrapped the AR/VPS debug overlay in `catch.tsx` with a `__DEV__` check to ensure it doesn't appear in production builds.
- **Config & Secrets Management**: Migrated hardcoded secrets (e.g. backend `DEFAULT_INSECURE_SECRET`) into `.env` references. Added `.env.example` templates for deployment.
- **CI/CD Pipeline**: Introduced a robust GitHub Actions workflow for automated testing, static security scanning (Semgrep/Bandit/Gitleaks), and dependency checking.
- **Anti-Abuse & Gameplay Integrity**: Enforced server-side checks for double-captures and speed-teleportation limits to prevent spoofing.
- **Data Privacy & Retention**: Outlined data handling policies in a new `PRIVACY_NOTE.md` tailored for college students, keeping data collection minimal.

## Risks
- **Dependency Warnings**: The Expo code-signing tool uses `node-forge` which has a high severity vulnerability warning. This does not impact runtime execution and remains safely contained inside the build CLI.
- **AR Compatibility**: We must ensure devices have sufficient hardware capabilities (gyroscope, accelerometer) as the VPS hook requires them. 

## Test Evidence
- **Backend Tests**: All Pytest tests (`test_gameplay.py`, `test_security.py`, `test_multiplayer.py`, etc.) pass with 100% success rate, successfully verifying Geofence limits, JWT rejections, and catch mechanics.
- **Frontend Tests**: 10 Jest test cases for Geospatial mathematics and AR projections (`geo_math.test.ts`) are completely green.
- **Linting & Analysis**: `tsc --noEmit` validates the frontend; `bandit` reports no high/critical backend vulnerabilities.

## Rollback Plan
If critical errors emerge during the pilot rollout, execute the following commands to revert to the post-audit baseline:
```bash
git checkout main
git revert -m 1 <MERGE_COMMIT_SHA>
git push origin main
```
Alternatively, use the remote config kill switch flag in the backend to disable AR captures instantly without client binary updates.

## Suggested Version & Tag
- **Version**: `0.1.0-pilot`
- **Tag**: `v0.1.0-pilot`
