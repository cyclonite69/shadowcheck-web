# Geocoding Daemon

The Geocoding Daemon is a background service in ShadowCheck that handles continuous, automated address enrichment for wireless network observations. It ensures that the `geocoding_cache` is kept up-to-date by processing pending coordinates through various third-party providers.

## Overview

The daemon runs as a continuous loop within the Express backend, decoupled from user requests. It periodically checks for coordinates that lack geocoding data and attempts to resolve them using the configured provider suite.

### Key Components

- **Runtime**: `server/src/services/geocoding/daemonRuntime.ts`
- **State Management**: `server/src/services/geocoding/daemonState.ts`
- **Providers**: `server/src/services/geocoding/providers.ts`
- **Persistence**: Geocoding configuration is persisted to the database to survive restarts.

## How It Works

1. **Initialization**: When the server starts (or when manually triggered via the Admin API), the daemon loads its last known configuration.
2. **Loop Execution**:
   - The daemon wakes up and identifies batch candidates from the `app.observations` table that aren't yet in the `app.geocoding_cache`.
   - It iterates through enabled providers (e.g., Mapbox, Nominatim, OpenCage) to resolve addresses.
   - Results are committed to the cache.
3. **Adaptive Sleeping**:
   - **Active Mode**: If the last run processed data, it waits for `loopDelayMs` (default: 30s) before the next tick.
   - **Idle Mode**: If no new data was found, it enters a deeper sleep for `idleSleepMs` (default: 5m) to save resources.
   - **Error Mode**: If a tick fails (e.g., rate limits or network issues), it waits for `errorSleepMs` (default: 15m).

## Configuration

The daemon can be configured via the **Admin -> Geocoding** tab or through environment variables for initial defaults.

| Parameter      | Default  | Description                                       |
| :------------- | :------- | :------------------------------------------------ |
| `provider`     | `mapbox` | Primary geocoding provider.                       |
| `loopDelayMs`  | `30000`  | Delay between ticks when data is being processed. |
| `idleSleepMs`  | `300000` | Delay when no pending data is found.              |
| `errorSleepMs` | `900000` | Delay after a provider or system error.           |
| `batchSize`    | `50`     | Number of coordinates to process per tick.        |

## Supported Providers

- **Mapbox**: Best for high-accuracy residential addresses.
- **Nominatim (OSM)**: Open-source fallback; strictly rate-limited.
- **OpenCage / LocationIQ**: Commercial aggregators with high daily limits.
- **Overpass**: Specialized for POI (Point of Interest) name resolution.

## Monitoring & Control

- **Status API**: `GET /api/admin/geocoding/status` returns the current running state, last run time, and last error.
- **Manual Start/Stop**: The daemon can be toggled via the Admin UI.
- **Logs**: All daemon activity is logged with the `[Geocoding]` prefix in the server logs.

## Performance Impact

The daemon uses a non-blocking `while` loop with `setTimeout` (via `sleep` helper). It is designed to have negligible impact on API response latency. Database transactions are kept small and frequent to prevent locking long-running queries.
