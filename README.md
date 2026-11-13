# MediLink — Healthcare Emergency Hospital Finder

Hackathon-ready Flask backend for emergency hospital search, filtering, nearby discovery, and CRUD operations.

## Tech Stack

- Python 3.10+
- Flask
- Flask-CORS
- SQLite (`backend/hospitals.db`)

## Project Structure

```
backend/
├── app.py              # Flask entry point
├── models.py           # Database & business logic
├── seed.py             # Seed script
├── hospitals.db        # SQLite database (auto-created)
├── routes/
│   └── hospitals.py    # API routes
└── data/
    └── hospitals.json  # Sample hospital data
```

## Setup

### 1. Create virtual environment (recommended)

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Seed the database

```bash
cd backend
python seed.py
```

To re-seed and overwrite existing data:

```bash
python seed.py --force
```

### 4. Run the server

```bash
cd backend
python app.py
```

API base URL: `http://localhost:5000`

CORS is enabled for:

- `http://localhost:3000` (React)
- `http://localhost:5173` (Vite)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check & endpoint list |
| GET | `/api/hospitals` | All hospitals (`?sort=rating`) |
| GET | `/api/hospital/<id>` | Single hospital |
| GET | `/api/filter` | Filter hospitals (see below) |
| GET | `/api/emergency` | Emergency hospitals only |
| GET | `/api/search?name=` | Search by name |
| GET | `/api/nearby?lat=&lng=` | Nearby hospitals by distance |
| POST | `/api/hospital` | Create hospital |
| PUT | `/api/hospital/<id>` | Update hospital |
| DELETE | `/api/hospital/<id>` | Delete hospital |

### Filter query parameters

`GET /api/filter?city=Mumbai&specialization=Cardiology&emergency_service=true&min_rating=4.5&min_beds=10&sort=rating`

| Parameter | Description |
|-----------|-------------|
| `city` | Exact city match |
| `specialization` | Partial specialization match |
| `emergency_service` | `true` / `false` |
| `min_rating` | Minimum rating (0–5) |
| `min_beds` | Minimum available beds |
| `sort=rating` | Sort by rating (descending) |

### Nearby hospitals

`GET /api/nearby?lat=19.076&lng=72.8777&limit=5&radius=50`

| Parameter | Description |
|-----------|-------------|
| `lat` / `latitude` | User latitude |
| `lng` / `longitude` | User longitude |
| `limit` | Max results (default 10, max 50) |
| `radius` | Max distance in km (optional) |

Each nearby result includes `distance_km`.

### Create hospital (POST body)

```json
{
  "hospital_name": "City Care Hospital",
  "city": "Mumbai",
  "specialization": "General Medicine",
  "available_beds": 20,
  "emergency_service": true,
  "rating": 4.2,
  "contact_number": "+91-22-00000000",
  "latitude": 19.07,
  "longitude": 72.87,
  "timings": "24/7"
}
```

## Example Requests

```bash
# All hospitals sorted by rating
curl "http://localhost:5000/api/hospitals?sort=rating"

# Emergency hospitals in Delhi
curl "http://localhost:5000/api/filter?city=Delhi&emergency_service=true"

# Search by name
curl "http://localhost:5000/api/search?name=Apollo"

# Nearby hospitals
curl "http://localhost:5000/api/nearby?lat=19.076&lng=72.8777&limit=5"
```

## Response Format

All endpoints return JSON:

```json
{
  "success": true,
  "message": "Hospitals retrieved successfully",
  "data": [...],
  "count": 18
}
```

## License

MIT — Hackathon use encouraged.
