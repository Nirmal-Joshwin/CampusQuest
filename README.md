# 🏰 CampusQuest: Location-Based AR Campus Exploration & MMORPG

> An augmented reality geolocation gaming system engineered specifically for **Coimbatore Institute of Technology (CIT)**.  
> Explore the physical campus in a native 3D isometric perspective, detect anomalies within geodesic interaction rings, capture creatures in camera AR, harvest quantum loot caches, team up in multiplayer tag-team raids, and compete on inter-departmental leaderboards.

---

## 📚 Project Documentation

- **Software Requirements Specification (SRS)**: [`docs/SRS_CampusQuest.md`](./docs/SRS_CampusQuest.md) *(IEEE Std 830-1998 / IEEE 29148-2018 Compliant)*
- **Academic Printable SRS Document (One-Click PDF Export)**: [`docs/SRS_CampusQuest.html`](./docs/SRS_CampusQuest.html) *(Open in any browser and press `Ctrl + P` to export as PDF)*

---

## ⚡ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Mobile Frontend** | React Native `0.86.3`, Expo SDK `57.0.26`, React `19.2.3`, TypeScript `5.x`, Expo Router |
| **3D Maps & Spatial** | `react-native-maps` (Google Maps / Apple MapKit) with 3D Hybrid Extrusions & 55° Tilt |
| **Sensors & Media** | `expo-camera` (AR viewfinder), `expo-audio` (procedural SFX), `expo-location`, `expo-haptics` |
| **Backend API** | Python `3.12`, FastAPI `0.115+`, Uvicorn ASGI Server, Pydantic v2 |
| **Database & ORM** | SQLite 3 (zero-config local dev) / PostgreSQL 16 via SQLAlchemy ORM |
| **Spatial Algorithms** | 23-Point Ray-Casting Polygon Geofence, Haversine Spherical Distance ($15$m capture ring) |
| **Security** | JWT (HMAC-SHA256), BCrypt Password Hashing, Role-Based Access Control (RBAC) |

---

## 📋 System Prerequisites

Before setting up on a new device, ensure you have installed:

| Tool | Recommended Version | Verification Command |
| :--- | :--- | :--- |
| **Node.js** | `v20.x` or `v22.x` LTS | `node -v` |
| **Python** | `3.10` – `3.12` | `python --version` |
| **Git** | `2.x+` | `git --version` |
| **Expo Go (Mobile Phone)** | SDK 57 (from Google Play / App Store) | Open Expo Go on phone |

> [!IMPORTANT]  
> Both your computer and your mobile phone **must be connected to the same Wi-Fi network** (or your phone's Wi-Fi hotspot) so Expo Go can communicate with your computer's local backend.

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
     *(If script execution is disabled on PowerShell, run: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` and retry).*
   - **macOS / Linux**:
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Initialize `.env` from example**:
   - **Windows (PowerShell)**:
     ```powershell
     copy .env.example .env
     ```
   - **macOS / Linux**:
     ```bash
     cp .env.example .env
     ```
   > [!NOTE]  
   > The backend automatically defaults to local SQLite (`campusquest.db`) out-of-the-box. You do **not** need to install or configure PostgreSQL to run locally.

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
   > [!TIP]  
   > The `-c` flag clears any cached Metro bundler state, ensuring Expo SDK 57 bundles cleanly.

---

### 4. Running on Your Mobile Device

1. Ensure your phone and computer are on the **same Wi-Fi network**.
2. Open the **Expo Go** app on your phone.
3. **Scan the QR Code**:
   - **Android**: Tap *"Scan QR code"* inside the Expo Go app.
   - **iOS**: Scan the QR code using the native iOS Camera app and tap the Expo prompt.
4. The project bundle will download and launch with native 3D isometric campus buildings!

---

## 📂 Project Directory Structure

```text
CampusQuest/
├── backend/                  # FastAPI Python backend
│   ├── app/
│   │   ├── config.py         # App settings & environment loader
│   │   ├── database.py       # SQLAlchemy engine (SQLite fallback)
│   │   ├── geofence.py       # CIT 23-point polygon & story spawns
│   │   ├── models.py         # Database ORM entities
│   │   ├── schemas.py        # Pydantic request/response schemas
│   │   └── routers/          # API endpoints (auth, gameplay, shop, etc.)
│   ├── run.py                # Server entry point
│   ├── requirements.txt      # Python dependencies
│   └── test_security.py      # Automated security & spatial test suite
│
├── frontend/                 # React Native / Expo client
│   ├── app/                  # Expo Router file-based screens
│   │   ├── index.tsx         # 3D Tactical Map HUD & Compass
│   │   ├── catch.tsx         # AR Camera Viewfinder & Mini-game
│   │   ├── inventory.tsx     # Bestiary & Companion Buddy System
│   │   ├── friends.tsx       # Cadet Radar & Multiplayer Tag-Team Raids
│   │   ├── shop.tsx          # Armory & Campus Data Credit Economy
│   │   ├── admin.tsx         # Gamemaster Spatial Telemetry Console
│   │   └── login.tsx         # Cadet Registration & Authentication
│   ├── styles/               # Translucent Cyber-Glass theme system
│   ├── utils/                # API client, haversine math, sound engine
│   └── package.json          # Node dependencies (Expo SDK 57)
│
├── docs/                     # Academic Documentation & Specifications
│   ├── SRS_CampusQuest.md    # IEEE 830-1998 Software Requirements Specification
│   └── SRS_CampusQuest.html  # Print-ready HTML document (One-click PDF export)
│
├── .gitignore                # Comprehensive ignore rules
└── README.md                 # Project guide & documentation
```

---

## 🛠️ Verification & Automated Tests

To run the backend security, authentication, and spatial containment test suite:
```bash
cd backend
python test_security.py
python test_api.py
```

To verify frontend TypeScript types:
```bash
cd frontend
npx tsc --noEmit
```

---

## ❓ Troubleshooting

| Issue | Cause & Solution |
| :--- | :--- |
| **`Network request failed` on mobile** | 1. Ensure phone & PC are on the same Wi-Fi.<br>2. Allow Python / port 8000 through your Windows Defender / OS Firewall.<br>3. Set `EXPO_PUBLIC_API_URL=http://<YOUR_LAN_IP>:8000` in `frontend/.env`. |
| **`The installed version of Expo Go is for SDK 57. The project uses SDK XX`** | Run `npx expo start -c` to clear Metro cache; the project has been updated to Expo SDK 57. |
| **`Execution of scripts is disabled on this system` (PowerShell)** | Run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` before activating `.venv`. |
| **Database error on startup** | The app falls back to local SQLite (`campusquest.db`) automatically if PostgreSQL is not found. No manual database setup is required. |
