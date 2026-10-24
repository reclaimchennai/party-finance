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
import sys
import hashlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from names import clean_name  # noqa: E402

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


def alias_short_names():
    """Party abbreviations (AIADMK, CPI(M), ...) resolve too, unless already taken."""
    for k, p in PARTIES.items():
        if p.get("short") and len(p["short"]) >= 2:
            ALIASES.setdefault(norm(p["short"]), k)


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


# --------------------------------------------- 1. audited accounts read per report -----
# ECI audit reports (recognised parties) and the CEO Tamil Nadu filings of TN RUPPs,
# each figure with its page and confidence.
def party_key_for(name, state="Tamil Nadu"):
    k = canon(name)
    if not k:
        k = "TN:" + norm(name)[:40]
        add_party(k, clean_name(name.strip()), "", "RUPP", state, tn_rupp=True)
    return k


EXTRACTIONS = [
    ("data/raw/ocr/audit_text/index.json", "data/raw/ocr/audit_extract", "ECI audited accounts", False),
    ("data/raw/ocr/tn_rupp_audit_text/index.json", "data/raw/ocr/tn_rupp_extract", "CEO Tamil Nadu audited accounts", True),
]
extracted, best, unmapped_titles = [], {}, set()
for index_path, extract_dir, src_type, tn in EXTRACTIONS:
    if not os.path.exists(os.path.join(ROOT, index_path)):
        continue
    index = {d["n"]: d for d in load(index_path)}
    rows = []
    for f in sorted(glob.glob(os.path.join(ROOT, extract_dir, "batch_*_output.json"))):
        rows.extend(json.load(open(f)))
    extracted.extend(rows)
    for e in rows:
        meta = index.get(e["n"], {})
        name = title_party(meta.get("title", e.get("party", "")))
        key = party_key_for(name) if tn else canon(name)
        if not key:
            unmapped_titles.add(meta.get("title"))
            continue
        fy = meta.get("fy") or e.get("fy")
        has_totals = e.get("total_income") is not None or e.get("total_expenditure") is not None
        score = (has_totals, not tn, {"high": 3, "medium": 2, "low": 1}.get(e.get("confidence"), 0),
                 "revised" in (meta.get("title") or "").lower())
        cur = best.get((key, fy))
        if not cur or score > cur[0]:
            best[(key, fy)] = (score, e, meta, src_type)

for (key, fy), (_, e, meta, src_type) in best.items():
    inc, exp = dict(e.get("income") or {}), e.get("expenditure") or {}
    # Some statements print bonds as a sub-line of donations; don't count them twice
    total, eb_line, don = e.get("total_income"), inc.get("electoral_bonds"), inc.get("donations_contributions")
    if total and eb_line and don and don >= eb_line and sum(v for v in inc.values() if v) > total * 1.01:
        inc["donations_contributions"] = don - eb_line
    put(key, fy, {"type": src_type, "url": meta.get("pdf_url"), "title": meta.get("title"),
                  "page": (e.get("pages") or {}).get("income_statement"), "confidence": e.get("confidence"),
                  "notes": e.get("notes")},
        income=e.get("total_income"), expenditure=e.get("total_expenditure"), surplus=e.get("surplus"),
        donations=inc.get("donations_contributions"), eb_reported=inc.get("electoral_bonds"),
        membership=inc.get("membership_fees_subscriptions"), interest=inc.get("interest_dividend"),
        election_exp=exp.get("election"), admin_exp=exp.get("administrative_general"),
        staff_exp=exp.get("employee_salaries"), publicity_exp=exp.get("publicity_propaganda"),
        general_fund=e.get("general_fund_closing"), cash_bank=e.get("cash_bank_and_deposits_closing"),
        total_assets=e.get("total_assets"), audit_confidence=e.get("confidence"))

# --------------------------------------------- 2. CEO Tamil Nadu RUPP filings ---
erolls = load("public/data/tn_rupp_filings_erolls.json")
erolls_party_key = {}
for r in erolls:
    k = party_key_for(r["party_name"])
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

