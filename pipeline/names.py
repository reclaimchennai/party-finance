"""
Display-name cleanup for names copied out of PDFs (SBI bond buyers, ECI party names).

  QWIKSUPPLYCHAINPRIVATELIMITED          -> Qwik Supply Chain Private Limited
  WESTERN UP POWER TRANSMISSION CO LI MITED -> Western UP Power Transmission Co Limited
  B G SHIRKE CONSTRUCTION ... PVT L TD   -> B G Shirke Construction ... Pvt Ltd

Glued words are split only into known business / common English words; anything else
stays one word (proper nouns such as Birla or Qwik are never chopped up).
"""
import gzip
import os
import re
from functools import lru_cache

BIZ = """rtgs neft private limited pvt ltd llp india indian global services service technologies technology tech infra
infrastructure infrastructures projects project securities security pharma pharmaceuticals cements cement estates
estate carbon investment investments media ventures venture construction constructions foundations foundation civil
engineering eng stock broking beauty brands brand retail supply chain chem chemicals enterprises enterprise business
solutions solution resources resource advisors advisory access infotech info power energy energies solar wind steel
steels iron metals metal mining minerals industries industry trading traders trade finance financial capital holdings
holding developers developer realty realtors builders build properties property housing hotels hotel hospitality
foods food agro exports export imports import logistics transport transmission motors auto automobiles textiles
textile fabrics paper plastics polymers electricals electrical electronics systems software consultancy consultants
company corporation corp group trust electoral charitable fund marketing distributors distribution healthcare health
hospital hospitals medical life sciences labs laboratories education educational green renewable petro petroleum
gas oil coal coke cables wires tubes pipes cement mills mill sugar spinning gaming games lottery entertainment
films studios broadcasting communications telecom networks digital data cloud satellite airlines aviation shipping
ports marine sea land lands farms farm plantation tea coffee spices rice dairy beverages breweries distilleries
spirits wines tobacco apparel garments footwear jewellers jewellery gems diamonds gold silver ceramics glass
tiles paints coatings fertilisers fertilizers seeds crop science products product works manufacturing
manufacturers fabricators equipments equipment machines machinery tools engineers contractors contracts
kumar singh gupta sharma mishra agarwal agrawal jain shah patel reddy rao vijay ajay sanjay pankaj rajesh ramesh
suresh mahesh dinesh krishna lakshmi ganesh balaji shri sri devi prasad chand lal nath
""".split()
STATE_ABBR = {"UP", "MP", "AP", "HP", "TN", "WB", "UK", "JK", "NE", "II", "III", "IV", "USA", "UAE"}
KEEP_UPPER = {"LLP", "DLF", "NCC", "ITC", "MKJ", "RPSG", "JSW", "GMR", "IRB", "NHPC", "NTPC", "HDFC", "ICICI",
              "SBI", "MEIL", "GVK", "IDFC", "EPC", "RSPL", "IFB", "KPC", "PNB", "LIC", "BHEL", "ONGC", "SKM"}
SPECIAL = {"PVT": "Pvt", "LTD": "Ltd", "CO": "Co", "AND": "and", "OF": "of", "THE": "the", "&": "&", "PL": "Pvt Ltd"}
TRAILING_JUNK = re.compile(r"\s*(?:\b(?:RTGS|NEFT|IMPS|BR|L?\d{3,})\b\s*)+$")


@lru_cache(maxsize=1)
def english():
    """Common English words (>= 4 letters) from wordninja's frequency list, top 30k."""
    try:
        import wordninja
        path = os.path.join(os.path.dirname(wordninja.__file__), "wordninja_words.txt.gz")
        with gzip.open(path, "rt") as f:
            words = [w.strip() for w in f][:30000]
        return {w for w in words if len(w) >= 4}
    except Exception:
        return set()


def _cost(seg):
    if seg in BIZ:
        return 1.0
    if seg in english():
        return 1.6
    return 2.5 + len(seg) * 0.45    # unknown run: allowed, but long ones cost more than real words


def split_glued(token):
    """Split a long run of letters into known words, leaving unknown stretches intact."""
    s = token.lower()
    n = len(s)
    best = [(0.0, [])] + [(float("inf"), [])] * n
    for i in range(1, n + 1):
        for j in range(max(0, i - 24), i):
            seg = s[j:i]
            if len(seg) < 2 and seg not in ("a",):
                continue
            c = best[j][0] + _cost(seg)
            if c < best[i][0]:
                best[i] = (c, best[j][1] + [seg])
    parts = best[n][1]
    while len(parts) > 1 and parts[-1] in ("rtgs", "neft", "br", "imps", "l"):
        parts = parts[:-1]   # bank remarks glued onto the name
    # glue back unknown neighbours so proper nouns stay whole
    out = []
    for p in parts:
        if out and p not in BIZ and p not in english() and out[-1] not in BIZ and out[-1] not in english():
            out[-1] += p
        else:
            out.append(p)
    return [p.upper() for p in out]


