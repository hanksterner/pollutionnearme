import os, json, re
from datetime import date
from pdf2image import convert_from_path
import pytesseract

# Explicit path to tesseract.exe (optional if PATH is set)
pytesseract.pytesseract.tesseract_cmd = r"C:\Users\kurtb\AppData\Local\Programs\Tesseract-OCR\tesseract.exe"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
INPUT_FILE = os.path.join(PROJECT_ROOT, "data", "All Current Final NPL Sites-20251110105748.pdf")
OUTPUT_FILE = os.path.join(PROJECT_ROOT, "data", "superfund.json")
ERROR_LOG = os.path.join(PROJECT_ROOT, "logs", "ocr-errors.txt")

# Ensure logs directory exists
os.makedirs(os.path.dirname(ERROR_LOG), exist_ok=True)

sites = []
errors = []

# Convert PDF pages to images (lower dpi for speed)
pages = convert_from_path(INPUT_FILE, dpi=200)

for page_num, page in enumerate(pages, start=1):
    text = pytesseract.image_to_string(page, lang="eng")
    for line_num, line in enumerate(text.split("\n"), start=1):
        if not line.strip() or line.startswith("Region") or "Site Name" in line:
            continue

        # Split line into columns by 2+ spaces
        parts = re.split(r"\s{2,}", line.strip())
        if len(parts) < 8:
            errors.append(f"Page {page_num}, line {line_num}: {line}")
            continue

        site = {
            "region": parts[0],
            "state": parts[1],
            "name": parts[2],
            "site_id": parts[3],
            "epa_id": parts[4],
            "address": parts[5],
            "city": parts[6],
            "zip": parts[7],
            "county": parts[8] if len(parts) > 8 else None,
            "federal_facility": parts[9] if len(parts) > 9 else None,
            "native_entity": parts[10] if len(parts) > 10 else None,
            "latitude": parts[11] if len(parts) > 11 else None,
            "longitude": parts[12] if len(parts) > 12 else None,
            "npl_status_date": parts[13] if len(parts) > 13 else None
        }
        sites.append(site)

# Sanity check
count = len(sites)
if not (350 <= count <= 400):
    raise ValueError(f"Unexpected site count: {count}. OCR may have drifted.")

# Write JSON output
output = {
    "national_count": count,
    "as_of": str(date.today()),
    "sites": sites
}
with open(OUTPUT_FILE, "w", encoding="utf-8") as out:
    json.dump(output, out, indent=2)

# Write error log with summary
if errors:
    with open(ERROR_LOG, "w", encoding="utf-8") as log:
        log.write("\n".join(errors))
        log.write("\n\n---\n")
        log.write(f"Total malformed rows: {len(errors)} out of {count + len(errors)} lines processed\n")
    print(f"OCR anomalies logged to {ERROR_LOG}")

print(f"superfund.json created at {OUTPUT_FILE} with {count} current Final NPL sites")
