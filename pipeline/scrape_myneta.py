#!/usr/bin/env python3
"""
Historical party finances from ADR's MyNeta (myneta.info/party), which transcribes the
annual audit reports and Form 24A contribution reports parties file with the ECI,
back to FY 2001-02 for national and state parties.

  statements : balance sheet, income heads and expenditure heads per party-year
               (action=itr), amounts in lakh as published -> rupees
  donations  : per-year Form 24A totals (summary page) and the top 60 donors of each
               party-year (action=donation, first two pages; run with --donors)

Every fetched page is cached under data/raw/myneta/html/ so reruns are offline.

Outputs
  data/derived/myneta_statements.json
  data/derived/myneta_donations.json        (with --donors)
"""
import os
import re
import sys
import json
import html
import time
import hashlib
import requests
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "data/raw/myneta/html")
BASE = "https://myneta.info/party/index.php"
HEADERS = {"User-Agent": "Mozilla/5.0 (party-finance research; github.com/reclaimchennai/party-finance)"}
os.makedirs(CACHE, exist_ok=True)
session = requests.Session()


def fetch(query):
    path = os.path.join(CACHE, hashlib.md5(query.encode()).hexdigest()[:16] + ".html")
    if os.path.exists(path) and os.path.getsize(path) > 2000:
        return open(path, encoding="utf-8", errors="ignore").read()
    for attempt in range(4):
        try:
            r = requests.get(f"{BASE}?{query}" if query else BASE, headers=HEADERS, timeout=(10, 40))
            if r.status_code == 200 and len(r.text) > 2000:
                with open(path, "w", encoding="utf-8") as f:
                    f.write(r.text)
                time.sleep(0.25)
                return r.text
        except requests.RequestException:
            pass
        time.sleep(2 + attempt * 3)
    return ""


def clean(s):
    return html.unescape(re.sub(r"<[^>]+>", " ", s)).replace("\xa0", " ").strip()


def rupees(s):
    """'Rs. 1,835.23 Lacs' -> 183523000 ; '0' -> 0"""
    s = s.replace(",", "")
    m = re.search(r"(-?\d+(?:\.\d+)?)", s)
    if not m:
        return None
    v = float(m.group(1))
    if re.search(r"lac|lakh", s, re.I):
        v *= 1e5
    elif re.search(r"cror", s, re.I):
        v *= 1e7
    return round(v)


def amount_rs(s):
    """'Rs. 2,81,00,943.00 2 Cror+' -> 28100943 (the trailing words are a rounded restatement)"""
    m = re.search(r"Rs\.?\s*([\d,]+(?:\.\d+)?)", s or "")
    return round(float(m.group(1).replace(",", ""))) if m else None


def parties_and_links():
    t = fetch("")
    parties = {}
    for m in re.finditer(r"<b>([^<]+)</b><br>\s*<div class='w3-bar'>\s*<a [^>]*action=summary&id=(\d+)", t):
        name = re.sub(r"\s+", " ", m.group(1)).strip()
        abbr = re.search(r"\(([^()]*(?:\([^()]*\))?[^()]*)\)\s*$", name)
        parties[int(m.group(2))] = {"myneta_id": int(m.group(2)), "name": re.sub(r"\s*\([^()]*(?:\([^()]*\))?[^()]*\)\s*$", "", name).strip(),
                                    "abbr": abbr.group(1).strip() if abbr else ""}
    itr = sorted(set((int(i), int(y)) for y, i in re.findall(r"action=itr&year=(\d+)&id=(\d+)", t)))
    don = sorted(set((int(i), int(y)) for y, i in re.findall(r"action=donation&year=(\d+)&id=(\d+)", t)))
    return parties, itr, don


SECTIONS = ("Assets", "Liabilities", "Income", "Expenditure")


def parse_statement(t):
    """Rows of the statement table -> {section: {label: rupees}} plus printed totals."""
    out = {s: {} for s in SECTIONS}
    totals = {}
    section = None
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", t, re.S):
        cells = [clean(c) for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, re.S)]
        cells = [c for c in cells if c]
        if not cells:
            continue
        if len(cells) == 1 and cells[0] in SECTIONS:
            section = cells[0]
            continue
        if len(cells) == 1 and re.match(r"Total (Assets|Liabilities|Income|Expenditure)", cells[0]):
            kind = cells[0].split()[1]
            totals[kind] = rupees(cells[0][len("Total " + kind):])
            section = None   # a section ends at its printed total
            continue
        if section and len(cells) >= 2:
            if re.match(r"Total ", cells[0]):
                totals[cells[0].split()[1]] = rupees(cells[1])
                section = None
            elif rupees(cells[1]) is not None:
                out[section][re.sub(r"\s+", " ", cells[0])] = rupees(cells[1])
    return out, totals


