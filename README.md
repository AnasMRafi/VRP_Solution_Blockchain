# 🚚 RouteChain

**Delivery Route Optimization with Blockchain Traceability**

A full-stack web application for optimizing delivery routes using VRP algorithms, with immutable blockchain records for proof of delivery.

![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688?logo=fastapi)
![React](https://img.shields.io/badge/React-18.2-61DAFB?logo=react)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb)
![Solidity](https://img.shields.io/badge/Solidity-0.8.0-363636?logo=solidity)

---

## ✨ Features

### 🗺️ Route Optimization
- **VRP Solver** - Google OR-Tools for optimal route calculation
- **Distance Matrix** - OpenRouteService API for real-world distances
- **Interactive Map** - Leaflet with route visualization
- **Geocoding** - Convert addresses ↔ coordinates (Nominatim)

### 🔐 Blockchain Integration
- **Smart Contracts** - Solidity on Ethereum (Ganache local)
- **Immutable Records** - Route hashes stored on-chain
- **Verification** - Prove data integrity anytime
- **MetaMask Compatible** - View transactions in wallet

### 👥 Multi-User System
- **JWT Authentication** - Secure login/register
- **Admin Panel** - Manage drivers, view stats
- **Role-Based Access** - Admin vs Driver permissions
- **Customer Database** - Save frequent delivery addresses

### 📊 Analytics & Reporting
- **Dashboard** - Route statistics, charts
- **Export** - PDF and CSV reports
- **Performance Metrics** - Distance, time, deliveries

### 📱 Mobile Ready
- **PWA Support** - Install as mobile app
- **Responsive Design** - Works on all devices
- **Navigation** - Open in Google Maps, Waze, Apple Maps

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | FastAPI, Python 3.12, Pydantic |
| **Frontend** | React 18, Vite, Tailwind CSS |
| **Database** | MongoDB Atlas |
| **Blockchain** | Solidity 0.8, Web3.py, Ganache |
| **Maps** | Leaflet, OpenRouteService |
| **Auth** | JWT (python-jose, bcrypt) |

---

## 🚀 Quick Start

### Prerequisites

- Python 3.12+
- Node.js 18+
- MongoDB Atlas account ([free tier](https://www.mongodb.com/cloud/atlas))
- OpenRouteService API key ([free signup](https://openrouteservice.org/dev/#/signup))

### 1. Clone & Setup Backend

```bash
git clone https://github.com/your-repo/PFA_VRP.git
cd PFA_VRP/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file (see configuration below)
cp .env.example .env
# Edit .env with your credentials

# Start server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Setup Frontend

```bash
cd ../frontend

# Install dependencies
npm install

# Start dev server
npm run dev -- --host
```

### 3. Access Application

- **Frontend**: http://localhost:5173
- **API Docs**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

---

## ⚙️ Configuration

### Backend Environment (`backend/.env`)

```env
# MongoDB Atlas
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/
MONGODB_DB_NAME=routechain

# OpenRouteService (https://openrouteservice.org/dev/#/signup)
OPENROUTESERVICE_API_KEY=your_api_key_here

# JWT Secret (generate: openssl rand -hex 32)
SECRET_KEY=your_secret_key_here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080  # 7 days

# App Settings
APP_NAME=RouteChain
APP_VERSION=1.0.0
DEBUG=True

# CORS (* for dev, specific URLs for production)
CORS_ORIGINS=*

# Blockchain (optional)
GANACHE_URL=http://127.0.0.1:7545
CONTRACT_ADDRESS=0x...  # After deploying contract
```

### Frontend Environment (`frontend/.env`)

```env
# Optional: Backend URL (auto-detects hostname in dev)
VITE_API_URL=http://localhost:8000
```

---

## ⛓️ Blockchain Setup (Optional)

### 1. Install Ganache

Download from [trufflesuite.com/ganache](https://trufflesuite.com/ganache/) → Click **Quickstart**

### 2. Deploy Contract

**Option A: Using Remix (Recommended)**
1. Open [remix.ethereum.org](https://remix.ethereum.org)
2. Create `RouteRegistry.sol`, paste contract from `blockchain/contracts/`
3. Compile with Solidity 0.8.0
4. Deploy → Environment: Injected Provider (MetaMask) or Custom RPC
5. Copy contract address and ABI

**Option B: Using Script**
```bash
cd blockchain
pip install -r requirements.txt
python scripts/deploy.py
```

### 3. Configure Backend

Add to `backend/.env`:
```env
CONTRACT_ADDRESS=0xYourContractAddress
```

Save ABI to `blockchain/deployed/RouteRegistry_abi.json`

---

## 📱 Mobile Access

To access from your phone:

1. **Backend**: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
2. **Frontend**: `npm run dev -- --host`
3. **CORS**: Set `CORS_ORIGINS=*` in backend `.env`
4. **Access**: `http://<your-computer-ip>:5173`

> Find your IP: `ipconfig getifaddr en0` (Mac) or `hostname -I` (Linux)

---

## 📁 Project Structure

```
PFA_VRP/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI application
│   │   ├── config.py         # Environment settings
│   │   ├── models/           # Pydantic schemas
│   │   │   ├── driver.py
│   │   │   ├── route.py
│   │   │   ├── customer.py
│   │   │   └── depot.py
│   │   ├── routers/          # API endpoints
│   │   │   ├── auth.py
│   │   │   ├── routes.py
│   │   │   ├── customers.py
│   │   │   ├── analytics.py
│   │   │   └── admin.py
│   │   └── services/         # Business logic
│   │       ├── database.py
│   │       ├── vrp_solver.py
│   │       ├── distance.py
│   │       ├── blockchain.py
│   │       └── export.py
│   ├── requirements.txt
│   └── .env
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Auth/         # Login, Register
│   │   │   ├── Dashboard/    # Routes, Forms
│   │   │   ├── Admin/        # Admin panel
│   │   │   ├── Customers/    # Customer management
│   │   │   └── Layout/       # Header, navigation
│   │   ├── context/          # AuthContext
│   │   └── services/         # API client
│   ├── package.json
│   └── .env
│
└── blockchain/
    ├── contracts/
    │   └── RouteRegistry.sol  # Smart contract
    ├── deployed/
    │   └── RouteRegistry_abi.json
    ├── scripts/
    │   └── deploy.py
    └── requirements.txt
```

---

## 🔧 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Login with email/password |
| POST | `/auth/register` | Register new driver |
| GET | `/auth/me` | Get current user profile |

### Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/routes/optimize` | Create & optimize route |
| GET | `/routes/` | List all routes |
| GET | `/routes/{id}` | Get route details |
| PATCH | `/routes/{id}/status` | Update route status |
| POST | `/routes/{id}/confirm-delivery` | Confirm delivery |
| GET | `/routes/{id}/export/pdf` | Export as PDF |
| GET | `/routes/{id}/verify-blockchain` | Verify integrity |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/drivers` | List all drivers |
| PUT | `/admin/drivers/{id}/role` | Update driver role |

---

## 👤 First Admin Setup

After registering your first user:

```bash
# Make user an admin (replace driver_id)
curl -X POST http://localhost:8000/admin/make-admin/{driver_id}
```

Or use the API docs at `/docs`.

---

## 🧪 Development

### Run Tests
```bash
cd backend
pytest
```

### Format Code
```bash
# Backend
black app/

# Frontend
npm run lint
```

---

## 📄 License

MIT License - See [LICENSE](LICENSE)

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

**Made with ❤️ for PFA Project**
