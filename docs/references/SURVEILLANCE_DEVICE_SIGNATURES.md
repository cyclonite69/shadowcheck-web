# Surveillance Device Signature Catalog

**Compiled:** 2026-05-03  
**Sources:** NSM-Barii/flock-back · MaxwellDPS/Flock-You-Android · 0xXyc/flock-you-wifi-recon · FoggedLens/deflock · gainsec.com/2025/06/30/trap-shooter-tiny-flock-safety-sniffer-alarm  
**Purpose:** Comprehensive detection signature reference for Shadowcheck integration. Covers WiFi OUI, SSID, BLE name/UUID/manufacturer ID, device taxonomy, threat scoring, and data-source mapping.

---

## 1. Flock Safety

### 1.1 WiFi OUIs

All prefixes are colon-separated, lowercase, first three octets (OUI).  
Detection logic: match `addr2` (transmitter) **and** `addr1` (receiver) — Flock cameras spend most
of their duty cycle sleeping and appear as the _destination_ of probe responses before they wake to
transmit. The `addr1` technique is @NitekryDPaul's discovery and catches cameras that pure-TX sniffers miss.

#### High-Confidence OUIs

Direct IEEE registration or exclusive-use empirical (all sources agree).

| OUI        | Source                                           | Notes                                    |
| ---------- | ------------------------------------------------ | ---------------------------------------- |
| `70:c9:4e` | NitekryDPaul                                     | Flock WiFi infrastructure                |
| `3c:91:80` | NitekryDPaul                                     | Flock WiFi infrastructure                |
| `d8:f3:bc` | NitekryDPaul                                     | Flock WiFi infrastructure                |
| `80:30:49` | NitekryDPaul                                     | Flock WiFi infrastructure                |
| `b8:35:32` | NitekryDPaul                                     | Flock WiFi infrastructure                |
| `14:5a:fc` | NitekryDPaul                                     | Flock WiFi infrastructure                |
| `74:4c:a1` | NitekryDPaul                                     | Flock WiFi infrastructure                |
| `08:3a:88` | NitekryDPaul                                     | Flock WiFi infrastructure                |
| `9c:2f:9d` | NitekryDPaul                                     | Flock WiFi infrastructure                |
| `c0:35:32` | NitekryDPaul                                     | Flock WiFi infrastructure                |
| `94:08:53` | NitekryDPaul + flock-back                        | Flock WiFi infrastructure                |
| `e4:aa:ea` | NitekryDPaul + flock-back                        | Flock WiFi infrastructure                |
| `24:b2:b9` | NitekryDPaul                                     | Flock WiFi infrastructure                |
| `b8:1e:a4` | NitekryDPaul                                     | Flock WiFi infrastructure                |
| `70:08:94` | NitekryDPaul                                     | Flock WiFi infrastructure                |
| `58:8e:81` | NitekryDPaul + flock-back + flock-you-wifi-recon | FS Ext Battery devices                   |
| `ec:1b:bd` | NitekryDPaul + flock-back + flock-you-wifi-recon | FS Ext Battery devices                   |
| `3c:71:bf` | NitekryDPaul                                     | Flock WiFi infrastructure                |
| `58:00:e3` | NitekryDPaul                                     | Flock WiFi infrastructure                |
| `90:35:ea` | NitekryDPaul + flock-back + flock-you-wifi-recon | FS Ext Battery devices                   |
| `5c:93:a2` | NitekryDPaul                                     | Flock WiFi infrastructure                |
| `64:6e:69` | NitekryDPaul                                     | Flock WiFi infrastructure                |
| `48:27:ea` | NitekryDPaul                                     | Flock WiFi infrastructure                |
| `a4:cf:12` | NitekryDPaul                                     | Flock WiFi infrastructure                |
| `82:6b:f2` | DeFlockJoplin (field test, Joplin MO)            | 12th camera in 11/12 field run           |
| `cc:cc:cc` | flock-back + flock-you-wifi-recon                | FS Ext Battery devices                   |
| `04:0d:84` | flock-back + flock-you-wifi-recon                | FS Ext Battery devices                   |
| `f0:82:c0` | flock-back + flock-you-wifi-recon                | FS Ext Battery devices                   |
| `1c:34:f1` | flock-back + flock-you-wifi-recon                | FS Ext Battery devices                   |
| `38:5b:44` | flock-back + flock-you-wifi-recon                | FS Ext Battery devices                   |
| `94:34:69` | flock-back + flock-you-wifi-recon                | FS Ext Battery devices                   |
| `b4:e3:f9` | flock-back + flock-you-wifi-recon                | FS Ext Battery devices                   |
| `b4:1e:52` | flock-you-wifi-recon                             | Direct IEEE registration to Flock Safety |

