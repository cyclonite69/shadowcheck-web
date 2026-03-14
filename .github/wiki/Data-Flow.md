# Data Flow

**Docs references (repo):** [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md), [docs/FEATURES.md](../../docs/FEATURES.md)

> **Complete data flow diagrams for ShadowCheck platform**

---

## Overview

This page documents how data flows through the ShadowCheck system, from ingestion to visualization.

---

## Complete Data Flow

```mermaid
flowchart TB
    subgraph "Data Sources"
        A1[Kismet SQLite]
        A2[WiGLE CSV]
        A3[Manual Imports]
    end

    subgraph "ETL Pipeline"
        B1[Load Stage<br/>UNLOGGED Tables]
        B2[Transform<br/>Normalize & Clean]
        B3[Promote<br/>Production Tables]
        B4[Index Creation]
        B5[Materialized Views]
    end

    subgraph "Database Layer"
        C1[(app.networks)]
        C2[(app.observations)]
        C3[(app.network_tags)]
        C4[(app.location_markers)]
        C5[Materialized Views]
    end

    subgraph "Application Layer"
        D1[Repository Layer]
        D2[Service Layer]
        D3[API Routes]
    end

    subgraph "Cache Layer"
        E1[(Redis Cache)]
        E2[Session Store]
        E3[Rate Limiter]
    end

    subgraph "Client Layer"
        F1[Dashboard]
        F2[Geospatial Intel]
        F3[Analytics]
        F4[ML Training]
    end

    A1 --> B1
    A2 --> B1
    A3 --> B1

    B1 --> B2
    B2 --> B3
    B3 --> B4
    B4 --> B5

    B5 --> C1
    B5 --> C2
    B5 --> C3
    B5 --> C4
    B5 --> C5

    C1 --> D1
    C2 --> D1
    C3 --> D1
    C4 --> D1
    C5 --> D1

    D1 --> D2
    D2 --> D3

    D2 -.->|Cache| E1
    D3 -.->|Sessions| E2
    D3 -.->|Rate Limit| E3

    D3 --> F1
    D3 --> F2
    D3 --> F3
    D3 --> F4

    style B1 fill:#ed8936,stroke:#c05621,color:#fff
    style C1 fill:#4299e1,stroke:#2b6cb0,color:#fff
    style E1 fill:#f56565,stroke:#c53030,color:#fff
    style F1 fill:#48bb78,stroke:#2f855a,color:#fff
```

---

## Network Data Flow

````mermaid
sequenceDiagram
    participant Import as Import Script
    participant Staging as Staging Tables
    participant Transform as Transform Logic
    participant Prod as Production Tables
    participant API as API Layer
    participant Client as Frontend

    Import->>Staging: Bulk INSERT (UNLOGGED)
    Note over Staging: Fast writes, no WAL

    Staging->>Transform: Normalize data
    Transform->>Transform: Clean duplicates
    Transform->>Transform: Calculate threat scores
    Transform->>Transform: Enrich manufacturer

    Transform->>Prod: INSERT INTO app.networks
    Transform->>Prod: INSERT INTO app.observations

    Note over Prod: LOGGED tables with indexes

    Prod->>Prod: Trigger: update_network_stats
    Prod->>Prod: Trigger: calculate_threat_score

    Client->>API: GET /api/networks
    API->>Prod: SELECT with filters
    Prod-->>API: Result set
    API-->>Client: JSON response
    ```

    ---

    ## Threat Detection Flow

    ...
    _Last Updated: 2026-03-14_
    A[Network Observation] --> B[Calculate Features]

    B --> C1[Observation Count]
    B --> C2[Unique Days Seen]
    B --> C3[Geographic Spread]
    B --> C4[Signal Strength]
    B --> C5[Distance from Home]
    B --> C6[Behavioral Flags]

    C1 --> D[Rule-Based Scoring]
    C2 --> D
    C3 --> D
    C4 --> D
    C5 --> D
    C6 --> D

    D --> E{ML Model Available?}

    E -->|Yes| F[ML Prediction]
    E -->|No| G[Rule Score Only]

    F --> H[Combine Scores]
    G --> H

    H --> I[Final Threat Score<br/>0-100]

    I --> J{Score > 70?}
    J -->|Yes| K[High Threat]
    J -->|No| L{Score > 40?}
    L -->|Yes| M[Medium Threat]
    L -->|No| N[Low/No Threat]

    style K fill:#f56565,stroke:#c53030,color:#fff
    style M fill:#ed8936,stroke:#c05621,color:#fff
    style N fill:#48bb78,stroke:#2f855a,color:#fff
````

---

## Filter Application Flow

```mermaid
flowchart LR
    A[User Input] --> B[Filter State<br/>Zustand Store]
    B --> C[Debounce<br/>500ms]
    C --> D[Build Query Params]
    D --> E[API Request]
    E --> F[Backend Parser]

    F --> G1[Temporal Filters]
    F --> G2[Spatial Filters]
    F --> G3[Signal Filters]
    F --> G4[Tag Filters]

    G1 --> H[Build SQL WHERE]
    G2 --> H
    G3 --> H
    G4 --> H

    H --> I[Execute Query]
    I --> J[Return Results]
    J --> K[Update UI]

    B -.->|Sync| L[URL Query String]

    style A fill:#4a5568,stroke:#cbd5e0,color:#fff
    style K fill:#48bb78,stroke:#2f855a,color:#fff
