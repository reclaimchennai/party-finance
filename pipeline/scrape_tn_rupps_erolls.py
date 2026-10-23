#!/usr/bin/env python3
"""
Scraper for Chief Electoral Officer, Tamil Nadu (erolls.tn.gov.in)
RUPPs Report Submitted Status & Financial Filings.

The portal has three summary tables (Contribution, Annual Audit, Election
Expenditure). Each year row links to a "submitted" list and a "not submitted"
list. Submitted lists have two column groups: filed on/before the due date
and filed after the due date.

  Annual audit  : Sl | Name | View | Address | date, receipt, expenditure (on time) | date, receipt, expenditure (late) | Remarks
  Contribution  : Sl | Name | View | Address | date, amount (on time) | date, amount (late) | Remarks
  Expenditure   : Sl | Name | View | Address | ... (election-wise statements)
"""

import os
import re
import json
import time
import requests
from bs4 import BeautifulSoup
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_URL = "https://www.erolls.tn.gov.in/dashboard/RUPPs.aspx"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = "CEO Tamil Nadu (erolls.tn.gov.in)"

# (summary table index, listview id, submitted link, not-submitted link, category)
TABLES = [
    (0, "lv_Contribution_Count", "lnk_Contribution", "lnk_Contribution_Not", "Form 24A Contribution Report"),
    (1, "lv_Annual_Count", "lnk_Annual", "lnk_Annual_Not", "Annual Audit Report"),
    (2, "lv_Expenditure_Count", "lnk_Expenditure", "lnk_Contribution_Not", "Election Expenditure Statement"),
]


def get_page(session):
    r = session.get(BASE_URL, headers=HEADERS, verify=False, timeout=30)
    return BeautifulSoup(r.text, "html.parser")


def postback(session, target):
    soup = get_page(session)
    form = {i["name"]: i.get("value", "") for i in soup.find_all("input")
            if i.get("name") and i.get("type") == "hidden"}
    form["__EVENTTARGET"] = target
    form["__EVENTARGUMENT"] = ""
    r = session.post(BASE_URL, data=form, headers=HEADERS, verify=False, timeout=60)
    return BeautifulSoup(r.text, "html.parser")


def to_num(s):
    s = re.sub(r"[^\d.]", "", s or "")
    try:
        return float(s) if s else None
    except ValueError:
        return None


def norm_date(s):
    s = (s or "").strip()
    return s if re.match(r"^\d{2}/\d{2}/\d{4}$", s) else ""


def parse_submitted(soup, year, category):
    tbl = soup.find("table")
    if not tbl:
        return []
    out = []
    for tr in tbl.find_all("tr"):
        tds = tr.find_all(["th", "td"])
        cells = [c.get_text(" ", strip=True) for c in tds]
        if len(cells) < 5 or not cells[0].isdigit():
            continue
        link = next((a.get("href") for a in tr.find_all("a")
                     if a.get("href") and "financialreport" in a.get("href").lower()), None)
        rest = cells[4:]
        rec = {
            "year": year, "category": category, "status": "Submitted",
            "party_name": cells[1], "address": cells[3],
            "pdf_url": link, "source": SOURCE,
        }
        if category == "Annual Audit Report":
            on, late = rest[0:3], rest[3:6]
            grp, timing = (on, "On time") if norm_date(on[0] if on else "") or any(on[1:3]) else (late, "Late")
            grp = grp + [""] * (3 - len(grp))
            rec.update({
                "filing_date": norm_date(grp[0]), "timing": timing,
                "total_receipts": to_num(grp[1]), "total_expenditure": to_num(grp[2]),
                "remarks": rest[6] if len(rest) > 6 else "",
            })
            rec["amount"] = rec["total_receipts"]
        else:
            # Contribution (amount shown) and election expenditure (amount spent) share one layout
            on, late = rest[0:2], rest[2:4]
            grp, timing = (on, "On time") if norm_date(on[0] if on else "") or (len(on) > 1 and on[1]) else (late, "Late")
            grp = grp + [""] * (2 - len(grp))
            rec.update({
                "filing_date": norm_date(grp[0]), "timing": timing,
                "amount": to_num(grp[1]),
                "remarks": rest[4] if len(rest) > 4 else "",
            })
        if not rec["filing_date"] and rec.get("timing") in ("On time", "Late") and \
                not any(rec.get(k) for k in ("amount", "total_receipts", "total_expenditure")):
            rec["timing"] = "Unknown"
        out.append(rec)
    return out


def parse_not_submitted(soup, year, category):
    tbl = soup.find("table")
    if not tbl:
        return []
    out = []
    for tr in tbl.find_all("tr"):
        cells = [c.get_text(" ", strip=True) for c in tr.find_all(["th", "td"])]
        if len(cells) < 2 or not cells[0].isdigit():
            continue
        out.append({
            "year": year, "category": category, "status": "Not submitted",
            "party_name": cells[1], "address": cells[2] if len(cells) > 2 else "",
            "filing_date": "", "timing": "Not filed", "amount": None,
            "pdf_url": None, "source": SOURCE,
        })
    return out


def main():
    print("Scraping Chief Electoral Officer Tamil Nadu RUPPs reports...")
    session = requests.Session()
    soup = get_page(session)
    tables = soup.find_all("table")

    records, summary = [], []
    for t_idx, lv, lnk, lnk_not, category in TABLES:
        if t_idx >= len(tables):
            continue
        rows = [tr for tr in tables[t_idx].find_all("tr") if tr.find("td")]
        for i, tr in enumerate(rows):
            cells = [c.get_text(strip=True) for c in tr.find_all("td")]
            year = cells[0]
            summary.append({"category": category, "year": year,
                            "total_rupps": to_num(cells[1]), "submitted": to_num(cells[2]),
                            "not_submitted": to_num(cells[3])})
            base = f"ctl00$ContentPlaceHolder1${lv}$ctrl{i}$ctl00$"
            sub = parse_submitted(postback(session, base + lnk), year, category)
            time.sleep(0.4)
            nsub = parse_not_submitted(postback(session, base + lnk_not), year, category)
            time.sleep(0.4)
            print(f"  {category} {year}: {len(sub)} submitted, {len(nsub)} not submitted "
                  f"(portal says {cells[2]}/{cells[3]})")
            records.extend(sub + nsub)

    payload = records
    for d in ("data/derived", "public/data"):
        with open(os.path.join(ROOT, d, "tn_rupp_filings_erolls.json"), "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=1, ensure_ascii=False)
        with open(os.path.join(ROOT, d, "tn_rupp_filing_summary.json"), "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=1, ensure_ascii=False)
    print(f"Saved {len(records)} records and {len(summary)} summary rows.")


if __name__ == "__main__":
    main()
