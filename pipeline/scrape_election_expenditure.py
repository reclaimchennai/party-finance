#!/usr/bin/env python3
"""
Collect election-expenditure statements for Tamil Nadu, 2004 onward.

  - ECI archive (old.eci.gov.in, 2004-2021): one category per election cycle, with
    national / state party subcategories; "Part" categories hold interim statements.
  - Current ECI site (2022 on): the expenditure-report catalog (fetch_eci_catalog.py).
  - CEO Tamil Nadu: statements of TN unrecognised parties (scrape_tn_rupps_erolls.py).

Kept: every statement by a Tamil Nadu party, and national parties' statements for
Tamil Nadu assembly elections (those cover TN alongside other states).

Output: data/raw/election_expenditure/*.pdf + manifest.json
"""
import os
import re
import json
import html
import time
import requests
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data/raw/election_expenditure")
ARCHIVE = "https://old.eci.gov.in"
HEADERS = {"User-Agent": "Mozilla/5.0 (party-finance research; github.com/reclaimchennai/party-finance)"}
NAV_FILES = {"15622", "9228", "8756", "13911"}
NAV_CATS = {"8", "10", "11", "15", "16", "17", "148", "238", "1581"}

# archive category -> (election label, statement kind, TN assembly election?)
ELECTIONS = {
    "320-ee-lok-sabha-2004-and-ae-of-andhra-pradesh-karnataka-orissa-and-sikkim": ("Lok Sabha 2004", "Full", False),
    "318-ee-assam-west-bengal-tamil-nadu-pondicherry-kerala-2006": ("Tamil Nadu Assembly 2006", "Full", True),
    "301-ee-lok-sabha-and-assembly-elections-2009": ("Lok Sabha 2009", "Full", False),
    "296-ee-assam-kerala-tamil-nadu-west-bengal-and-pudducherry-2011": ("Tamil Nadu Assembly 2011", "Full", True),
    "272-ee-lok-sabha-election-2014": ("Lok Sabha 2014", "Full", False),
    "260-ee-assamwest-bengalkeralatamil-nadu-and-puducherry-2016": ("Tamil Nadu Assembly 2016", "Full", True),
    "263-part-ee-assamwest-bengalkeralatamil-nadu-and-puducherry-2016": ("Tamil Nadu Assembly 2016", "Part", True),
    "1141-ee-lok-sabha-election-2019-state-legislative-assemblies": ("Lok Sabha 2019", "Full", False),
    "1149-part-ee-lok-sabha-election-2019-state-legislative-assemblies": ("Lok Sabha 2019", "Part", False),
    "1564-ee-2021": ("Tamil Nadu Assembly 2021", "Full", True),
    "1552-part-ee-2021": ("Tamil Nadu Assembly 2021", "Part", True),
}
TN_PARTY = re.compile(r"dravida munnetra|d\.?m\.?k|desiya murpokku|pattali makkal|marumalarchi|viduthalai chiruthaigal|"
                      r"naam tamilar|makkal needhi|amma makkal|tamil maanila|puthiya tamilagam|indiya jananayaka|"
                      r"kongunadu|manithaneya|tamilaga vettri|indian union muslim league", re.I)
NATIONAL = re.compile(r"bharatiya janata|indian national congress|communist party of india|bahujan samaj|"
                      r"aam aadmi|nationalist congress|all india trinamool", re.I)

session = requests.Session()
session.headers.update(HEADERS)


def get(url, **kw):
    for attempt in range(4):
        try:
            r = session.get(url, timeout=(15, 120), **kw)
            if r.status_code == 200:
                return r
        except requests.RequestException:
            pass
        time.sleep(2 + attempt * 3)
    return None


def category_files(slug, seen):
    """Files in a category and its subcategories: [(file_id, title, url, category_slug)]."""
    if slug in seen:
        return []
    seen.add(slug)
    out, page = [], 1
    while True:
        url = f"{ARCHIVE}/files/category/{slug}/" + (f"page/{page}/" if page > 1 else "")
        r = get(url)
        if not r:
            break
        t = r.text
        for furl, fid, title in re.findall(r'href=["\'](https?://old\.eci\.gov\.in/files/file/(\d+)-[a-z0-9-]+/)["\'][^>]*>\s*([^<]{3,}?)\s*<', t):
            if fid not in NAV_FILES:
                out.append((fid, html.unescape(title).strip(), furl, slug))
        if page == 1:
            for child in sorted(set(re.findall(r"files/category/(\d+-[a-z0-9-]+)/", t))):
                if child.split("-")[0] not in NAV_CATS and child not in seen and child not in ELECTIONS:
                    out.extend(category_files(child, seen))
        pages = [int(p) for p in re.findall(r"/page/(\d+)/", t)]
        if page >= max(pages, default=1):
            break
        page += 1
    return out


