# Deployment Guide

**Docs version (repo):** [docs/DEPLOYMENT.md](../../docs/DEPLOYMENT.md)

> **Complete deployment workflows for all environments**

---

## Deployment Options

ShadowCheck supports three primary deployment scenarios:

1. **Local Development** - Quick setup for development
2. **Docker Compose** - Containerized local/home lab deployment
3. **AWS Production** - Scalable cloud deployment

---

## Deployment Decision Tree

```mermaid
flowchart TD
    A[Choose Deployment] --> B{Environment?}

    B -->|Development| C[Local Setup]
    B -->|Home Lab| D[Docker Compose]
    B -->|Production| E[AWS Cloud]

    C --> C1[npm install]
    C1 --> C2[Dockerized PostgreSQL / Redis]
    C2 --> C3[npm run dev]

    D --> D1[docker-compose.yml]
    D1 --> D2[Docker containers]
    D2 --> D3[Persistent volumes]
    D3 --> D4[docker-compose up]

    E --> E1[Launch EC2]
    E1 --> E2[Setup script]
    E2 --> E3[Docker deployment]
    E3 --> E4[Grafana monitoring]

    style C4 fill:#48bb78,stroke:#2f855a,color:#fff
    style D4 fill:#48bb78,stroke:#2f855a,color:#fff
    style E4 fill:#48bb78,stroke:#2f855a,color:#fff
```

---

## Local Development Setup

### Prerequisites

- Node.js 22+
- PostgreSQL 18+
- Redis 7+
- Git

### Setup Flow

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant Git as Git Repo
    participant NPM as npm
    participant DB as PostgreSQL
    participant Redis as Redis
    participant App as Application

    Dev->>Git: git clone
    Git-->>Dev: Repository

    Dev->>NPM: npm install
    NPM-->>Dev: Dependencies installed

    Dev->>DB: Create database
    Dev->>DB: Run migrations
    DB-->>Dev: Schema ready

    Dev->>Redis: Start Redis server
    Redis-->>Dev: Ready

    Dev->>App: npm run dev
    App-->>Dev: Server running :3001
```

### Quick Start Commands

```bash
# Clone repository
git clone https://github.com/cyclonite69/shadowcheck-web.git
cd shadowcheck-web

# Install dependencies
npm install

# Start supporting services
docker compose up -d

# Configure environment
# Secrets policy: do not create local .env files with credentials; use AWS Secrets Manager or explicit env-var overrides

# Start development server
npm run dev
```

---

## Docker Compose Deployment

### Architecture

```mermaid
graph TB
    subgraph "Docker Network: shadowcheck-network"
        A[shadowcheck-app<br/>Node.js App<br/>Port 3001]
        B[postgres<br/>PostgreSQL 18<br/>Port 5432]
        C[shadowcheck-redis<br/>Redis 7<br/>Port 6379]
        D[pgadmin<br/>pgAdmin 4<br/>Port 5050]
        I[shadowcheck-grafana<br/>Grafana<br/>Port 3002]
    end

    E[Host Machine] --> A
    E --> D
    E --> I

    A --> B
    A --> C
    D --> B
    I --> B

    F[Volume: postgres-data] -.-> B
    G[Volume: redis-data] -.-> C
    H[Volume: pgadmin-data] -.-> D

    style A fill:#2496ed,stroke:#1d7fc1,color:#fff
    style B fill:#336791,stroke:#2d5a7b,color:#fff
    style C fill:#d82c20,stroke:#a41e11,color:#fff
    style D fill:#336791,stroke:#2d5a7b,color:#fff
```

### Deployment Flow

```mermaid
flowchart LR
    A[docker-compose.yml] --> B[Pull Images]
    B --> C[Create Network]
    C --> D[Create Volumes]
    D --> E[Start PostgreSQL]
    E --> F[Start Redis]
    F --> G[Start App]
    G --> H[Start pgAdmin]
    H --> I[Health Checks]
    I --> J{All Healthy?}
    J -->|Yes| K[Deployment Complete]
    J -->|No| L[Check Logs]

    style K fill:#48bb78,stroke:#2f855a,color:#fff
    style L fill:#f56565,stroke:#c53030,color:#fff
