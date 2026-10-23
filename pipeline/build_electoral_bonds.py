import fitz
import re
import json
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # for names.py
from collections import defaultdict, Counter
from datetime import datetime

print("Starting Electoral Bonds processor...")

DOC_RED_PATH = 'data/raw/electoral_bonds/EB_Redemption_Details.pdf'
DOC_PUR_PATH = 'data/raw/electoral_bonds/EB_Purchase_Details.pdf'

# Regex patterns for Redemption
combined_re = re.compile(r'^(\d+)\s+(\d{2}/[A-Za-z]{3}/\d{4})\s*(.*)$')
date_re = re.compile(r'^(\d{2}/[A-Za-z]{3}/\d{4})\s*(.*)$')
acct_re = re.compile(r'^\*+\d{4}$')
num_re = re.compile(r'^\d+$')

doc_red = fitz.open(DOC_RED_PATH)
redemptions = []

for page in doc_red:
    for b in page.get_text('blocks'):
        text = b[4].strip()
        if 'Sr No.' in text or text.startswith('Page '):
            continue
        lines = [l.strip() for l in text.split('\n') if l.strip()]
        i = 0
        while i < len(lines):
            sr, date, party_initial = None, None, ''
            m_comb = combined_re.match(lines[i])
            if m_comb:
                sr, date, party_initial = m_comb.group(1), m_comb.group(2), m_comb.group(3).strip()
                next_idx = i + 1
            elif num_re.match(lines[i]) and i + 1 < len(lines):
                m_d = date_re.match(lines[i+1])
                if m_d:
                    sr, date, party_initial = lines[i], m_d.group(1), m_d.group(2).strip()
                    next_idx = i + 2
                else:
                    i += 1
                    continue
            else:
                i += 1
                continue
            
            j = next_idx
            party_parts = [party_initial] if party_initial else []
            while j < len(lines) and not acct_re.match(lines[j]) and not date_re.match(lines[j]) and not combined_re.match(lines[j]):
                party_parts.append(lines[j])
                j += 1
            
            if j < len(lines) and acct_re.match(lines[j]):
                acct = lines[j]
                prefix = lines[j+1] if j+1 < len(lines) else ''
                bond_no = lines[j+2] if j+2 < len(lines) else ''
                denom = lines[j+3] if j+3 < len(lines) else ''
                branch = lines[j+4] if j+4 < len(lines) else ''
                teller = lines[j+5] if j+5 < len(lines) else ''
                denom_val = int(denom.replace(',', ''))
                redemptions.append({
                    'sr': int(sr),
                    'encash_date': date,
                    'party': ' '.join(party_parts).strip(),
                    'account': acct,
                    'prefix': prefix,
                    'bond_no': bond_no,
                    'denomination': denom_val,
                    'branch': branch,
                    'teller': teller
                })
                i = j + 6
            else:
                i = next_idx

print(f"Parsed {len(redemptions)} redemptions")

# Regex patterns for Purchases
date_token_re = re.compile(r'\b\d{2}/[A-Za-z]{3}/\d{4}\b')
prefix_re = re.compile(r'^[A-Z]{2}$')
denom_re = re.compile(r'^\d{1,3}(?:,\d{2,3})*(?:,\d{3})?$')
comb_sr_urn = re.compile(r'^(\d+)\s+(\d{20,25})$')
urn_re = re.compile(r'^\d{20,25}$')

doc_pur = fitz.open(DOC_PUR_PATH)
purchases = {}

