# Architecture

**Docs version (repo):** [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md)

> **System architecture and design patterns for ShadowCheck**

---

## Overview

ShadowCheck uses a modern modular architecture combining:

- **React/Vite frontend** with TypeScript and Tailwind CSS
- **Node.js/Express backend** with service/repository pattern
- **PostgreSQL + PostGIS** for geospatial data processing
- **Redis** for caching, sessions, and rate limiting

---

## System Architecture Diagram

```mermaid
graph TB
    subgraph "Client Layer"
        A[React Frontend<br/>Vite + TypeScript]
        A1[Dashboard]
        A2[Geospatial Intel]
        A3[Analytics]
        A4[ML Training]
        A5[Admin Panel]
        A --> A1
        A --> A2
        A --> A3
        A --> A4
        A --> A5
    end

    subgraph "API Gateway"
        B[Express Server<br/>Node.js 20+]
        B1[Rate Limiter<br/>1000 req/15min]
        B2[Auth Middleware]
        B3[Security Headers]
        B --> B1
        B --> B2
        B --> B3
    end

    subgraph "Service Layer"
        C1[Network Service]
        C2[Threat Service]
        C3[Analytics Service]
        C4[ML Service]
        C5[Admin Service]
    end

    subgraph "Repository Layer"
        D1[Network Repository]
        D2[Observation Repository]
        D3[Tag Repository]
        D4[Analytics Repository]
    end

    subgraph "Data Layer"
        E[(PostgreSQL 18<br/>+ PostGIS)]
        F[(Redis 4+<br/>Cache & Sessions)]
        G[ETL Pipeline]
    end

    A -->|REST API| B
    B --> C1
    B --> C2
    B --> C3
    B --> C4
    B --> C5

    C1 --> D1
    C2 --> D1
    C3 --> D4
    C4 --> D1
    C5 --> D1

    D1 --> E
    D2 --> E
    D3 --> E
    D4 --> E

    C1 -.->|Cache| F
    C3 -.->|Cache| F
    B1 -.->|Rate Limit| F
    B2 -.->|Sessions| F

    G -->|Load Data| E

    style A fill:#4a5568,stroke:#cbd5e0,color:#fff
    style B fill:#2d3748,stroke:#cbd5e0,color:#fff
    style E fill:#2c5282,stroke:#90cdf4,color:#fff
    style F fill:#742a2a,stroke:#fc8181,color:#fff
```

---

## Component Architecture

```mermaid
graph LR
    subgraph "Frontend Components"
        FC1[Page Components]
        FC2[Feature Components]
        FC3[UI Components]
        FC4[Hooks]
        FC5[Stores<br/>Zustand]
    end

    subgraph "Backend Modules"
        BC1[Routes<br/>v1 & v2]
        BC2[Services<br/>Business Logic]
        BC3[Repositories<br/>Data Access]
        BC4[Middleware]
        BC5[Utils]
    end

    FC1 --> FC2
    FC2 --> FC3
    FC2 --> FC4
    FC4 --> FC5

    BC1 --> BC2
    BC2 --> BC3
    BC1 --> BC4
    BC2 --> BC5

    style FC1 fill:#4c51bf,stroke:#a3bffa,color:#fff
    style BC1 fill:#2d3748,stroke:#cbd5e0,color:#fff
```

---

## Database Architecture

**Multi-User Security Model:**

- `shadowcheck_user` (Read-Only)
- `shadowcheck_admin` (Full Access)

**Materialized Views:**

- `api_network_explorer_mv` (fast queries)
- `threat_analysis_mv` (threat metrics)
- `analytics_summary_mv` (dashboard metrics)

---

## Project Structure

