import csv, json, os
from datetime import date

# Resolve paths relative to the script location
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
INPUT_FILE = os.path.join(PROJECT_ROOT, "data", "nplfinalbydate.txt")
OUTPUT_FILE = os.path.join(PROJECT_ROOT, "data", "superfund.json")

sites_by_id = {}

with open(INPUT_FILE, newline="", encoding="latin-1") as f:
    reader = csv.DictReader(f)
    for row in reader:
        epa_id = row["SITE_EPA_ID"].strip()
        federal = row["FEDERAL"].strip().upper()
        final_date = row["FINAL_DATE"].strip()

        # Skip deleted or proposed sites
        if federal in ("D", "P"):
            continue

        # Deduplicate: keep only the latest FINAL_DATE per site
        if epa_id not in sites_by_id or final_date > sites_by_id[epa_id]["final_date"]:
            sites_by_id[epa_id] = {
                "epa_id": epa_id,
                "name": row["SITE_NAME"].strip(),
                "city": row["SITE_CITY"].strip(),
                "state": row["STATE"].strip(),
                "region": row["REGION"].strip(),
                "federal": federal,
                "final_date": final_date,
                "score": float(row["SITE_SCORE"]) if row["SITE_SCORE"] else None
            }

sites = list(sites_by_id.values())

output = {
    "national_count": len(sites),
    "as_of": str(date.today()),
    "sites": sites
}

with open(OUTPUT_FILE, "w", encoding="utf-8") as out:
    json.dump(output, out, indent=2)

print(f"superfund.json created at {OUTPUT_FILE} with {len(sites)} current Final NPL sites")
