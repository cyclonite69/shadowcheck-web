# ShadowCheck Features

Complete feature list for the SIGINT Forensics Platform.

## Core Capabilities

### 1. Dashboard

- Real-time network statistics
- Threat count overview
- Surveillance device detection
- Enrichment status tracking
- Quick metrics at a glance

### 2. Geospatial Analysis

- Interactive Mapbox GL JS map
- Network location visualization
- Observation clustering
- Home location marker
- Distance calculations
- Heatmap overlays
- Custom marker support

### 3. Network Analysis

- 173,326+ unique networks tracked
- 566,400+ location observations
- Multi-radio support (WiFi, BLE, Bluetooth, LTE, 5G, GSM)
- Signal strength tracking
- Encryption detection
- Channel/frequency analysis
- Manufacturer identification (MAC OUI lookup)

### 4. Threat Detection

- ML-powered threat scoring (0-100)
- Behavioral pattern analysis
- Movement tracking
- Speed calculations
- Distance range monitoring
- Home/away detection
- Temporal pattern analysis
- User tagging system (LEGIT, FALSE_POSITIVE, INVESTIGATE, THREAT)

### 5. Analytics

- Network type distribution
- Signal strength histograms
- Temporal activity patterns (24-hour)
- Security/encryption analysis
- Radio type trends over time
- Customizable time ranges (24h, 7d, 30d, 90d, all)

## Intelligence Features

### Address Enrichment

- Multi-API venue identification (4 sources)
- Business name lookup
- Address resolution
- Conflict resolution between sources
- Confidence scoring

### Device Classification

- Automatic device type detection
- Vehicle identification
- IoT device recognition
- Smartphone detection
- Manufacturer categorization

### Contextual Analysis

- Government facility detection
- Educational institution identification
- Commercial venue recognition
- Residential area mapping

### Trilateration

- AP location calculation from multiple observations
- Accuracy estimation
- Multi-point positioning

### UUID Tracking

- Device movement patterns
- Behavioral profiling
- Cross-session tracking
- Temporal correlation

## Machine Learning

### Threat Detection Model

- Logistic regression classifier
- Feature engineering:
  - Distance range
  - Observation count
  - Unique days
  - Home/away patterns
  - Signal strength
  - Movement speed
- Training on user-tagged networks
- Confidence scoring
- Real-time prediction

### Model Training

- Minimum 10 tagged samples
- Automatic retraining
- Performance metrics
- Feature importance analysis

## Data Management

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
- Geospatial (`/geospatial.html`)
- Networks (`/networks.html`)
- Analytics (`/analytics.html`)
- Surveillance (`/surveillance.html`)

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