#### Medium-Confidence OUIs (Contract Manufacturers)

These OUIs belong to Liteon Technology and USI (Universal Scientific Industrial), which produce
Flock hardware but also ship unrelated consumer/enterprise devices. An OUI match alone without
corroborating SSID or BLE signal carries higher false-positive risk.

| OUI        | Source                             | Manufacturer                            |
| ---------- | ---------------------------------- | --------------------------------------- |
| `f4:6a:dd` | NitekryDPaul + flock-back mfr list | Liteon Technology                       |
| `f8:a2:d6` | NitekryDPaul + flock-back mfr list | Liteon Technology                       |
| `e0:0a:f6` | flock-back mfr list                | Liteon Technology                       |
| `00:f4:8d` | NitekryDPaul + flock-back mfr list | USI (Universal Scientific Industrial)   |
| `d0:39:57` | NitekryDPaul + flock-back mfr list | USI                                     |
| `e8:d0:fc` | NitekryDPaul + flock-back mfr list | USI                                     |
| `e0:4f:43` | NitekryDPaul                       | Classification unclear — empirical only |

#### High-Precision Wildcard Probe Signature (DeFlockJoplin)

Flock cameras channel-hop and spam wildcard 802.11 Probe Requests on every channel.
Combining OUI + probe pattern gives a very tight signature (field-tested: 11/12 cameras
caught, 2 false positives):

1. Frame is Management, type=0, subtype=4 (Probe Request)
2. SSID Information Element (tag 0) present with length **0** (wildcard)
3. `addr2` (transmitter) matches any OUI in the high-confidence list above

---

### 1.2 SSID Patterns

| Pattern                  | Type      | Confidence | Notes                                                  |
| ------------------------ | --------- | ---------- | ------------------------------------------------------ |
| `^Flock-[0-9A-Fa-f]{6}$` | Regex     | HIGH       | Canonical format; 6 hex chars post-hyphen (GainSec)    |
| `test_flck`              | Exact     | CRITICAL   | Dev SSID found in production firmware (CVE-2025-59409) |
| `(?i)flock`              | Substring | HIGH       | Catches all "flock" variants case-insensitively        |
| `(?i)flck`               | Substring | MEDIUM     | Abbreviated variant; also catches `test_flck`          |
| `FS Ext Battery`         | Exact     | HIGH       | Extended battery unit                                  |
| `(?i)^fs[_-].*`          | Regex     | HIGH       | FS-prefix variant                                      |
| `(?i)^falcon[_-]?.*`     | Regex     | HIGH       | Falcon ALPR model                                      |
| `(?i)^sparrow[_-]?.*`    | Regex     | HIGH       | Sparrow ALPR model                                     |
| `(?i)^condor[_-]?.*`     | Regex     | HIGH       | Condor multi-lane ALPR model                           |
| `(?i)^penguin[_-]?.*`    | Regex     | MEDIUM     | Penguin mobile ALPR                                    |
| `(?i)^pigvision[_-]?.*`  | Regex     | MEDIUM     | Pigvision surveillance system                          |

> **Wi-Fi Scoring Narrowing:** Wi-Fi candidates classified FLOCK_SAFETY_CAMERA are dropped at scoring unless SSID matches `^Flock-[0-9A-Fa-f]{6}$` or is exactly lowercase `test_flck` (exact lowercase required). OUI-only and substring-only matches remain excluded.

**Default hotspot credential:** password `security` (found on Flock Safety devices — GainSec research)

---

### 1.3 BLE Device Names

Matched case-insensitively. Regex column is the Flock-You-Android pattern.

| Name / Prefix    | Regex                   | Confidence | Device                         |
| ---------------- | ----------------------- | ---------- | ------------------------------ |
| `FS Ext Battery` | `(?i)^fs ext battery.*` | HIGH       | Extended battery unit          |
| `Flock`          | `(?i)^flock[_-]?.*`     | HIGH       | Any Flock Safety BLE interface |
| `Falcon`         | `(?i)^falcon[_-]?.*`    | HIGH       | Falcon ALPR                    |
| `Raven`          | `(?i)^raven[_-]?.*`     | HIGH       | Raven gunshot detector         |
| `Sparrow`        | `(?i)^sparrow[_-]?.*`   | MEDIUM     | Sparrow ALPR                   |
| `Penguin`        | `(?i)^penguin[_-]?.*`   | MEDIUM     | Penguin mobile ALPR            |
| `Pigvision`      | `(?i)^pigvision[_-]?.*` | MEDIUM     | Pigvision system               |

