# ShadowCheck Project Structure

This document provides a comprehensive overview of the ShadowCheck project structure, explaining the purpose and organization of each directory and key file.

## Root Directory Structure

```
ShadowCheckStatic/
├── .devcontainer/          # DevContainer configuration
├── .github/                # GitHub workflows and templates
├── .husky/                 # Git hooks configuration
├── .vscode/                # VS Code settings and extensions
├── coverage/               # Test coverage reports
├── data/                   # Runtime data (gitignored)
├── client/                 # React/Vite frontend
├── docs/                   # Project documentation
├── scripts/                # Utility and maintenance scripts
├── server/                 # Express backend
├── sql/                    # Database schemas and migrations
├── tests/                  # Test files
├── package.json            # Node.js dependencies and scripts
└── README.md               # Project overview
```

## Frontend Architecture (`client/`)

### React Components (`client/src/components/`)

```
client/src/components/
├── DashboardPage.tsx               # Main dashboard with real-time metrics
├── GeospatialIntelligencePage.tsx  # Interactive map with Mapbox GL JS
├── AnalyticsPage.tsx               # Charts and data visualization
├── MLTrainingPage.tsx              # Machine learning model management
├── AdminPage.tsx                   # System administration interface
├── ApiTestPage.tsx                 # API endpoint testing interface
├── WigleTestPage.tsx               # WiGLE API integration testing
├── KeplerTestPage.tsx              # Kepler.gl visualization testing
├── FilterPanel.tsx                 # Universal filter interface
├── ActiveFiltersSummary.tsx        # Active filters display
├── Navigation.tsx                  # Main navigation component
├── NetworksExplorer.tsx            # Network data explorer
├── ThreatsExplorer.tsx             # Threat analysis interface
├── NetworkContextMenu.jsx          # Right-click context menu
├── LazyMapComponent.jsx            # Lazy-loaded map wrapper
└── modals/                         # Modal dialog components
    └── [various modal components]
```

### State Management (`client/src/stores/`)

```
client/src/stores/
└── filterStore.ts          # Zustand store for global filter state
```

### Custom Hooks (`client/src/hooks/`)

```
client/src/hooks/
├── useFilteredData.ts      # Data fetching with filter integration
├── useAdaptedFilters.ts    # Filter adaptation for different pages
└── usePageFilters.ts       # Page-specific filter management
```

### Client Utilities (`client/src/utils/`)

```
client/src/utils/
├── filterCapabilities.ts           # Filter configuration and capabilities
├── mapboxLoader.ts                 # Mapbox GL JS integration
├── mapOrientationControls.ts       # Map control utilities
└── renderNetworkTooltip.ts         # Map tooltip rendering
```

### Type Definitions (`client/src/types/`)

```
client/src/types/
└── filters.ts              # TypeScript definitions for filter system
```

### Logging (`client/src/logging/`)

```
client/src/logging/
└── clientLogger.ts         # Client-side error logging
```

## Backend Architecture

### Main Server (`server/server.js`)

The main Express server file containing:

- Legacy API routes (v1)
- Middleware configuration
- Database connection setup
- Error handling
- Security headers

### Modern Backend Structure (`server/src/`)

#### API Routes (`server/src/api/`)

```
server/src/api/
└── routes/                 # Modern API route handlers (v2)
    └── [route modules]     # Modular route organization
```

#### Business Logic (`server/src/services/`)

```
server/src/services/
├── filterQueryBuilder.js          # Universal filter system
├── threatScoringService.js         # Threat detection algorithms
├── mlScoringService.js             # Machine learning predictions
├── simpleMLScoringService.js       # Simplified ML scoring
├── analyticsService.js             # Analytics and reporting
├── backgroundJobsService.js        # Background task processing
├── dashboardService.js             # Dashboard data aggregation
├── wigleImportService.js           # WiGLE API integration
├── ouiGroupingService.js           # OUI manufacturer grouping
├── secretsManager.js               # Secure credential management
├── keyringService.js               # OS keyring integration
└── dataQualityFilters.js           # Data validation and filtering
```

#### Data Access Layer (`server/src/repositories/`)

```
server/src/repositories/
├── baseRepository.js       # Base repository with common functionality
└── networkRepository.js    # Network-specific data access
```

#### Configuration (`server/src/config/`)

```
server/src/config/
├── database.js             # Database connection configuration
└── container.js            # Dependency injection container
```

#### Validation (`server/src/validation/`)

```
server/src/validation/
├── schemas.js              # Joi validation schemas
└── middleware.js           # Validation middleware
```

#### Error Handling (`server/src/errors/`)

```
server/src/errors/
├── AppError.js             # Custom error classes
└── errorHandler.js         # Global error handling
```

#### Logging (`server/src/logging/`)

```
server/src/logging/
├── logger.js               # Winston logger configuration
└── middleware.js           # Request logging middleware
```

#### Middleware (`server/src/middleware/`)

```
server/src/middleware/
└── requestId.js            # Request ID generation
```

## Database Structure (`sql/`)

### Migrations (`sql/migrations/`)

