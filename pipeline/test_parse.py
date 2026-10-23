import pymupdf
import re

doc = pymupdf.open("data/raw/parties_pan_india/main_notification_2021.pdf")
full_text = ""
for pno in range(8, 101):
    txt = doc[pno].get_text()
    lines = txt.split("\n")
    clean_lines = []
    for l in lines:
        s = l.strip()
        if re.match(r"^\d+$", s) and int(s) == pno + 1:
            continue
        if "TABLE – III" in s or "REGISTERED UNRECOGNISED PARTIES" in s:
            continue
        if "Name of the Registered" in s or "Headquarters Address" in s or "Sl. No." in s:
            continue
        clean_lines.append(l)
    full_text += "\n" + "\n".join(clean_lines) + "\n"

pos = 0
parties = []
missed = []

for expected in range(1, 2797):
    # Regex: newline followed by expected number, then space or newline, then Party name starting with letter or symbol
    pat = re.compile(r"\n\s*" + str(expected) + r"[\s\n]+([A-Z\(\"\'\‘\’][^\n]+)")
    m = pat.search(full_text, pos)
    if not m:
        # try searching from full text (in case out of order or page boundary)
        m = pat.search(full_text)
    if m:
        name = m.group(1).strip()
        parties.append({"id": expected, "name": name, "start": m.start(), "end": m.end()})
        pos = m.end()
    else:
        missed.append(expected)

print(f"Successfully matched {len(parties)} / 2796 parties!")
print(f"Missed {len(missed)}: {missed[:20]}")
if parties:
    print("Sample party 1:", parties[0])
    print("Sample party 100:", parties[99] if len(parties) > 99 else None)
    print("Sample party 2796:", parties[-1])
