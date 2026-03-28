#!/usr/bin/env python3
"""Run all intelligence dashboard generators and validate output."""
import subprocess, sys, json, os

here = os.path.dirname(os.path.abspath(__file__))
generators = [
    "gen_national.py",
    "gen_michigan.py",
    "gen_oui_fleet.py",
    "gen_critical_infra.py",
    "gen_home_fleet_detection.py",
]
expected = [
    "shadowcheck_national.json",
    "shadowcheck_michigan.json",
    "shadowcheck_oui_fleet.json",
    "shadowcheck_critical_infra.json",
    "shadowcheck_home_fleet_detection.json",
]

for gen in generators:
    result = subprocess.run([sys.executable, os.path.join(here, gen)], capture_output=True, text=True)
    if result.returncode != 0:
        print(f"FAIL: {gen}\n{result.stderr}")
        sys.exit(1)
    print(result.stdout.strip())

# Validate JSON and check required fields
for fname in expected:
    path = os.path.join(here, fname)
    with open(path) as f:
        d = json.load(f)
    assert d.get("uid"), f"{fname}: missing uid"
    assert d.get("panels"), f"{fname}: no panels"
    assert d.get("templating", {}).get("list"), f"{fname}: no variables"
    assert d.get("__inputs"), f"{fname}: missing __inputs"
    # Check all 4 variables present
    var_names = {v["name"] for v in d["templating"]["list"]}
    for v in ["ssid_pattern", "state", "confidence_threshold", "span_days_min"]:
        assert v in var_names, f"{fname}: missing variable {v}"
    # Check no hardcoded FBI strings in rawSql (only $ssid_pattern)
    raw = json.dumps(d)
    import re
    hardcoded = re.findall(r"ILIKE\s+'%FBI%'", raw)
    assert not hardcoded, f"{fname}: hardcoded FBI string in SQL"
    print(f"  ✓ {fname}: {len(d['panels'])} panels, uid={d['uid']}")

print("\nAll dashboards generated and validated.")