---

### 1.4 BLE Manufacturer IDs

| Company ID (hex) | Company Name | Source                                                               |
| ---------------- | ------------ | -------------------------------------------------------------------- |
| `0x09C8`         | XUNTONG      | wgreenberg/flock-you — associated with Flock Safety devices in-field |

---

### 1.5 Device Models (Taxonomy)

| Model              | Type                       | Description                                                                              | SSID/BLE Pattern      |
| ------------------ | -------------------------- | ---------------------------------------------------------------------------------------- | --------------------- |
| **Falcon**         | Fixed pole-mounted ALPR    | Standard street/intersection camera; captures LP + vehicle characteristics               | `falcon.*`            |
| **Sparrow**        | Compact ALPR               | Smaller form factor, same LP capture                                                     | `sparrow.*`           |
| **Condor**         | High-speed multi-lane ALPR | Highway/multi-lane deployments                                                           | `condor.*`            |
| **Raven**          | Acoustic gunshot detector  | Solar, 24/7 audio surveillance; also detects "human distress"; SoundThinking integration | `raven.*` + BLE UUIDs |
| **Bravo**          | Compute box                | Edge compute unit; no direct WiFi SSID                                                   | —                     |
| **Penguin**        | Mobile ALPR                | Vehicle-mounted mobile unit                                                              | `penguin.*`           |
| **FS Ext Battery** | Extended battery unit      | Auxiliary power for fixed cameras                                                        | `FS Ext Battery`      |

---

## 2. General ALPR / Surveillance Camera OUIs

LTE modem OUIs (Flock and competitors use cellular-connected cameras):

| OUI        | Manufacturer         | Device Role                                | Confidence  |
| ---------- | -------------------- | ------------------------------------------ | ----------- |
| `50:29:4D` | Quectel              | LTE modem — commonly used in Flock cameras | MEDIUM      |
| `86:25:19` | Quectel              | LTE cellular module                        | MEDIUM      |
| `00:14:2D` | Telit                | LTE modem — IoT surveillance               | MEDIUM      |
| `D8:C7:71` | Telit Wireless       | LTE module                                 | MEDIUM      |
| `00:0E:8E` | Sierra Wireless      | Police/fleet vehicle mobile routers        | MEDIUM-HIGH |
| `00:11:75` | Sierra Wireless      | Fleet vehicle mobile hotspot               | MEDIUM-HIGH |
| `00:14:3E` | Sierra Wireless      | IoT/M2M/fleet modem                        | MEDIUM      |
| `00:A0:D5` | Sierra Wireless      | Cellular module                            | MEDIUM      |
| `00:30:44` | Cradlepoint          | Mobile router — police/emergency vehicles  | MEDIUM-HIGH |
| `00:10:8B` | Cradlepoint          | Mobile surveillance/command router         | MEDIUM-HIGH |
| `EC:F4:51` | Cradlepoint NetCloud | Fleet management router                    | MEDIUM      |
| `00:40:9D` | Digi International   | Fleet telematics                           | LOW-MEDIUM  |
| `00:07:F9` | CalAmp               | Vehicle tracking and fleet management      | MEDIUM      |
| `00:1E:C0` | Geotab               | Fleet telematics                           | LOW-MEDIUM  |
| `D4:CA:6E` | u-blox               | Cellular/GPS module                        | LOW         |

IP Camera Manufacturers (IEEE OUI database — public registrations):

