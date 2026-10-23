#!/usr/bin/env python3
"""
Build the analysis-ready tables the dashboard loads (public/data/dash/*.json).

Joins every source on one canonical party key:
  - ECI audited annual accounts (figures extracted per report, data/raw/ocr/audit_extract)
  - CEO Tamil Nadu RUPP filings (receipts / expenditure / Form 24A totals, on-time vs late vs not filed)
  - SBI electoral bond disclosures (every bond, all recipient parties)
  - ECI document catalogs (audit, contribution and election-expenditure reports)
  - TN party profiles (parties.json: leaders, symbols, logos)

Outputs
  dash/parties.json     one row per party with identity + rollups
  dash/finance.json     party x financial year facts, each with its source
  dash/compliance.json  party x year x report filing status
  dash/documents.json   every source document with party key
"""
import os
import re
import json
import glob
import difflib
from collections import defaultdict
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public/data/dash")
os.makedirs(OUT, exist_ok=True)


def load(path):
    with open(os.path.join(ROOT, path), encoding="utf-8") as f:
        return json.load(f)


def norm(s):
    s = s.lower().replace("&", " and ").replace("\xa0", " ")
    s = re.sub(r"\bjanta\b", "janata", s)
    s = re.sub(r"\bmunnettra\b", "munnetra", s)
    s = re.sub(r"\bkazagam\b", "kazhagam", s)
    s = re.sub(r"\bpeoples\b", "people's", s)
    return re.sub(r"[^a-z0-9]", "", s)


# ------------------------------------------------------------------ parties --
registry = load("data/derived/all_india_parties.json")
profiles = {p["id"]: p for p in load("public/data/parties.json")}

PARTIES = {}      # key -> record
ALIASES = {}      # normalized name -> key


def add_party(key, name, short, rec, state, **extra):
    if key not in PARTIES:
        PARTIES[key] = {"k": key, "name": name, "short": short, "rec": rec, "state": state, **extra}
    ALIASES[norm(name)] = key
    return PARTIES[key]


for p in registry:
    if p["category"] in ("National", "State"):
        short = p.get("short_name") or p["party_name"]
        key = short.replace("(", "").replace(")", "").replace(" ", "")
        add_party(key, p["party_name"], short, "National" if p["category"] == "National" else "State",
                  p["state"], symbol=p.get("symbol"), reg_id=p["party_id"])

# Parties recognised elsewhere or prominent in TN that the 2023 recognition list does not carry
EXTRA = [
    ("CPI", "Communist Party of India", "CPI", "State", "Kerala"),
    ("NTK", "Naam Tamilar Katchi", "NTK", "State", "Tamil Nadu"),
    ("VCK", "Viduthalai Chiruthaigal Katchi", "VCK", "RUPP", "Tamil Nadu"),
    ("TVK", "Tamilaga Vettri Kazhagam", "TVK", "RUPP", "Tamil Nadu"),
    ("MDMK", "Marumalarchi Dravida Munnetra Kazhagam", "MDMK", "RUPP", "Tamil Nadu"),
    ("MNM", "Makkal Needhi Maiam", "MNM", "RUPP", "Tamil Nadu"),
    ("AMMK", "Amma Makkal Munnettra Kazagam", "AMMK", "RUPP", "Tamil Nadu"),
    ("INLD", "Indian National Lok Dal", "INLD", "State", "Haryana"),
    ("RLP", "Rashtriya Loktantrik Party", "RLP", "State", "Rajasthan"),
    ("BAP", "Bharat Adivasi Party", "BAP", "State", "Rajasthan"),
    ("LJPRV", "Lok Janshakti Party (Ram Vilas)", "LJP(RV)", "State", "Bihar"),
    ("RPIA", "Republican Party of India (Athawale)", "RPI(A)", "State", "Nagaland"),
    ("RGP", "Revolutionary Goans Party", "RGP", "State", "Goa"),
    ("JSP", "Janasena Party", "JSP", "State", "Andhra Pradesh"),
    ("CAP", "Citizen Action Party Sikkim", "CAP-S", "State", "Sikkim"),
    ("NCPSP", "Nationalist Congress Party - Sharadchandra Pawar", "NCP(SP)", "State", "Maharashtra"),
]
for key, name, short, rec, state in EXTRA:
    add_party(key, name, short, rec, state)

