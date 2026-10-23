#!/usr/bin/env python3
"""OCR the scanned ECI Notification No.56/2025/PPS-III (10 Oct 2025) RUPP list into per-page TSV."""
import os, subprocess, glob
from concurrent.futures import ThreadPoolExecutor

PDF = "data/raw/parties_pan_india/rupp_2025_10_10.pdf"
OUT = "data/raw/ocr/rupp_2025"
os.makedirs(OUT, exist_ok=True)
n = int([l for l in subprocess.run(["pdfinfo", PDF], capture_output=True, text=True).stdout.splitlines()
         if l.startswith("Pages")][0].split()[1])

def ocr(i):
    base = f"{OUT}/p{i:03d}"
    if os.path.exists(base + ".tsv") and os.path.getsize(base + ".tsv") > 0:
        return
    subprocess.run(["pdftoppm", "-r", "300", "-gray", "-f", str(i), "-l", str(i), "-png", PDF, f"{OUT}/img{i:03d}"], check=True)
    img = glob.glob(f"{OUT}/img{i:03d}*.png")[0]
    subprocess.run(["tesseract", img, base, "--psm", "6", "-l", "eng", "tsv"], capture_output=True)
    os.remove(img)

with ThreadPoolExecutor(8) as ex:
    list(ex.map(ocr, range(1, n + 1)))
print("done", n)