| OUI        | Manufacturer                              | Vendor Context                         | Notes             |
| ---------- | ----------------------------------------- | -------------------------------------- | ----------------- |
| `00:40:8C` | Axis Communications                       | IP cameras, encoders                   | Primary OUI block |
| `AC:CC:8E` | Axis Communications                       | IP cameras                             | Second block      |
| `B8:A4:4F` | Axis Communications                       | IP cameras                             | Third block       |
| `FC:F1:52` | Axis Communications                       | IP cameras                             | Fourth block      |
| `C0:56:E3` | Hangzhou Hikvision                        | ALPR/IP cameras                        | Primary block     |
| `54:C4:15` | Hangzhou Hikvision                        | IP cameras                             | Second block      |
| `BC:AD:28` | Hangzhou Hikvision                        | IP cameras                             | Third block       |
| `44:19:B6` | Hangzhou Hikvision                        | IP cameras                             | Fourth block      |
| `E0:50:8B` | Zhejiang Dahua Technology                 | IP cameras / NVR                       | Primary block     |
| `B4:A3:82` | Zhejiang Dahua Technology                 | IP cameras                             | Second block      |
| `90:02:A9` | Zhejiang Dahua Technology                 | IP cameras                             | Third block       |
| `00:18:85` | Avigilon Corporation                      | ALPR / IP cameras (Motorola Solutions) | Primary block     |
| `4C:EA:67` | Avigilon Corporation                      | IP cameras                             | Second block      |
| `00:0C:2D` | Bosch Security Systems                    | IP cameras / encoders                  | Primary block     |
| `00:40:7F` | FLIR Systems                              | Thermal/IR cameras                     | Primary block     |
| `80:02:F2` | FLIR Systems                              | Thermal cameras                        | Second block      |
| `00:09:18` | Hanwha Techwin (formerly Samsung Techwin) | IP cameras                             | Primary block     |
| `00:E0:91` | Hanwha Techwin                            | IP cameras                             | Second block      |
| `00:D0:F1` | Pelco (Schneider Electric)                | IP cameras / PTZ                       | Primary block     |
| `00:03:C5` | Mobotix AG                                | IP cameras (embedded Linux)            | Primary block     |
| `00:01:4A` | Sony Corporation                          | IP cameras / encoders                  | Primary block     |
| `00:04:20` | Sony Corporation                          | IP cameras                             | Second block      |

> **Note on ALPR-specific vendors:** Genetec AutoVu, Motorola Vigilant, and Rekor ALPR
> systems often run on generic x86 compute boxes with standard NIC OUIs (Intel, Realtek, etc.)
> and are better detected via SSID or network behavior than OUI alone.

---

## 3. Raven / SoundThinking / ShotSpotter

### 3.1 BLE Service UUIDs

Source: NSM-Barii/flock-back `signatures.py` + Flock-You-Android `DetectionPatterns.kt` + flock-you-wifi-recon `main.cpp` (all consistent).  
**Confirmation threshold:** Match ≥2 Raven-specific services to confirm (reduces false positives from standard BLE Health/Location service use).

| UUID                                   | Service Name                   | Data Exposed                                          | Firmware Versions   |
| -------------------------------------- | ------------------------------ | ----------------------------------------------------- | ------------------- |
| `0000180a-0000-1000-8000-00805f9b34fb` | Device Information             | Serial number, model, firmware version, manufacturer  | 1.1.x, 1.2.x, 1.3.x |
| `00003100-0000-1000-8000-00805f9b34fb` | GPS Location                   | Latitude, longitude, altitude, fix status             | 1.2.x, 1.3.x        |
| `00003200-0000-1000-8000-00805f9b34fb` | Power Management               | Battery level, charging status, solar input voltage   | 1.2.x, 1.3.x        |
| `00003300-0000-1000-8000-00805f9b34fb` | Network Status                 | LTE signal strength, carrier, data usage, WiFi status | 1.2.x, 1.3.x        |
| `00003400-0000-1000-8000-00805f9b34fb` | Upload Statistics              | Bytes uploaded, detection count, last upload time     | 1.3.x only          |
| `00003500-0000-1000-8000-00805f9b34fb` | Error / Diagnostics            | Error codes, system health, diagnostic data           | 1.3.x only          |
| `00001809-0000-1000-8000-00805f9b34fb` | Health Thermometer (Legacy)    | Repurposed: device temperature, environmental data    | 1.1.x only          |
| `00001819-0000-1000-8000-00805f9b34fb` | Location / Navigation (Legacy) | Basic location data                                   | 1.1.x only          |

### 3.2 Firmware Version Fingerprinting from UUIDs

```
Has 0x1809 + 0x1819, no custom UUID     → firmware 1.1.x (legacy)
Has 0x3100 + 0x3200, no 0x3400/0x3500   → firmware 1.2.x
Has 0x3400 and/or 0x3500                 → firmware 1.3.x (latest, full diagnostics)
```

> **Tier 21 Candidate Precedence Contract:**
>
> - **Profile 1 (EXACT):** ≥2 custom Raven UUIDs (`0x3100`–`0x3500`) → Base 90, `EXACT`. Only Profile 1 overrides generic Tier 20 (`RESIDENTIAL_CAMERA`) and Tier 5 Xuntong default (`FLOCK_SAFETY_CAMERA`).
> - **Profile 2 (PARTIAL):** Legacy pair (`0x1809` + `0x1819`) → Base 60, `PARTIAL`. Does not override Tier 20 or Tier 5.
> - **Profile 3 (PARTIAL):** Single custom Raven UUID (`0x3100`–`0x3500`) → Base 70, `PARTIAL`. Does not override Tier 20 or Tier 5.
> - Standard `0x180A` alone, `0x1809`-only, and `0x1819`-only do not match Tier 21.

