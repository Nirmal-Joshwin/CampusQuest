# 🏰 CampusQuest: Location-Based AR Campus Exploration & MMORPG

> An augmented reality geolocation gaming system for **Coimbatore Institute of Technology (CIT)**.  
> Explore the physical campus in 3D, capture anomalies within geodesic interaction rings, discover quantum loot caches, team up in multiplayer raids, and compete on the inter-departmental leaderboard.

---

##  System Prerequisites

Before setting up on a new device, ensure you have:

| Tool | Recommended Version | Verification Command |
| :--- | :--- | :--- |
| **Node.js** | `v20.x` or `v22.x` LTS | `node -v` |
| **Python** | `3.10` – `3.12` | `python --version` |
| **Git** | `2.x+` | `git --version` |
| **Expo Go (Mobile)** | SDK 57 (from Google Play / App Store) | Open Expo Go on phone |

> [!NOTE]  
> Both your computer and your mobile phone **must be connected to the same Wi-Fi network** (or phone hotspot) so Expo Go can communicate with your computer's local backend.

---

## 🚀 Step-by-Step Setup Guide

### 1. Clone the Repository
```bash
git clone https://github.com/Nirmal-Joshwin/CampusQuest.git
cd CampusQuest
```

---

### 2. Backend Setup (FastAPI + Python)

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Create and activate a virtual environment**:
   - **Windows (PowerShell)**:
     ```powershell
     python -m venv .venv
     .\.venv\Scripts\Activate.ps1
     ```
     *(If script execution is disabled: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`)*
   - **macOS / Linux**:
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables**:
   ```bash
   # Copy the example environment file
   cp .env.example .env    # On Linux/macOS
   copy .env.example .env  # On Windows PowerShell
   ```
   *(By default, it uses SQLite `campusquest.db` automatically without needing any PostgreSQL setup!)*

5. **Start the backend server**:
   ```bash
   python run.py
   ```
   Or:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```
   *Verifying*: Open `http://localhost:8000/docs` in your browser to inspect the interactive Swagger API documentation.

---

### 3. Frontend Setup (React Native + Expo SDK 57)

Open a **new terminal window** in the project root:

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install JavaScript dependencies**:
   ```bash
   npm install
   ```

3. **(Optional) Configure Custom Backend IP**:
   - By default, the app **automatically detects your computer's LAN IP** from Expo!
   - If you want to explicitly pin your machine's IP, create a `frontend/.env` file:
     ```env
     EXPO_PUBLIC_API_URL=http://<YOUR_COMPUTER_IP>:8000
     ```
     *(Find your IP with `ipconfig` on Windows or `ifconfig` / `ip a` on macOS/Linux).*

4. **Start the Expo Metro bundler**:
   ```bash
   npx expo start -c
   ```

---

### 4. Running on Your Mobile Device

1. Ensure your phone and computer are on the **same Wi-Fi network**.
2. Open the **Expo Go** app on your phone.
3. **Scan the QR Code**:
   - **Android**: Tap *"Scan QR code"* inside the Expo Go app.
   - **iOS**: Scan the QR code using the native iOS Camera app and tap the Expo prompt.
4. The project bundle will download and launch with native 3D isometric campus buildings!

---

## 🚢 Production Deployment (Docker Compose)

CampusQuest is fully containerized for enterprise campus deployment with **PostGIS**, **FastAPI (ASGI)**, and **Nginx (Static Expo Web + API Reverse Proxy)**.

### 1. Launch Production Stack
From the project root directory, run:
```bash
docker compose up -d --build
```

### 2. Services Deployed
| Container | Service | Port | Health Check | Description |
| :--- | :--- | :--- | :--- | :--- |
| `campusquest_db` | PostGIS 16 | `5432` | `pg_isready` | PostgreSQL with geospatial PostGIS extensions |
| `campusquest_backend` | FastAPI ASGI | `8000` | `/health/ready` | Scaled Python backend with connection pooling & security headers |
| `campusquest_frontend` | Nginx Alpine | `80` | `http://localhost:80/` | Static compiled web bundle with gzip compression & `/api/` reverse proxy |

### 3. Production Health Probes
- **Liveness Probe**: `http://localhost:8000/health` (HTTP 200 `{ "status": "healthy" }`)
- **Readiness Probe**: `http://localhost:8000/health/ready` (HTTP 200 `{ "status": "ready", "database": "connected" }`)

---

## 🛠️ Verification & Testing

To verify backend tests:
```bash
cd backend
python test_security_audit.py
python test_api.py
```

To verify frontend TypeScript types and build:
```bash
cd frontend
npm run typecheck
npm run build:web
```

---

## ❓ Troubleshooting

| Issue | Cause & Solution |
| :--- | :--- |
| **`Network request failed` on mobile** | 1. Ensure phone & PC are on the same Wi-Fi.<br>2. Allow Python / port 8000 through your Windows Defender / OS Firewall.<br>3. Set `EXPO_PUBLIC_API_URL=http://<YOUR_LAN_IP>:8000` in `frontend/.env`. |
| **`The installed version of Expo Go is for SDK 57. The project uses SDK XX`** | Run `npx expo start -c` to clear Metro cache; the project has been updated to Expo SDK 57. |
| **`Execution of scripts is disabled on this system` (PowerShell)** | Run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` before activating `.venv`. |
| **Database error on startup** | The app falls back to local SQLite (`campusquest.db`) automatically if PostgreSQL is not found. No manual database setup is required. |