for page in doc_pur:
    for b in page.get_text('blocks'):
        text = b[4].strip()
        if 'Sr No.' in text or text.startswith('Page '):
            continue
        lines = [l.strip() for l in text.split('\n') if l.strip()]
        i = 0
        while i < len(lines):
            sr, urn = None, None
            m_comb = comb_sr_urn.match(lines[i])
            if m_comb:
                sr, urn = m_comb.group(1), m_comb.group(2)
                next_idx = i + 1
            elif num_re.match(lines[i]) and i + 1 < len(lines) and urn_re.match(lines[i+1]):
                sr, urn = lines[i], lines[i+1]
                next_idx = i + 2
            else:
                i += 1
                continue
            
            k = next_idx
            dates, purchaser_parts = [], []
            while k < len(lines):
                if prefix_re.match(lines[k]) and k + 4 < len(lines) and num_re.match(lines[k+1]) and denom_re.match(lines[k+2]):
                    break
                dates.extend(date_token_re.findall(lines[k]))
                clean_text = date_token_re.sub('', lines[k]).strip()
                if clean_text:
                    purchaser_parts.append(clean_text)
                k += 1
            
            if k < len(lines) and len(dates) >= 2:
                prefix = lines[k]
                bond_no = lines[k+1]
                denom = lines[k+2]
                branch = lines[k+3]
                teller = lines[k+4]
                status = lines[k+5] if k+5 < len(lines) and lines[k+5] in ['Paid', 'Expired'] else 'Paid'
                denom_val = int(denom.replace(',', ''))
                purchases[(prefix, bond_no)] = {
                    'sr': int(sr),
                    'urn': urn,
                    'journal_date': dates[0],
                    'purchase_date': dates[1] if len(dates) > 1 else dates[0],
                    'expiry_date': dates[2] if len(dates) > 2 else '',
                    'purchaser': ' '.join(purchaser_parts).strip(),
                    'prefix': prefix,
                    'bond_no': bond_no,
                    'denomination': denom_val,
                    'branch': branch,
                    'teller': teller,
                    'status': status
                }
                i = k + 6
            else:
                i = next_idx

print(f"Parsed {len(purchases)} purchases")

# Standardize party names
def normalize_party(p):
    p_up = p.upper().strip()
    if 'DRAVIDA MUNNETRA KAZHAGAM' in p_up and 'ANNA' not in p_up:
        return 'DMK'
    if 'ALL INDIA ANNA DRAVIDA MUNNETRA KAZHAGAM' in p_up or 'AIADMK' in p_up:
        return 'AIADMK'
    if 'BHARATIYA JANATA PARTY' in p_up or p_up == 'BJP':
        return 'BJP'
    if 'ALL INDIA CONGRESS COMMITTEE' in p_up or 'INDIAN NATIONAL CONGRESS' in p_up:
        return 'INC'
    if 'TRINAMOOL CONGRESS' in p_up:
        return 'AITC'
    if 'BHARAT RASHTRA SAMITHI' in p_up or 'TELANGANA RASHTRA SAMITHI' in p_up:
        return 'BRS'
    if 'BIJU JANATA DAL' in p_up:
        return 'BJD'
    if 'AAM AADMI PARTY' in p_up:
        return 'AAP'
    if 'YUVAJANA SRAMIKA RYTHU' in p_up or 'YSR' in p_up:
        return 'YSRCP'
    if 'TELUGU DESAM' in p_up:
        return 'TDP'
    if 'SHIVSENA' in p_up or 'SHIV SENA' in p_up:
        return 'SHIVSENA'
    if 'JANASENA' in p_up:
        return 'JANASENA'
    if 'RASHTRIYA JANTA DAL' in p_up:
        return 'RJD'
    if 'SAMAJVADI PARTY' in p_up:
        return 'SP'
    if 'JANATA DAL ( SECULAR )' in p_up or 'JANATA DAL (SECULAR)' in p_up:
        return 'JD(S)'
    if 'JANTA DAL(UNITED)' in p_up or 'JANATA DAL (UNITED)' in p_up:
        return 'JD(U)'
    if 'JHARKHAND MUKTI MORCHA' in p_up:
        return 'JMM'
    if 'SHIROMANI AKALI DAL' in p_up:
        return 'SAD'
    if 'SIKKIM KRANTIKARI MORCHA' in p_up:
        return 'SKM'
    if 'SIKKIM DEMOCRATIC FRONT' in p_up:
        return 'SDF'
    return p