```
sql/migrations/
├── README.md                       # Migration execution order
├── 00_init_schema.sql              # Initial schema setup
├── 01_create_import_schema.sql     # Import schema creation
├── 02_create_mvs_and_imports_table.sql  # Materialized views
├── 03_fix_location_markers_schema.sql   # Schema fixes
├── 20251220_*.sql                  # Date-prefixed migrations
├── 20251221_*.sql                  # Recent schema updates
├── add_*.sql                       # Feature additions
├── create_*.sql                    # Table/function creation
├── update_*.sql                    # Schema updates
└── [various migration files]       # Historical migrations
```

### Functions (`sql/functions/`)

```
sql/functions/
├── create_scoring_function.sql     # Threat scoring algorithms
├── fix_kismet_functions.sql        # Kismet data processing
├── calculate_threat_score_v*.sql   # Threat score versions
└── incremental_threat_scoring.sql  # Incremental scoring
```

### Temporary Files (`sql/temp/`)

```
sql/temp/
├── .gitkeep                        # Keep directory in git
└── [temporary SQL files]           # Development SQL files
```

## Scripts and Utilities (`scripts/`)

### Import Scripts (`scripts/import/`)

```
scripts/import/
├── import-wigle-v2-json.js         # WiGLE JSON import
├── import-wigle-parallel.js        # Parallel WiGLE import
└── turbo-import.js                 # High-speed data import
```

### Enrichment Scripts (`scripts/enrichment/`)

```
scripts/enrichment/
├── enrichment-system.js            # Multi-API enrichment system
├── enrichment-system.ts            # TypeScript version
├── enrich-addresses-fast.js        # Fast address enrichment
├── enrich-addresses-multi.js       # Multi-source enrichment
├── enrich-business-names.js        # Business name lookup
├── enrich-multi-source.js          # Multi-API integration
├── enrich-overpass-optimized.js    # Overpass API optimization
├── generate-overpass-queries.js    # Query generation
└── monitor-enrichment.js           # Enrichment monitoring
```

### Geocoding Scripts (`scripts/geocoding/`)

```
scripts/geocoding/
├── geocode-addresses.js            # Address geocoding
├── geocode-batch.js                # Batch geocoding
├── geocode-wigle.js                # WiGLE-specific geocoding
├── reverse-geocode-batch.js        # Batch reverse geocoding
├── reverse-geocode-parallel.js     # Parallel reverse geocoding
├── reverse-geocode-smart.js        # Smart reverse geocoding
├── import-*.js                     # Various import utilities
└── export-missing-geocodes.js      # Export missing data
```

### Machine Learning (`scripts/ml/`)

```
scripts/ml/
├── ml-iterate.py                   # ML algorithm iteration
├── ml-trainer.js                   # Model training
└── requirements.txt                # Python dependencies
```

### System Scripts (`scripts/`)

```
scripts/
├── backup-shadowcheck.sh           # Database backup
├── docker-manage.sh                # Docker management
├── refresh-threat-scores.sh        # Threat score refresh
├── rebuild-networks-precision.js   # Network data rebuild
├── run-migration.js                # Migration runner
├── set-home.js                     # Home location setup
├── update-home-s22.js              # Home location update
├── generate-sitemap.js             # SEO sitemap generation
└── write-robots.js                 # robots.txt generation
```

### Keyring Management (`scripts/keyring/`)

```
scripts/keyring/
├── get-keyring-password.py         # Password retrieval
├── install-keyring-tool.sh         # Keyring installation
├── list-keyring-items.py           # List stored items
└── setup-postgres-keyring.sh       # PostgreSQL keyring setup
```

### Shell Scripts (`scripts/shell/`)

```
scripts/shell/
├── audit-pages.sh                  # Page audit
├── fix-headers.sh                  # Header fixes
├── run-migration.sh                # Migration execution
└── start-server.sh                 # Server startup
```

### Python Scripts (`scripts/python/`)

```
scripts/python/
└── fix_headers.py                  # Header processing
```

## Testing Structure (`tests/`)

### Unit Tests (`tests/unit/`)

```
tests/unit/
├── filterQueryBuilder.test.js      # Filter system tests
├── filters-systematic.test.js      # Systematic filter testing
├── observationCountMin-investigation.test.js  # Specific investigations
├── escapeSQL.test.js               # SQL security tests
├── secretsManager.test.js          # Secrets management tests
├── health.test.js                  # Health check tests
└── requestId.test.js               # Request ID tests
```

### Integration Tests (`tests/integration/`)

```
tests/integration/
├── README.md                       # Integration test guide
├── explorer-v2.test.js             # Explorer v2 tests
├── like-escaping.test.js           # SQL escaping tests
├── observability.test.js           # Logging tests
├── route-refactoring-verification.test.js  # Route tests
└── sql-injection-fixes.test.js     # Security tests
```

### API Tests (`tests/api/`)

```
tests/api/
└── dashboard.test.js               # Dashboard API tests
```

### Test Configuration

```
tests/
├── setup.js                        # Test setup configuration
├── test-*.js                       # Various test utilities
└── [test configuration files]      # Jest and test configs
```

## Documentation (`docs/`)

### Core Documentation

