# ShadowCheck Intelligence Dashboards

This document describes the specialized intelligence and forensic dashboards provided by the ShadowCheck monitoring stack.

## Overview

Unlike standard system metrics, Intelligence Dashboards focus on behavioral patterns, geographic clustering, and coordinated signal activity. They are often generated dynamically or tailored to specific forensic requirements.

## Core Dashboards

### 1. Home Fleet Detection

- **Source**: `shadowcheck_home_fleet_detection.json`
- **Purpose**: Identifies coordinated vehicle operations based on shared OUI (manufacturer) patterns and proximity timestamps.
- **Key Metrics**:
  - Multi-vehicle proximity clusters
  - SSID recurrence across mobile nodes
  - Staging area identification

### 2. Mobile Unit Tracking

- **Purpose**: Visualizes the movement of a single suspected surveillance unit across multiple collection sessions.
- **Utility**: Cross-references signal strength with known forensic markers (Courthouses, FBI offices).

## Generation Utilities

To maintain these dashboards at scale, ShadowCheck uses Python-based generators located in `deploy/monitoring/grafana/provisioning/dashboards/intelligence/`.

### gen_home_fleet_detection.py

This script builds the JSON dashboard definition by querying the `app.networks` and `app.network_tags` materialized views to identify high-probability fleet candidates.

**Usage:**

```bash
python3 deploy/monitoring/grafana/provisioning/dashboards/intelligence/gen_home_fleet_detection.py
```

## Forensic Analysis via Grafana

By leveraging Grafana's temporal filtering and alerting, ShadowCheck provides:

- **Threshold Alerts**: Automatic notification when a high-threat score network is detected within range of a critical location marker.
- **Visual Correlation**: Layering network detections over judicial infrastructure maps to identify surveillance staging zones.
