#!/usr/bin/env python3
"""
Download the audited-accounts PDFs that Tamil Nadu RUPPs filed with the CEO Tamil Nadu,
so their totals can be itemised (the portal's table only gives receipts and expenditure).

Selection: every filing with receipts of Rs 10 lakh or more, plus every year of the
TN parties the dashboard profiles. Writes data/raw/tn_rupp_audits/ with a manifest.json
in the same shape as data/raw/annual_audits/manifest.json.
"""
import os
import json
import time
import requests
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data/raw/tn_rupp_audits")
HEADERS = {"User-Agent": "Mozilla/5.0"}
FOCUS = ["Pattali", "Viduthalai Chiruthaigal", "Marumalarchi Dravida", "Makkal Needhi", "Amma Makkal",
         "Vettri", "Naam Tamilar", "Puthiya Tamilagam", "Kongunadu", "Manithaneya", "Indiya Jananayaka",
         "Tamil Maanila"]


def main():
    os.makedirs(OUT, exist_ok=True)
    filings = json.load(open(os.path.join(ROOT, "public/data/tn_rupp_filings_erolls.json")))
    picked = [r for r in filings if r["category"] == "Annual Audit Report" and r["status"] == "Submitted" and r.get("pdf_url")
              and ((r.get("total_receipts") or 0) >= 1e6 or any(f in r["party_name"] for f in FOCUS))]
    manifest = {}
    for r in picked:
        fname = r["pdf_url"].rsplit("/", 1)[-1].replace(".PDF", ".pdf")
        path = os.path.join(OUT, fname)
        if not (os.path.exists(path) and os.path.getsize(path) > 1000):
            resp = requests.get(r["pdf_url"], headers=HEADERS, verify=False, timeout=90)
            if resp.status_code != 200:
                print("failed", resp.status_code, r["pdf_url"])
                continue
            open(path, "wb").write(resp.content)
            time.sleep(0.3)
        fy = r["year"]
        manifest[fname] = {"pdf_url": r["pdf_url"], "title": f"{r['party_name'].strip()} (Annual Audit Report for the Financial Year {fy[:4]}-{fy[-2:]})",
                           "year_group": f"Annual Audit Reports {fy}", "source": "CEO Tamil Nadu"}
    json.dump(manifest, open(os.path.join(OUT, "manifest.json"), "w"), indent=1, ensure_ascii=False)
    print(f"{len(manifest)} PDFs in {OUT}")


if __name__ == "__main__":
    main()
