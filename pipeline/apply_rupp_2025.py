#!/usr/bin/env python3
"""
Apply ECI Notification No.56/2025/PPS-III (10 Oct 2025) to the pan-India registry.

Run after build_all_india_parties.py and parse_rupp_2025.py.

  Table I(A) -> current RUPPs (2,049). Matched parties get the 2025 address;
                unmatched ones are parties registered after the 2021 list.
  Table I(B) -> 334 RUPPs delisted in the first 2025 round
  Table I(C) -> 474 RUPPs delisted in the second 2025 round

RUPPs from the 2021 list that appear in none of the three tables are kept but
flagged `in_2025_list = False` (renamed, merged or delisted by an order we do
not hold).
"""
import os
import re
import csv
import sys
import json
import difflib
import types
from collections import Counter

sys.modules.setdefault("pymupdf", types.ModuleType("pymupdf"))   # only the geocoder is needed
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_all_india_parties import detect_state_and_coords, extract_pincode  # noqa: E402
from names import clean_name  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NOTIF = "ECI Notification No. 56/2025/PPS-III (10 Oct 2025)"
ROUND = {"I(B)": "first 2025 delisting round (334 RUPPs)", "I(C)": "second 2025 delisting round (474 RUPPs)"}

GENERIC = {"party", "of", "india", "the", "and", "national", "all", "bharatiya", "rashtriya",
           "akhil", "bhartiya", "congress", "samaj", "jan", "janata", "lok", "dal", "front"}


def norm(name):
    s = name.lower().replace("&", "and")
    s = re.sub(r"\(.*?\)", lambda m: m.group(0), s)
    return re.sub(r"[^a-z0-9]", "", s)


def clean_ocr(text):
    """Drop OCR debris: trailing tokens without real words, stray symbols."""
    text = re.sub(r"[|\"“”‘’~=_{}\[\]<>]+", " ", text)
    toks = text.split()
    def wordy(t):
        letters = re.sub(r"[^A-Za-z]", "", t)
        return len(letters) >= 2 and re.search(r"[aeiouyAEIOUY]", letters) and not re.fullmatch(r"[a-z]{1,2}", letters)
    while toks and not wordy(toks[-1]) and not re.search(r"\d{3,}", toks[-1]):
        toks.pop()
    while toks and not wordy(toks[0]) and not re.search(r"\d", toks[0]):
        toks.pop(0)
    return re.sub(r"\s+", " ", " ".join(toks)).strip(" ,.-;:")


