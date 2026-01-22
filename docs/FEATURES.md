# ShadowCheck Features

Complete feature list for the SIGINT Forensics Platform.

## Core Capabilities

### 1. Dashboard

- Real-time network statistics with live updates
- Threat count overview with severity levels
- Surveillance device detection and classification
- Enrichment status tracking across multiple APIs
- Quick metrics at a glance with interactive cards
- Responsive design with dark theme
- Filter integration with universal filter system

### 2. Geospatial Analysis

- Interactive Mapbox GL JS map with custom styling
- Network location visualization with clustering
- Observation clustering with density-based grouping
- Home location marker with distance calculations
- Distance calculations using PostGIS functions
- Heatmap overlays for threat density
- Custom marker support with threat-based coloring
- Map orientation controls (compass, pitch, bearing)
- Lazy loading for performance optimization

### 3. Network Analysis

- 173,326+ unique networks tracked (current database stats)
- 566,400+ location observations with temporal data
- Multi-radio support (WiFi, BLE, Bluetooth, LTE, 5G, GSM, NFC)
- Signal strength tracking with RSSI analysis
- Encryption detection with WPA3/WPA2/WEP classification
- Channel/frequency analysis with band detection
- Manufacturer identification (MAC OUI lookup with 40,000+ entries)
- Universal filter system with 20+ filter types
- Advanced filtering with temporal, spatial, and behavioral filters
- Real-time search with debounced input
- Sortable tables with pagination (up to 5000 records per page)

### 4. Threat Detection

- ML-powered threat scoring (0-100 scale) with confidence intervals
- Behavioral pattern analysis using movement algorithms
- Movement tracking with speed calculations (km/h)
- Distance range monitoring from home location
- Home/away detection with configurable thresholds
- Temporal pattern analysis (24-hour activity cycles)
- User tagging system (LEGIT, FALSE_POSITIVE, INVESTIGATE, THREAT)
- Stationary confidence scoring for fixed vs mobile devices
- Multi-algorithm threat detection with ensemble methods
- Real-time threat classification with background processing

### 5. Analytics

- Network type distribution with radio type breakdown
- Signal strength histograms with statistical analysis
- Temporal activity patterns (24-hour heatmaps)
- Security/encryption analysis with vulnerability assessment
- Radio type trends over time with forecasting
- Customizable time ranges (24h, 7d, 30d, 90d, all)
- Interactive Chart.js visualizations with drill-down
- Export capabilities (CSV, JSON) with filtered datasets
- Performance metrics and query optimization insights

## Modern Frontend Architecture

### React + Vite Frontend

- **React 18** with TypeScript support
- **Vite** build system for fast development and optimized production builds
- **Lazy loading** for heavy components (maps, analytics)
- **Suspense** boundaries for graceful loading states
- **React Router** with future-ready configuration
- **Tailwind CSS** for responsive, dark-themed UI
- **Component-based architecture** with reusable UI elements

### Pages & Routing

- **Dashboard** (`/` and `/dashboard`) - Real-time metrics and threat overview
- **Geospatial Intelligence** (`/geospatial` or `/geospatial-intel`) - Interactive mapping
- **Analytics** (`/analytics`) - Charts and statistical analysis
- **API Test** (`/endpoint-test`) - Development API testing interface
- **ML Training** (`/ml-training`) - Machine learning model management
- **Admin** (`/admin`) - System administration and configuration
- **WiGLE Test** (`/wigle-test`) - WiGLE API integration testing
- **Kepler Test** (`/kepler-test`) - Kepler.gl visualization testing

### State Management

- **Zustand** for global filter state management
- **React hooks** for component-level state
- **Custom hooks** for data fetching and filter adaptation
- **Context providers** for shared functionality

### Performance Optimizations