### 3.3 MAC OUI (WiFi / BLE)

| OUI        | Registrant         | Source                                  |
| ---------- | ------------------ | --------------------------------------- |
| `d4:11:d6` | SoundThinking Inc. | IEEE OUI database — direct registration |

### 3.4 BLE Name Patterns

| Pattern                  | Regex                                              | Notes                       |
| ------------------------ | -------------------------------------------------- | --------------------------- |
| Raven                    | `(?i)^raven[_-]?.*`                                | All Raven firmware versions |
| ShotSpotter              | `(?i)^shotspotter[_-]?.*`                          | Legacy branding             |
| SoundThinking            | `(?i)^soundthinking[_-]?.*`                        | Current branding            |
| Acoustic sensor variants | `(?i)^(shotspot\|soundthink\|acoustic[_-]?sens).*` | Abbreviated forms           |

### 3.5 Security Context

Per GainSec research and Flock-You-Android `DetectionPatterns.kt`:

- Raven leaks GPS coordinates, battery state, LTE signal strength, and detection event counts over **unauthenticated BLE** (no pairing required to read services)
- "Distress" detection definition is vague; false positives trigger police dispatch
- Solar-powered, 24/7 audio surveillance; no warrant required for installation in public space
- Manufacturer ID 0x09C8 (XUNTONG) observed on Flock/Raven BLE advertisements in field

---

## 4. PigVision

Limited signature data available across all source repos.

| Signal Type   | Pattern                 | Confidence | Source                                         |
| ------------- | ----------------------- | ---------- | ---------------------------------------------- |
| SSID          | `(?i)^pigvision[_-]?.*` | MEDIUM     | flock-back `signatures.py`, SsidPatterns.kt    |
| BLE Name      | `(?i)^pigvision[_-]?.*` | MEDIUM     | flock-back `signatures.py`, BleNamePatterns.kt |
| Device Type   | `PIGVISION_SYSTEM`      | —          | Flock-You-Android taxonomy                     |
| Threat Score  | 85                      | —          | BleNamePatterns.kt / SsidPatterns.kt           |
| Impact Factor | 1.0                     | —          | ImpactFactors.kt                               |

> **Research gap:** No known IEEE OUI registration, BLE service UUIDs, or manufacturer ID for
> PigVision systems has been documented in any of the source repos. Detection relies entirely on
> SSID/BLE name matching.
>
> **Implementation Status:** Pigvision BLE detection is deferred pending a database schema migration to add `PIGVISION_SYSTEM` to `app.surveillance_detections(chk_surveillance_device_type)`. Pigvision names are explicitly excluded from Tier 6 `FLOCK_SAFETY_CAMERA` classification to avoid device misattribution.

---

## 5. Detection Confidence Taxonomy

### 5.1 Threat Score Formula

From `ThreatScoring.kt` (Flock-You-Android):

```
threat_score = base_likelihood × impact_factor × confidence
```

- `base_likelihood`: 0–100 — probability this detection is a real threat
- `impact_factor`: 0.5–2.0 — severity multiplier by device type (see §5.3)
- `confidence`: 0.1–1.0 — detection quality (see §5.2)

Final score capped at 100. Severity thresholds: **CRITICAL** ≥90 · **HIGH** ≥70 · **MEDIUM** ≥50 · **LOW** ≥30 · **INFO** <30.

### 5.2 Confidence Adjustments

| Condition                         | Adjustment        |
| --------------------------------- | ----------------- |
| RSSI > −50 dBm (excellent signal) | +0.10             |
| RSSI > −60 dBm (good signal)      | +0.05             |
| RSSI < −80 dBm (weak signal)      | −0.10             |
| RSSI < −90 dBm (very weak)        | −0.20             |
| Seen >3 times or >5 min duration  | +0.20             |
| Single detection, <30 s           | −0.20             |
| Multiple confirming indicators    | +0.20             |
| Single weak indicator only        | −0.30             |
| Cross-protocol correlation        | +0.30             |
| Known false positive pattern      | −0.50             |
| Common consumer device            | −0.20             |
| Stationary in known safe area     | −0.15             |
| Urban/indoor + GNSS target        | −0.30 (multipath) |

**Match quality bonuses** (additive to confidence):

