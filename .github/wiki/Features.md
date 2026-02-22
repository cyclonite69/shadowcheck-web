# Features

**Docs version (repo):** [docs/FEATURES.md](../../docs/FEATURES.md)

> **Complete feature catalog for ShadowCheck**

---

## Feature Overview

```mermaid
mindmap
  root((ShadowCheck))
    Core Features
      Dashboard
      Geospatial Intel
      Network Explorer
      Threat Detection
    Data Management
      ETL Pipeline
      Database Import
      Data Export
      Backups
    Intelligence
      ML Training
      Threat Scoring
      Address Enrichment
      WiGLE Integration
    Visualization
      Interactive Maps
      Analytics Charts
      Weather FX
      Heatmaps
    Security
      Authentication
      Role-Based Access
      Rate Limiting
      Secrets Management
```

---

## Core UI & Exploration

| Feature                     | Description                                                        |
| --------------------------- | ------------------------------------------------------------------ |
| **Dashboard**               | Real-time metrics cards, threat indicators, filter-aware summaries |
| **Geospatial Intelligence** | Map-based analysis with heatmaps, routes, timeline overlays        |
| **Geospatial Explorer**     | Interactive map view with network selection and tooltips           |
| **Networks Explorer**       | Filtered network table with sorting and manufacturer cues          |
| **Threats Explorer**        | Strong-signal candidate list with quick triage                     |
| **Analytics**               | Temporal activity, radio-type trends, threat score charts          |
| **WiGLE Page**              | Local WiGLE data search with optional live API lookups             |
| **Kepler Page**             | Kepler.gl-ready GeoJSON feeds with filter support                  |
| **API Test Page**           | Endpoint smoke tests and response inspection                       |
| **Admin Page**              | Configuration workflows and operational controls                   |

---

## Dashboard Architecture

```mermaid
graph TB
    A[Dashboard Page] --> B[Metrics Cards]
    A --> C[Filter Panel]
    A --> D[Quick Actions]

    B --> E[Total Networks]
    B --> F[Threat Count]
    B --> G[Surveillance Devices]
    B --> H[Enriched Networks]

    C --> I[Apply Filters]
    I --> J[Update All Cards]

    D --> K[Navigate to Geospatial]
    D --> L[Navigate to Analytics]
    D --> M[Navigate to ML Training]

    style A fill:#4a5568,stroke:#cbd5e0,color:#fff
    style B fill:#4299e1,stroke:#2b6cb0,color:#fff
```

---

## Universal Filter System

```mermaid
flowchart LR
    A[Filter Input] --> B{Filter Type}

    B -->|Temporal| C[Date Range<br/>Time of Day<br/>Day of Week]
    B -->|Signal| D[RSSI Range<br/>Quality<br/>Channel]
    B -->|Radio| E[Type<br/>Band<br/>Frequency]
    B -->|Security| F[Encryption<br/>WPS Status]
    B -->|Distance| G[From Home<br/>Range]
    B -->|Geography| H[Bounding Box<br/>Radius<br/>Polygon]
    B -->|Tags| I[Threat Tags<br/>Custom Tags]
    B -->|Device| J[Manufacturer<br/>Device Type]

    C --> K[Build SQL Query]
    D --> K
    E --> K
    F --> K
    G --> K
    H --> K
    I --> K
    J --> K

    K --> L[Execute Query]
    L --> M[Return Filtered Results]

    style M fill:#48bb78,stroke:#2f855a,color:#fff
```

### Filter Types (20+)

- **Time Filters**: Date ranges, hours, days of week
- **Signal Filters**: Strength (RSSI), quality, channel, frequency
- **Radio Filters**: Type (WiFi/BLE/etc.), band (2.4/5GHz), frequency ranges
- **Security Filters**: Encryption type, WPS status
- **Distance Filters**: From home location, distance range
- **Geography Filters**: Bounding box, radius, polygon
- **Tag Filters**: Threat classification, custom tags
- **Device Filters**: Manufacturer (OUI), device type
- **Behavioral Filters**: Seen at home, seen away, movement patterns
- **Observation Filters**: Count, unique days, first/last seen

