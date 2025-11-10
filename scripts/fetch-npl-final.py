import os, json
from datetime import date

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
RAW_FILE = os.path.join(PROJECT_ROOT, "data", "npl.raw.json")
OUTPUT_FILE = os.path.join(PROJECT_ROOT, "data", "superfund.json")
ERROR_LOG = os.path.join(PROJECT_ROOT, "logs", "ingest-errors.txt")

os.makedirs(os.path.dirname(ERROR_LOG), exist_ok=True)

with open(RAW_FILE, "r", encoding="utf-8") as f:
    raw = json.load(f)

features = raw.get("features", [])
sites = []
errors = []

def norm(val):
    if val is None:
        return ""
    if isinstance(val, str):
        return val.strip()
    return str(val).strip()

for f in features:
    attrs = f.get("attributes", {}) or {}
    geom = f.get("geometry", {}) or {}

    status = norm(attrs.get("Status"))
    deletion_date = norm(attrs.get("Deletion_Date"))
    deletion_notice = norm(attrs.get("Deletion_FR_Notice"))
    listing_date = norm(attrs.get("Listing_Date"))

    # Exclude Proposed and Deleted outright
    if status == "Proposed NPL Site":
        continue
    if status == "Deleted NPL Site":
        continue

    # For NPL Site entries, require a Listing_Date and no deletion markers
    if status == "NPL Site":
        if not listing_date:
            continue
        if deletion_date or deletion_notice:
            continue

    # Prefer geometry lat/lon if present; otherwise use attributes
    lat = attrs.get("Latitude")
    lon = attrs.get("Longitude")
    if "y" in geom and "x" in geom:
        lat = geom.get("y")
        lon = geom.get("x")

    site = {
        "region": norm(attrs.get("Region_ID")),
        "state": norm(attrs.get("State")),
        "name": norm(attrs.get("Site_Name")),
        "site_id": norm(attrs.get("SEMS_ID")),
        "epa_id": norm(attrs.get("Site_EPA_ID")),
        "city": norm(attrs.get("City")),
        "county": norm(attrs.get("County")),
        "latitude": "" if lat is None else lat,
        "longitude": "" if lon is None else lon,
        "npl_status": status,
        "proposed_date": norm(attrs.get("Proposed_Date")),
        "listing_date": listing_date,
        "construction_completion_date": norm(attrs.get("Construction_Completion_Date")),
        "deletion_date": deletion_date,
        "deletion_notice": deletion_notice
    }

    if not site["name"] or not site["state"]:
        errors.append(f"Missing required fields for feature: Site_Name={attrs.get('Site_Name')}, State={attrs.get('State')}")
        continue

    sites.append(site)

count = len(sites)
# Sanity band for active Final NPL sites
if not (300 <= count <= 600):
    errors.append(f"Unexpected site count: {count}. Verify filter against data/npl.raw.json.")

output = {
    "national_count": count,
    "as_of": str(date.today()),
    "source": "EPA ArcGIS NPL Sites with Status Information (Status='NPL Site' with Listing_Date, excluding Deletion markers)",
    "sites": sites
}

with open(OUTPUT_FILE, "w", encoding="utf-8") as out:
    json.dump(output, out, indent=2)

if errors:
    with open(ERROR_LOG, "w", encoding="utf-8") as log:
        log.write("\n".join(errors))
        log.write("\n\n---\n")
        log.write(f"Total anomalies: {len(errors)} across {len(features)} features inspected\n")
    print(f"Ingest anomalies logged to {ERROR_LOG}")

print(f"superfund.json created at {OUTPUT_FILE} with {count} current Final NPL sites")
