import json
import os
import requests
import time
from urllib.parse import urlparse

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

TN_PARTIES = [
    'dravida munnetra kazhagam',
    'anna dravida munnetra kazhagam',
    'naam tamilar katchi',
    'pattali makkal katchi',
    'desiya murpokku dravida kazhagam',
    'marumalarchi dravida munnetra kazhagam',
    'viduthalai chiruthaigal katchi',
    'makkal needhi maiam',
    'indian union muslim league',
    'all india n r congress',
    # National parties operating in TN:
    'bharatiya janata party',
    'indian national congress',
    'communist party of india (marxist)',
    'communist party of india',
    'aam aadmi party',
    'bahujan samaj party'
]

def is_target_party(title):
    t = title.lower()
    return any(p in t for p in TN_PARTIES)

def sanitize_filename(name):
    return "".join(c if c.isalnum() or c in (' ', '-', '_', '.') else '_' for c in name).strip()

def download_file(url, target_path):
    if os.path.exists(target_path) and os.path.getsize(target_path) > 1000:
        print(f"  [Exists] {os.path.basename(target_path)}")
        return True
    try:
        r = requests.get(url, headers=HEADERS, stream=True, timeout=60)
        if r.status_code == 200:
            with open(target_path, 'wb') as f:
                for chunk in r.iter_content(chunk_size=1024*1024):
                    if chunk:
                        f.write(chunk)
            print(f"  [Downloaded] {os.path.basename(target_path)} ({os.path.getsize(target_path)//1024} KB)")
            return True
        else:
            print(f"  [Failed {r.status_code}] {url}")
            return False
    except Exception as e:
        print(f"  [Error] {e} on {url}")
        return False

def download_catalog(catalog_file, output_dir, report_type, every_party=False):
    os.makedirs(output_dir, exist_ok=True)
    with open(catalog_file) as f:
        data = json.load(f).get('message', {})
    
    print(f"\n================ Downloading {report_type} ================")
    count = 0
    manifest_path = os.path.join(output_dir, 'manifest.json')
    manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {}
    url_to_file = {v['pdf_url']: k for k, v in manifest.items()}
    for year_group, items in data.items():
        for item in items:
            title = item.get('title', '')
            pdf_url = item.get('pdf_url')
            if (every_party or is_target_party(title)) and pdf_url:
                year_clean = sanitize_filename(year_group)
                title_clean = sanitize_filename(title)[:80]
                fname = url_to_file.get(pdf_url) or f"{year_clean}_{title_clean}.pdf"
                if fname in manifest and manifest[fname]['pdf_url'] != pdf_url:
                    # truncated titles can collide (e.g. original vs revised report)
                    fname = f"{year_clean}_{title_clean}_{pdf_url.rsplit('/', 1)[-1]}"
                manifest[fname] = {'pdf_url': pdf_url, 'title': title, 'year_group': year_group}
                target_path = os.path.join(output_dir, fname)
                print(f"-> {year_group}: {title}")
                if download_file(pdf_url, target_path):
                    count += 1
                time.sleep(0.3)
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=1, ensure_ascii=False)
    print(f"Downloaded {count} {report_type} PDFs")

if __name__ == '__main__':
    import sys
    if '--all-audits' in sys.argv:
        # Every recognized party's audited accounts, for pan-India finance comparison
        download_catalog('data/raw/metadata/annual_audit_reports.json', 'data/raw/annual_audits', 'Annual Audit Reports', every_party=True)
    else:
        download_catalog('data/raw/metadata/contribution_reports.json', 'data/raw/contributions', 'Contribution Reports')
        download_catalog('data/raw/metadata/annual_audit_reports.json', 'data/raw/annual_audits', 'Annual Audit Reports')