### Filter Features

- **Page-scoped filters** with URL sync and debounced application
- **Distance-from-home filters** backed by stored home location markers
- **Complex queries** with AND/OR logic
- **Filter presets** for common scenarios
- **Real-time updates** with 500ms debounce

---

## Geospatial & Mapping

```mermaid
graph TB
    subgraph "Map Layers"
        A[Base Map<br/>Mapbox/Google]
        B[Network Points]
        C[Heatmap Layer]
        D[Route Layer]
        E[Marker Layer]
        F[Weather FX Layer]
    end

    subgraph "Interactions"
        G[Click Network]
        H[Hover Tooltip]
        I[Draw Polygon]
        J[Measure Distance]
    end

    subgraph "Controls"
        K[Layer Toggle]
        L[Style Selector]
        M[Weather Toggle]
        N[Filter Panel]
    end

    A --> B
    A --> C
    A --> D
    A --> E
    A --> F

    B --> G
    B --> H

    K --> B
    K --> C
    K --> D
    L --> A
    M --> F
    N --> B

    style A fill:#4a5568,stroke:#cbd5e0,color:#fff
    style F fill:#4299e1,stroke:#2b6cb0,color:#fff
```

| Feature                | Description                                        |
| ---------------------- | -------------------------------------------------- |
| **Mapbox Integration** | Token management, style proxying, request proxy    |
| **Google Maps Tiles**  | Server-side tile proxy with key management         |
| **Heatmaps**           | Geospatial overlays for movement patterns          |
| **Routes & Timelines** | Movement visualization                             |
| **Location Markers**   | CRUD for saved markers plus radius-based home zone |
| **Unified Tooltips**   | Consistent, rich hover tooltips across map views   |
| **Weather FX**         | Real-time atmospheric visualization                |

---

## Weather FX System

```mermaid
flowchart TD
    A[Map Center] --> B[Fetch Weather Data]
    B --> C{Weather Condition}

    C -->|Rain| D[Rain Particle System]
    C -->|Snow| E[Snow Particle System]
    C -->|Clear| F[Clear Particles]

    D --> G[Vertical Streaks<br/>Speed: 15-20 px/frame]
    E --> H[Sinusoidal Drift<br/>Gentle Fall]
    F --> I[Adjust Fog Opacity]

    G --> J[Canvas Overlay]
    H --> J
    I --> J

    J --> K[Render on Map]

    style K fill:#48bb78,stroke:#2f855a,color:#fff
```

### Weather Features

- **Real-time Weather Overlay**: Dynamic fog, rain, and snow effects
- **Particle System**: High-performance canvas-based rendering
- **Historical Weather**: View past conditions for observation points
- **Backend Proxy**: Secure `/api/weather` endpoints
- **Atmospheric Effects**: Temperature, pressure, visibility data

---

## Threat Detection System

```mermaid
flowchart TD
    A[Network Observation] --> B[Feature Extraction]

    B --> C1[Observation Count]
    B --> C2[Unique Days]
    B --> C3[Geographic Spread]
    B --> C4[Signal Strength]
    B --> C5[Distance from Home]
    B --> C6[Movement Speed]

    C1 --> D[Rule-Based Scoring]
    C2 --> D
    C3 --> D
    C4 --> D
    C5 --> D
    C6 --> D

    D --> E{ML Model Available?}

    E -->|Yes| F[ML Prediction<br/>Logistic Regression<br/>Random Forest<br/>Gradient Boosting]
    E -->|No| G[Rule Score Only]

    F --> H[Weighted Combination]
    G --> H

    H --> I[Final Threat Score<br/>0-100]

    I --> J{Classify}
    J -->|>70| K[High Threat<br/>Red]
    J -->|40-70| L[Medium Threat<br/>Orange]
    J -->|<40| M[Low/No Threat<br/>Green]

    style K fill:#f56565,stroke:#c53030,color:#fff
    style L fill:#ed8936,stroke:#c05621,color:#fff
    style M fill:#48bb78,stroke:#2f855a,color:#fff
```