ALIAS_EXTRA = {
    "communistpartyofindiamarxistleninistliberation": "CPIMLL",
    "communistpartyofindiamarxistleninistliberation": "CPIMLL",
    "allindiamajilisittehadulmuslimeen": "AIMIM",
    "allindiamajliseittehadulmuslimeen": "AIMIM",
    "allindiamajiliseittehadulmuslimeen": "AIMIM",
    "allindianrcongress": "AINRC",
    "ajsuparty": "AJSU",
    "jammuandkashmirpeoplesdemocraticparty": "JKPDP",
    "jammuandkashmirpeople'sdemocraticparty": "JKPDP",
    "jammuandkashmirnationalconference": "JKNC",
    "hillsstatepeople'sdemocraticparty": "HSPDP",
    "lokjanshaktipartyramvilas": "LJPRV",
    "lokjanshaktipartyramvilas": "LJPRV",
    "yuvajansramikarythucongressparty": "YSRCP",
    "telegudesamparty": "TDP",
    "shriomaniakalidal": "SAD",
    "nationaldemocraticprogressiveparty": "NDPP",
    "maharashtrawadigomantakparty": "MGP",
    "bijujanatadal": "BJD",
    "communistpartyofindiamarxist": "CPIM",
    "presidentallindiacongresscommittee": "INC",
    "adyakshasamajvadiparty": "SP",
    "biharpradeshjanatadalunited": "JDU",
    "shivsena": "SHS",
    "nationalistcongresspartymaharashtrapradesh": "NCP",
    "maharashtrawadigomntakparty": "MGP",
    "ysrcongresspartyyuvajanasramikarythucongressparty": "YSRCP",
    "dravidamunnetrakazhagamdmk": "DMK",
    "keralacongresm": "KCM",
    "nationalistcongressparty": "NCP",
}
for a, k in ALIAS_EXTRA.items():
    ALIASES[norm(a)] = k
ALIASES[norm("Communist Party of India (Marxist-Leninist) Liberation")] = "CPIMLL"


def canon(name):
    """Party key for any spelling seen in ECI titles, SBI data or erolls listings."""
    n = norm(name)
    if n in ALIASES:
        return ALIASES[n]
    hit = difflib.get_close_matches(n, list(ALIASES), n=1, cutoff=0.88)
    return ALIASES[hit[0]] if hit else None


def title_party(title):
    """Strip the report description from an ECI catalog title."""
    t = title.replace("\xa0", " ")
    for a, b in (("Janata Dal - Secular", "Janata Dal (Secular)"), ("Lok Jan Shakti Party - Ramvilas", "Lok Janshakti Party (Ram Vilas)"),
                 ("Citizen Action Party - Sikkim", "Citizen Action Party Sikkim")):
        t = t.replace(a, b)
    t = re.sub(r"^\s*(Revised( Report)?\s*-\s*|Main EES of )", "", t, flags=re.I)
    t = re.split(r"\s*(?:\((?=Annual|Revised|For |Main)|:|\s-|-\s|-(?=Contribution|Part|Revised|Main|Full|Cash)|\sfor\s(?=GELA)|\s(?=(?:Main|Part|Full|Contribution|Compliance|Expenditure|Other notes|Cash Flow)\b))", t)[0]
    return t.strip(" -_")


# TN focus set (the parties profiled in parties.json)
TN_KEYS = {"DMK", "AIADMK", "NTK", "PMK", "DMDK", "MDMK", "VCK", "MNM", "IUML", "TVK", "BJP", "INC",
           "CPIM", "CPI", "AAP", "BSP", "AMMK"}
PROFILE_KEY = {"CPIM": "CPIM"}
for k in TN_KEYS:
    if k in PARTIES:
        PARTIES[k]["tn"] = True
        prof = profiles.get(k) or profiles.get(PROFILE_KEY.get(k, ""))
        if prof:
            for f in ("tamil_name", "leader", "founded_year", "headquarters", "website", "logo_url", "symbol",
                      "assembly_standing", "assembly_role"):
                if prof.get(f):
                    PARTIES[k][f] = prof[f]

# ------------------------------------------------------------- helpers ----
def fy_of(d):
    """Indian financial year label for a date (Apr-Mar)."""
    y = d.year if d.month >= 4 else d.year - 1
    return f"{y}-{str(y + 1)[2:]}"


def fy_short(label):
    m = re.search(r"(\d{4})\s*-\s*(\d{2,4})", label or "")
    return f"{m.group(1)}-{m.group(2)[-2:]}" if m else ""


finance = defaultdict(dict)   # (key, fy) -> fields
sources = defaultdict(list)


def put(key, fy, src, **vals):
    row = finance[(key, fy)]
    for f, v in vals.items():
        if v is not None and row.get(f) is None:
            row[f] = v
    sources[(key, fy)].append(src)


# --------------------------------------------- 1. ECI audited accounts -----
audit_index = {d["n"]: d for d in load("data/raw/ocr/audit_text/index.json")}
extracted = []
for f in sorted(glob.glob(os.path.join(ROOT, "data/raw/ocr/audit_extract/batch_*_output.json"))):
    extracted.extend(json.load(open(f)))