```

### Commands

```bash
# Start all services
docker compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild after changes
docker compose up -d --build

# Access pgAdmin
# http://localhost:5050
# Email: admin@shadowcheck.local
# Password: admin
```

### Volume Management

```mermaid
graph LR
    A[Docker Volumes] --> B[postgres-data<br/>Database files]
    A --> C[redis-data<br/>Cache & sessions]
    A --> D[pgadmin-data<br/>pgAdmin config]

    B -.->|Backup| E[Host: backups/]
    C -.->|Persist| F[Host: redis-dump.rdb]
    D -.->|Config| G[Host: pgadmin/]

    style B fill:#4299e1,stroke:#2b6cb0,color:#fff
    style C fill:#f56565,stroke:#c53030,color:#fff
```

---

## AWS Production Deployment

### Infrastructure Overview

```mermaid
graph TB
    subgraph "AWS Cloud"
        A[Route 53<br/>DNS]
        B[Application Load Balancer<br/>HTTPS/TLS]
        C[EC2 Instance<br/>t3.medium Spot]
        D[EBS Volume<br/>50GB gp3]
        E[S3 Bucket<br/>Backups]
        F[CloudWatch<br/>Logs & Metrics]
        G[Systems Manager<br/>Session Manager]
        H[Secrets Manager<br/>Optional]
    end

    I[Users] --> A
    A --> B
    B --> C
    C --> D
    C --> E
    C --> F
    G --> C
    H -.-> C

    style C fill:#ff9900,stroke:#ec7211,color:#fff
    style E fill:#569a31,stroke:#3d6e23,color:#fff
```

### Deployment Workflow

```mermaid
flowchart TD
    A[Local Machine] --> B[Run launch script]
    B --> C[Create EC2 Instance]
    C --> D[Attach IAM Role]
    D --> E[Configure Security Groups]
    E --> F[Attach EBS Volume]

    F --> G[Connect via SSM]
    G --> H[Run setup script]

    H --> I[Install Docker]
    H --> J[Clone Repository]
    H --> K[Configure Environment]

    I --> L[docker-compose up]
    J --> L
    K --> L

    L --> M[Health Check]
    M --> N{Healthy?}
    N -->|Yes| O[Configure ALB]
    N -->|No| P[Check Logs]

    O --> Q[Update DNS]
    Q --> R[Production Ready]

    style R fill:#48bb78,stroke:#2f855a,color:#fff
    style P fill:#f56565,stroke:#c53030,color:#fff
```

### Launch Script Flow

```bash
# 1. Launch EC2 instance
./deploy/aws/scripts/launch-shadowcheck-spot.sh

# 2. Connect via SSM
aws ssm start-session --target INSTANCE_ID --region us-east-1

# 3. Run automated setup
bash
curl -fsSL https://raw.githubusercontent.com/cyclonite69/shadowcheck-web/master/deploy/aws/scripts/setup-instance.sh | sudo bash

# 4. Deploy application
cd /home/ssm-user/shadowcheck
./deploy/aws/scripts/deploy-complete.sh
```

### Update Workflow

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant Git as GitHub
    participant EC2 as EC2 Instance
    participant Docker as Docker
    participant App as Application

    Dev->>Git: git push origin master
    Git-->>Dev: Push successful

    Dev->>EC2: SSH/SSM connect
    EC2->>Git: git pull origin master
    Git-->>EC2: Latest code

    EC2->>Docker: docker-compose down
    EC2->>Docker: docker-compose build
    EC2->>Docker: docker compose up -d

    Docker->>App: Start containers
    App-->>Docker: Health check OK
    Docker-->>EC2: Deployment complete
    EC2-->>Dev: Success
```

