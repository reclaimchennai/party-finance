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

import sys

# default: ECI audit reports; `extract_audit_text.py tn` handles the CEO Tamil Nadu RUPP filings
# `ee` handles election-expenditure statements (data/raw/election_expenditure)
SRC, OUT = ("data/raw/tn_rupp_audits", "data/raw/ocr/tn_rupp_audit_text") if "tn" in sys.argv[1:] else \
           ("data/raw/election_expenditure", "data/raw/ocr/ee_text") if "ee" in sys.argv[1:] else \
           ("data/raw/annual_audits", "data/raw/ocr/audit_text")


def junk(text):
    """A scanned page's embedded text layer is often garbage (wrong encodings, CJK noise)."""
    chars = re.sub(r"\s", "", text)
    if len(chars) < 80:
        return True
    good = len(re.findall(r"[A-Za-z0-9.,()/:-]", chars))
    return good / len(chars) < 0.85


def catalog_index():
    """Map each downloaded file to its catalog entry via download_reports.py's manifest."""
    idx = {}
    for fname, it in json.load(open(os.path.join(SRC, "manifest.json"))).items():
        fy = re.search(r"(\d{4})-(\d{4})", it.get("year_group", ""))
        idx[fname] = {"title": it["title"], "pdf_url": it["pdf_url"],
                      "fy": f"{fy.group(1)}-{fy.group(2)[2:]}" if fy else "", "year_group": it.get("year_group", ""),
                      **{k: it[k] for k in ("election", "kind", "source", "portal_amount") if k in it}}
    return idx


def page_count(pdf):
    out = subprocess.run(["pdfinfo", pdf], capture_output=True, text=True).stdout
    m = re.search(r"Pages:\s+(\d+)", out)
    return int(m.group(1)) if m else 0


# Election-expenditure statements carry their summary up front; the rest is schedules.
MAX_PAGES = 20 if OUT.endswith("ee_text") else 10_000


def dump(job):
    n, pdf = job
    pages = min(page_count(pdf), MAX_PAGES)
    texts, ocred = [], []
    for p in range(1, pages + 1):
        t = subprocess.run(["pdftotext", "-layout", "-f", str(p), "-l", str(p), pdf, "-"],
                           capture_output=True, text=True).stdout
        if junk(t):
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
    sel_path = os.path.join(SRC, "selected.json")
    if os.path.exists(sel_path):
        files = [f for f in files if f in set(json.load(open(sel_path)))]
    jobs = [(i, os.path.join(SRC, f)) for i, f in enumerate(files, 1)]
    with ThreadPoolExecutor(8) as ex:
        res = {n: (pages, ocred) for n, pages, ocred in ex.map(dump, jobs)}
    index = []
    for i, f in enumerate(files, 1):
        m = meta.get(f, {})
        index.append({"n": i, "text_file": f"{i:03d}.txt", "pdf_file": f, **m, "total_pages": page_count(os.path.join(SRC, f)),
                      "pages": res[i][0], "ocr_pages": res[i][1]})
    json.dump(index, open(f"{OUT}/index.json", "w"), indent=1, ensure_ascii=False)
    print(f"{len(index)} documents; {sum(1 for d in index if d['ocr_pages'])} needed OCR; "
          f"{sum(1 for d in index if not d.get('pdf_url'))} not matched to catalog")


if __name__ == "__main__":
    main()