| Quality   | Bonus | Condition                                                      |
| --------- | ----- | -------------------------------------------------------------- |
| EXACT     | +0.15 | Exact match to known signature (e.g., `test_flck`, direct OUI) |
| STRONG    | +0.10 | Multiple patterns matched (OUI + SSID, or OUI + BLE name)      |
| PARTIAL   | 0.00  | Single pattern matched                                         |
| WEAK      | −0.10 | Partial regex match                                            |
| HEURISTIC | −0.20 | Behavioral/timing match only                                   |

### 5.3 Impact Factors by Device Type

| Device Type                                                        | Impact Factor | Notes                         |
| ------------------------------------------------------------------ | ------------- | ----------------------------- |
| STINGRAY_IMSI, CELLEBRITE_FORENSICS, GRAYKEY_DEVICE, MAN_IN_MIDDLE | 2.0           | Intercepts all communications |
| GNSS_SPOOFER, GNSS_JAMMER, RF_JAMMER                               | 1.8           | Can cause physical harm       |
| WIFI_PINEAPPLE                                                     | 1.8           | Active network attack         |
| ROGUE_AP                                                           | 1.7           | Communication interception    |
| FLIPPER_ZERO_SPAM                                                  | 1.9           | Active BLE DOS/spam           |
| FLIPPER_ZERO                                                       | 1.5           | Multi-tool, context-dependent |
| HACKRF_SDR                                                         | 1.6           | RF monitoring/transmission    |
| PROXMARK, LAN_TURTLE, SHARK_JACK                                   | 1.7           | Network/RFID attack tools     |
| AIRTAG, TILE_TRACKER, SAMSUNG_SMARTTAG, GENERIC_BLE_TRACKER        | 1.5           | Stalking concern              |
| SURVEILLANCE_VAN                                                   | 1.5           | Mobile surveillance platform  |
| DRONE                                                              | 1.4           | Aerial surveillance           |
| HIDDEN_CAMERA, HIDDEN_TRANSMITTER, PACKET_SNIFFER                  | 1.3           | Privacy violation             |
| FLOCK_SAFETY_CAMERA, LICENSE_PLATE_READER, FACIAL_RECOGNITION      | 1.2           | Mass surveillance             |
| RAVEN_GUNSHOT_DETECTOR, SHOTSPOTTER                                | 1.2           | Audio surveillance            |
| BODY_CAMERA, POLICE_VEHICLE, POLICE_RADIO, AXON_POLICE_TECH        | 1.0           | Known surveillance type       |
| PENGUIN_SURVEILLANCE, PIGVISION_SYSTEM                             | 1.0           | Unknown surveillance          |
| RING_DOORBELL, NEST_CAMERA, WYZE_CAMERA, ARLO_CAMERA, EUFY_CAMERA  | 0.8           | Consumer IoT                  |
| AMAZON_SIDEWALK, BLUETOOTH_BEACON, RETAIL_TRACKER                  | 0.7           | Minor privacy                 |
| SPEED_CAMERA, RED_LIGHT_CAMERA, TOLL_READER                        | 0.6           | Traffic infrastructure        |
| FLEET_VEHICLE, TRAFFIC_SENSOR                                      | 0.5           | Infrastructure only           |

### 5.4 Base Likelihoods by Detection Method

| Detection Method                                        | Base Likelihood | Notes                         |
| ------------------------------------------------------- | --------------- | ----------------------------- |
| Exact known threat match (direct OUI, `test_flck` SSID) | 85              | Highest confidence            |
| Encryption downgrade (5G/4G→2G)                         | 75              | Strong IMSI catcher indicator |
| Active GNSS spoofing (multiple indicators)              | 70              | —                             |
| Tracker following (3+ locations)                        | 55              | Same device at multiple stops |
| Suspicious cell parameters                              | 50              | Unusual but not conclusive    |
| GNSS signal anomaly                                     | 40              | Environmental or spoofing     |
| Unknown cell tower                                      | 35              | Not in database               |
| Single pattern match (SSID substring, contract OUI)     | 30              | One signal only               |
| Cell change while stationary                            | 25              | Could be network optimization |
| Brief ultrasonic detection                              | 20              | Under 30 s                    |
| GNSS multipath                                          | 15              | Urban canyon — usually benign |
| Known consumer device (Ring, Nest, etc.)                | 10              | Informational only            |

### 5.5 Per-Protocol Confidence Classification

**WiFi (W-type)**

