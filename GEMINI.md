# ShadowCheck - Project Context

## Project Overview

**ShadowCheck** is a SIGINT forensics and wireless network analysis platform. It is designed for real-time threat detection, geospatial correlation via PostGIS, and interactive analysis dashboards.

- **Type:** Full-stack Web Application (Node.js/Express + React/Vite).
- **Core Purpose:** Wireless network surveillance, threat detection, and forensic analysis.
- **Architecture:**
  - **Frontend:** React (TypeScript) built with Vite. Uses Mapbox GL JS and Deck.gl for visualizations.
  - **Backend:** Node.js with Express. REST API structure.
  - **Database:** PostgreSQL with PostGIS extension for geospatial queries. Uses materialized views for performance.
  - **ML:** Python and Node.js-based machine learning pipelines for threat scoring.

## Key Technologies

- **Runtime:** Node.js (v20+)
- **Database:** PostgreSQL (v18+) + PostGIS
- **Frontend Framework:** React 18
- **Build Tool:** Vite
- **Maps:** Mapbox GL JS, Deck.gl
- **State Management:** Zustand
- **Styling:** Tailwind CSS

## Directory Structure

- `client/`: Frontend source code (React, TypeScript, Vite config).
- `server/`: Backend source code (Express, API routes, Services).
- `scripts/`: Maintenance, ML, and import scripts.
- `sql/`: Database schema, migrations, and functions.
- `dist/`: Production build output (served by the backend).
- `docker/`: Docker infrastructure files.
- `tests/`: Server-side Jest tests.

## Development Workflow

### 1. Prerequisites

- Node.js 20+
- PostgreSQL 18+ with PostGIS
- `.env` file configured (see `.env.example`).

### 2. Installation

```bash
npm install
```

### 3. Database Setup

Ensure PostgreSQL is running and the database is created with the PostGIS extension. Run migrations:

```bash
# Example
psql -U shadowcheck_user -d shadowcheck_db -f sql/functions/create_scoring_function.sql
# See sql/migrations/README.md for order
```

### 4. Running the Application

- **Backend Dev:** `npm run dev` (Runs `nodemon server/server.js` on port 3001).
- **Frontend Dev:** `npm run dev:frontend` (Runs Vite dev server on port 5173, proxies `/api` to 3001).
- **Production Build:** `npm run build` (Builds frontend to `dist/`).
- **Production Start:** `npm start` (Runs `node server/server.js`, serving API and `dist/`).

### 5. Testing

- **Run Tests:** `npm test` (Runs Jest tests).
- **Linting:** `npm run lint` (ESLint).

## Code Conventions

- **Frontend:**
  - Components in `client/src/components`.
  - API calls managed via services/hooks in `client/src/api` or `client/src/hooks`.
  - Vite handles the build process, outputting to `../dist`.
- **Backend:**
  - Modular architecture: `api/routes`, `services`, `repositories`, `utils`.
  - Initialization logic is heavily abstracted into `server/src/utils/*Init.js` files.
  - Secrets managed via file-based secrets (Docker support) or env vars.
- **Database:**
  - Heavy use of SQL functions and materialized views (`api_network_explorer_mv`) for complex geospatial logic.
  - Migrations should be SQL files in `sql/migrations`.

## Deployment

The project is containerized using Docker.

- `Dockerfile`: Multi-stage build for the Node.js app.
- `docker-compose.yml`: Orchestrates the API and Redis services (depends on external Postgres).

## Kepler.gl Data Rules (Do Not Violate)

- No default limits for Kepler endpoints unless a user provides `limit`.
- Kepler is designed for large datasets; avoid artificial caps.
- Endpoints: `/api/kepler/data`, `/api/kepler/observations`, `/api/kepler/networks`.