```

---

## Caching Flow

```mermaid
flowchart TD
    A[API Request] --> B{Check Redis Cache}

    B -->|Hit| C[Return Cached Data]
    B -->|Miss| D[Query Database]

    D --> E[Process Results]
    E --> F[Store in Redis<br/>TTL: 5min]
    F --> G[Return Fresh Data]

    H[Background Job<br/>Every 5min] --> I{Cache Expired?}
    I -->|Yes| J[Refresh Cache]
    I -->|No| K[Skip]

    J --> D

    style C fill:#48bb78,stroke:#2f855a,color:#fff
    style D fill:#ed8936,stroke:#c05621,color:#fff
```

---

## ML Training Flow

```mermaid
sequenceDiagram
    participant User as Admin User
    participant API as ML API
    participant Service as ML Service
    participant DB as Database
    participant Model as ML Model

    User->>API: POST /api/ml/train
    API->>Service: trainModel()

    Service->>DB: Fetch tagged networks
    DB-->>Service: Training data

    Service->>Service: Validate data (>10 samples)

    Service->>Service: Extract features
    Service->>Service: Split train/test (80/20)

    Service->>Model: Train Logistic Regression
    Service->>Model: Train Random Forest
    Service->>Model: Train Gradient Boosting

    Model-->>Service: Model metrics

    Service->>Service: Cross-validation
    Service->>Service: Grid search
    Service->>Service: Select best model

    Service->>DB: Score all networks
    DB-->>Service: Updated scores

    Service-->>API: Training results
    API-->>User: Success + metrics
```

---

## Geospatial Query Flow

```mermaid
flowchart TD
    A[Map Interaction] --> B{Query Type}

    B -->|Bounding Box| C[Extract Bounds]
    B -->|Radius| D[Extract Center + Radius]
    B -->|Point| E[Extract Coordinates]

    C --> F[Build PostGIS Query]
    D --> F
    E --> F

    F --> G[ST_Within / ST_DWithin]
    G --> H[Spatial Index Scan<br/>GiST]

    H --> I[Filter Results]
    I --> J[Transform to GeoJSON]
    J --> K[Return to Client]
    K --> L[Render on Map]

    style H fill:#4299e1,stroke:#2b6cb0,color:#fff
    style L fill:#48bb78,stroke:#2f855a,color:#fff