---

## Environment Configuration

### Configuration Hierarchy

```mermaid
flowchart LR
    A[Environment Variables] --> B{Source}

    B -->|Development| C[.env file]
    B -->|Docker| D[docker-compose.yml]
    B -->|AWS| E[EC2 User Data]

    C --> F[Application]
    D --> F
    E --> F

    F --> G[Runtime Config]

    style F fill:#4a5568,stroke:#cbd5e0,color:#fff
```

### Required Variables

| Variable      | Development      | Docker            | AWS               |
| ------------- | ---------------- | ----------------- | ----------------- |
| `DB_HOST`     | `postgres`       | `postgres`        | `postgres`        |
| `DB_PORT`     | 5432             | 5432              | 5432              |
| `DB_NAME`     | shadowcheck_db   | shadowcheck_db    | shadowcheck_db    |
| `DB_USER`     | shadowcheck_user | shadowcheck_user  | shadowcheck_user  |
| `DB_PASSWORD` | ⚠️ Required      | ⚠️ Required       | ⚠️ Required       |
| `REDIS_HOST`  | localhost        | shadowcheck-redis | shadowcheck-redis |
| `REDIS_PORT`  | 6379             | 6379              | 6379              |
| `PORT`        | 3001             | 3001              | 3001              |
| `NODE_ENV`    | development      | production        | production        |

---

## Database Migration Strategy

```mermaid
flowchart TD
    A[New Deployment] --> B{Database Exists?}

    B -->|No| C[Create Database]
    B -->|Yes| D[Check Version]

    C --> E[Run All Migrations]
    D --> F{Up to Date?}

    F -->|No| G[Run Pending Migrations]
    F -->|Yes| H[Skip Migrations]

    E --> I[Verify Schema]
    G --> I
    H --> I

    I --> J{Schema Valid?}
    J -->|Yes| K[Start Application]
    J -->|No| L[Rollback & Fix]

    style K fill:#48bb78,stroke:#2f855a,color:#fff
    style L fill:#f56565,stroke:#c53030,color:#fff
```

### Migration Order

```bash
# 1. Core schema
psql -f sql/migrations/01_create_tables.sql

# 2. Functions
psql -f sql/functions/create_scoring_function.sql
psql -f sql/functions/fix_kismet_functions.sql

# 3. Triggers
psql -f sql/migrations/02_create_triggers.sql

# 4. Indexes
psql -f sql/migrations/03_create_indexes.sql

# 5. Security
psql -f sql/migrations/20260129_implement_db_security.sql

# 6. Materialized views
psql -f sql/migrations/04_create_materialized_views.sql
```

---

## Health Check & Monitoring

### Health Check Endpoints

```mermaid
flowchart LR
    A[Load Balancer] --> B[/health]
    B --> C{Check Database}
    C -->|OK| D{Check Redis}
    D -->|OK| E[200 OK]
    D -->|Fail| F[503 Service Unavailable]
    C -->|Fail| F

    style E fill:#48bb78,stroke:#2f855a,color:#fff
    style F fill:#f56565,stroke:#c53030,color:#fff
```

### Monitoring Stack

```mermaid
graph TB
    A[Application] --> B[Winston Logger]
    B --> C[CloudWatch Logs]

    A --> D[PostgreSQL]
    D --> E[Grafana Dashboards]

    E --> F[Tactical Overview]
    E --> G[Network Analytics]
    E --> H[System Performance]

    C --> I[Log Insights]

    style E fill:#4299e1,stroke:#2b6cb0,color:#fff
    style F fill:#48bb78,stroke:#2f855a,color:#fff
```

**Grafana Deployment:**

