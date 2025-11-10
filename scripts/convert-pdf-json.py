import pdfplumber, json, os, re
from datetime import date

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
INPUT_FILE = os.path.join(PROJECT_ROOT, "data", "All Current Final NPL Sites-20251110105748.pdf")
OUTPUT_FILE = os.path.join(PROJECT_ROOT, "data", "superfund.json")
ERROR_LOG = os.path.join(PROJECT_ROOT, "logs", "parse-errors.txt")

os.makedirs(os.path.dirname(ERROR_LOG), exist_ok=True)

sites = []
errors = []

with pdfplumber.open(INPUT_FILE) as pdf:
    for page_num, page in enumerate(pdf.pages, start=1):
        # Use extract_words to get tokens with positions
        words = page.extract_words()
        if not words:
            continue

        # Group words by line (using y0 coordinate)
        lines = {}
        for w in words:
            line_key = round(w["top"], 1)
            lines.setdefault(line_key, []).append(w)

        for line_num, (_, tokens) in enumerate(sorted(lines.items()), start=1):
            text_line = " ".join(t["text"] for t in tokens)
            if not text_line.strip() or text_line.startswith("Region") or "Site Name" in text_line:
                continue

            parts = re.split(r"\s{2,}", text_line.strip())
            if len(parts) < 8:
                errors.append(f"Page {page_num}, line {line_num}: {text_line}")
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

count = len(sites)
if not (350 <= count <= 400):
    raise ValueError(f"Unexpected site count: {count}. Parsing may have drifted.")

output = {
    "national_count": count,
    "as_of": str(date.today()),
    "sites": sites
}
with open(OUTPUT_FILE, "w", encoding="utf-8") as out:
    json.dump(output, out, indent=2)

if errors:
    with open(ERROR_LOG, "w", encoding="utf-8") as log:
        log.write("\n".join(errors))
        log.write("\n\n---\n")
        log.write(f"Total malformed rows: {len(errors)} out of {count + len(errors)} lines processed\n")
    print(f"Parsing anomalies logged to {ERROR_LOG}")

print(f"superfund.json created at {OUTPUT_FILE} with {count} current Final NPL sites")