# Standardize purchaser names (normalize corporate entities)
def normalize_purchaser(p):
    p_clean = p.strip()
    p_up = p_clean.upper()
    if 'FUTURE GAMING' in p_up:
        return 'Future Gaming and Hotel Services PR'
    if 'MEGHA ENGINEERING' in p_up:
        return 'Megha Engineering & Infrastructures Ltd'
    if 'WESTWELL GASES' in p_up:
        return 'Westwell Gases Pvt Ltd'
    if 'ASKUS LOGISTICS' in p_up:
        return 'Askus Logistics Pvt Ltd'
    if 'FERTILELAND FOODS' in p_up:
        return 'Fertileland Foods Pvt Ltd'
    if 'INDIA CEMENTS' in p_up:
        return 'The India Cements Ltd'
    if 'HERALD BEVERAGES' in p_up:
        return 'Herald Beverages Pvt Ltd'
    if 'KAL RADIO' in p_up:
        return 'Kal Radio Ltd (Sun Group)'
    if 'CHENNAI GREEN WOODS' in p_up:
        return 'Chennai Green Woods Pvt Ltd'
    if 'APCO INFRATECH' in p_up:
        return 'Apco Infratech Pvt Ltd'
    if 'VEDANTA' in p_up:
        return 'Vedanta Limited'
    if 'BHARTI AIRTEL' in p_up or 'BHARTI TELEMEDIA' in p_up:
        return 'Bharti Airtel Group'
    if 'HALDIA ENERGY' in p_up:
        return 'Haldia Energy Limited'
    if 'ESSEL MINING' in p_up:
        return 'Essel Mining & Industries Ltd'
    if 'JINDAL' in p_up:
        return 'Jindal Group'
    if 'TORRENT' in p_up:
        return 'Torrent Group'
    return p_clean

# Join redemptions with purchases
joined_bonds = []
party_stats = defaultdict(lambda: {
    'party_raw': '',
    'party_code': '',
    'total_amount': 0,
    'total_bonds': 0,
    'matched_bonds': 0,
    'unmatched_bonds': 0,
    'denominations': defaultdict(int),
    'monthly_timeline': defaultdict(int),
    'donors': defaultdict(int),
    'dates': []
})

tn_regional_codes = {'DMK', 'AIADMK', 'NTK', 'PMK', 'DMDK', 'MDMK', 'VCK', 'MNM', 'IUML'}
tn_national_codes = {'BJP', 'INC', 'CPI(M)', 'CPI', 'AAP', 'BSP'}

for r in redemptions:
    key = (r['prefix'], r['bond_no'])
    p_code = normalize_party(r['party'])
    stats = party_stats[p_code]
    stats['party_raw'] = r['party']
    stats['party_code'] = p_code
    stats['total_amount'] += r['denomination']
    stats['total_bonds'] += 1
    stats['denominations'][r['denomination']] += 1
    
    # date handling
    date_str = r['encash_date']
    stats['dates'].append(date_str)
    try:
        dt = datetime.strptime(date_str, "%d/%b/%Y")
        ym = dt.strftime("%Y-%m")
        stats['monthly_timeline'][ym] += r['denomination']
    except:
        pass
    
    pur = purchases.get(key)
    if pur:
        stats['matched_bonds'] += 1
        donor_norm = normalize_purchaser(pur['purchaser'])
        stats['donors'][donor_norm] += r['denomination']
        donor_name = pur['purchaser']
        pur_date = pur['purchase_date']
        urn = pur['urn']
    else:
        stats['unmatched_bonds'] += 1
        donor_name = "Undisclosed (Purchased pre-12-Apr-2019)"
        donor_norm = donor_name
        stats['donors'][donor_norm] += r['denomination']
        pur_date = "Pre-12-Apr-2019"
        urn = "NA"
    
    joined_bonds.append({
        'prefix': r['prefix'],
        'bond_no': r['bond_no'],
        'code': f"{r['prefix']}{r['bond_no']}",
        'party_code': p_code,
        'party_name': r['party'],
        'denomination': r['denomination'],
        'encash_date': r['encash_date'],
        'purchase_date': pur_date,
        'purchaser': donor_name,
        'purchaser_normalized': donor_norm,
        'branch_encash': r['branch'],
        'urn': urn
    })