best = {}
unmapped_titles = set()
for e in extracted:
    meta = audit_index.get(e["n"], {})
    key = canon(title_party(meta.get("title", e.get("party", ""))))
    if not key:
        unmapped_titles.add(meta.get("title"))
        continue
    fy = meta.get("fy") or e.get("fy")
    has_totals = e.get("total_income") is not None or e.get("total_expenditure") is not None
    score = (has_totals, {"high": 3, "medium": 2, "low": 1}.get(e.get("confidence"), 0),
             "revised" in (meta.get("title") or "").lower())
    cur = best.get((key, fy))
    if not cur or score > cur[0]:
        best[(key, fy)] = (score, e, meta)

for (key, fy), (_, e, meta) in best.items():
    inc, exp = dict(e.get("income") or {}), e.get("expenditure") or {}
    # Some statements print bonds as a sub-line of donations; don't count them twice
    total, eb_line, don = e.get("total_income"), inc.get("electoral_bonds"), inc.get("donations_contributions")
    if total and eb_line and don and don >= eb_line and sum(v for v in inc.values() if v) > total * 1.01:
        inc["donations_contributions"] = don - eb_line
    put(key, fy, {"type": "ECI audited accounts", "url": meta.get("pdf_url"), "title": meta.get("title"),
                  "page": (e.get("pages") or {}).get("income_statement"), "confidence": e.get("confidence"),
                  "notes": e.get("notes")},
        income=e.get("total_income"), expenditure=e.get("total_expenditure"), surplus=e.get("surplus"),
        donations=inc.get("donations_contributions"), eb_reported=inc.get("electoral_bonds"),
        membership=inc.get("membership_fees_subscriptions"), interest=inc.get("interest_dividend"),
        election_exp=exp.get("election"), admin_exp=exp.get("administrative_general"),
        staff_exp=exp.get("employee_salaries"), publicity_exp=exp.get("publicity_propaganda"),
        general_fund=e.get("general_fund_closing"), cash_bank=e.get("cash_bank_and_deposits_closing"),
        total_assets=e.get("total_assets"), auditor=e.get("auditor"), audit_confidence=e.get("confidence"))

# --------------------------------------------- 2. CEO Tamil Nadu RUPP filings ---
erolls = load("public/data/tn_rupp_filings_erolls.json")
erolls_party_key = {}
for r in erolls:
    k = canon(r["party_name"])
    if not k:
        k = "TN:" + norm(r["party_name"])[:40]
        add_party(k, r["party_name"].strip(), "", "RUPP", "Tamil Nadu", tn_rupp=True)
    erolls_party_key[r["party_name"]] = k
    PARTIES[k].setdefault("address", r.get("address"))
    if r["status"] != "Submitted":
        continue
    fy = fy_short(r["year"])
    src = {"type": "CEO Tamil Nadu filing", "url": r.get("pdf_url"), "title": f"{r['category']} {r['year']}",
           "filed": r.get("filing_date"), "timing": r.get("timing")}
    if r["category"] == "Annual Audit Report":
        put(k, fy, src, income=r.get("total_receipts"), expenditure=r.get("total_expenditure"))
        row = finance[(k, fy)]
        if row.get("surplus") is None and row.get("income") is not None and row.get("expenditure") is not None:
            row["surplus"] = row["income"] - row["expenditure"]
    elif r["category"] == "Form 24A Contribution Report":
        put(k, fy, src, contributions_24a=r.get("amount"))

# --------------------------------------------- 3. Electoral bonds by FY -------
eb = load("public/data/electoral_bonds_all.json")
eb_key = {}
for i, p in enumerate(eb["parties"]):
    k = canon(p["name"]) or canon(p["code"])
    if not k:
        k = p["code"]
        add_party(k, p["name"].title(), p["code"], "State", "")
    eb_key[i] = k
    PARTIES[k]["eb_code"] = p["code"]