def download_archive_file(fid, furl):
    """File page -> ?do=download -> confirm link(s) carrying a session csrfKey."""
    r = get(furl + "?do=download")
    if not r:
        return []
    if r.headers.get("content-type", "").startswith("application/pdf"):
        return [("", r.content)]
    links = sorted(set(l.replace("&amp;", "&") for l in re.findall(r"href=['\"]([^'\"]*do=download&(?:amp;)?r=\d+[^'\"]*)['\"]", r.text)))
    files = []
    for link in links:
        f = get(link)
        if f and f.content[:4] == b"%PDF":
            files.append((re.search(r"r=(\d+)", link).group(1), f.content))
        time.sleep(0.5)
    return files


def main():
    os.makedirs(OUT, exist_ok=True)
    mpath = os.path.join(OUT, "manifest.json")
    manifest = json.load(open(mpath)) if os.path.exists(mpath) else {}
    have = {v.get("file_page") for v in manifest.values()}

    seen = set()
    for slug, (election, kind, tn_assembly) in ELECTIONS.items():
        files = category_files(slug, seen)
        keep = [f for f in files if TN_PARTY.search(f[1]) or (tn_assembly and NATIONAL.search(f[1]))]
        print(f"{election} ({kind}): {len(files)} statements, {len(keep)} kept")
        for fid, title, furl, cat in keep:
            if furl in have:
                continue
            for r_id, blob in download_archive_file(fid, furl):
                name = f"archive_{fid}{'_' + r_id if r_id else ''}.pdf"
                open(os.path.join(OUT, name), "wb").write(blob)
                manifest[name] = {"title": title, "election": election, "kind": kind, "source": "ECI archive",
                                  "file_page": furl, "category": cat, "pdf_url": furl}
                have.add(furl)
            json.dump(manifest, open(mpath, "w"), indent=1, ensure_ascii=False)
            time.sleep(0.5)

    # Current ECI site, 2022 onward
    cat = json.load(open(os.path.join(ROOT, "data/raw/metadata/expenditure_reports.json")))["message"]
    for group, items in cat.items():
        for it in items:
            t = it["title"]
            tn_el = re.search(r"tamil nadu", t, re.I)
            if not (TN_PARTY.search(t) or (tn_el and NATIONAL.search(t))):
                continue
            ls = re.search(r"lok sabha", t, re.I)
            year = re.search(r"(20\d\d)", t)
            election = f"Lok Sabha {year.group(1)}" if ls and year else (f"Tamil Nadu Assembly {year.group(1)}" if tn_el and year else t)
            kind = "Part" if re.search(r"\bpart\b", t, re.I) else ("Compliance" if re.search(r"compliance", t, re.I) else "Full")
            name = "eci_" + it["pdf_url"].rsplit("/", 1)[-1]
            if name not in manifest:
                r = get(it["pdf_url"])
                if r and r.content[:4] == b"%PDF":
                    open(os.path.join(OUT, name), "wb").write(r.content)
                    manifest[name] = {"title": t, "election": election, "kind": kind, "source": "ECI", "pdf_url": it["pdf_url"]}
    # CEO Tamil Nadu: statements of TN unrecognised parties
    labels = {"GELS": "Lok Sabha", "TNLA": "Tamil Nadu Assembly", "BE": "Bye-election"}
    for r0 in json.load(open(os.path.join(ROOT, "public/data/tn_rupp_filings_erolls.json"))):
        if r0["category"] != "Election Expenditure Statement" or r0["status"] != "Submitted" or not r0.get("pdf_url"):
            continue
        code, yr = r0["year"].split("-")
        name = "ceotn_" + r0["pdf_url"].rsplit("/", 1)[-1].replace(".PDF", ".pdf")
        if name not in manifest:
            r = get(r0["pdf_url"], verify=False)
            if r and r.content[:4] == b"%PDF":
                open(os.path.join(OUT, name), "wb").write(r.content)
                manifest[name] = {"title": f"{r0['party_name'].strip()} - Election Expenditure Statement, {labels.get(code, code)} {yr}",
                                  "election": f"{labels.get(code, code)} {yr}", "kind": "Full", "source": "CEO Tamil Nadu",
                                  "pdf_url": r0["pdf_url"], "portal_amount": r0.get("amount"), "filed": r0.get("filing_date")}
    json.dump(manifest, open(mpath, "w"), indent=1, ensure_ascii=False)
    print(f"{len(manifest)} statements in {OUT}")


if __name__ == "__main__":
    main()