# --------------------------------------------- 2b. ADR MyNeta history (FY 2001-02 on) ---
# ADR transcribes each ECI audit report into balance sheet + income/expenditure heads.
# Used for every party-year we have not read ourselves; overlapping years are kept as a
# cross-check (adr_income / adr_expenditure).
INCOME_RULES = [
    ("_skip", r"excess of|deficit|surplus|balance being|net loss"),   # balancing lines, whichever way ADR labels them
    ("eb_reported", r"electoral bond"),
    ("donations", r"donat|contribut|grant|relief fund|electoral trust|collection from"),
    ("membership", r"member|fee|subscri|delegate|levy|application|admission"),
    ("interest", r"interest|dividend"),
]
SPEND_RULES = [
    ("_skip", r"excess of|surplus|deficit|balance being|net profit"),
    ("election_exp", r"election|campaign|\bpoll"),
    ("staff_exp", r"employee|salar|staff|wage|remunerat|honorari|bonus|provident"),
    ("publicity_exp", r"publicity|propaganda|advertis|media|pamphlet|poster|banner"),
    ("admin_exp", r"administrat|general exp|office|rent|electric|telephone|printing|stationery|travel|conveyance|"
                  r"audit|legal|professional|repair|maint|insurance|meeting|accounting|vehicle|newspaper|"
                  r"bank charge|postage|courier|misc|water|internet|computer|conference|function"),
]


def classify(label, rules):
    for bucket, rx in rules:
        if re.search(rx, label, re.I):
            return bucket
    return "_other"


myneta_path = os.path.join(ROOT, "data/derived/myneta_statements.json")
statements = {}            # "k|fy" -> itemised heads, for the party drawer
adr_rows = 0
if os.path.exists(myneta_path):
    for m in json.load(open(myneta_path)):
        k = canon(m["name"]) or canon(m.get("abbr") or "")
        if not k:
            k = re.sub(r"[^A-Z0-9]", "", (m.get("abbr") or m["name"]).upper())[:12]
            add_party(k, clean_name(m["name"]), m.get("abbr") or "", "State", "")
        fy = m["fy"]
        inc_b, exp_b = defaultdict(int), defaultdict(int)
        for label, v in (m.get("income") or {}).items():
            inc_b[classify(label, INCOME_RULES)] += v or 0
        for label, v in (m.get("expenditure") or {}).items():
            exp_b[classify(label, SPEND_RULES)] += v or 0
        income = sum(v for b, v in inc_b.items() if b != "_skip")
        expenditure = sum(v for b, v in exp_b.items() if b != "_skip")
        liab, assets = m.get("liabilities") or {}, m.get("assets") or {}
        fund = sum(v or 0 for l, v in liab.items() if re.search(r"general fund|corpus|capital fund", l, re.I)
                   and not re.search(r"earmark|building", l, re.I)) or None
        cash = sum(v or 0 for l, v in assets.items() if re.search(r"cash|bank|fixed deposit|term deposit|fdr", l, re.I)
                   and not re.search(r"loan|advance", l, re.I)) or None
        statements[f"{k}|{fy}"] = {"src": m["url"], "income": m.get("income"), "expenditure": m.get("expenditure"),
                                   "assets": assets, "liabilities": liab}
        row = finance[(k, fy)]
        audited = any(x["type"] in ("ECI audited accounts", "CEO Tamil Nadu audited accounts") for x in sources[(k, fy)])
        if audited and row.get("audit_confidence") == "low" and (income or expenditure):
            # our own read of a damaged scan was low confidence: ADR's transcription wins
            for f in ("income", "expenditure", "surplus", "donations", "eb_reported", "membership", "interest",
                      "election_exp", "admin_exp", "staff_exp", "publicity_exp"):
                row.pop(f, None)
            audited = False
        if audited:
            row["adr_income"], row["adr_expenditure"] = income, expenditure
            continue
        if not income and not expenditure:
            continue
        if row.get("income") is not None:
            # only portal totals so far (CEO TN): ADR's itemised statement replaces them
            for f in ("income", "expenditure", "surplus"):
                row.pop(f, None)
        adr_rows += 1
        put(k, fy, {"type": "ADR MyNeta (from ECI audit report)", "url": m["url"]},
            income=income, expenditure=expenditure, surplus=income - expenditure,
            donations=inc_b.get("donations"), eb_reported=inc_b.get("eb_reported"), membership=inc_b.get("membership"),
            interest=inc_b.get("interest"), election_exp=exp_b.get("election_exp"), admin_exp=exp_b.get("admin_exp"),
            staff_exp=exp_b.get("staff_exp"), publicity_exp=exp_b.get("publicity_exp"),
            general_fund=fund, cash_bank=cash, total_assets=(m.get("printed_totals") or {}).get("Assets"))