```
shadowcheck-static/
├── 📁 client/              # React/Vite frontend
│   ├── src/
│   │   ├── components/     # React components (.tsx)
│   │   ├── hooks/          # Custom React hooks
│   │   ├── stores/         # Zustand state management
│   │   ├── utils/          # Utility functions
│   │   └── types/          # TypeScript definitions
│   └── vite.config.ts      # Vite configuration
│
├── 📁 server/              # Express backend
│   ├── server.ts           # Main server entry
│   └── src/
│       ├── api/routes/     # REST API routes (v1 + v2)
│       ├── services/       # Business logic layer
│       ├── repositories/   # Data access layer
│       ├── middleware/     # Express middleware
│       └── utils/          # Server utilities
│
├── 📁 etl/                 # ETL pipeline
│   ├── 01_load/            # Data extraction
│   ├── 03_transform/       # Data transformation
│   └── 05_indexes/         # Index creation
│
├── 📁 scripts/             # Utility scripts
│   ├── import/             # Data import utilities
│   ├── geocoding/          # Geocoding scripts
│   ├── enrichment/         # Address enrichment
│   └── ml/                 # ML training scripts
│
├── 📁 sql/                 # Database
│   ├── functions/          # SQL functions
│   └── migrations/         # Schema migrations
│
└── 📁 docs/                # Documentation
    ├── architecture/       # System architecture
    ├── security/           # Security guides
    └── development/      # Development guides
```

---

## Data Flow

### Threat Detection Request Flow

```
User Request
↓
[Frontend] → GET /api/threats/quick?page=1&limit=100&minSeverity=40
↓
[Middleware] → Rate Limiting → CORS → Authentication
↓
[Route Handler] → Parse & Validate Query Params
↓
[Threat Service] → Calculate Threat Scores
↓
[Repository Layer] → Query Database (CTEs)
↓
[PostgreSQL] → Execute Query with PostGIS Distance Calculations
↓
[Repository Layer] → Map DB Results to Domain Models
↓
[Threat Service] → Apply Pagination & Filtering
↓
[Route Handler] → Format Response
↓
[Frontend] → Render Threat Table
```

### Enrichment Data Flow

```
[WiGLE CSV Import] → Import Script
↓
[PostgreSQL] → app.wigle_networks_enriched
↓
[Enrichment System] → Multi-API Venue Lookup
├─→ [LocationIQ API] → Conflict Resolution
├─→ [OpenCage API] → Voting System
├─→ [Overpass API] → Best Match Selection
└─→ [Nominatim API] → Gap Filling
↓
[PostgreSQL] → app.ap_addresses (venue names, categories)
↓
[Frontend] → Display Enriched Network Data
```

---

## Technology Stack

**Backend:**

- Node.js 20+ (TypeScript)
- Express.js REST API
- PostgreSQL 18 + PostGIS 3.6
- Winston structured logging

**Frontend:**

- React 19 (TypeScript)
- Vite build system
- Tailwind CSS v4
- Mapbox GL JS / Deck.gl
- Zustand state management

**Infrastructure:**

- Docker + Docker Compose
- Jest testing framework
- GitHub Actions CI/CD

---

## Scalability Considerations

### Current Limitations

- Single PostgreSQL instance (no read replicas)
- Connection pool: 20 max connections
- Single-threaded Node.js (no horizontal scaling)

### Scaling Path

**Short-Term (0-100K users)**

- Nginx load balancer
- Multiple API instances
- PostgreSQL read replicas

**Medium-Term (100K-1M users)**

- Redis caching layer
- CDN for static assets
- API rate limiting per user

**Long-Term (1M+ users)**

- Microservices architecture
- Event-driven architecture (Kafka)
- TimescaleDB for time-series data

---

## Related Documentation

- [API Reference](API-Reference) - Complete REST API documentation
- [Development Guide](Development) - Development setup and workflows
- [Database](Database) - Schema and query reference
- [Security](Security) - Security architecture and best practices

sequenceDiagram
participant U as User Browser
participant F as Frontend
participant API as Express API
participant S as Service Layer
participant R as Repository
participant DB as PostgreSQL
participant Cache as Redis

    U->>F: Load Dashboard
    F->>API: GET /api/dashboard-metrics
    API->>Cache: Check cache

    alt Cache Hit
        Cache-->>API: Return cached data
    else Cache Miss
        API->>S: getDashboardMetrics()
        S->>R: Query repositories
        R->>DB: Execute SQL
        DB-->>R: Return results
        R-->>S: Formatted data
        S-->>API: Metrics object
        API->>Cache: Store in cache (5min TTL)
    end

    API-->>F: JSON response
    F-->>U: Render dashboard