1.  **Launch Instance**: Use `docker compose -f docker-compose.monitoring.yml up -d` to start the monitoring stack.
2.  **Access**: Default port is `3002`.
3.  **Dashboards**: Tactical and system dashboards are pre-provisioned in `/grafana/dashboards/`.
4.  **Secrets**: Ensure `GRAFANA_ADMIN_PASSWORD` and `GRAFANA_READER_PASSWORD` are set in the environment.

---

---

## Backup & Disaster Recovery

### Backup Strategy

```mermaid
flowchart TD
    A[Scheduled Job<br/>Daily 2 AM] --> B[pg_dump]
    B --> C[Compress with gzip]
    C --> D[Upload to S3]
    D --> E[Verify Upload]
    E --> F{Success?}
    F -->|Yes| G[Delete Local Copy]
    F -->|No| H[Retry 3x]
    H --> I{Retry Success?}
    I -->|Yes| G
    I -->|No| J[Alert Admin]

    G --> K[Rotate Old Backups<br/>Keep 30 days]

    style G fill:#48bb78,stroke:#2f855a,color:#fff
    style J fill:#f56565,stroke:#c53030,color:#fff
```

### Restore Process

```mermaid
sequenceDiagram
    participant Admin as Administrator
    participant S3 as S3 Bucket
    participant EC2 as EC2 Instance
    participant DB as PostgreSQL

    Admin->>S3: Download backup
    S3-->>Admin: backup.sql.gz

    Admin->>EC2: Upload backup
    Admin->>EC2: Stop application

    EC2->>DB: Drop database
    EC2->>DB: Create database
    EC2->>DB: pg_restore backup.sql

    DB-->>EC2: Restore complete

    EC2->>EC2: Verify data integrity
    EC2->>EC2: Start application

    EC2-->>Admin: Restore successful
```

---

## Scaling Strategies

### Vertical Scaling

```mermaid
graph LR
    A[t3.small<br/>2 vCPU, 2GB] --> B[t3.medium<br/>2 vCPU, 4GB]
    B --> C[t3.large<br/>2 vCPU, 8GB]
    C --> D[t3.xlarge<br/>4 vCPU, 16GB]

    style A fill:#ed8936,stroke:#c05621,color:#fff
    style D fill:#48bb78,stroke:#2f855a,color:#fff
```

### Horizontal Scaling

```mermaid
graph TB
    A[Application Load Balancer] --> B[EC2 Instance 1]
    A --> C[EC2 Instance 2]
    A --> D[EC2 Instance 3]

    B --> E[(PostgreSQL<br/>Primary)]
    C --> E
    D --> E

    E --> F[(PostgreSQL<br/>Read Replica)]

    B --> G[(Redis Cluster)]
    C --> G
    D --> G

    style A fill:#ff9900,stroke:#ec7211,color:#fff
    style E fill:#4299e1,stroke:#2b6cb0,color:#fff
```

---

## Troubleshooting

### Common Issues

```mermaid
flowchart TD
    A[Deployment Issue] --> B{Symptom?}

    B -->|Container Won't Start| C[Check Logs]
    B -->|Database Connection| D[Check Credentials]
    B -->|Redis Connection| E[Check Redis Status]
    B -->|Port Conflict| F[Check Port Usage]

    C --> G[docker-compose logs]
    D --> H[Verify .env file]
    E --> I[redis-cli ping]
    F --> J[netstat -tulpn]

    G --> K[Fix & Restart]
    H --> K
    I --> K
    J --> K

    style K fill:#48bb78,stroke:#2f855a,color:#fff
```

---

## Security Checklist

- [ ] Change default passwords
- [ ] Enable HTTPS/TLS
- [ ] Configure firewall rules
- [ ] Enable CloudWatch logging
- [ ] Setup automated backups
- [ ] Rotate credentials every 90 days
- [ ] Enable MFA for AWS console
- [ ] Review security groups
- [ ] Enable encryption at rest
- [ ] Configure rate limiting

---

_Last Updated: 2026-02-07_
