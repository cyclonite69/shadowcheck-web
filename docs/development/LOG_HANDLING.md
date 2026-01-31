# Log Handling

## Runtime Logs

Runtime logs are automatically ignored by git and should never be committed:

- `server/data/logs/` - Server runtime logs
- `*.log` - All log files
- `logs/` - Any logs directory

## Search Exclusions

When using ripgrep or similar tools, logs are automatically excluded via `.gitignore` patterns.

To explicitly exclude logs from searches:

```bash
rg --type-not log "pattern"
# or
rg "pattern" --glob '!*.log' --glob '!server/data/logs/*'
```

## Log Locations

- **Server logs**: `server/data/logs/`
  - `combined.log` - All log levels
  - `error.log` - Error level only
  - `debug.log` - Debug level and above
