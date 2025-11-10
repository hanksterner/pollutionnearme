import os, requests, json

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
RAW_OUT = os.path.join(PROJECT_ROOT, "data", "npl.raw.json")

url = "https://services.arcgis.com/cJ9YHowT8TU7DUyn/arcgis/rest/services/Superfund_National_Priorities_List_(NPL)_Sites_with_Status_Information/FeatureServer/0/query"
params = {
    "where": "1=1",
    "outFields": "*",
    "returnGeometry": "true",
    "f": "json",
    "outSR": "4326"
}

resp = requests.get(url, params=params, timeout=60)
resp.raise_for_status()
data = resp.json()

os.makedirs(os.path.join(PROJECT_ROOT, "data"), exist_ok=True)
with open(RAW_OUT, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)

features = len(data.get("features", []))
print(f"Saved raw NPL feature layer to {RAW_OUT} with {features} features")
