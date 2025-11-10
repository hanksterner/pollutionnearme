import pikepdf, os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
INPUT_FILE = os.path.join(PROJECT_ROOT, "data", "All Current Final NPL Sites-20251110105748.pdf")
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "data")

pdf = pikepdf.open(INPUT_FILE)
embedded_files = pdf.Root.Names.EmbeddedFiles.Names

for i in range(0, len(embedded_files), 2):
    name = embedded_files[i]
    file_spec = embedded_files[i+1]
    ef_stream = file_spec['EF']['F']
    data = bytes(ef_stream.read_bytes())

    out_path = os.path.join(OUTPUT_DIR, name)
    with open(out_path, "wb") as out_file:
        out_file.write(data)
    print(f"Extracted attachment {i//2+1}: {out_path}")
