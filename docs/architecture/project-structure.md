# Project Structure

ShadowCheck uses a **monorepo-style structure** where both backend (Node.js/Express) and frontend (React/TypeScript) coexist in the same repository, sharing the `src/` directory.

## Directory Layout

```
/
├── src/
│   ├── api/              # 🔧 BACKEND: Express API routes (v1)
│   │   └── routes/v1/    # Networks, threats, dashboard, etc.
│   ├── services/         # 🔧 BACKEND: Business logic layer
│   ├── repositories/     # 🔧 BACKEND: Database access layer
│   ├── config/           # 🔧 BACKEND: Configuration (DB, DI container)
│   ├── validation/       # 🔧 BACKEND: Request validation
│   ├── middleware/       # 🔧 BACKEND: Express middleware
│   ├── errors/           # 🔧 BACKEND: Error handling
│   ├── logging/          # 🔧 BACKEND: Winston logging
│   ├── utils/            # 🔧 BACKEND: Utility functions
│   │
│   ├── components/       # ⚛️ FRONTEND: React components
│   ├── App.tsx           # ⚛️ FRONTEND: React router & app shell
│   ├── main.tsx          # ⚛️ FRONTEND: React entry point
│   ├── index.css         # ⚛️ FRONTEND: Global styles
│   └── unified.css       # ⚛️ FRONTEND: Additional styles
│
├── public/               # ⚛️ FRONTEND: Static assets
│   ├── legacy/           # Legacy HTML pages (being phased out)
│   └── css/              # Legacy styles
│
├── server.js             # 🔧 BACKEND: Express server entry point
├── index.html            # ⚛️ FRONTEND: HTML template for Vite
├── vite.config.js        # ⚛️ FRONTEND: Vite build configuration
├── tsconfig.json         # ⚛️ FRONTEND: TypeScript config
│
├── scripts/              # 🛠️ UTILITIES: Data import, ML, migrations
├── sql/                  # 🗄️ DATABASE: Migrations and functions
├── tests/                # 🧪 TESTING: Jest tests
├── docs/                 # 📚 DOCUMENTATION
├── docker-compose.yml    # 🐳 DOCKER: Container orchestration
└── Dockerfile            # 🐳 DOCKER: API container definition
```

## Technology Stack

### Backend (Node.js 20+)

- **Language**: JavaScript (CommonJS modules)
- **Framework**: Express.js
- **Database**: PostgreSQL 18 + PostGIS 3.6 (Docker)
- **Architecture**: Layered (Routes → Services → Repositories)

### Frontend (React 18)

- **Language**: TypeScript (ES modules)
- **Framework**: React 18
- **Build Tool**: Vite
- **Router**: React Router v6
- **Styling**: Tailwind CSS
- **Maps**: Mapbox GL JS
- **Charts**: Recharts

## File Type Patterns

| File Extension   | Purpose                       | Location                                               |
| ---------------- | ----------------------------- | ------------------------------------------------------ |
| `*.js` (backend) | Backend JavaScript (CommonJS) | `src/api/`, `src/services/`, `src/repositories/`, etc. |
| `*.tsx`, `*.jsx` | Frontend React components     | `src/components/`, `src/App.tsx`, `src/main.tsx`       |
| `*.ts` (backend) | Backend TypeScript utilities  | `scripts/enrichment/`                                  |
| `*.css`          | Frontend styles               | `src/`, `public/css/`                                  |
| `*.sql`          | Database migrations           | `sql/migrations/`                                      |
| `*.test.js`      | Backend tests                 | `tests/`                                               |

## Development Workflow

### Backend Development

```bash
# Start backend API (port 3001)
npm run dev

# Or run in Docker
docker-compose up -d --build api
```

**Entry point**: `server.js` → Loads routes from `src/api/routes/v1/`

**Key files**:

- `server.js` - Express server initialization
- `src/config/database.js` - PostgreSQL connection pool
- `src/api/routes/v1/*.js` - API endpoint definitions

### Frontend Development

```bash
# Start Vite dev server (port 5173)
npm run dev:frontend

# Build for production
npm run build  # → outputs to dist/
```

**Entry point**: `index.html` → `main.tsx` → `App.tsx`

**Key files**:

- `index.html` - HTML template
- `src/main.tsx` - React initialization
- `src/App.tsx` - React Router configuration
- `src/components/*.tsx` - Page components

### Full Stack Development

Run both backend and frontend in separate terminals:

```bash
# Terminal 1: Backend API
npm run dev

# Terminal 2: Frontend dev server
npm run dev:frontend
```

Frontend dev server proxies `/api` requests to backend on port 3001.

## Production Deployment

In production, the React app is built and served by Express:

```bash
# 1. Build React frontend
npm run build  # → dist/

# 2. Start Express server
npm start

# Express serves:
# - API routes at /api/*
# - Built React app from dist/
# - SPA fallback for React Router
```

## Why This Structure?

### Advantages

✅ **Single repository** - Easier to manage, single CI/CD pipeline
✅ **Shared types** - Can eventually share TypeScript types
✅ **Unified versioning** - Backend and frontend versioned together
✅ **Simple deployment** - Express serves built React app

### Trade-offs

⚠️ **Mixed file types** - JavaScript (backend) and TypeScript (frontend) in same `src/`
⚠️ **Potential confusion** - Developers must understand which code runs where
⚠️ **Build complexity** - Two separate build processes (Node.js + Vite)

## Migration Path (Optional)

If you want stricter separation, consider this structure:

```
/
├── apps/
│   ├── backend/    # Move src/api, src/services, etc. here
│   └── frontend/   # Move src/components, src/App.tsx here
├── packages/
│   └── shared/     # Shared types, utilities
└── package.json    # Workspace root
```

This would require:

- npm/yarn workspaces or pnpm
- Updated import paths
- Modified build scripts

**Current structure is acceptable** for the project's current size.

## Quick Reference

| Task                   | Location             | Technology            |
| ---------------------- | -------------------- | --------------------- |
| Add API endpoint       | `src/api/routes/v1/` | JavaScript (Express)  |
| Add business logic     | `src/services/`      | JavaScript            |
| Add database query     | `src/repositories/`  | JavaScript (pg)       |
| Add React page         | `src/components/`    | TypeScript (React)    |
| Add database migration | `sql/migrations/`    | SQL                   |
| Add test               | `tests/`             | JavaScript (Jest)     |
| Import data            | `scripts/import/`    | JavaScript/TypeScript |

---

**See also:**

- [CLAUDE.md](CLAUDE.md) - Development guide
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - System architecture
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) - Development setup