```
docs/
├── README.md                       # Documentation index
├── FEATURES.md                     # Feature overview
├── ARCHITECTURE.md                 # System architecture
├── DEVELOPMENT.md                  # Development guide
├── DEPLOYMENT.md                   # Deployment guide
├── API.md                          # API documentation
├── API_REFERENCE.md                # Detailed API reference
└── DIRECTORY_STRUCTURE.md          # This file
```

### Specialized Documentation

```
docs/
├── architecture/                   # Architecture deep-dives
├── features/                       # Feature-specific docs
├── guides/                         # Implementation guides
├── security/                       # Security documentation
├── testing/                        # Testing guides
├── operations/                     # Operational procedures
├── enrichment/                     # Enrichment system docs
├── deployment/                     # Deployment guides
├── getting-started/                # New user guides
├── development/                    # Development workflows
├── integrations/                   # Third-party integrations
├── setup/                          # Setup instructions
├── threat-analysis/                # Threat analysis docs
└── archive/                        # Historical documentation
```

## Configuration Files

### Build and Development

```
├── package.json                    # Node.js project configuration
├── package-lock.json               # Dependency lock file
├── vite.config.js                  # Vite build configuration
├── tailwind.config.js              # Tailwind CSS configuration
├── postcss.config.js               # PostCSS configuration
├── tsconfig.json                   # TypeScript configuration
├── tsconfig.node.json              # Node.js TypeScript config
├── jest.config.js                  # Jest testing configuration
├── eslint.config.js                # ESLint configuration
├── .eslintrc.json                  # Legacy ESLint config
├── .prettierrc.json                # Prettier formatting config
├── .prettierignore                 # Prettier ignore patterns
└── .editorconfig                   # Editor configuration
```

### Environment and Deployment

```
├── .env.example                    # Environment template
├── .env.production                 # Production environment
├── .env.local                      # Local overrides
├── Dockerfile                      # Docker container definition
├── docker-compose.yml              # Docker Compose configuration
├── docker-compose.dev.yml          # Development Docker config
└── .dockerignore                   # Docker ignore patterns
```

### Git and CI/CD

```
├── .gitignore                      # Git ignore patterns
├── .github/                        # GitHub configuration
│   ├── workflows/                  # GitHub Actions
│   ├── ISSUE_TEMPLATE.md           # Issue template
│   ├── PULL_REQUEST_TEMPLATE.md    # PR template
│   ├── dependabot.yml              # Dependabot configuration
│   └── FUNDING.yml                 # Funding information
├── .husky/                         # Git hooks
│   ├── pre-commit                  # Pre-commit hook
│   └── _/                          # Husky internals
└── .circleci/                      # CircleCI configuration
    └── config.yml                  # CI configuration
```

### VS Code Configuration

```
.vscode/
├── extensions.json                 # Recommended extensions
├── launch.json                     # Debug configuration
├── tasks.json                      # Task definitions
├── settings.json                   # Workspace settings
└── mcp.json                        # MCP configuration
```

### DevContainer Configuration

```
.devcontainer/
├── devcontainer.json               # DevContainer definition
└── docker-compose.yml              # DevContainer services
```

## Data Directories (Runtime)

### Data Storage (`data/`)

```
data/                               # Runtime data (gitignored)
├── .gitkeep                        # Keep directory in git
├── csv/                            # CSV export files
├── logs/                           # Application logs
│   ├── combined.log                # All log levels
│   ├── error.log                   # Error logs only
│   └── debug.log                   # Debug information
└── notes-media/                    # Media attachments
```

### Secrets (`secrets/`)

```
secrets/                            # Secure credential storage
├── README.md                       # Secrets management guide
├── mapbox_token.txt                # Mapbox API token
├── db_password.txt                 # Database password
└── api_key.txt                     # API keys
```

### Imports (`imports/`)

```
imports/                            # Import data staging
└── wigle/                          # WiGLE import files
    └── response_*.json             # WiGLE API responses
```

### Backups (`backups/`)

```
backups/                            # Database backups (gitignored)
└── [backup files]                  # Automated backup storage
```

## Key Files Explained

### Entry Points

- **`server/server.js`**: Main Express server with legacy API routes
- **`client/src/main.tsx`**: React application entry point
- **`index.html`**: HTML template for Vite

### Configuration

- **`package.json`**: Dependencies, scripts, and project metadata
- **`vite.config.js`**: Frontend build configuration with proxy setup
- **`tailwind.config.js`**: CSS framework configuration
- **`.env.example`**: Environment variable template

### Security

- **`server/src/utils/escapeSQL.js`**: SQL injection prevention
- **`server/src/services/secretsManager.js`**: Secure credential management
- **`server/static-server.js`**: Production server with security headers

### Database

- **`sql/migrations/README.md`**: Migration execution order
- **`server/src/config/database.js`**: Database connection configuration
- **`server/src/services/filterQueryBuilder.js`**: Universal filter system

This structure supports:

- **Modern development** with React, TypeScript, and Vite
- **Secure deployment** with proper secret management
- **Scalable architecture** with modular backend services
- **Comprehensive testing** with unit and integration tests
- **Production readiness** with Docker and CI/CD support
