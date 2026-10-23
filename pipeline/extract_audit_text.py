#!/usr/bin/env python3
"""
Dump every downloaded ECI annual audit PDF to page-marked text for figure extraction.

Pages with almost no text layer are OCR'd with tesseract. Output:
  data/raw/ocr/audit_text/<n>.txt   ("=== PAGE k ===" markers)
  data/raw/ocr/audit_text/index.json  (file -> party, FY, ECI url, pages, OCR'd pages)
"""
import os
import re
import json
import glob
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor

SRC = "data/raw/annual_audits"
OUT = "data/raw/ocr/audit_text"


def catalog_index():
    """Map each downloaded file to its catalog entry via download_reports.py's manifest."""
    idx = {}
    for fname, it in json.load(open(os.path.join(SRC, "manifest.json"))).items():
        fy = re.search(r"(\d{4})-(\d{4})", it["year_group"])
        idx[fname] = {"title": it["title"], "pdf_url": it["pdf_url"],
                      "fy": f"{fy.group(1)}-{fy.group(2)[2:]}" if fy else "", "year_group": it["year_group"]}
    return idx


def page_count(pdf):
    out = subprocess.run(["pdfinfo", pdf], capture_output=True, text=True).stdout
    m = re.search(r"Pages:\s+(\d+)", out)
    return int(m.group(1)) if m else 0


def dump(job):
    n, pdf = job
    pages = page_count(pdf)
    texts, ocred = [], []
    for p in range(1, pages + 1):
        t = subprocess.run(["pdftotext", "-layout", "-f", str(p), "-l", str(p), pdf, "-"],
                           capture_output=True, text=True).stdout
        if len(re.sub(r"\s", "", t)) < 80:
            with tempfile.TemporaryDirectory() as tmp:
                subprocess.run(["pdftoppm", "-r", "300", "-gray", "-f", str(p), "-l", str(p), "-png", pdf, f"{tmp}/pg"], check=False)
                imgs = glob.glob(f"{tmp}/pg*.png")
                if imgs:
                    t = subprocess.run(["tesseract", imgs[0], "-", "--psm", "4", "-l", "eng"],
                                       capture_output=True, text=True).stdout
                    ocred.append(p)
        texts.append(f"=== PAGE {p} ===\n{t}")
    with open(f"{OUT}/{n:03d}.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(texts))
    return n, pages, ocred


def main():
    os.makedirs(OUT, exist_ok=True)
    meta = catalog_index()
    files = sorted(meta)
    jobs = [(i, os.path.join(SRC, f)) for i, f in enumerate(files, 1)]
    with ThreadPoolExecutor(8) as ex:
        res = {n: (pages, ocred) for n, pages, ocred in ex.map(dump, jobs)}
    index = []
    for i, f in enumerate(files, 1):
        m = meta.get(f, {})
        index.append({"n": i, "text_file": f"{i:03d}.txt", "pdf_file": f, **m,
                      "pages": res[i][0], "ocr_pages": res[i][1]})
    json.dump(index, open(f"{OUT}/index.json", "w"), indent=1, ensure_ascii=False)
    print(f"{len(index)} documents; {sum(1 for d in index if d['ocr_pages'])} needed OCR; "
          f"{sum(1 for d in index if not d.get('pdf_url'))} not matched to catalog")


if __name__ == "__main__":
    main()
