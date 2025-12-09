# Surveillance Detection Algorithm

## Overview

ShadowCheck detects potential tracking/stalking devices by analyzing network behavior patterns over time. The system calculates threat scores based on multiple behavioral indicators.

## Prerequisites

### Required Data
1. **Home Location** - Must be set via Admin page or geospatial map
2. **Minimum Observations** - At least 2 observations per network (configurable)
3. **Time Window** - Default 30 days of observation data
4. **Valid Timestamps** - Observations after Jan 1, 2000

### Database Requirements
- `app.location_markers` table with home marker
- `app.observations` table with GPS coordinates
- `app.networks` table with network metadata
- `app.network_tags` table for user classifications

## Threat Score Calculation

### Base Score Components (0-100 points)

#### 1. Temporal Persistence (0-30 points)
- **30 points**: Seen on 7+ unique days
- **20 points**: Seen on 3-6 unique days  
- **10 points**: Seen on 2 unique days

**Why**: Devices that persist over multiple days are more suspicious than one-time encounters.

#### 2. Geographic Range (0-40 points)
- **40 points**: Distance range > 1.0 km
- **25 points**: Distance range 0.5-1.0 km
- **0 points**: Distance range < 0.5 km

**Why**: Devices that move with you over significant distances are likely tracking you.

#### 3. Observation Frequency (0-20 points)
- **20 points**: 50+ observations
- **10 points**: 20-49 observations
- **5 points**: 5-19 observations

**Why**: More frequent detections indicate persistent proximity.

#### 4. Location Diversity (0-15 points)
- **15 points**: 10+ unique locations
- **10 points**: 5-9 unique locations
- **0 points**: < 5 unique locations

**Why**: Devices seen at many different places are following you, not stationary.

### Threat Score Thresholds

- **Critical (80-100)**: Immediate investigation required
- **High (70-79)**: Strong tracking indicators
- **Medium (50-69)**: Suspicious behavior patterns
- **Low (40-49)**: Borderline suspicious
- **< 40**: Not displayed (filtered out)

## Advanced Detection Patterns

### Pattern Analysis (from `/api/threats/detect`)

#### Home/Away Detection
- **Seen at Home**: Within 100m of home location
- **Seen Away**: More than 500m from home
- **Critical Pattern**: Seen both at home AND away = likely tracking device

#### Speed Analysis
- Calculates maximum speed between observations
- **> 100 km/h**: Vehicle tracker
- **> 50 km/h**: Mobile device in vehicle
- **> 20 km/h**: Walking/cycling speed
- **< 20 km/h**: Stationary or slow movement

#### Distance Tracking
- Tracks distance from home for each observation
- Identifies if device follows you to multiple locations
- Calculates maximum distance between any two observations

### Threat Type Classification

1. **Mobile Tracking Device**
   - Seen at home AND away
   - Speed > 20 km/h
   - Multiple unique days

2. **Potential Stalking Device**
   - Seen at home AND away
   - Any speed
   - Persistent over time

3. **Following Pattern Detected**
   - Distance range > 1 km
   - Multiple unique days
   - Not seen at home

4. **High-Speed Vehicle Tracker**
   - Speed > 100 km/h
   - Any location pattern

5. **Mobile Device (Non-Home)**
   - Not seen at home
   - Distance range > 0.5 km

6. **Low Risk Movement**
   - Doesn't match above patterns

## User Tagging System

### Tag Types
- **THREAT**: User confirms as tracking device
- **FALSE_POSITIVE**: User marks as safe (own device, neighbor, etc.)
- **INVESTIGATE**: Flagged for further analysis

### Tag Effects
- Tagged networks are excluded from active threat detection
- User tags override ML scores
- Confidence level (0-100) indicates certainty

## API Endpoints

### Quick Threat Detection
```
GET /api/threats/quick?page=1&limit=50
```
Returns networks with threat score ≥ 40, excluding tagged networks.

### Detailed Threat Analysis
```
GET /api/threats/detect
```
Returns comprehensive threat analysis with patterns, speeds, and classifications.

### Tag Network
```
POST /api/tag-network
Body: { bssid, tag_type, confidence, notes }
```

## False Positive Reduction

### Automatic Filtering
- Cellular networks (LTE/GSM/5G) only flagged if range > 5 km
- Networks with < 2 observations excluded
- Networks with invalid timestamps excluded
- User-tagged safe networks excluded

### Common False Positives
- **Your own devices**: Phone, laptop, smartwatch
- **Neighbor networks**: Stationary but seen frequently
- **Work networks**: Seen daily but not tracking
- **Public WiFi**: Coffee shops, stores you frequent

**Solution**: Tag these as FALSE_POSITIVE to remove from threat list.

## Best Practices

1. **Set Home Location First** - Critical for accurate detection
2. **Review Daily** - Check new threats regularly
3. **Tag Known Devices** - Mark your own devices as safe
4. **Investigate High Scores** - Anything 70+ deserves attention
5. **Check Patterns** - Look at observation timeline and locations
6. **Use Map View** - Visualize where device was detected

## Technical Details

### Database Query
See `/src/api/routes/v1/threats.js` for full SQL implementation.

### Key Tables
- `app.observations` - GPS coordinates and timestamps
- `app.networks` - Network metadata (SSID, BSSID, type)
- `app.location_markers` - Home location reference
- `app.network_tags` - User classifications

### Performance
- Queries limited to 30-day window
- Pagination support (50 results per page)
- Indexed on BSSID and observed_at for speed
