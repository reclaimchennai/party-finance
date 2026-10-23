import pymupdf
import re

def test_delisted_87():
    doc = pymupdf.open("data/raw/parties_pan_india/deleted_rupps_87.pdf")
    text = ""
    for page in doc:
        text += page.get_text() + "\n"
    
    # Each row is Sl. No., Name, Address
    # Matches: number on its own line or with name
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    items = []
    i = 0
    while i < len(lines):
        line = lines[i]
        m = re.match(r"^(\d+)\s*$", line)
        if m and int(m.group(1)) <= 100:
            sr = int(m.group(1))
            name = lines[i+1]
            i += 2
            addr_parts = []
            while i < len(lines) and not re.match(r"^\d+\s*$", lines[i]):
                if "Sl. No." not in lines[i] and "Headquarters Address" not in lines[i]:
                    addr_parts.append(lines[i])
                i += 1
            items.append({"sr": sr, "name": name, "address": " ".join(addr_parts)})
        else:
            i += 1
    print(f"deleted_rupps_87: found {len(items)} parties (expected 87)")
    if items:
        print("  Sample 1:", items[0])
        print("  Sample 87:", items[-1])

def test_delisted_111():
    doc = pymupdf.open("data/raw/parties_pan_india/deleted_rupps_111.pdf")
    text = ""
    for page in doc:
        text += page.get_text() + "\n"
    
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    items = []
    i = 0
    while i < len(lines):
        line = lines[i]
        m = re.match(r"^(\d+)\s*$", line)
        if m and int(m.group(1)) <= 150:
            sr = int(m.group(1))
            name = lines[i+1]
            i += 2
            addr_parts = []
            while i < len(lines) and not re.match(r"^\d+\s*$", lines[i]):
                if "Sl. No." not in lines[i] and "Address" not in lines[i]:
                    addr_parts.append(lines[i])
                i += 1
            items.append({"sr": sr, "name": name, "address": " ".join(addr_parts)})
        else:
            i += 1
    print(f"deleted_rupps_111: found {len(items)} parties (expected 111)")
    if items:
        print("  Sample 1:", items[0])
        print("  Sample 111:", items[-1])

def test_delisted_86():
    doc = pymupdf.open("data/raw/parties_pan_india/deleted_rupps_86_2022.pdf")
    text = ""
    for page in doc:
        text += page.get_text() + "\n"
    
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    items = []
    i = 0
    while i < len(lines):
        line = lines[i]
        m = re.match(r"^(\d+)\s*$", line)
        if m and int(m.group(1)) <= 100:
            sr = int(m.group(1))
            name = lines[i+1]
            i += 2
            parts = []
            while i < len(lines) and not re.match(r"^\d+\s*$", lines[i]):
                if "Sl." not in lines[i] and "Name of the" not in lines[i]:
                    parts.append(lines[i])
                i += 1
            items.append({"sr": sr, "name": name, "rest": " ".join(parts)})
        else:
            i += 1
    print(f"deleted_rupps_86: found {len(items)} parties (expected 86)")
    if items:
        print("  Sample 1:", items[0])
        print("  Sample 86:", items[-1])

def test_inactive_253():
    doc = pymupdf.open("data/raw/parties_pan_india/inactive_rupps_253_2022.pdf")
    text = ""
    for page in doc:
        text += page.get_text() + "\n"
    
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    items = []
    i = 0
    while i < len(lines):
        line = lines[i]
        m = re.match(r"^(\d+)\s*$", line)
        if m and int(m.group(1)) <= 300:
            sr = int(m.group(1))
            name = lines[i+1]
            i += 2
            parts = []
            while i < len(lines) and not re.match(r"^\d+\s*$", lines[i]):
                if "Sl. No." not in lines[i] and "Name of the" not in lines[i]:
                    parts.append(lines[i])
                i += 1
            items.append({"sr": sr, "name": name, "rest": " ".join(parts)})
        else:
            i += 1
    print(f"inactive_rupps_253: found {len(items)} parties (expected 253)")
    if items:
        print("  Sample 1:", items[0])
        print("  Sample 253:", items[-1])

def test_delisted_255():
    doc = pymupdf.open("data/raw/parties_pan_india/deleted_rupps_255_2016.pdf")
    text = ""
    for p in range(1, len(doc)):
        text += doc[p].get_text() + "\n"
    
    # Each row has Sl No. (1-255), Notification Sl No., Name, Address
    # In page text:
    # 1. \n 36 \n Party Name \n Address
    pattern = re.compile(r"\n\s*(\d{1,3})\.\s*\n\s*(\d+)\s*\n\s*([^\n]+)", re.MULTILINE)
    matches = list(pattern.finditer(text))
    print(f"deleted_rupps_255_2016: found {len(matches)} party headers (expected 255)")
    if matches:
        print("  Sample 1:", matches[0].groups())
        print("  Sample last:", matches[-1].groups())

if __name__ == "__main__":
    test_delisted_87()
    test_delisted_111()
    test_delisted_86()
    test_inactive_253()
    test_delisted_255()
