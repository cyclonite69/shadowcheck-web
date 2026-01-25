# PgAdmin Setup Guide

## ✅ PgAdmin is Running

PgAdmin is now running and accessible at: **http://localhost:5050**

## 🔑 Login Credentials

**Email:** `admin@example.com`
**Password:** `admin`

> 💡 These are the default credentials. To change them, update `PGADMIN_EMAIL` and `PGADMIN_PASSWORD` in your `.env` file and restart PgAdmin.

## 🔌 Connecting to PostgreSQL

### Option 1: Pre-configured Server (Recommended)

A server connection is already configured for you. After logging in:

1. Click on **"Servers"** in the left sidebar
2. Expand **"ShadowCheck PostgreSQL"**
3. When prompted for password, enter: **`changeme`**
4. ✅ Check "Save password" to avoid entering it again
5. You should now see the `shadowcheck_db` database

### Option 2: Manual Server Setup

If the pre-configured server doesn't work, add it manually:

1. Right-click **"Servers"** → **"Register" → "Server..."**
2. **General Tab:**
   - Name: `ShadowCheck PostgreSQL`
   - Comment: `ShadowCheck main database`
3. **Connection Tab:**
   - Host name/address: `shadowcheck_postgres`
   - Port: `5432`
   - Maintenance database: `shadowcheck_db`
   - Username: `shadowcheck_user`
   - Password: `changeme`
   - ✅ Save password: Yes
4. Click **Save**

## 📊 Database Structure

Once connected, you'll see:

```
shadowcheck_db/
├── Schemas/
│   ├── app/                    # Main application schema
│   │   ├── Tables/
│   │   │   ├── networks        # Network metadata (173k+ rows)
│   │   │   ├── observations    # Location records (566k+ rows)
│   │   │   ├── network_tags    # User tags (THREAT, LEGIT, etc.)
│   │   │   ├── location_markers # Home/work locations
│   │   │   └── ...
│   │   ├── Views/
│   │   └── Functions/
│   └── public/                 # System schema
└── Extensions/
    └── postgis                 # PostGIS 3.6 for geospatial
```

## 🔍 Quick Queries

Try these queries in the Query Tool:

### Check Data Volume

```sql
-- Count networks
SELECT COUNT(*) FROM app.networks;

-- Count observations
SELECT COUNT(*) FROM app.observations;

-- Network type distribution
SELECT type, COUNT(*)
FROM app.networks
GROUP BY type
ORDER BY COUNT(*) DESC;
```

### View Recent Observations

```sql
SELECT
    bssid,
    latitude,
    longitude,
    signal_dbm,
    observed_at
FROM app.observations
ORDER BY observed_at DESC
LIMIT 10;
```

### Find Threats

```sql
SELECT
    bssid,
    ssid,
    ml_threat_score,
    threat_level
FROM app.networks
WHERE ml_threat_score >= 40
ORDER BY ml_threat_score DESC
LIMIT 20;
```

### Geospatial Query (Networks near home)

```sql
WITH home AS (
    SELECT location
    FROM app.location_markers
    WHERE marker_type = 'home'
    LIMIT 1
)
SELECT
    n.bssid,
    n.ssid,
    ST_Distance(n.location::geography, h.location::geography) / 1000 as distance_km
FROM app.networks n, home h
WHERE n.location IS NOT NULL
ORDER BY distance_km
LIMIT 10;
```

## 🛠️ Troubleshooting

### Can't Connect to Server

**Error:** "could not connect to server"

**Solutions:**

1. Verify PostgreSQL is running:

   ```bash
   docker ps | grep shadowcheck_postgres
   ```

2. Check they're on the same network:

   ```bash
   docker network inspect shadowcheck_net
   ```

3. Use hostname `shadowcheck_postgres` (not `localhost`)

### Wrong Password

**Error:** "FATAL: password authentication failed"

**Solution:**

- Password is: `changeme`
- Make sure there are no extra spaces
- Check case sensitivity

### Server Already Exists

**Error:** "A server with this name already exists"

**Solution:**

- The server is already configured
- Just expand it in the left sidebar and enter the password

### PgAdmin Not Loading

**Check Status:**

```bash
docker ps --filter "name=shadowcheck_pgadmin"
```

**Restart:**

```bash
docker restart shadowcheck_pgadmin
```

**Check Logs:**

```bash
docker logs shadowcheck_pgadmin
```

## 🔐 Security Notes

### Production Environment

For production, change the default credentials:

1. Update `.env`:

   ```bash
   PGADMIN_EMAIL=your-email@example.com
   PGADMIN_PASSWORD=your-secure-password
   ```

2. Restart PgAdmin:

   ```bash
   docker-compose -f docker-compose.postgres.yml restart pgadmin
   ```

3. Change PostgreSQL password:

   ```sql
   ALTER USER shadowcheck_user WITH PASSWORD 'new-secure-password';
   ```

4. Update credentials in:
   - `.env` → `DB_PASSWORD=new-secure-password`
   - Keyring: `node -e "require('./server/src/services/keyringService').setCredential('db_password', 'new-secure-password')"`
   - `secrets/db_password.txt`

### Access Control

PgAdmin is exposed on port 5050. To restrict access:

**Option 1: Use localhost only**

```yaml
ports:
  - '127.0.0.1:5050:80' # Only accessible from localhost
```

**Option 2: Use firewall**

```bash
sudo ufw allow from 192.168.1.0/24 to any port 5050  # Only allow local network
```

**Option 3: Use reverse proxy** (Nginx/Traefik with authentication)

## 📱 Accessing from Other Machines

To access PgAdmin from another computer on your network:

1. Find your server's IP:

   ```bash
   hostname -I | awk '{print $1}'
   ```

2. Access from browser:

   ```
   http://YOUR_IP:5050
   ```

3. Connect to database using hostname `shadowcheck_postgres`

## 🚀 Management Commands

```bash
# Start PgAdmin
docker-compose -f docker-compose.postgres.yml up -d pgadmin

# Stop PgAdmin
docker-compose -f docker-compose.postgres.yml stop pgadmin

# Restart PgAdmin
docker-compose -f docker-compose.postgres.yml restart pgadmin

# View logs
docker logs shadowcheck_pgadmin -f

# Access PgAdmin shell
docker exec -it shadowcheck_pgadmin sh
```

## 📚 Additional Resources

- **PgAdmin Documentation:** https://www.pgadmin.org/docs/
- **PostgreSQL 18 Docs:** https://www.postgresql.org/docs/18/
- **PostGIS Documentation:** https://postgis.net/documentation/

---

**Quick Reference:**

| Item                 | Value                 |
| -------------------- | --------------------- |
| **PgAdmin URL**      | http://localhost:5050 |
| **PgAdmin Email**    | admin@example.com     |
| **PgAdmin Password** | admin                 |
| **DB Host**          | shadowcheck_postgres  |
| **DB Port**          | 5432                  |
| **DB Name**          | shadowcheck_db        |
| **DB User**          | shadowcheck_user      |
| **DB Password**      | changeme              |