# --------------------------------------------- 2c. Form 24A donor lists (ADR MyNeta) ---
# Totals fill contributions_24a where the ECI/CEO record has none; the donor lists go
# to one small file per party for the drawer.
donors_path = os.path.join(ROOT, "data/derived/myneta_donations.json")
donor_files = {}
if os.path.exists(donors_path):
    for d in json.load(open(donors_path)):
        k = canon(d["name"]) or canon(d.get("abbr") or "")
        if not k or not d.get("n_donors"):
            continue
        fy = d["fy"]
        put(k, fy, {"type": "ADR MyNeta Form 24A list", "url": d["url"]}, contributions_24a=d["total"])
        merged = defaultdict(lambda: {"amount": 0, "n": 0, "pan": False})
        for x in d["donors"]:
            nm = clean_name(x["name"])
            m = merged[nm]
            m["amount"] += x["amount"] or 0
            m["n"] += 1
            m["pan"] = m["pan"] or x["pan_given"]
        top = sorted(merged.items(), key=lambda kv: -kv[1]["amount"])
        pf = donor_files.setdefault(k, {"years": {}, "all": defaultdict(int)})
        pf["years"][fy] = {"n": d["n_donors"], "total": d["total"], "url": d["url"],
                           "top": [[nm, v["amount"], v["n"], int(v["pan"])] for nm, v in top[:60]]}
        for nm, v in merged.items():
            pf["all"][nm] += v["amount"]
    os.makedirs(os.path.join(OUT, "donors"), exist_ok=True)
    for k, pf in donor_files.items():
        pf["all"] = sorted(([nm, v] for nm, v in pf["all"].items()), key=lambda x: -x[1])[:60]
        with open(os.path.join(OUT, "donors", re.sub(r"[^A-Za-z0-9_-]", "_", k) + ".json"), "w", encoding="utf-8") as f:
            json.dump(pf, f, separators=(",", ":"), ensure_ascii=False)
    for k in donor_files:
        PARTIES[k]["donor_file"] = re.sub(r"[^A-Za-z0-9_-]", "_", k)

# --------------------------------------------- 2d. Election-expenditure statements ---
alias_short_names()
# Tamil Nadu elections 2004 onward (scrape_election_expenditure.py + per-statement reads).
elections_out, ee_docs = [], []
ee_index_path = os.path.join(ROOT, "data/raw/ocr/ee_text/index.json")
if os.path.exists(ee_index_path):
    ee_index = {d["n"]: d for d in load("data/raw/ocr/ee_text/index.json")}
    ee_reads = {}
    for f in sorted(glob.glob(os.path.join(ROOT, "data/raw/ocr/ee_extract/batch_*_output.json"))):
        for e in json.load(open(f)):
            ee_reads[e["n"]] = e
    KIND_RANK = {"Full": 3, "Compliance": 1, "Part": 2}
    best_ee = {}
    for n, meta in ee_index.items():
        e = ee_reads.get(n, {})
        name = re.split(r"\s+-\s+(?:Election|Main|Full|Part|Compliance)|\s*\(Report|\s+\d+-[A-Z]", meta.get("title", ""))[0]
        name = title_party(name) if meta.get("source") != "CEO Tamil Nadu" else name
        key = party_key_for(name) if meta.get("source") == "CEO Tamil Nadu" else canon(name)
        if not key:
            unmapped_titles.add(meta.get("title"))
            continue
        total = e.get("total_expenditure")
        if total is None and meta.get("portal_amount"):
            total = meta["portal_amount"]
        if total is None:
            continue
        # main statement over supplements/by-election filings in the same cycle: full kind, then the larger total
        score = (KIND_RANK.get(meta.get("kind"), 0), e.get("doc_kind") in (None, "full"), total or 0,
                 {"high": 3, "medium": 2, "low": 1}.get(e.get("confidence"), 0))
        k2 = (key, meta.get("election"))
        if k2 not in best_ee or score > best_ee[k2][0]:
            best_ee[k2] = (score, e, meta, total)
    # small CEO TN statements that were not read page by page: the portal's total only
    indexed = {d["pdf_file"] for d in ee_index.values()}
    for fname, meta in load("data/raw/election_expenditure/manifest.json").items():
        if fname in indexed or meta.get("source") != "CEO Tamil Nadu" or meta.get("portal_amount") is None:
            continue
        key = party_key_for(meta["title"].split(" - Election Expenditure")[0])
        if (key, meta["election"]) not in best_ee:
            best_ee[(key, meta["election"])] = ((0, 0), {}, {**meta, "pdf_url": meta["pdf_url"]}, meta["portal_amount"])
    for (key, election), (_, e, meta, total) in best_ee.items():
        p = PARTIES.get(key, {})
        tn_party = bool(p.get("tn") and p.get("rec") != "National" or p.get("tn_rupp") or p.get("state") in ("Tamil Nadu", "Puducherry"))
        states = e.get("states_covered") or []
        covers_tn = not states or any(re.search(r"tamil", s_, re.I) for s_ in states)
        # Tamil Nadu's part of the money: TN parties' statements are about TN (with Puducherry at most);
        # national parties' only where they give a state split or file for TN alone.
        if tn_party:
            tn_total = total
        elif not covers_tn:
            continue            # e.g. a West Bengal-only filing listed under the TN election
        elif e.get("tamil_nadu_share") is not None:
            tn_total = e["tamil_nadu_share"]
        elif states and all(re.search(r"tamil|puduch|pondich", s_, re.I) for s_ in states):
            tn_total = total
        else:
            tn_total = None     # several states, no split
        if not total and not tn_party:
            continue            # NIL statements of parties that did not contest in TN
        pr, cand, su, rec = e.get("propaganda") or {}, e.get("candidates") or {}, e.get("state_unit") or {}, e.get("receipts") or {}
        heads = {"h_star": pr.get("star_campaigner_travel"), "h_leaders": pr.get("other_leaders_travel"),
                 "h_media": pr.get("media_advertisement"), "h_publicity": pr.get("publicity_materials"),
                 "h_meetings": pr.get("public_meetings"), "h_candidates": cand.get("total"),
                 "h_state": (su.get("propaganda_total") or 0) + (su.get("candidates_total") or 0) or None,
                 "h_other": pr.get("other")}
        itemised = sum(v or 0 for v in heads.values())
        if not itemised:
            heads = {"h_none": total}
        elif itemised < total * 0.98:
            heads["h_other"] = (heads.get("h_other") or 0) + (total - itemised)   # unexplained remainder
        year = int(re.search(r"(\d{4})", election).group(1))
        elections_out.append({
            "k": key, "election": election, "year": year, "type": "LS" if election.startswith("Lok") else "AE",
            "kind": meta.get("kind"), "doc_kind": e.get("doc_kind"), "total": total, "tn_total": tn_total,
            "tn_share": e.get("tamil_nadu_share"),
            **{h_: v for h_, v in heads.items() if v is not None},
            "eb_received": rec.get("electoral_bonds"), "receipts": rec.get("total"),
            "opening": e.get("opening_balance"), "closing": e.get("closing_balance"),
            "states": ", ".join(e.get("states_covered") or []) or None,
            "url": meta.get("pdf_url"), "source": meta.get("source"), "confidence": e.get("confidence"),
            "tn_party": tn_party,
        })
        ee_docs.append({"k": key, "kind": "Election expenditure statement", "fy": str(year), "title": meta.get("title"),
                     "url": meta.get("pdf_url"), "size": None, "source": meta.get("source"), "election": election})

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