def statements(parties, links):
    def one(link):
        pid, year = link
        t = fetch(f"action=itr&year={year}&id={pid}")
        if not t:
            return None
        sec, totals = parse_statement(t)
        return {**parties.get(pid, {"myneta_id": pid}), "fy": f"{year - 1}-{str(year)[2:]}",
                "url": f"{BASE}?action=itr&year={year}&id={pid}", **{k.lower(): v for k, v in sec.items()},
                "printed_totals": totals}
    with ThreadPoolExecutor(4) as ex:
        rows = [r for r in ex.map(one, links) if r]
    return rows


def parse_donors(t):
    rows = []
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", t, re.S):
        cells = [clean(c) for c in re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)]
        if len(cells) >= 7 and cells[0].isdigit():
            rows.append({"name": re.sub(r"\s+", " ", cells[1]), "address": re.sub(r"\s+", " ", cells[2]),
                         "amount": amount_rs(cells[3]), "mode": re.sub(r"\s+", " ", cells[4]),
                         "pan_given": cells[5].strip().upper().startswith("Y"), "fy": cells[6]})
    pages = [int(x) for x in re.findall(r"action=donation&year=\d+&id=\d+&page=(\d+)", t)]
    return rows, max(pages) if pages else 1


def donation_summary(pid):
    """Per-year Form 24A totals and donor counts for one party (one page)."""
    t = fetch(f"action=summary&id={pid}&show=donation")
    out = {}
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", t, re.S):
        cells = [clean(c) for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, re.S)]
        if len(cells) >= 3 and re.fullmatch(r"\d{4}-\d{2}", cells[0]):
            out[cells[0]] = {"total": amount_rs(cells[1]), "n_donors": int(re.sub(r"\D", "", cells[2]) or 0)}
    return out


TOP_PAGES = 2   # donor lists are sorted by amount, largest first: two pages = the top 60 donors


def donations(parties, links):
    summaries = {}
    with ThreadPoolExecutor(4) as ex:
        for pid, summ in zip(sorted(parties), ex.map(donation_summary, sorted(parties))):
            summaries[pid] = summ

    def one(link):
        pid, year = link
        fy = f"{year}-{str(year + 1)[2:]}"   # donation pages are keyed by the FY's start year (statements by its end year)
        q = f"action=donation&year={year}&id={pid}"
        donors, pages = parse_donors(fetch(q))
        for p in range(2, min(pages, TOP_PAGES) + 1):
            more, _ = parse_donors(fetch(f"action=donation&year={year}&id={pid}&page={p}"))
            donors += more
        summ = summaries.get(pid, {}).get(fy, {})
        print(f"  donors {pid} {year}: top {len(donors)} of {summ.get('n_donors')}", flush=True)
        return {**parties.get(pid, {"myneta_id": pid}), "fy": fy, "url": f"{BASE}?{q}",
                "n_donors": summ.get("n_donors", len(donors)),
                "total": summ.get("total", sum(d["amount"] or 0 for d in donors)), "donors": donors}
    with ThreadPoolExecutor(4) as ex:
        return list(ex.map(one, links))


def main():
    parties, itr, don = parties_and_links()
    print(f"{len(parties)} parties, {len(itr)} statements, {len(don)} donation years")
    rows = statements(parties, itr)
    with open(os.path.join(ROOT, "data/derived/myneta_statements.json"), "w", encoding="utf-8") as f:
        json.dump(rows, f, indent=1, ensure_ascii=False)
    print(f"statements: {len(rows)} saved")
    if "--donors" in sys.argv:
        d = donations(parties, don)
        with open(os.path.join(ROOT, "data/derived/myneta_donations.json"), "w", encoding="utf-8") as f:
            json.dump(d, f, separators=(",", ":"), ensure_ascii=False)
        print(f"donations: {len(d)} party-years, {sum(len(x['donors']) for x in d)} top-donor rows")


if __name__ == "__main__":
    main()
