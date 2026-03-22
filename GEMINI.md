# ShadowCheckWeb: SIGINT Forensics Platform

## Project Overview

**ShadowCheckWeb** is a production-grade SIGINT (Signals Intelligence) forensics and wireless network analysis platform. It provides real-time threat detection, geospatial correlation via PostGIS, and interactive analysis dashboards.

- **Primary Technologies:** React 19, Vite 7, TypeScript, Node.js 20+, Express, PostgreSQL 18 + PostGIS, Redis 7.0.
- **Architecture:** Modern modular architecture with clear separation of concerns:
  - **Frontend:** Component-based UI with Zustand for state management, Mapbox GL JS and Deck.gl for spatial visualization.
  - **Backend:** Express-based REST API with a Service-Query pattern.
  - **Data Layer:** PostgreSQL (PostGIS) for spatial data, Redis for session management, rate limiting, and caching.
  - **ETL:** Modular pipeline for data ingestion, transformation, and enrichment.

## Directory Structure

- `client/`: React/Vite frontend source code.
- `server/`: Express backend source code.
  - `src/api/`: REST API route definitions.
  - `src/services/`: Business logic layer with direct SQL query integration.
- `etl/`: ETL pipeline scripts and logic.
- `scripts/`: Utility scripts for database management, geocoding, and maintenance.
- `sql/`: Database schema, migrations, and PostGIS functions.
- `docs/`: Comprehensive architectural and development documentation.
- `tests/`: Integration and unit tests (Jest).
- `deploy/`: Deployment configurations for AWS, Docker, and Homelab.

## Building and Running

### Prerequisites

- Node.js 20+
- PostgreSQL 18+ with PostGIS
- Redis 7.0+
- Docker (optional, for infrastructure)

### Development Commands

- `npm install`: Install dependencies.
- `npm run dev`: Start full-stack development environment (builds server and runs with nodemon).
- `npm run dev:frontend`: Run Vite dev server for the client.
- `npm run build`: Build both frontend and server for production.
- `npm start`: Run the production server from `dist/`.
- `docker-compose up -d`: Start PostgreSQL and Redis infrastructure.

### Testing and Linting

- `npm test`: Run all tests (Jest).
- `npm run test:integration`: Run integration tests (requires DB).
- `npm run lint`: Run ESLint to check for code quality issues.
- `npm run format`: Format code using Prettier.

## Development Conventions

### Modularity Philosophy

ShadowCheck follows **responsibility-based modularity**. Each module should have one primary responsibility. Favor coherence and logical grouping over arbitrary line limits.

- **Service Layer:** Houses all business logic and threat scoring algorithms, encapsulating direct database interactions using parameterized queries.

### Tech Stack Standards

- **TypeScript:** Mandatory for all new frontend and backend code. Use explicit typing and avoid `any`.
- **API Versioning:** Use `/api/v1/` or `/api/v2/` prefixes for routes.
- **Spatial Calculations:** Use PostGIS `ST_Distance` (spheroid) for all distance-based logic in SQL.
- **Security:** Rigorously validate all inputs (Joi/Zod) and avoid raw SQL concatenation to prevent injection.

### Git Workflow

- **Commit Messages:** Follow [Conventional Commits](https://www.conventionalcommits.org/) (e.g., `feat:`, `fix:`, `docs:`, `test:`).
- **Branching:** Use feature branches and PRs for all changes.
- **Validation:** Ensure `npm test` and `npm run lint` pass before committing.

## Key Files

- `server/server.ts`: Main entry point for the Express server.
- `client/src/App.tsx`: Main entry point for the React frontend.
- `package.json`: Project dependencies and scripts.
- `docs/ARCHITECTURE.md`: Detailed system architecture.
- `docs/DEVELOPMENT.md`: Comprehensive development guide.
- `.env.example`: Template for environment variables.
