# ShadowCheck Directory Structure

## Root Directory

```
shadowcheck-static/
├── README.md                 # Main project documentation
├── CHANGELOG.md              # Version history and changes
├── CODE_OF_CONDUCT.md        # Community guidelines
├── CONTRIBUTING.md           # Contribution guidelines
├── SECURITY.md               # Security policies
├── CLAUDE.md                 # AI assistant interaction log
├── package.json              # Node.js dependencies
├── package-lock.json         # Locked dependency versions
├── server.js                 # Express server entrypoint
├── server/                   # Express API modules (v1/v2)
├── src/                      # React/Vite frontend + shared server modules
├── etl/                      # ETL pipelines (load/transform/promote)
│
├── docs/                     # Documentation
│   ├── README.md             # Documentation index
│   ├── enrichment/           # Address enrichment docs
│   │   ├── ENRICHMENT_FINAL_REPORT.md
│   │   ├── ENRICHMENT_SUMMARY.md
│   │   ├── PRODUCTION_ENRICHMENT.md
│   │   ├── FREE_ADDRESS_APIS.md
│   │   └── GET_FREE_API_KEYS.md
│   ├── archive/              # Historical documentation
│   └── *.md                  # Other documentation files
│
├── scripts/                  # Utility scripts
│   ├── enrichment/           # Address enrichment scripts
│   │   ├── enrichment-system.js      # Production enrichment (JS)
│   │   ├── enrichment-system.ts      # Production enrichment (TS)
│   │   ├── enrich-multi-source.js    # Multi-API enrichment
│   │   ├── monitor-enrichment.js     # Progress monitoring
│   │   └── generate-overpass-queries.js
│   ├── geocoding/            # Geocoding scripts
│   │   ├── reverse-geocode-smart.js
│   │   ├── import-*-geocodes.js
│   │   └── geocode-*.js
│   ├── ml/                   # Machine learning
│   │   ├── ml-trainer.js
│   │   ├── ml-iterate.py
│   │   └── requirements.txt
│   ├── setup_db.sh           # Database setup
│   └── fix-docker-bridge.sh # Docker networking fix
│
├── sql/                      # SQL files
│   ├── migrations/           # Database migrations
│   │   ├── add_trilateration_enrichment.sql
│   │   ├── classify_device_types.sql
│   │   ├── contextual_classification.sql
│   │   └── *.sql
│   └── functions/            # SQL functions
│       ├── create_scoring_function.sql
│       └── fix_kismet_functions.sql
│
├── data/                     # Data files
│   ├── csv/                  # CSV data files
│   │   ├── locations_*.csv
│   │   ├── addresses_*.csv
│   │   └── networks_*.csv
│   └── logs/                 # Log files
│       ├── enrichment.log
│       └── server.log
│
├── tests/                    # Test files
│   ├── api/
│   ├── integration/
│   ├── unit/
│   └── test-*.js
│
├── docker/                   # Docker helpers
├── docker-compose.yml        # Docker configuration
├── docker-compose.dev.yml    # Dev Docker configuration
├── vite.config.js            # Vite config
├── tailwind.config.js        # Tailwind config
│
└── utils/                    # Utility modules
    └── errorHandler.js       # Error handling
```

## Key Directories

### `/scripts`

Contains all executable scripts organized by function:

- **enrichment/**: Address and venue enrichment
- **geocoding/**: Reverse geocoding and address lookup
- **ml/**: Machine learning and threat detection

### `/sql`

Database-related SQL files:

- **migrations/**: Schema changes and data migrations
- **functions/**: Stored procedures and functions

### `/data`

Data files and logs (excluded from git):

- **csv/**: Temporary CSV files for import/export
- **logs/**: Application and process logs

### `/docs`

All documentation:

- **enrichment/**: Enrichment system documentation
- **archive/**: Historical documentation

### `/server`

Express API modules and route handlers.

### `/src`

React/Vite frontend and shared backend modules:

- `src/main.tsx` (frontend entry)
- `src/App.tsx` (frontend routing)
- `src/api/`, `src/services/`, `src/repositories/` (backend)

### `/etl`

Data pipelines and SQL for load/transform/promote steps.

### `/tests`

Test files for various components

## File Organization Rules

### Root Directory

**Should contain:**

- README.md (main documentation)
- CHANGELOG.md (version history)
- CODE_OF_CONDUCT.md
- CONTRIBUTING.md
- SECURITY.md
- package.json / package-lock.json
- server.js (server entrypoint)
- server/ (backend modules)
- src/ (frontend + shared modules)
- etl/ (data pipelines)
- .gitignore, .env.example

**Should NOT contain:**

- CSV files (→ data/csv/)
- Log files (→ data/logs/)
- SQL files (→ sql/)
- Scripts (→ scripts/)
- Test files (→ tests/)

### Scripts

All executable scripts go in `/scripts` subdirectories:

- Enrichment scripts → `/scripts/enrichment/`
- Geocoding scripts → `/scripts/geocoding/`
- ML scripts → `/scripts/ml/`
- Setup scripts → `/scripts/`

### Documentation

All markdown documentation goes in `/docs`:

- Feature-specific docs → `/docs/[feature]/`
- Historical docs → `/docs/archive/`

### Data Files

All data files go in `/data`:

- CSV files → `/data/csv/`
- Log files → `/data/logs/`
- Temporary files → `/data/tmp/`

## Usage Examples

### Running Enrichment

```bash
# From project root
node scripts/enrichment/enrichment-system.js 1000

# Monitor progress
node scripts/enrichment/monitor-enrichment.js
```

### Running Geocoding

```bash
# Reverse geocode addresses
node scripts/geocoding/reverse-geocode-smart.js input.csv output.csv
```

### Database Migrations

```bash
# Run migration
psql -f sql/migrations/add_trilateration_enrichment.sql
```

### Viewing Logs

```bash
# Enrichment logs
tail -f data/logs/enrichment.log

# Server logs
tail -f data/logs/server.log
```

## Maintenance

### Adding New Scripts

1. Place in appropriate `/scripts` subdirectory
2. Update this documentation
3. Add to README.md if user-facing

### Adding New Documentation

1. Place in `/docs` or appropriate subdirectory
2. Update `/docs/README.md` index
3. Link from main README.md if important

### Cleaning Up

```bash
# Remove old CSV files
rm data/csv/*_old.csv

# Clean logs older than 7 days
find data/logs -name "*.log" -mtime +7 -delete
```