def main():
    # build_all_india_parties.py writes the pre-2025 registry; freeze a copy so reruns are idempotent
    base = os.path.join(ROOT, "data/derived/all_india_parties_pre2025.json")
    if not os.path.exists(base) or "--rebase" in sys.argv:
        with open(os.path.join(ROOT, "data/derived/all_india_parties.json")) as f, open(base, "w") as g:
            g.write(f.read())
    reg = json.load(open(base))
    notif = json.load(open(os.path.join(ROOT, "data/derived/rupp_2025_notification.json")))

    by_norm = {norm(p["party_name"]): p for p in reg}
    keys = list(by_norm)

    def match(name):
        k = norm(name)
        if k in by_norm:
            return by_norm[k], 1.0
        cand = difflib.get_close_matches(k, keys, n=1, cutoff=0.86)
        if cand:
            return by_norm[cand[0]], difflib.SequenceMatcher(None, k, cand[0]).ratio()
        return None, 0

    pool = [p for p in reg if p.get("category") not in ("National", "State")]

    def loose_match(name, pin, seen):
        """Second pass: same PIN code with a similar name, or a long 2021 name that is a prefix of the 2025 one."""
        k = norm(name)
        best, best_r = None, 0
        for p in pool:
            if id(p) in seen:
                continue
            pk = norm(p["party_name"])
            prefix = len(pk) >= 12 and k.startswith(pk)
            same_pin = pin and p.get("pincode") == pin
            r = difflib.SequenceMatcher(None, k, pk).ratio()
            if (same_pin and (prefix or r > 0.7)) or (prefix and r > 0.6):
                r += 1 if same_pin else 0
                if r > best_r:
                    best, best_r = p, r
        return best, best_r

    seen = set()
    stats = Counter()
    new_rows = []
    for r in notif:
        name, addr = clean_ocr(r["name"]), clean_ocr(r["address"])
        hit, score = match(name)
        if hit and hit.get("category") in ("National", "State"):
            hit, score = None, 0    # a RUPP that shares a recognised party's spelling is a different entity
        if hit and id(hit) in seen:
            hit = None              # two OCR rows collapsing onto one party: keep both
        if not hit:
            hit, score = loose_match(name, extract_pincode(addr), seen)
            if hit and len(name) > len(hit["party_name"]):
                hit["party_name_2021"] = hit["party_name"]
                hit["party_name"] = name   # the 2021 PDF parse truncated multi-line names
        quality = "ocr-matched" if hit else ("ocr" if len(name) > 4 and re.search(r"[A-Za-z]{3}", name) else "ocr-unreadable")
        base = hit if hit else {}
        st, dist, pin, lat, lon = detect_state_and_coords(addr, party_key=name)
        rec = hit if hit else {
            "party_id": f"R25_{r['table'][2]}{r['sl']:04d}",
            "party_name": name, "short_name": "", "symbol": "Free Symbol (Allotted per election)",
        }
        if hit:
            seen.add(id(hit))
            rec["previous_address"] = base.get("address", "")
        rec.update({
            "address": addr or base.get("address", ""),
            "state": st if st != "Other / Unspecified" else base.get("state", st),
            "district": dist or base.get("district", ""),
            "pincode": pin or extract_pincode(addr) or base.get("pincode", ""),
            "lat": lat, "lon": lon,
            "eci_2025_table": r["table"], "eci_2025_sl": r["sl"], "eci_2025_page": r["page"],
            "name_source": quality, "in_2025_list": True,
        })
        if hit and score < 1:
            rec["ocr_name"] = name
        if r["table"] == "I(A)":
            rec.update({"status": "Registered Unrecognized (RUPP)", "category": "RUPP",
                        "delisted_order": None, "delisted_date": None, "source_doc": NOTIF + " Table I(A)"})
            if not hit:
                rec["registered_after_2021"] = True
            stats["I(A) " + ("matched" if hit else "new")] += 1
        else:
            rec.update({"status": "Delisted / Cancelled", "category": "Delisted / Inactive",
                        "delisted_order": f"{NOTIF} Table {r['table']} — {ROUND[r['table']]}",
                        "delisted_date": "2025", "delisted_reason": "Did not contest any election for six years since 2019 and/or offices not physically found (ECI 2025 verification drive)",
                        "source_doc": NOTIF + " Table " + r["table"], "symbol": "Cancelled / None"})
            stats[r["table"] + " " + ("matched" if hit else "new")] += 1
        if not hit:
            new_rows.append(rec)

    reg.extend(new_rows)
    for p in reg:
        if "in_2025_list" not in p:
            p["in_2025_list"] = p.get("category") in ("National", "State")
            if p["status"] == "Registered Unrecognized (RUPP)":
                p["status"] = "RUPP (not in 2025 list)"
                stats["2021 RUPP not in 2025 list"] += 1
    print(dict(stats))

    for p in reg:
        p["party_name"] = clean_name(p["party_name"])
    order = {"Recognized National": 1, "Recognized State": 2, "Registered Unrecognized (RUPP)": 3,
             "RUPP (not in 2025 list)": 4, "Inactive": 5, "Delisted / Cancelled": 6}
    reg.sort(key=lambda x: (order.get(x["status"], 99), x["state"], x["party_name"]))

    by_status, by_state, by_cat = Counter(), Counter(), Counter()
    for p in reg:
        by_status[p["status"]] += 1
        by_state[p["state"]] += 1
        by_cat[p["category"]] += 1
    with_pin = sum(1 for p in reg if p.get("pincode"))
    summary = {
        "total_parties": len(reg),
        "parties_with_pincode": with_pin,
        "pincode_coverage_pct": round(with_pin / len(reg) * 100, 1),
        "active_rupps_2025": stats["I(A) matched"] + stats["I(A) new"],
        "delisted_2025": {"I(B)": stats["I(B) matched"] + stats["I(B) new"], "I(C)": stats["I(C) matched"] + stats["I(C) new"]},
        "by_status": dict(by_status.most_common()),
        "by_state": dict(by_state.most_common()),
        "by_category": dict(by_cat),
        "metadata": {
            "source": "ECI recognition notifications (2023), RUPP notifications (2021, 10 Oct 2025) and delisting orders (2016–2025)",
            "last_updated": "2025-10-10",
            "ocr_note": "2025 notification is a scanned PDF; names/addresses were OCR'd cell-by-cell and matched to earlier ECI lists where possible (name_source field).",
        },
    }
    fields = ["party_id", "party_name", "short_name", "status", "category", "state", "district", "pincode",
              "address", "symbol", "lat", "lon", "delisted_order", "delisted_date", "delisted_reason",
              "source_doc", "in_2025_list", "eci_2025_table", "eci_2025_sl", "name_source"]
    for d in ("data/derived", "public/data"):
        json.dump(reg, open(os.path.join(ROOT, d, "all_india_parties.json"), "w"), indent=1, ensure_ascii=False)
        json.dump(summary, open(os.path.join(ROOT, d, "all_india_parties_summary.json"), "w"), indent=2, ensure_ascii=False)
        with open(os.path.join(ROOT, d, "all_india_parties.csv"), "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
            w.writeheader()
            w.writerows(reg)
    print(json.dumps({k: summary[k] for k in ("total_parties", "pincode_coverage_pct", "active_rupps_2025", "delisted_2025", "by_status")}, indent=1))


if __name__ == "__main__":
    main()
