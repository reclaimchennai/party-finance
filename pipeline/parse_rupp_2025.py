#!/usr/bin/env python3
"""
Parse the scanned ECI Notification No.56/2025/PPS-III (10 Oct 2025).

  Table I(A): current Registered Unrecognized Political Parties (RUPPs)
  Table I(B): 334 RUPPs delisted (Aug 2025)
  Table I(C): 474 RUPPs delisted (Sep 2025)

Each English page is a ruled 3-column grid (Sl. No. | Name | Address). We find
the grid lines with OpenCV, then OCR every cell on its own with tesseract,
which keeps multi-line names intact. A table switch is detected when the serial
number restarts at 1.

Output: data/derived/rupp_2025_notification.json
"""
import os
import re
import json
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor

import cv2
import numpy as np

PDF = "data/raw/parties_pan_india/rupp_2025_10_10.pdf"
OUT = "data/derived/rupp_2025_notification.json"
RAW = "data/raw/ocr/rupp_2025_cells.json"
FIRST_PAGE, LAST_PAGE = 5, 134          # English half of the notification
TABLE_NAMES = ["I(A)", "I(B)", "I(C)"]
EXPECTED = {"I(A)": 2049, "I(B)": 334, "I(C)": 474}   # stated in the notification / last serial


def render(page, tmp):
    base = os.path.join(tmp, f"pg{page:03d}")
    subprocess.run(["pdftoppm", "-r", "300", "-gray", "-f", str(page), "-l", str(page), "-png", PDF, base], check=True)
    path = [os.path.join(tmp, f) for f in os.listdir(tmp) if f.startswith(f"pg{page:03d}")][0]
    img = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
    os.remove(path)
    return deskew(img)