````

---

## Request Flow

```mermaid
flowchart TD
    A[HTTP Request] --> B{Rate Limit Check}
    B -->|Exceeded| C[429 Too Many Requests]
    B -->|OK| D{Auth Required?}
    D -->|Yes| E{Valid Session?}
    E -->|No| F[401 Unauthorized]
    E -->|Yes| G[Route Handler]
    D -->|No| G
    G --> H[Service Layer]
    H --> I[Repository Layer]
    I --> J{Cache Available?}
    J -->|Yes| K[Return Cached]
    J -->|No| L[Query Database]
    L --> M[Cache Result]
    M --> N[Return Response]
    K --> N
    N --> O[200 OK]

    style A fill:#4299e1,stroke:#2b6cb0,color:#fff
    style O fill:#48bb78,stroke:#2f855a,color:#fff
    style C fill:#f56565,stroke:#c53030,color:#fff
    style F fill:#f56565,stroke:#c53030,color:#fff
````

---

## Database Schema Overview

```mermaid
erDiagram
    NETWORKS ||--o{ OBSERVATIONS : has
    NETWORKS ||--o{ NETWORK_TAGS : has
    NETWORKS ||--o{ NETWORK_NOTES : has
    NETWORKS ||--o{ NETWORK_MEDIA : has
    NETWORKS ||--o{ SSID_HISTORY : has
    NETWORKS ||--o{ NETWORK_THREAT_SCORES : has

    NETWORKS {
        string bssid PK
        string ssid
        string type
        string manufacturer
        timestamp first_seen
        timestamp last_seen
        integer observation_count
        float threat_score
    }

    OBSERVATIONS {
        bigint id PK
        string bssid FK
        geometry location
        integer signal
        integer channel
        integer frequency
        timestamp observed_at
    }

    NETWORK_TAGS {
        bigint id PK
        string bssid FK
        string tag
        boolean is_threat
        float confidence
        timestamp tagged_at
    }

    NETWORK_NOTES {
        bigint id PK
        string bssid FK
        text note
        timestamp created_at
    }

    NETWORK_MEDIA {
        bigint id PK
        string bssid FK
        string media_type
        string file_path
        timestamp captured_at
    }

    SSID_HISTORY {
        bigint id PK
        string bssid FK
        string ssid
        timestamp first_seen
        timestamp last_seen
    }

    NETWORK_THREAT_SCORES {
        bigint id PK
        string bssid FK
        float rule_score
        float ml_score
        float combined_score
        timestamp calculated_at
    }

    LOCATION_MARKERS ||--o{ NETWORKS : "distance from"
    LOCATION_MARKERS {
        bigint id PK
        string name
        geometry location
        boolean is_home
        float radius_km
    }

    WIGLE_V3_OBSERVATIONS ||--o{ NETWORKS : enriches
    WIGLE_V3_OBSERVATIONS {
        bigint id PK
        string bssid FK
        geometry location
        string source
        timestamp fetched_at
    }

    WIGLE_V3_NETWORK_DETAILS ||--o{ NETWORKS : enriches
    WIGLE_V3_NETWORK_DETAILS {
        bigint id PK
        string bssid FK
        string ssid
        string encryption
        timestamp last_update
    }

    AGENCY_OFFICES {
        bigint id PK
        string name
        string office_type
        geometry location
        string address
        string phone
    }

    USERS ||--o{ USER_SESSIONS : has
    USERS ||--o{ NETWORK_TAGS : creates
    USERS {
        bigint id PK
        string username
        string password_hash
        string role
        timestamp created_at
    }

    USER_SESSIONS {
        string session_id PK
        bigint user_id FK
        timestamp expires_at
    }

    ML_MODEL_METADATA ||--o{ ML_TRAINING_HISTORY : has
    ML_MODEL_METADATA {
        bigint id PK
        string model_type
        float accuracy
        float precision
        float recall
        timestamp trained_at
    }

    ML_TRAINING_HISTORY {
        bigint id PK
        bigint model_id FK
        integer training_samples
        json hyperparameters
        timestamp trained_at
    }

    RADIO_MANUFACTURERS {
        bigint id PK
        string oui_prefix
        string manufacturer
    }

    GEOCODING_CACHE {
        bigint id PK
        geometry location
        string address
        string venue_name
        timestamp cached_at
    }

    ROUTES {
        bigint id PK
        string name
        geometry path
        timestamp recorded_at
    }

    SETTINGS {
        string key PK
        string value
        timestamp updated_at
    }
```

---

## ETL Pipeline Flow

```mermaid
flowchart LR
    A[Raw Data<br/>SQLite/CSV] --> B[01_load<br/>Staging Tables]
    B --> C[02_transform<br/>Normalize & Clean]
    C --> D[03_promote<br/>Production Tables]
    D --> E[04_indexes<br/>Create Indexes]
    E --> F[05_materialized_views<br/>Refresh Views]
    F --> G[Production Ready]

    B -.->|UNLOGGED| H[(Staging DB)]
    D -.->|LOGGED| I[(Production DB)]

    style A fill:#4a5568,stroke:#cbd5e0,color:#fff
    style G fill:#48bb78,stroke:#2f855a,color:#fff
    style H fill:#ed8936,stroke:#c05621,color:#fff
    style I fill:#4299e1,stroke:#2b6cb0,color:#fff
```

---

## Machine Learning Pipeline

```mermaid
flowchart TD
    A[Tagged Networks<br/>Training Data] --> B{Sufficient Data?<br/>>10 samples}
    B -->|No| C[Return Error]
    B -->|Yes| D[Feature Extraction]
    D --> E[Split Train/Test<br/>80/20]
    E --> F[Train Models]

    F --> G[Logistic Regression]
    F --> H[Random Forest]
    F --> I[Gradient Boosting]

    G --> J[Cross Validation]
    H --> J
    I --> J

    J --> K[Hyperparameter<br/>Grid Search]
    K --> L[Select Best Model]
    L --> M[Evaluate Metrics]
    M --> N{Accuracy > 0.8?}
    N -->|Yes| O[Deploy Model]
    N -->|No| P[Retrain with<br/>More Data]

    O --> Q[Score All Networks]
    Q --> R[Update ml_score<br/>in Database]

    style A fill:#4a5568,stroke:#cbd5e0,color:#fff
    style O fill:#48bb78,stroke:#2f855a,color:#fff
    style C fill:#f56565,stroke:#c53030,color:#fff
    style P fill:#ed8936,stroke:#c05621,color:#fff
```

---

## Security Architecture

```mermaid
graph TB
    subgraph "Security Layers"
        A[HTTPS/TLS<br/>Reverse Proxy]
        B[Rate Limiting<br/>Redis-backed]
        C[Security Headers<br/>CSP, HSTS, etc.]
        D[Session Management<br/>Redis Store]
        E[Role-Based Access<br/>Admin/User]
        F[SQL Injection Prevention<br/>Parameterized Queries]
        G[Secrets Management<br/>AWS Secrets Manager]
    end

    H[Client Request] --> A
    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G
    G --> I[Application Logic]

    style A fill:#2c5282,stroke:#90cdf4,color:#fff
    style G fill:#742a2a,stroke:#fc8181,color:#fff
```

---

## Deployment Architecture

### Local Development

```mermaid
graph LR
    A[Developer] --> B[npm run dev]
    B --> C[Vite Dev Server<br/>:5173]
    B --> D[Node Server<br/>:3001]
    D --> E[(PostgreSQL<br/>:5432)]
    D --> F[(Redis<br/>:6379)]

    style C fill:#646cff,stroke:#535bf2,color:#fff
    style D fill:#68a063,stroke:#3c873a,color:#fff
```

### Docker Deployment

```mermaid
graph TB
    A[docker-compose up] --> B[shadowcheck-app<br/>Container]
    A --> C[shadowcheck-postgres<br/>Container]
    A --> D[shadowcheck-redis<br/>Container]
    A --> E[pgadmin<br/>Container]

    B --> C
    B --> D
    E --> C

    B -->|Port 3001| F[Host Network]
    E -->|Port 5050| F

    style B fill:#2496ed,stroke:#1d7fc1,color:#fff
    style C fill:#336791,stroke:#2d5a7b,color:#fff
    style D fill:#d82c20,stroke:#a41e11,color:#fff
```

### AWS Production

```mermaid
graph TB
    A[Route 53<br/>DNS] --> B[ALB<br/>Load Balancer]
    B --> C[EC2 Instance<br/>Spot/On-Demand]
    C --> D[Docker Containers]
    D --> E[App Container]
    D --> F[PostgreSQL Container]
    D --> G[Redis Container]

    C --> H[EBS Volume<br/>Database Storage]
    C --> I[CloudWatch<br/>Logs & Metrics]

    J[S3 Bucket] -.->|Backups| F
    K[Systems Manager] -.->|Session Manager| C

    style B fill:#ff9900,stroke:#ec7211,color:#fff
    style C fill:#ff9900,stroke:#ec7211,color:#fff
    style J fill:#569a31,stroke:#3d6e23,color:#fff
```

---

## Technology Stack Details

### Frontend Stack

| Technology   | Version | Purpose          |
| ------------ | ------- | ---------------- |
| React        | 19.x    | UI framework     |
| TypeScript   | 5.x     | Type safety      |
| Vite         | 7.x     | Build tool       |
| Tailwind CSS | 4.x     | Styling          |
| Mapbox GL JS | 3.x     | Mapping          |
| Zustand      | 5.x     | State management |

### Backend Stack

| Technology | Version | Purpose          |
| ---------- | ------- | ---------------- |
| Node.js    | 20+     | Runtime          |
| Express    | 4.x     | Web framework    |
| PostgreSQL | 18+     | Database         |
| PostGIS    | 3.6+    | Geospatial       |
| Redis      | 4+      | Cache & sessions |
| Winston    | 3.x     | Logging          |
| Jest       | 30.x    | Testing          |
| Winston    | 3.x     | Logging          |
| Jest       | 29.x    | Testing          |

---

## Performance Optimizations

### Caching Strategy

```mermaid
flowchart LR
    A[Request] --> B{Cache Key Exists?}
    B -->|Yes| C[Return Cached<br/>TTL: 5min]
    B -->|No| D[Query Database]
    D --> E[Store in Redis]
    E --> F[Return Fresh Data]

    G[Background Job] -.->|Every 5min| H[Refresh Cache]

    style C fill:#48bb78,stroke:#2f855a,color:#fff
    style D fill:#ed8936,stroke:#c05621,color:#fff
```

### Database Optimizations

- **Materialized Views**: Pre-computed threat intelligence
- **Spatial Indexes**: GiST indexes on geometry columns
- **Partial Indexes**: Filtered indexes for common queries
- **Connection Pooling**: Reuse database connections
- **UNLOGGED Tables**: Fast staging table inserts

---

## Monitoring & Observability

```mermaid
graph TB
    A[Application] --> B[Winston Logger]
    B --> C[Console Output]
    B --> D[File Logs]
    B --> E[CloudWatch Logs]

    A --> F[Metrics Collection]
    F --> G[Request Duration]
    F --> H[Error Rates]
    F --> I[Cache Hit Ratio]

    G --> J[CloudWatch Metrics]
    H --> J
    I --> J

    J --> K[Alarms & Alerts]

    style A fill:#4a5568,stroke:#cbd5e0,color:#fff
    style K fill:#f56565,stroke:#c53030,color:#fff
```

---

## Scalability Considerations

### Horizontal Scaling

- **Stateless API**: Session data in Redis allows multiple instances
- **Load Balancer**: Distribute traffic across instances
- **Database Read Replicas**: Separate read/write workloads

### Vertical Scaling

- **Connection Pooling**: Optimize database connections
- **Redis Clustering**: Distribute cache across nodes
- **CDN Integration**: Serve static assets from edge locations

---

_Last Updated: 2026-02-07_