# Add zero-bond parties explicitly for transparency:
zero_parties = [
    ('CPI(M)', 'Communist Party of India (Marxist)', 'National Party (Refused on Constitutional Principle)'),
    ('CPI', 'Communist Party of India', 'National Party (Refused on Principle)'),
    ('NTK', 'Naam Tamilar Katchi', 'State Party (Did Not Receive/Accept)'),
    ('PMK', 'Pattali Makkal Katchi', 'State Party (No Encashed Bonds Disclosed)'),
    ('DMDK', 'Desiya Murpokku Dravida Kazhagam', 'State Party (No Encashed Bonds Disclosed)'),
    ('MDMK', 'Marumalarchi Dravida Munnetra Kazhagam', 'Regional Party (No Bonds Disclosed)'),
    ('VCK', 'Viduthalai Chiruthaigal Katchi', 'Regional Party (No Bonds Disclosed)'),
    ('MNM', 'Makkal Needhi Maiam', 'Regional Party (No Bonds Disclosed)'),
    ('BSP', 'Bahujan Samaj Party', 'National Party (No Electoral Bonds Encashed)')
]

for code, name, note in zero_parties:
    if code not in party_stats:
        party_stats[code] = {
            'party_raw': name,
            'party_code': code,
            'total_amount': 0,
            'total_bonds': 0,
            'matched_bonds': 0,
            'unmatched_bonds': 0,
            'denominations': {},
            'monthly_timeline': {},
            'donors': {},
            'dates': [],
            'note': note
        }

# Format output structure
parties_output = []
for p_code, stats in sorted(party_stats.items(), key=lambda x: -x[1]['total_amount']):
    top_donors = []
    for d, amt in sorted(stats['donors'].items(), key=lambda x: -x[1])[:25]:
        top_donors.append({
            'donor': d,
            'amount': amt,
            'amount_cr': round(amt / 10_000_000, 2),
            'share_pct': round((amt / stats['total_amount'] * 100), 2) if stats['total_amount'] > 0 else 0
        })
    
    # Timeline sorted
    timeline_sorted = [
        {'month': m, 'amount': amt, 'amount_cr': round(amt / 10_000_000, 2)}
        for m, amt in sorted(stats['monthly_timeline'].items())
    ]
    
    denom_formatted = [
        {'denomination': k, 'count': v, 'total': k * v, 'total_cr': round((k * v) / 10_000_000, 2)}
        for k, v in sorted(stats['denominations'].items(), reverse=True)
    ]
    
    is_tn_regional = p_code in tn_regional_codes
    is_tn_national = p_code in tn_national_codes
    
    parties_output.append({
        'party_code': p_code,
        'party_name': stats['party_raw'] or p_code,
        'is_tn_regional': is_tn_regional,
        'is_tn_national': is_tn_national,
        'total_amount': stats['total_amount'],
        'total_amount_cr': round(stats['total_amount'] / 10_000_000, 2),
        'total_bonds': stats['total_bonds'],
        'matched_bonds': stats['matched_bonds'],
        'unmatched_bonds': stats['unmatched_bonds'],
        'top_donors': top_donors,
        'monthly_timeline': timeline_sorted,
        'denominations': denom_formatted,
        'note': stats.get('note', '')
    })

# Full registry filtered to TN parties and national parties in TN + top corporate donors
tn_and_national_codes = tn_regional_codes | tn_national_codes
eb_registry = [b for b in joined_bonds if b['party_code'] in tn_and_national_codes]