### Threat Detection Features

- **Multi-factor scoring**: Combines 6+ behavioral indicators
- **ML-powered**: Multiple algorithms with hyperparameter optimization
- **Movement analysis**: Speed calculation and pattern detection
- **Home/away detection**: Identifies networks seen in multiple contexts
- **Manual tagging**: Admin can classify networks for training
- **Real-time updates**: Scores recalculated on new observations

---

## Machine Learning Pipeline

```mermaid
flowchart LR
    A[Tagged Networks] --> B[Feature Engineering]
    B --> C[Train/Test Split<br/>80/20]

    C --> D1[Logistic Regression]
    C --> D2[Random Forest]
    C --> D3[Gradient Boosting]

    D1 --> E[Cross Validation]
    D2 --> E
    D3 --> E

    E --> F[Grid Search<br/>Hyperparameters]
    F --> G[Select Best Model]
    G --> H[Evaluate Metrics<br/>Accuracy, Precision<br/>Recall, F1, ROC-AUC]

    H --> I{Accuracy > 0.8?}
    I -->|Yes| J[Deploy Model]
    I -->|No| K[Retrain]

    J --> L[Score All Networks]
    L --> M[Update Database]

    style J fill:#48bb78,stroke:#2f855a,color:#fff
    style K fill:#ed8936,stroke:#c05621,color:#fff
```

### ML Features

- **Multiple Algorithms**: Logistic Regression, Random Forest, Gradient Boosting
- **Hyperparameter Optimization**: Grid search with cross-validation
- **Model Versioning**: Track training history and metrics
- **Feature Importance**: Understand which factors drive predictions
- **Minimum Data**: Requires 10+ tagged networks for training
- **Automatic Scoring**: Updates all network scores after training

---

## Analytics System

```mermaid
graph TB
    subgraph "Analytics Widgets"
        A[Temporal Activity]
        B[Network Types]
        C[Signal Distribution]
        D[Threat Trends]
        E[Radio Types Over Time]
        F[Security Analysis]
    end

    subgraph "Data Sources"
        G[(observations)]
        H[(networks)]
        I[(network_tags)]
    end

    subgraph "Caching"
        J[(Redis Cache<br/>TTL: 5min)]
    end

    A --> G
    B --> H
    C --> G
    D --> H
    E --> G
    F --> H

    A -.->|Cache| J
    B -.->|Cache| J
    C -.->|Cache| J
    D -.->|Cache| J

    style J fill:#f56565,stroke:#c53030,color:#fff
```

### Analytics Features

- **Chart.js Visualizations**: Interactive, responsive charts
- **Real-time Updates**: Refresh with filter changes
- **Cached Aggregations**: 5-minute TTL for performance
- **Export Capabilities**: Download charts as images
- **Temporal Analysis**: Hourly, daily, weekly patterns
- **Distribution Analysis**: Signal strength, network types, security

---

## Data Import & ETL

```mermaid
flowchart LR
    A[Data Sources] --> B[01_load<br/>Staging Tables<br/>UNLOGGED]
    B --> C[02_transform<br/>Normalize & Clean]
    C --> D[03_promote<br/>Production Tables<br/>LOGGED]
    D --> E[04_indexes<br/>Create Indexes]
    E --> F[05_materialized_views<br/>Refresh Views]
    F --> G[Production Ready]

    style B fill:#ed8936,stroke:#c05621,color:#fff
    style D fill:#4299e1,stroke:#2b6cb0,color:#fff
    style G fill:#48bb78,stroke:#2f855a,color:#fff
```

### ETL Features

- **Modular Pipeline**: Separate load/transform/promote steps
- **UNLOGGED Staging**: Fast bulk inserts without WAL overhead
- **Duplicate Detection**: Automatic deduplication
- **Manufacturer Enrichment**: OUI prefix matching
- **Threat Score Calculation**: Automatic scoring on import
- **Materialized Views**: Pre-computed threat intelligence
- **Progress Tracking**: Real-time import status

---

## Address Enrichment