eb_fy = defaultdict(int)
eb_total = defaultdict(int)
eb_n = defaultdict(int)
for pi, di, amt, enc, pur in eb["rows"]:
    k = eb_key[pi]
    d = date(enc // 10000, enc // 100 % 100, enc % 100)
    eb_fy[(k, fy_of(d))] += amt
    eb_total[k] += amt
    eb_n[k] += 1
for (k, fy), amt in eb_fy.items():
    put(k, fy, {"type": "SBI electoral bond disclosure"}, eb_encashed=amt)

# --------------------------------------------- 4. documents + ECI filing status --
docs = []
compliance = []
cat_files = {"Annual audit report": "annual_audit_reports", "Contribution report (Form 24A)": "contribution_reports",
             "Election expenditure statement": "expenditure_reports"}
eci_filed = defaultdict(set)   # (key, kind) -> set(fy)
for kind, fname in cat_files.items():
    cat = load(f"data/raw/metadata/{fname}.json")["message"]
    for group, items in cat.items():
        for it in items:
            k = canon(title_party(it["title"]))
            fy = fy_short(group)
            elec = re.search(r"(Lok Sabha|Legislative Assembl\w*|GELA|GE ?LA)[^0-9]*(\d{4})", it["title"])
            docs.append({"k": k, "kind": kind, "fy": fy, "title": it["title"].replace("\xa0", " "),
                         "url": it["pdf_url"], "size": it.get("record_size"), "source": "ECI",
                         "election": elec.group(0) if elec and kind.startswith("Election") else None})
            if k and kind != "Election expenditure statement":
                eci_filed[(k, kind)].add(fy)
            if not k:
                unmapped_titles.add(it["title"])

for r in erolls:
    k = erolls_party_key[r["party_name"]]
    kind = {"Annual Audit Report": "Annual audit report", "Form 24A Contribution Report": "Contribution report (Form 24A)",
            "Election Expenditure Statement": "Election expenditure statement"}[r["category"]]
    fy = fy_short(r["year"]) or r["year"]
    status = r["timing"] if r["status"] == "Submitted" else "Not filed"
    if status == "Not filed" and kind == "Annual audit report" and fy == "2025-26" and date.today() <= date(2026, 10, 31):
        status = "Due 31 Oct 2026"   # audited accounts for FY 2025-26 are not yet overdue
    compliance.append({"k": k, "scope": "TN RUPP (CEO Tamil Nadu)", "kind": kind, "fy": fy,
                       "status": status,
                       "filed": r.get("filing_date") or None, "amount": r.get("amount"),
                       "url": r.get("pdf_url")})
    if r["status"] == "Submitted" and r.get("pdf_url"):
        docs.append({"k": k, "kind": kind, "fy": fy, "title": f"{r['party_name']} — {r['category']} {r['year']}",
                     "url": r["pdf_url"], "size": None, "source": "CEO Tamil Nadu", "filed": r.get("filing_date")})

for extra in load("public/data/source_documents.json"):
    if extra.get("pdf_url", "").startswith("/data/"):
        docs.append({"k": extra.get("party_id"), "kind": "Contribution report (Form 24A)", "fy": fy_short(extra["year_group"]),
                     "title": extra["title"], "url": extra["pdf_url"], "size": extra.get("record_size"), "source": "Party filing (image)"})

# ECI publishes reports of recognised parties; absence means "not published on the ECI site"
ECI_YEARS = ["2022-23", "2023-24", "2024-25", "2025-26"]
for k, p in PARTIES.items():
    if p["rec"] not in ("National", "State"):
        continue
    for kind in ("Annual audit report", "Contribution report (Form 24A)"):
        for fy in ECI_YEARS:
            filed = fy in eci_filed[(k, kind)]
            compliance.append({"k": k, "scope": "Recognised party (ECI)", "kind": kind, "fy": fy,
                               "status": "Published" if filed else ("Due 31 Oct 2026" if fy == "2025-26" and kind == "Annual audit report" and date.today() <= date(2026, 10, 31) else "Not published")})

# ------------------------------------------------------------- rollups ---
fin_rows = []
for (k, fy), row in sorted(finance.items()):
    srcs = sources[(k, fy)]
    fin_rows.append({"k": k, "fy": fy, **row, "sources": srcs})

for k, p in PARTIES.items():
    rows = [r for r in fin_rows if r["k"] == k and r.get("income") is not None]
    if rows:
        last = max(rows, key=lambda r: r["fy"])
        p["latest_fy"] = last["fy"]
        p["latest_income"] = last["income"]
        p["latest_expenditure"] = last.get("expenditure")
        p["latest_general_fund"] = last.get("general_fund")
    if eb_total.get(k):
        p["eb_total"] = eb_total[k]
        p["eb_bonds"] = eb_n[k]
    p["n_docs"] = sum(1 for d in docs if d["k"] == k)

parties_out = sorted(PARTIES.values(), key=lambda p: ({"National": 0, "State": 1}.get(p["rec"], 2), p["name"]))
meta = {"built": date.today().isoformat(), "fin_rows": len(fin_rows), "parties": len(parties_out),
        "audit_docs_extracted": len(extracted), "unmapped_titles": sorted(t for t in unmapped_titles if t)}

for name, obj in (("parties", parties_out), ("finance", fin_rows), ("compliance", compliance),
                  ("documents", docs), ("meta", meta)):
    with open(os.path.join(OUT, f"{name}.json"), "w", encoding="utf-8") as f:
        json.dump(obj, f, separators=(",", ":"), ensure_ascii=False)

print(f"parties {len(parties_out)}, finance rows {len(fin_rows)}, compliance {len(compliance)}, docs {len(docs)}")
print(f"audit docs extracted: {len(extracted)}; unmapped titles: {len(meta['unmapped_titles'])}")
for t in meta["unmapped_titles"][:30]:
    print("  ?", t)