known_urls = {d["url"] for d in docs}
docs.extend(d for d in ee_docs if d["url"] not in known_urls)

# ------------------------------------------------------------- rollups ---
fin_rows = []
SRC_KEYS = ("type", "url", "page", "confidence", "filed", "timing")   # titles/notes stay in the raw extractions
for (k, fy), row in sorted(finance.items()):
    srcs = [{f: x[f] for f in SRC_KEYS if x.get(f) is not None} for x in sources[(k, fy)]]
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
        "audit_docs_extracted": len(extracted), "adr_rows": adr_rows,
        "eb_total": sum(eb_total.values()), "eb_bonds": sum(eb_n.values()), "eb_parties": len(eb_total),
        "documents": len(docs), "unmapped_titles": sorted(t for t in unmapped_titles if t)}

# Content hash of everything the site loads: the app requests data with ?v=<version>, so
# browsers can cache it for good and still pick up a rebuild immediately.
payloads = {name: json.dumps(obj, separators=(",", ":"), ensure_ascii=False) for name, obj in
            (("parties", parties_out), ("finance", fin_rows), ("compliance", compliance),
             ("documents", docs), ("statements", statements), ("elections", elections_out))}
h = hashlib.sha1()
for name in sorted(payloads):
    h.update(payloads[name].encode())
for extra in ("public/data/electoral_bonds_all.json", "public/data/all_india_parties.json", "public/data/india-states.geojson",
              "public/data/all_india_parties_summary.json", "public/data/tn_rupp_filing_summary.json"):
    h.update(open(os.path.join(ROOT, extra), "rb").read())
meta["version"] = h.hexdigest()[:10]
payloads["meta"] = json.dumps(meta, separators=(",", ":"), ensure_ascii=False)
for name, text in payloads.items():
    with open(os.path.join(OUT, f"{name}.json"), "w", encoding="utf-8") as f:
        f.write(text)

print(f"parties {len(parties_out)}, finance rows {len(fin_rows)}, compliance {len(compliance)}, docs {len(docs)}")
print(f"audit docs extracted: {len(extracted)}; ADR rows used: {adr_rows}; version {meta['version']}; unmapped titles: {len(meta['unmapped_titles'])}")
for t in meta["unmapped_titles"][:30]:
    print("  ?", t)