```mermaid
flowchart TD
    A[Network Location] --> B{Enrichment Source}

    B -->|1| C[OpenCage<br/>Geocoding API]
    B -->|2| D[LocationIQ<br/>Reverse Geocoding]
    B -->|3| E[Abstract API<br/>Location Data]
    B -->|4| F[Overpass<br/>OSM POI]

    C --> G[Merge Results]
    D --> G
    E --> G
    F --> G

    G --> H[Store in Database]
    H --> I[Display on Map]

    style G fill:#4299e1,stroke:#2b6cb0,color:#fff
```

### Enrichment Features

- **Multi-API Support**: 4 data sources for comprehensive coverage
- **Venue Identification**: Businesses, landmarks, addresses
- **Fallback Strategy**: Try multiple sources if one fails
- **Rate Limiting**: Respect API quotas
- **Caching**: Store enriched data to avoid re-querying
- **Manual Override**: Admin can edit enrichment data

---

## Security Features

```mermaid
graph TB
    subgraph "Authentication"
        A[Session-Based Auth]
        B[Redis Session Store]
        C[Role-Based Access]
    end

    subgraph "Protection"
        D[Rate Limiting<br/>1000/15min]
        E[SQL Injection Prevention]
        F[XSS Protection]
        G[CSRF Protection]
    end

        subgraph "Secrets"
        H[AWS Secrets Manager]
        I[Environment Variable Overrides]
        J[Encrypted Credentials]
    end

    A --> B
    B --> C

    D --> K[Application]
    E --> K
    F --> K
    G --> K

    H --> L[Config Manager]
    I --> L
    J --> L

    style K fill:#4a5568,stroke:#cbd5e0,color:#fff
```

### Security Features

- **Session Management**: Redis-backed sessions with expiration
- **Role-Based Access**: Admin/User roles with permission checks
- **Rate Limiting**: IP-based throttling (1000 req/15min)
- **SQL Injection Prevention**: Parameterized queries throughout
- **Secrets Management**: AWS Secrets Manager (env overrides only)
- **Security Headers**: CSP, HSTS, X-Frame-Options, etc.
- **Password Rotation**: 60-90 day rotation policy
- **Audit Logging**: Track admin actions

---

## Export & Backup

```mermaid
flowchart LR
    A[Export Request] --> B{Format}

    B -->|CSV| C[Generate CSV]
    B -->|JSON| D[Generate JSON]
    B -->|GeoJSON| E[Generate GeoJSON]

    C --> F[Stream Response]
    D --> F
    E --> F

    F --> G[Browser Download]

    H[Backup Request] --> I[pg_dump]
    I --> J[Compress gzip]
    J --> K[Store in backups/]
    K --> L[Optional S3 Upload]

    style G fill:#48bb78,stroke:#2f855a,color:#fff
    style L fill:#4299e1,stroke:#2b6cb0,color:#fff
```

### Export Features

- **Multiple Formats**: CSV, JSON, GeoJSON
- **Filter Support**: Export filtered datasets
- **Streaming**: Handle large exports efficiently
- **Scheduled Backups**: Automated daily backups
- **S3 Integration**: Optional cloud backup storage
- **Restore Capability**: Full database restore from backups

---

## Admin Features

```mermaid
graph TB
    A[Admin Panel] --> B[System Config]
    A --> C[User Management]
    A --> D[Data Management]
    A --> E[AWS Management]
    A --> F[pgAdmin Control]

    B --> G[API Keys]
    B --> H[Settings]

    C --> I[Roles]
    C --> J[Permissions]

    D --> K[Import Data]
    D --> L[Cleanup Duplicates]
    D --> M[Backups]

    E --> N[Start/Stop Instances]
    E --> O[View Status]

    F --> P[Start pgAdmin]
    F --> Q[Stop pgAdmin]

    style A fill:#4a5568,stroke:#cbd5e0,color:#fff
```

### Admin Features