- **Code splitting** with dynamic imports
- **Bundle optimization** with Vite's tree shaking
- **Image optimization** and lazy loading
- **Debounced search** for real-time filtering
- **Virtualized lists** for large datasets
- **Memoized components** to prevent unnecessary re-renders

## Intelligence Features

### Address Enrichment

- Multi-API venue identification (4 sources: OpenCage, LocationIQ, Abstract, Overpass)
- Business name lookup with confidence scoring
- Address resolution with geocoding validation
- Conflict resolution between sources using weighted algorithms
- Confidence scoring based on source reliability
- Batch processing for large datasets
- Rate limiting and API key rotation

### Device Classification

- Automatic device type detection using ML algorithms
- Vehicle identification based on movement patterns
- IoT device recognition through behavioral analysis
- Smartphone detection via signal characteristics
- Manufacturer categorization with OUI database (40,000+ entries)
- Device fingerprinting for tracking across sessions

### Contextual Analysis

- Government facility detection using geofencing
- Educational institution identification
- Commercial venue recognition with business type classification
- Residential area mapping with privacy considerations
- Critical infrastructure identification
- Surveillance zone detection and alerting

### Trilateration & Positioning

- AP location calculation from multiple observations
- Accuracy estimation using statistical methods
- Multi-point positioning with error bounds
- GPS coordinate validation and filtering
- Indoor positioning estimation
- Movement pattern analysis for mobile devices

### UUID Tracking & Behavioral Analysis

- Device movement patterns with trajectory analysis
- Behavioral profiling using ML clustering
- Cross-session tracking with privacy safeguards
- Temporal correlation analysis
- Anomaly detection in movement patterns
- Speed and acceleration calculations

## Machine Learning & AI

### Threat Detection Model

- **Logistic regression classifier** with hyperparameter optimization
- **Random Forest** and **Gradient Boosting** ensemble methods
- **Feature engineering** with domain expertise:
  - Distance range from home location
  - Observation count and frequency
  - Unique days seen over time
  - Home/away behavioral patterns
  - Signal strength characteristics (RSSI)
  - Movement speed and acceleration
  - Temporal activity patterns
  - Network security characteristics
- **Training pipeline** with cross-validation
- **Model persistence** and versioning
- **Real-time prediction** with confidence scoring
- **Incremental learning** for model updates

### Model Training & Evaluation

- **Minimum 10 tagged samples** for training
- **Automatic retraining** when new tags are added
- **Performance metrics**: Accuracy, Precision, Recall, F1-Score, ROC-AUC
- **Feature importance analysis** for interpretability
- **Hyperparameter grid search** for optimization
- **Cross-validation** with stratified sampling
- **Model comparison** across multiple algorithms
- **Training history** and performance tracking

### Advanced Analytics

- **Clustering algorithms** for device grouping
- **Anomaly detection** for unusual patterns
- **Time series analysis** for temporal trends
- **Geospatial clustering** for location-based insights
- **Network topology analysis** for infrastructure mapping

## Development & DevOps Features

### Development Environment

- **DevContainer** support with VS Code integration
- **Docker Compose** for consistent development setup
- **Hot reload** with nodemon for backend development
- **Vite dev server** for frontend development with HMR
- **Environment configuration** with .env file management
- **Secrets management** with keyring integration
- **Database migrations** with ordered execution
- **Seed data** for development and testing

### Code Quality & Testing

- **ESLint** configuration with custom rules
- **Prettier** formatting with consistent style
- **Husky** pre-commit hooks for quality gates
- **Jest** testing framework with coverage reporting
- **Integration tests** for API endpoints
- **Unit tests** for business logic
- **SQL injection prevention** with parameterized queries
- **Security scanning** with automated tools

### Build & Deployment

- **Vite build system** with optimized production builds
- **Static server** with security headers for Lighthouse audits
- **Docker containerization** with multi-stage builds
- **CI/CD pipeline** with GitHub Actions
- **Environment-specific builds** (development, staging, production)
- **SEO optimization** with sitemap generation and robots.txt
- **Performance monitoring** with built-in metrics