def repair_split(tokens):
    """'LI MITED' -> 'LIMITED', 'L TD' -> 'LTD' when the join is a known word and a piece isn't."""
    out = []
    for t in tokens:
        if out:
            joined = (out[-1] + t).lower()
            a, b = out[-1].lower(), t.lower()
            if (joined in BIZ or joined in ("ltd", "pvt")) and not (a in BIZ and b in BIZ) and \
                    (a not in english() or b not in english()):
                out[-1] = out[-1] + t
                continue
        out.append(t)
    return out


def case_word(w, first):
    up = w.upper().rstrip(".")
    if up in SPECIAL:
        v = SPECIAL[up]
        return v[0].upper() + v[1:] if first else v
    if up in KEEP_UPPER or up in STATE_ABBR:
        return up
    letters = re.sub(r"[^A-Z]", "", up)
    if len(letters) == 1:
        return up
    if letters and len(letters) <= 4 and not re.search(r"[AEIOU]", letters) and up not in ("MR", "MRS", "DR", "SH", "SMT"):
        return up                       # acronyms such as RPSG, MKJ
    return "-".join(p[:1].upper() + p[1:].lower() for p in w.split("-"))


ADDRESS_START = re.compile(r"[\s,]+(?=(?:H\.?\s?No\b|House No|Village\b|Vill\.|Door No|D\.\s?No|Plot\b|Flat\b|"
                           r"No\.?\s?\d|\d+\s*[/,(-]|\d{2,}\b|[“\"]|Post\b|P\.O\.|C/o\b|At\s*[-–:]|Ward\b|T\.C\.\s?\d))")


def tidy(s):
    """Spacing fixes for names that are already in mixed case."""
    parts = ADDRESS_START.split(s, maxsplit=1)
    if len(parts) > 1 and len(parts[0]) >= 8:
        s = parts[0]                    # an address spilled into the name column
    if "," in s and len(s.split(",")[0]) >= 8:
        s = s.split(",")[0]             # party names never contain commas; addresses do
    s = re.sub(r"([a-z]{2})([A-Z][a-z])", r"\1 \2", s)        # GaribJanta -> Garib Janta
    s = re.sub(r"(\w)\(", r"\1 (", s)
    s = re.sub(r"\)(\w)", r") \1", s)
    s = re.sub(r"\s+[-–.]+(?:\s*[-–.])*\s+", " ", s)         # stray " - . " fragments
    s = re.sub(r"\(\s+", "(", s)
    s = re.sub(r"\s+\)", ")", s)
    s = re.sub(r"-\s+(?=[A-Z])", "-", s)                     # "Marxist- Ambedkarist"
    s = re.sub(r"(\w)'S\b", r"\1's", s)                     # People'S -> People's
    return re.sub(r"\s{2,}", " ", s).strip(" ,;")


def clean_name(raw):
    if not raw:
        return raw
    s = re.sub(r"\s+", " ", raw.replace(" ", " ")).strip()
    if s != s.upper() and re.search(r"[a-z]", s) and " " in s:
        return tidy(s)                  # already mixed case: only fix spacing
    s = TRAILING_JUNK.sub("", s.upper())
    tokens = []
    for t in re.split(r"(\s+|[(),/])", s):
        if not t or t.isspace():
            continue
        if re.fullmatch(r"MR[A-Z]{6,}", t):
            tokens.append("MR")
            t = t[2:]
        if re.fullmatch(r"[A-Z]{10,}", t):
            tokens.extend(split_glued(t))
        else:
            tokens.append(t)
    tokens = repair_split(tokens)
    words = [case_word(t, i == 0) if re.search(r"[A-Z]", t) else t for i, t in enumerate(tokens)]
    out = " ".join(words)
    out = re.sub(r"\s+([),/])", r"\1", out)
    out = re.sub(r"([(/])\s+", r"\1", out)
    return re.sub(r"\s{2,}", " ", out).strip()


def name_key(name):
    """Merge key for spelling variants of the same organisation."""
    s = (name or "").upper().replace("&", " AND ")
    s = re.sub(r"\bPVT\b|\bPRIVATE\b|\bP\b", " ", s)
    s = re.sub(r"\bLTD\b|\bLIMITED\b|\bLIMITE\b|\bLIMIT\b", " ", s)
    s = re.sub(r"\bAND\b|\bCO\b|\bCOMPANY\b|\bTHE\b", " ", s)
    return re.sub(r"[^A-Z0-9]", "", s)
