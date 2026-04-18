import json
import subprocess

config = {
    "mode": "address-only",
    "limit": 2000,
    "provider": "mapbox",
    "perMinute": 200,
    "permanent": True,
    "precision": 5,
    "providers": [
        {"mode": "address-only", "limit": 2000, "enabled": True, "provider": "mapbox", "perMinute": 200, "permanent": True},
        {"mode": "address-only", "limit": 1000, "enabled": True, "provider": "locationiq", "perMinute": 60, "permanent": False},
        {"mode": "address-only", "limit": 1000, "enabled": True, "provider": "opencage", "perMinute": 60, "permanent": False},
        {"mode": "address-only", "limit": 1000, "enabled": True, "provider": "geocodio", "perMinute": 60, "permanent": False},
        {"mode": "poi-only", "limit": 250, "enabled": True, "provider": "overpass", "perMinute": 60, "permanent": False}
    ],
    "idleSleepMs": 180000,
    "loopDelayMs": 15000,
    "errorSleepMs": 60000,
    "providerCursor": 0
}

sql_content = f"UPDATE app.settings SET value = '{json.dumps(config)}'::jsonb WHERE key = 'geocoding_daemon_config';"
escaped_sql = sql_content.replace("'", "'\\''")

command = f"sudo docker exec shadowcheck_postgres env PGPASSWORD=zJ346bJvKOoyPq9B3bVfmcBXhyycbnkQ psql -U shadowcheck_admin -d shadowcheck_db -c '{escaped_sql}'"

subprocess.run([
    "aws", "--profile", "shadowcheck", "ssm", "send-command",
    "--instance-ids", "i-06380d0c9c99f6124",
    "--document-name", "AWS-RunShellScript",
    "--parameters", json.dumps({"commands": [command]})
], check=True)
