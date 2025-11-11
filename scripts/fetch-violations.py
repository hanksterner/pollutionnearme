import csv, json, math

INPUT = r"D:\pollutionnearme\data\ECHO_EXPORTER.csv"
OUTPUT = r"D:\pollutionnearme\data\violations.json"

def to_num(v):
    try:
        n = float(v)
        if math.isnan(n) or math.isinf(n):
            return 0
        return int(n)
    except:
        return 0

def safe_float(v):
    try:
        n = float(v)
        if math.isnan(n) or math.isinf(n):
            return None
        return n
    except:
        return None

records = []
with open(INPUT, newline='', encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        # Safe coordinate parsing (allow nulls)
        lat = safe_float(row.get("FAC_LAT", ""))
        lon = safe_float(row.get("FAC_LONG", ""))

        # Penalties and violation counts
        penalty = to_num(row.get("FAC_TOTAL_PENALTIES", "0"))
        count = to_num(row.get("FAC_PENALTY_COUNT", "0"))

        if penalty == 0 and count == 0:
            continue  # skip facilities with no enforcement

        # Determine violation type from compliance status
        violation = "General violation"
        if row.get("CAA_COMPLIANCE_STATUS") and "Violation" in row.get("CAA_COMPLIANCE_STATUS"):
            violation = "Clean Air Act violation"
        elif row.get("CWA_COMPLIANCE_STATUS") and "Violation" in row.get("CWA_COMPLIANCE_STATUS"):
            violation = "Clean Water Act violation"
        elif row.get("RCRA_COMPLIANCE_STATUS") and "Violation" in row.get("RCRA_COMPLIANCE_STATUS"):
            violation = "RCRA hazardous waste violation"
        elif row.get("SDWA_COMPLIANCE_STATUS") and "Violation" in row.get("SDWA_COMPLIANCE_STATUS"):
            violation = "Safe Drinking Water Act violation"

        rec = {
            "facility": row.get("FAC_NAME", "").strip(),
            "city": row.get("FAC_CITY", "").strip(),
            "state": row.get("FAC_STATE", "").strip(),
            "lat": lat,   # may be None → JSON null
            "lon": lon,   # may be None → JSON null
            "violation": violation,
            "count": count,
            "penalty": penalty
        }
        records.append(rec)

# Write trimmed JSON
with open(OUTPUT, "w", encoding="utf-8") as out:
    json.dump(records, out, indent=2)

print(f"Wrote {len(records)} records to {OUTPUT}")