| Signal                                                              | Confidence Level | Score Guidance                                  |
| ------------------------------------------------------------------- | ---------------- | ----------------------------------------------- |
| OUI exact match (IEEE registered to Flock Safety, e.g., `b4:1e:52`) | HIGH             | Base 85                                         |
| OUI + SSID pattern match (e.g., `Flock-a1b2c3`)                     | CRITICAL         | Base 90, EXACT match quality                    |
| OUI match only (high-confidence list)                               | HIGH             | Base 70–80                                      |
| SSID exact `test_flck`                                              | CRITICAL         | Base 90 — dev SSID in production                |
| SSID regex `Flock-[hex6]`                                           | HIGH             | Base 85                                         |
| SSID substring `flock`                                              | MEDIUM           | Base 65 — false positive risk                   |
| Contract manufacturer OUI only                                      | MEDIUM           | Base 50 — Liteon/USI also make consumer devices |
| Wildcard probe + OUI                                                | HIGH             | Combine for tighter signature                   |

**BLE (E-type)**

| Signal                                        | Confidence Level | Score Guidance            |
| --------------------------------------------- | ---------------- | ------------------------- |
| ≥2 Raven service UUIDs (custom 0x3100–0x3500) | CRITICAL         | Base 90 — highly specific |
| Single custom Raven UUID (0x3100–0x3500)      | HIGH             | Base 70                   |
| Legacy Raven UUIDs (0x1809 + 0x1819 pair)     | MEDIUM           | Base 60, PARTIAL          |
| BLE name exact `FS Ext Battery`               | HIGH             | Base 85                   |
| BLE name regex `flock.*` or `falcon.*`        | HIGH             | Base 80                   |
| BLE manufacturer ID 0x09C8 (XUNTONG)          | HIGH             | Base 80                   |
| MAC OUI match (high-confidence list)          | HIGH             | Base 75                   |
| BLE name substring `flock` only               | MEDIUM           | Base 60                   |

---

## 6. Shadowcheck Integration Map

Based on Shadowcheck data model: network types `W` (WiFi), `E` (BLE), `B` (Bluetooth),
`L` (LTE), `N` (5G NR). Core tables: `app.networks`, `app.observations`, `app.network_tags`.

### 6.1 WiFi OUI Signatures → Data Sources

| Signature Set                                   | Data Source          | Query Approach                               | Network Type |
| ----------------------------------------------- | -------------------- | -------------------------------------------- | ------------ |
| Flock Safety high-confidence OUIs (33 prefixes) | `app.networks` BSSID | `WHERE LEFT(bssid, 8) = ANY(flock_ouis)`     | `W`          |
| Flock Safety high-confidence OUIs               | WiGLE v2 API         | BSSID prefix search per OUI                  | `W`          |
| Flock Safety high-confidence OUIs               | WiGLE v3 API         | Individual BSSID detail lookup               | `W`          |
| Contract manufacturer OUIs (7 prefixes)         | `app.networks` BSSID | Same as above; flag as MEDIUM confidence     | `W`          |
| ALPR vendor OUIs (Axis, Hikvision, Dahua, etc.) | `app.networks` BSSID | OUI prefix match → tag with vendor           | `W`          |
| LTE modem OUIs (Quectel, Sierra, Cradlepoint)   | `app.networks` BSSID | Flag as possible surveillance infrastructure | `W`          |
| SoundThinking OUI `d4:11:d6`                    | `app.networks` BSSID | Exact OUI match → CRITICAL tag               | `W`          |

### 6.2 SSID Patterns → Data Sources

| Pattern                                               | Data Source                                | Confidence | Network Type |
| ----------------------------------------------------- | ------------------------------------------ | ---------- | ------------ |
| `SSID ~ '^Flock-[0-9A-Fa-f]{6}$'` (regex)             | `app.networks` SSID                        | HIGH       | `W`          |
| `SSID = 'test_flck'` (exact)                          | `app.networks` SSID                        | CRITICAL   | `W`          |
| `SSID ILIKE '%flock%'`                                | `app.networks` SSID + WiGLE v2 SSID search | MEDIUM     | `W`          |
| `SSID ILIKE '%flck%'`                                 | `app.networks` SSID                        | MEDIUM     | `W`          |
| `SSID = 'FS Ext Battery'`                             | `app.networks` SSID                        | HIGH       | `W`          |
| `SSID ILIKE 'falcon%'` or `'sparrow%'` or `'condor%'` | `app.networks` SSID                        | HIGH       | `W`          |
| `SSID ILIKE 'penguin%'` or `'pigvision%'`             | `app.networks` SSID                        | MEDIUM     | `W`          |

### 6.3 BLE Signatures → Data Sources