- **Configuration Management**: Mapbox, WiGLE, Google Maps API keys
- **User Management**: Create, edit, delete users and roles
- **Data Import**: SQLite database import with progress tracking
- **Duplicate Cleanup**: Remove redundant observations
- **Backup Management**: Create and restore database backups
- **AWS Integration**: Start/stop EC2 instances from UI
- **pgAdmin Control**: Manage pgAdmin container lifecycle
- **System Monitoring**: View logs, metrics, health status

---

## Performance Optimizations

- **Redis Caching**: 5-minute TTL for analytics and metrics
- **Materialized Views**: Pre-computed threat intelligence
- **Spatial Indexes**: GiST indexes on geometry columns
- **Connection Pooling**: Reuse database connections
- **UNLOGGED Staging**: Fast bulk inserts
- **Lazy Loading**: React components load on demand
- **Debounced Filters**: 500ms delay before applying
- **Pagination**: Limit result sets to prevent overload

---

_Last Updated: 2026-02-07_

---

## Data & Enrichment

| Feature                  | Description                                       |
| ------------------------ | ------------------------------------------------- |
| **Multi-API Enrichment** | OpenCage, LocationIQ, Abstract, Overpass support  |
| **Manufacturer/OUI**     | Vendor data from radio manufacturers              |
| **Network Tagging**      | Manual classification and tag lookups             |
| **Trilateration**        | Estimate AP location from multiple observations   |
| **Export Tooling**       | CSV, JSON, GeoJSON exports                        |
| **Backup & Restore**     | JSON snapshot export with admin-protected restore |

---

## Threat Detection

| Feature                | Description                                                       |
| ---------------------- | ----------------------------------------------------------------- |
| **Rule-Based Scoring** | Multi-factor analysis (seen at home/away, distance, observations) |
| **ML Training**        | Logistic regression model training and scoring                    |
| **ML Iteration**       | Offline model comparison (LR, RF, Gradient Boosting)              |
| **Threat Analytics**   | Quick and detailed threat detection endpoints                     |

### Threat Score Calculation

| Factor       | Points | Condition              |
| ------------ | ------ | ---------------------- |
| Home/Away    | +40    | Seen at home AND away  |
| Distance     | +25    | Distance range > 200m  |
| Temporal     | +5-15  | Multiple unique days   |
| Observations | +5-10  | High observation count |
| Speed        | +10-20 | High movement speed    |

---

## Admin, Auth & Security

| Feature                 | Description                             |
| ----------------------- | --------------------------------------- |
| **Authentication**      | Session-based login/logout              |
| **Role-Based Gating**   | Admin-only routes for sensitive actions |
| **Settings Management** | AWS Secrets Manager-backed credentials  |
| **Security Headers**    | CSP and hardened response headers       |
| **Secrets Handling**    | AWS Secrets Manager (no secrets on disk) |

---

## Platform & Operations

| Feature             | Description                                    |
| ------------------- | ---------------------------------------------- |
| **API Versioning**  | v1 and v2 endpoints                            |
| **Modular Backend** | Services and repositories with validation      |
| **ETL Pipeline**    | Load/transform/promote steps                   |
| **Static Server**   | Production-ready hosting with security headers |
| **Rate Limiting**   | 1000 req/15min per IP                          |

---

## Pages Overview

| Page                | Route                  | Description                             |
| ------------------- | ---------------------- | --------------------------------------- |
| Dashboard           | `/`                    | Real-time metrics and threat indicators |
| Geospatial Intel    | `/geospatial`          | Map-based analysis with heatmaps        |
| Geospatial Explorer | `/geospatial-explorer` | Interactive map exploration             |
| Networks Explorer   | `/networks`            | Filtered network table                  |
| Analytics           | `/analytics`           | Charts and visualizations               |
| ML Training         | `/ml-training`         | Model management and training           |
| Admin               | `/admin`               | System administration                   |
| WiGLE               | `/wigle`               | WiGLE database search                   |
| Kepler              | `/kepler`              | Kepler.gl GeoJSON feeds                 |
| API Test            | `/endpoint-test`       | Endpoint testing                        |

---

## Related Documentation

- [Architecture](Architecture) - System design
- [API Reference](API-Reference) - REST API documentation
- [Machine Learning](Machine-Learning) - ML features