# Summary KPI metadata
total_eb_amount = sum(b['denomination'] for b in joined_bonds)
tn_regional_amount = sum(b['denomination'] for b in joined_bonds if b['party_code'] in tn_regional_codes)
dmk_amount = sum(b['denomination'] for b in joined_bonds if b['party_code'] == 'DMK')
aiadmk_amount = sum(b['denomination'] for b in joined_bonds if b['party_code'] == 'AIADMK')

eb_summary = {
    'total_scheme_encashed': total_eb_amount,
    'total_scheme_encashed_cr': round(total_eb_amount / 10_000_000, 2),
    'total_scheme_bonds': len(joined_bonds),
    'tn_regional_encashed': tn_regional_amount,
    'tn_regional_encashed_cr': round(tn_regional_amount / 10_000_000, 2),
    'dmk_encashed_cr': round(dmk_amount / 10_000_000, 2),
    'aiadmk_encashed_cr': round(aiadmk_amount / 10_000_000, 2),
    'bjp_encashed_cr': round(sum(b['denomination'] for b in joined_bonds if b['party_code'] == 'BJP') / 10_000_000, 2),
    'inc_encashed_cr': round(sum(b['denomination'] for b in joined_bonds if b['party_code'] == 'INC') / 10_000_000, 2),
    'zero_bond_parties': ['CPI(M)', 'CPI', 'NTK', 'PMK', 'DMDK', 'MDMK', 'VCK', 'MNM', 'BSP'],
    'parties': parties_output,
    'registry_count': len(eb_registry)
}

os.makedirs('data/derived', exist_ok=True)
with open('data/derived/electoral_bonds_summary.json', 'w', encoding='utf-8') as f:
    json.dump(eb_summary, f, indent=2)

with open('data/derived/electoral_bonds_registry.json', 'w', encoding='utf-8') as f:
    json.dump(eb_registry, f, indent=2)

print(f"Successfully generated electoral_bonds_summary.json ({len(parties_output)} parties)")
print(f"Successfully generated electoral_bonds_registry.json ({len(eb_registry)} TN & National records)")

# Compact every-party bond table for the dashboard's donor x party explorer.
# rows: [party_idx, donor_idx, denomination, encash YYYYMMDD, purchase YYYYMMDD or 0]
def ymd(s):
    try:
        return int(datetime.strptime(s, "%d/%b/%Y").strftime("%Y%m%d"))
    except (ValueError, TypeError):
        return 0

from names import clean_name, name_key

party_codes = sorted({b['party_code'] for b in joined_bonds})
party_names = {b['party_code']: clean_name(b['party_name']) for b in joined_bonds}
# clean buyer names and merge spelling variants ("& Finance" / "and Finance" / "Pvt Ltd" / "Private Limited")
variants = {}
for b in joined_bonds:
    raw = b['purchaser_normalized']
    variants.setdefault(name_key(clean_name(raw)) or raw, Counter())[clean_name(raw)] += b['denomination']
display = {k: c.most_common(1)[0][0] for k, c in variants.items()}
donor_of = {b['purchaser_normalized']: display[name_key(clean_name(b['purchaser_normalized'])) or b['purchaser_normalized']] for b in joined_bonds}
donor_names = sorted(set(donor_of.values()))
p_idx = {c: i for i, c in enumerate(party_codes)}
d_idx = {d: i for i, d in enumerate(donor_names)}
compact = {
    'source': 'SBI disclosures to ECI under Supreme Court order in ADR v. Union of India (WP(C) 880/2017), March 2024',
    'parties': [{'code': c, 'name': party_names[c]} for c in party_codes],
    'donors': donor_names,
    'rows': [[p_idx[b['party_code']], d_idx[donor_of[b['purchaser_normalized']]], b['denomination'],
              ymd(b['encash_date']), ymd(b['purchase_date'])] for b in joined_bonds],
}
for path in ('data/derived/electoral_bonds_all.json', 'public/data/electoral_bonds_all.json'):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(compact, f, separators=(',', ':'), ensure_ascii=False)
print(f"Successfully generated electoral_bonds_all.json ({len(compact['rows'])} bonds, {len(donor_names)} donors)")