| Signature                                             | Data Source                      | Confidence | Network Type |
| ----------------------------------------------------- | -------------------------------- | ---------- | ------------ |
| Raven UUIDs (0x3100–0x3500, any 2+)                   | `app.networks` service_uuids     | CRITICAL   | `E`          |
| Raven UUID 0x3400 or 0x3500 (single, firmware 1.3.x)  | `app.networks` service_uuids     | HIGH       | `E`          |
| Legacy Raven UUIDs 0x1809 + 0x1819 pair               | `app.networks` service_uuids     | MEDIUM     | `E`          |
| BLE name `FS Ext Battery`, `Flock`, `Falcon`, `Raven` | `app.networks` SSID (BLE name)   | HIGH       | `E`          |
| BLE manufacturer ID 0x09C8                            | `app.networks` manufacturer_data | HIGH       | `E`          |
| BLE OUI match (high-confidence Flock list)            | `app.networks` BSSID             | HIGH       | `E`          |

### 6.4 KML / GPS-Tagged Detections → Data Sources

| Data Type                           | Source                        | Integration Point                                             |
| ----------------------------------- | ----------------------------- | ------------------------------------------------------------- |
| flock-you ESP32 KML export          | `/api/export/kml` from device | Import into `app.observations` with detection_method tag      |
| flock-you CSV export (with GPS)     | `/api/export/csv`             | ETL pipeline → `app.networks` + `app.observations`            |
| flock-you JSON (MAC + GPS + method) | `/api/export/json`            | ETL pipeline — use `detection_method` field to set confidence |
| Prior session (`prev_session.json`) | Device SPIFFS                 | Same as above; mark as `prior_session=true`                   |

**Detection method field values** (from flock-you firmware — use to set confidence in ETL):

| `detection_method` value   | Meaning                                      | Confidence  |
| -------------------------- | -------------------------------------------- | ----------- |
| `mac_prefix`               | OUI matches high-confidence Flock list       | HIGH        |
| `mac_prefix_soundthinking` | OUI is `d4:11:d6` SoundThinking              | HIGH        |
| `mac_prefix_mfr`           | OUI matches contract mfr list (Liteon/USI)   | MEDIUM      |
| `device_name`              | BLE name substring match                     | MEDIUM-HIGH |
| `ble_mfr_id`               | Manufacturer ID 0x09C8 (XUNTONG)             | HIGH        |
| `raven_uuid`               | Raven service UUID match                     | CRITICAL    |
| `wifi_wildcard_probe`      | Wildcard probe + OUI (DeFlockJoplin)         | HIGH        |
| `wifi_oui_addr2`           | WiFi OUI match on transmitter                | HIGH        |
| `wifi_oui_addr1`           | WiFi OUI match on receiver (sleeping camera) | HIGH        |
| `ssid_pattern`             | `Flock-[hex6]` canonical SSID                | HIGH        |
| `ssid_exact`               | `test_flck` dev SSID                         | CRITICAL    |
| `ssid_substr_flock`        | `flock` substring in SSID                    | MEDIUM      |
| `ssid_substr_flck`         | `flck` substring in SSID                     | MEDIUM      |
| `oui_flock`                | WiFi scan mode OUI match                     | HIGH        |
| `oui_shotspotter`          | SoundThinking WiFi OUI                       | HIGH        |
| `oui_mfr`                  | Contract manufacturer OUI                    | MEDIUM      |

### 6.5 Cross-Domain Correlation Multipliers

Applied when the same device or location cluster triggers multiple protocol signals:

| Correlation                                           | Multiplier | Threshold            |
| ----------------------------------------------------- | ---------- | -------------------- |
| WiFi OUI + BLE UUID (same MAC prefix area)            | ×1.3       | Within 100m, 10 min  |
| Raven UUID + BLE name `raven.*`                       | ×1.2       | Same device          |
| Multiple Flock OUIs in same geographic cluster        | ×1.15      | 3+ devices in 200m   |
| WiFi OUI + SSID pattern (double hit)                  | ×1.1       | Same BSSID           |
| `mac_prefix` method + `device_name` method (same MAC) | ×1.2       | Same detection event |

---

_Sources: NSM-Barii/flock-back (2025) · MaxwellDPS/Flock-You-Android (2025) · 0xXyc/flock-you-wifi-recon (2025) · FoggedLens/deflock (2025) · @NitekryDPaul WiFi OUI research · Michael/DeFlockJoplin field data (Joplin, MO) · GainSec Trap Shooter research (2025) · IEEE OUI public registry_