```

---

## Analytics Aggregation Flow

```mermaid
flowchart LR
    A[Analytics Request] --> B{Cache Available?}

    B -->|Yes| C[Return Cached]
    B -->|No| D[Query Database]

    D --> E[Temporal Aggregation]
    D --> F[Signal Distribution]
    D --> G[Threat Trends]

    E --> H[GROUP BY time_bucket]
    F --> H
    G --> H

    H --> I[Calculate Stats]
    I --> J[Format Response]
    J --> K[Cache Result<br/>TTL: 5min]
    K --> L[Return to Client]

    C --> L

    style C fill:#48bb78,stroke:#2f855a,color:#fff
    style D fill:#ed8936,stroke:#c05621,color:#fff
```

---

## Authentication Flow

```mermaid
sequenceDiagram
    participant User as User Browser
    participant API as Express API
    participant Session as Redis Session
    participant DB as PostgreSQL

    User->>API: POST /api/auth/login
    API->>DB: Verify credentials

    alt Valid Credentials
        DB-->>API: User data
        API->>Session: Create session
        Session-->>API: Session ID
        API-->>User: Set-Cookie + user data
    else Invalid Credentials
        DB-->>API: No match
        API-->>User: 401 Unauthorized
    end

    User->>API: GET /api/admin/backup
    API->>Session: Validate session

    alt Valid Session
        Session-->>API: User data
        API->>API: Check admin role
        alt Is Admin
            API-->>User: 200 OK + data
        else Not Admin
            API-->>User: 403 Forbidden
        end
    else Invalid Session
        Session-->>API: No session
        API-->>User: 401 Unauthorized
    end
```

---

## Export Flow

```mermaid
flowchart TD
    A[Export Request] --> B[Apply Filters]
    B --> C[Query Database]
    C --> D{Export Format}

    D -->|CSV| E[Generate CSV]
    D -->|JSON| F[Generate JSON]
    D -->|GeoJSON| G[Generate GeoJSON]

    E --> H[Stream Response]
    F --> H
    G --> H

    H --> I[Set Headers<br/>Content-Disposition]
    I --> J[Send File]
    J --> K[Browser Download]

    style K fill:#48bb78,stroke:#2f855a,color:#fff
```

---

## Weather FX Data Flow

```mermaid
sequenceDiagram
    participant Map as Map Component
    participant API as Backend API
    participant OpenMeteo as Open-Meteo API
    participant FX as Weather FX Engine

    Map->>Map: Get map center coords
    Map->>API: GET /api/weather?lat=X&lon=Y
    API->>OpenMeteo: Fetch current weather
    OpenMeteo-->>API: Weather data
    API-->>Map: Proxy response

    Map->>FX: Update weather state

    alt Rain Detected
        FX->>FX: Initialize rain particles
        FX->>FX: Render vertical streaks
    else Snow Detected
        FX->>FX: Initialize snow particles
        FX->>FX: Render sinusoidal drift
    else Clear
        FX->>FX: Clear particles
        FX->>FX: Adjust fog opacity
    end

    FX->>Map: Update canvas overlay
```

---

## Backup & Restore Flow

```mermaid
flowchart LR
    A[Admin Request] --> B{Operation}

    B -->|Backup| C[pg_dump]
    B -->|Restore| D[pg_restore]

    C --> E[Compress with gzip]
    E --> F[Store in backups/]
    F --> G[Return file path]

    D --> H[Decompress]
    H --> I[Validate schema]
    I --> J[Restore to DB]
    J --> K[Verify integrity]
    K --> L[Return success]

    style G fill:#48bb78,stroke:#2f855a,color:#fff
    style L fill:#48bb78,stroke:#2f855a,color:#fff
```

---

## Real-Time Update Flow

```mermaid
flowchart TD
    A[New Observation] --> B[INSERT INTO observations]
    B --> C[Trigger: update_network_stats]

    C --> D[Update networks.last_seen]
    C --> E[Update networks.observation_count]
    C --> F[Recalculate threat_score]

    F --> G{Score Changed?}
    G -->|Yes| H[Invalidate Cache]
    G -->|No| I[Skip]

    H --> J[Next API Request]
    J --> K[Fresh Data]

    style K fill:#48bb78,stroke:#2f855a,color:#fff
```

---

_Last Updated: 2026-02-07_
