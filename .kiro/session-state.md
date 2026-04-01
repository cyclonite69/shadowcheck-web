# ShadowCheck Session State — March 31, 2026

## Completed Today

### Code Changes (all pushed to master)

1. **Hooks fix** — `NetworkTableBodyGrid.tsx` useMemo/useCallback moved above early return
2. **Toolbar layout** — marginLeft:auto wrapper for zones 3-5 in `MapToolbar.tsx`
3. **BSSID coloring** — tooltips, radio icons, sibling borders use macColor + mixBssidColors
4. **Radio type SVG icons** — fixed radio_type never being passed; proper BT rune, BLE, cellular icons
5. **Smart tooltips** — BT device class from capabilities, BT bond state (;10=NONE, ;12=BONDED), LTE carrier from MCC/MNC, GIGO suppression
6. **resolveRadioTech()** — single source of truth reconciling WiGLE type vs capabilities
7. **Signal range estimation** — radio-type-aware: BT 100m, BLE 200m, LTE/GSM 35km, NR 10km
8. **BLE misclassification detection** — type=W with freq=7936 or BT-style caps
9. **Grafana dashboards** — enhanced home fleet detection + Edsel Ford with 10+ new panels
10. **Anchor point system** — app.anchor_points table, verify_device_presence() function

### Database State

- **app.ai_insights**: 7 rows (fleet co-occurrence, FBI Watching, GCSO, radio reconciliation, overnight parking, freeway relocation, sampling bias)
- **app.anchor_points**: 325 HOME + 13 GRANGER_ST (WiGLE v3 enriched)
- **app.verify_device_presence()**: function working, tested on key dates

### Key Findings

- **162 fleet vehicles** (PAS + MDT + GreatLakesMobile) — Air Link / Sierra Wireless
- **Vehicle AF:1F** (PAS-131/323/RIG): all 4 operator locations, overnight parking, bursty cadence
- **FBI Watching** (Commscope sibling pair): approaching signal pattern on Saginaw St, correlates with video
- **Freeway relocation**: May 23 2024, 90.5km from home, GMC vehicle (hum85023/myGMC 0AE8), origin 7764 Granger St Detroit
- **Companion radios**: ONLY seen at Granger St, never near any operator location
- **Aumovio fleet**: 758 unique vehicle hotspots in dataset (00:54:AF OUI)

## In Progress — Where We Left Off

1. **Temporal disappearance analysis** — was running query for signals that appeared near home then vanished (90+ day absence). Query was interrupted.
2. **Stingray detection rules** — not yet started, planned to use resolveRadioTech + cell tower data
3. **Companion radio deep trace** — confirmed none appear near operator locations in WiGLE v3
4. **More Grafana enrichment** — anchor point panels added, could add disappearance/appearance panels

## Next Steps

- Restart kiro-cli to pick up .kiro/settings.json trusted commands
- Resume temporal disappearance query
- Build stingray/IMSI catcher detection scoring rules
- Field calibration feature for Hurley vehicle cataloging
- Cell tower reference data (FCC ASR / OpenCelliD)
