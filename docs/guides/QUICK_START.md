# ShadowCheck Quick Start Guide

Welcome to ShadowCheck! This guide will help you get up and running with the SIGINT Forensics platform.

## 🚀 Installation

### 1. Prerequisites

- **Node.js**: v20 or newer
- **PostgreSQL**: v18 or newer with **PostGIS** extension

### 2. Setup Database

Create the database and set up secure users:

```sql
-- Create Users
CREATE ROLE shadowcheck_user WITH LOGIN PASSWORD 'user_password';
CREATE ROLE shadowcheck_admin WITH LOGIN PASSWORD 'admin_password';

-- Create Database
CREATE DATABASE shadowcheck_db OWNER shadowcheck_admin;
\c shadowcheck_db
CREATE EXTENSION postgis;
```

### 3. Clone and Install

```bash
git clone https://github.com/your-username/shadowcheck-static.git
cd shadowcheck-static
npm install
```

### 4. Configuration

Create a `.env` file in the root directory:

```env
DB_USER=shadowcheck_user
DB_ADMIN_USER=shadowcheck_admin
DB_HOST=localhost
DB_NAME=shadowcheck_db
PORT=3001
```

Set your passwords in the system keyring:

```bash
node scripts/set-secret.js db_password "user_password"
node scripts/set-secret.js db_admin_password "admin_password"
node scripts/set-secret.js mapbox_token "your_mapbox_pk_here"
```

### 5. Run Migrations

```bash
# General application schema
psql -U shadowcheck_admin -d shadowcheck_db -f sql/functions/create_scoring_function.sql
# ... run remaining migrations in sql/migrations/

# Apply security policy
psql -U shadowcheck_admin -d shadowcheck_db -f sql/migrations/20260129_implement_db_security.sql
```

## 🛠️ Running the App

### Development Mode

Runs the backend with nodemon and frontend with Vite HMR.

```bash
npm run dev
```

### Production Build

```bash
npm run build
npm start
```

## 🛡️ Security & Roles

ShadowCheck uses **Role-Based Access Control (RBAC)**:

- **User Role**: Standard access to Dashboard, Geospatial, and Analytics.
- **Admin Role**: Full access including the `/admin` panel, database imports, and network tagging.

**Note**: Non-admin users will see "Access Denied" on administrative pages and restricted options in map context menus.

## 📍 Key Features

### 1. Unified Network Tooltips

Rich, threat-color-coded tooltips are available on all maps. Click any observation point or network marker to see:

- Threat Score & Level
- Signal Strength (dBm) & Frequency
- Proximity to Home (Delta/Delta-Last)
- Sighting Timeline (First/Last Seen)

### 2. Universal Filters

The sidebar on mapping and analytics pages allows filtering the entire dataset by:

- Radio Type (WiFi, BLE, Cellular)
- Threat Severity
- Signal Strength Range
- Timeframe & Date Range
- Spatial Bounding Box

### 3. ML Training

Admins can train the threat detection model in the **ML Training** tab of the Admin panel. A minimum of 10 manually tagged networks is required.

## ❓ Troubleshooting

### Database Connection Failed

- Ensure PostgreSQL is running.
- Verify `DB_HOST` and `DB_PORT` in `.env`.
- Check if `db_password` is set correctly in the keyring.

### Map is Blank

- Ensure `mapbox_token` is set in the keyring.
- Check browser console for Mapbox GL errors.

### "Access Denied" on Admin Page

- Verify your user account has the `admin` role assigned in the `app.users` table.

---

For more detailed information, see the [Full Documentation](../README.md).