def deskew(img):
    """Rotate so the table's long horizontal rules are level."""
    bw = cv2.adaptiveThreshold(255 - img, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 15, -2)
    h = cv2.morphologyEx(bw, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (img.shape[1] // 20, 1)))
    lines = cv2.HoughLinesP(h, 1, np.pi / 1800, threshold=300, minLineLength=img.shape[1] // 3, maxLineGap=40)
    if lines is None:
        return img
    angles = [np.degrees(np.arctan2(y2 - y1, x2 - x1)) for x1, y1, x2, y2 in lines.reshape(-1, 4)]
    angles = [a for a in angles if abs(a) < 3]
    if not angles:
        return img
    ang = float(np.median(angles))
    if abs(ang) < 0.05:
        return img
    m = cv2.getRotationMatrix2D((img.shape[1] / 2, img.shape[0] / 2), ang, 1.0)
    return cv2.warpAffine(img, m, (img.shape[1], img.shape[0]), flags=cv2.INTER_LINEAR, borderValue=255)


def line_positions(mask, axis, min_frac):
    """Collapse a line mask into centre positions of lines along one axis."""
    proj = mask.sum(axis=axis) / 255
    span = mask.shape[axis]
    idx = np.where(proj > span * min_frac)[0]
    groups, cur = [], []
    for i in idx:
        if cur and i - cur[-1] > 6:
            groups.append(int(np.mean(cur)))
            cur = []
        cur.append(i)
    if cur:
        groups.append(int(np.mean(cur)))
    return groups


def grid(img):
    bw = cv2.adaptiveThreshold(255 - img, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 15, -2)
    h = cv2.morphologyEx(bw, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (img.shape[1] // 8, 1)))
    v = cv2.morphologyEx(bw, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, img.shape[0] // 40)))
    h = cv2.dilate(h, np.ones((3, 3), np.uint8))
    v = cv2.dilate(v, np.ones((3, 3), np.uint8))
    rows = line_positions(h, 1, 0.35)
    cols = line_positions(v, 0, 0.15)
    return rows, cols


# Column layouts seen on clean pages; used when a scan's rules are too faint or skewed
TEMPLATES = {"A": [283, 437, 984, 2312], "BC": [286, 494, 1235, 2308]}


def fit_columns(cols, page):
    """Snap each template line to the nearest detected rule, else shift the template."""
    tpl = TEMPLATES["A" if page < 92 else "BC"]
    offs = [min((c - t for c in cols), key=abs) for t in tpl] if cols else [999] * 4
    good = [o for o in offs if abs(o) < 60]
    shift = int(np.median(good)) if good else 0
    return [t + (o if abs(o) < 60 else shift) for t, o in zip(tpl, offs)]


def ocr(crop, psm="6", digits=False):
    if crop.size == 0:
        return ""
    extra = ["-c", "tessedit_char_whitelist=0123456789"] if digits else []
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
        cv2.imwrite(f.name, crop)
        r = subprocess.run(["tesseract", f.name, "-", "--psm", psm, "-l", "eng"] + extra, capture_output=True, text=True)
    os.remove(f.name)
    return re.sub(r"\s+", " ", r.stdout).strip()


def parse_page(page):
    with tempfile.TemporaryDirectory() as tmp:
        img = render(page, tmp)
    rows, cols = grid(img)
    if len(rows) < 3:
        return page, [], (len(rows), len(cols))
    c0, c1, c2, c3 = fit_columns(cols, page)
    out = []
    pad = 6
    for top, bot in zip(rows, rows[1:]):
        if bot - top < 40:
            continue
        name = ocr(img[top + pad:bot - pad, c1 + pad:c2 - pad])
        if len(re.findall(r"[A-Za-z]", name)) < 3 or re.search(r"Name of|Headquarter|Unrecogni[sz]ed Political", name, re.I):
            continue  # header or empty row
        sl = ocr(img[top + pad:bot - pad, c0 + pad:c1 - pad], "6", digits=True)
        m = re.search(r"\d{1,4}", sl)
        addr = ocr(img[top + pad:bot - pad, c2 + pad:c3 - pad])
        if len(re.findall(r"[A-Za-z]", addr)) < 5:
            continue  # stray band from a broken rule
        clean = lambda t: re.sub(r"^[\W_]+|[\s|;:_'.,-]+$", "", t.replace("|", " ")).strip()
        out.append({"page": page, "sl": int(m.group()) if m else None, "name": clean(name), "address": clean(addr)})
    head = ocr(img[max(0, rows[0] - 330):rows[0], :]) if rows[0] > 60 else ""
    if re.search(r"1\s*\(?\s*[cC]\s*\)", head):
        for r in out:
            r["table_start"] = "I(C)"
        out[0:1] and out[0].update(new_table="I(C)")
    elif re.search(r"1\s*\(?\s*[bB]\s*\)", head):
        out[0:1] and out[0].update(new_table="I(B)")
    return page, out, (len(rows), len(cols))


def is_anchor(sl, prev_anchor, nxt_anchor):
    return sl is not None and prev_anchor < sl and (nxt_anchor is None or sl < nxt_anchor)


def reconcile(rows):
    """Use OCR'd serials as anchors. Between two anchors a < b there must be exactly
    b - a - 1 rows; any extra unanchored rows are fragments of a cell that a stray
    rule split, so they are merged into the row above."""
    out = []
    # monotone anchors: keep serials that increase and are within a plausible step
    last = 0
    for r in rows:
        s = r.get("sl_ocr")
        r["_anchor"] = s if (s is not None and last < s <= last + 25) else None
        if r["_anchor"]:
            last = s
    i = 0
    while i < len(rows):
        r = rows[i]
        out.append(r)
        if r["_anchor"] is None:
            i += 1
            continue
        j = i + 1
        while j < len(rows) and rows[j]["_anchor"] is None:
            j += 1
        between = rows[i + 1:j]
        nxt = rows[j]["_anchor"] if j < len(rows) else None
        need = (nxt - r["_anchor"] - 1) if nxt else len(between)
        extra = len(between) - need
        # merge the extra fragments with the shortest addresses into their predecessor
        drop = set(sorted(range(len(between)), key=lambda k: len(between[k]["address"]))[:max(extra, 0)])
        for k, b in enumerate(between):
            if k in drop:
                tgt = out[-1]
                tgt["name"] = (tgt["name"] + " " + b["name"]).strip()
                tgt["address"] = (tgt["address"] + " " + b["address"]).strip()
                tgt["merged"] = tgt.get("merged", 0) + 1
            else:
                out.append(b)
        i = j
    for r in out:
        r.pop("_anchor", None)
    return out


def finalize(raw):
    # Table split: headings for I(B) are OCR'd reliably; I(C) is found where serials restart
    a = [r for r in raw if r["page"] < 92]
    bc = [r for r in raw if r["page"] >= 92]
    by_page = {}
    for r in bc:
        if r.get("sl_ocr"):
            by_page.setdefault(r["page"], []).append(r["sl_ocr"])
    c_start = next(p for p in sorted(by_page) if p > 100 and np.median(by_page[p]) < 40)
    tables = {"I(A)": a, "I(B)": [r for r in bc if r["page"] < c_start], "I(C)": [r for r in bc if r["page"] >= c_start]}
    final = []
    for name, rows in tables.items():
        if len(rows) != EXPECTED[name]:
            rows = reconcile(rows)
        for i, r in enumerate(rows, 1):
            r["table"], r["sl"] = name, i
            r.pop("new_table", None)
        print(f"{name}: {len(rows)} rows (pages {rows[0]['page']}-{rows[-1]['page']})")
        final.extend(rows)
    return final


def main():
    if os.path.exists(RAW) and "--reocr" not in sys.argv:
        raw = json.load(open(RAW))
    else:
        with ThreadPoolExecutor(8) as ex:
            results = list(ex.map(parse_page, range(FIRST_PAGE, LAST_PAGE + 1)))
        raw = []
        for page, recs, g in sorted(results):
            if not recs:
                print(f"  page {page}: no rows (grid {g})")
            for r in recs:
                r["sl_ocr"] = r.pop("sl")
            raw.extend(recs)
        with open(RAW, "w", encoding="utf-8") as f:
            json.dump(raw, f, indent=1, ensure_ascii=False)
    final = finalize(raw)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(final, f, indent=1, ensure_ascii=False)
    print("saved", OUT)


if __name__ == "__main__":
    main()