### Security Features

- **Content Security Policy** (CSP) with Mapbox allowlist
- **Security headers** (X-Frame-Options, X-Content-Type-Options, etc.)
- **HTTPS enforcement** with automatic redirects
- **Rate limiting** (1000 requests per 15 minutes per IP)
- **CORS configuration** with origin validation
- **Input validation** and sanitization
- **SQL injection prevention** with parameterized queries
- **XSS protection** with output encoding
- **Secrets management** with OS-level keyring integration

### Import/Export

- CSV export (networks, observations)
- JSON export
- Filtered exports (threats, tagged)
- Bulk import support

### Database

- PostgreSQL 18 with PostGIS
- Optimized indexing
- Materialized views for performance
- Automatic deduplication
- Colocation tracking

### Backup/Restore

- Database backup creation
- Backup listing
- Point-in-time restore
- Automated backup scheduling

## Security Features

### Authentication

- API key authentication
- Header-based auth (not query params)
- Environment variable configuration

### Rate Limiting

- 1000 requests per 15 minutes
- Per-IP tracking
- Configurable limits

### Security Headers

- X-Content-Type-Options
- X-Frame-Options
- X-XSS-Protection
- Referrer-Policy
- Strict-Transport-Security (HTTPS)
- Content-Security-Policy

### Data Protection

- BSSID validation and sanitization
- SQL injection prevention
- Input length limits
- Secure credential storage (keyring)

## Integration Features

### WiGLE API

- Network detail lookup
- Database search
- Credential management via keyring
- Rate limit handling

### Mapbox

- Token management via keyring
- Tile caching
- Custom styling
- Offline fallback

### Keyring Integration

- Secure credential storage
- OS-level encryption
- Multi-credential support
- Automatic retrieval

## User Interface

### Pages

- Dashboard (`/`)
- Geospatial (`/geospatial` or `/geospatial-intel`)
- Networks (`/geospatial-explorer`)
- Analytics (`/analytics`)
- Threats (`/` dashboard cards and `/geospatial-intel`)

### UI Features

- Responsive design (Tailwind CSS)
- Dark mode support
- Sortable tables
- Pagination
- Search/filter
- Real-time updates
- Chart.js visualizations

## Performance

### Optimization

- Gzip compression
- Static file caching (1 hour)
- Database connection pooling (max 5)
- Query result caching
- Materialized view refresh
- Efficient indexing

### Scalability

- Pagination (max 5000 per page)
- Lazy loading
- Incremental data fetching
- Background processing

## Monitoring & Logging

### Error Handling

- Centralized error handler
- Detailed error messages
- Stack trace logging
- User-friendly error responses

### Database Monitoring

- Connection health checks
- Query retry logic
- Transient error handling
- Performance logging

## Development Features

### Code Quality

- ESLint configuration
- Prettier formatting
- Husky pre-commit hooks
- Lint-staged
- Jest testing framework

### Testing

- Unit tests
- Integration tests
- API endpoint tests
- Coverage reporting

### Documentation

- Comprehensive README
- API reference
- Architecture docs
- Database schema docs
- Deployment guides

## Deployment

### Docker Support

- Dockerfile included
- Docker Compose configuration
- Multi-stage builds
- Environment variable injection

### Production Ready

- HTTPS redirect support
- CORS configuration
- Environment-based config
- Health check endpoints
- Graceful shutdown

## Data Sources

### Supported Formats

- Kismet CSV/JSON
- WiGLE CSV
- Custom CSV formats
- Direct database import

### Radio Types

- WiFi (802.11 a/b/g/n/ac/ax)
- Bluetooth Low Energy (BLE)
- Bluetooth Classic
- LTE (4G)
- 5G NR
- GSM/Cellular

## Future Enhancements

See [ROADMAP.md](ROADMAP.md) for planned features.
