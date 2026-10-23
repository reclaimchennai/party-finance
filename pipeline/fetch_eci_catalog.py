import requests
import json
import os
import re

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

BASE_API = "https://www.eci.gov.in/eci-backend/public/api"

# Encrypted categories:
# 1: Expenditure Reports -> 3n2uo0hGhN0XIPNdkylcaA%3D%3D
# 2: Contribution Reports -> 0YcWVacCcN%2BItMO1821gUQ%3D%3D
# 3: Annual Audit Reports -> eRW6xxBOAJZaSpsvBHgf6w%3D%3D

CAT_CONTRIBUTIONS = "0YcWVacCcN%2BItMO1821gUQ%3D%3D"
CAT_AUDIT = "eRW6xxBOAJZaSpsvBHgf6w%3D%3D"
CAT_EXPENDITURE = "3n2uo0hGhN0XIPNdkylcaA%3D%3D"

os.makedirs('data/raw/metadata', exist_ok=True)
os.makedirs('data/derived', exist_ok=True)

def fetch_category(name, cat_token):
    url = f"{BASE_API}/get-custom-report?category_id={cat_token}"
    print(f"Fetching {name} from {url}...")
    try:
        r = requests.get(url, headers=HEADERS, timeout=30)
        data = r.json()
        with open(f"data/raw/metadata/{name}.json", "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"Saved {name}.json ({len(data.get('message', {}))} year groups)")
        return data
    except Exception as e:
        print(f"Error fetching {name}: {e}")
        return None

if __name__ == '__main__':
    fetch_category('contribution_reports', CAT_CONTRIBUTIONS)
    fetch_category('annual_audit_reports', CAT_AUDIT)
    fetch_category('expenditure_reports', CAT_EXPENDITURE)
