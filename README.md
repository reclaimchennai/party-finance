# Tamil Nadu Political Parties Financial Accountability & Pan-India Registry Dashboard

A unified, high-precision public transparency dashboard holding political parties accountable to the public through official statutory filings with the **Election Commission of India (ECI)** and **Supreme Court-mandated State Bank of India (SBI) Electoral Bonds disclosures**.

Built in the same family as other reclaimchennai.city dashboards, utilizing the custom `kit.css` design system with warm neutral surfaces, hairline grids, 44px pill controls, dark/light theme switching, and client-side SVG visualization.

---

## 🏛️ Key Features & Modules

### 1. 🔍 Financial Transparency & Accountability (Tamil Nadu Focus)
Tracks all regional political parties in Tamil Nadu along with national parties that contest elections and operate in the state:
- **Regional Parties**: DMK, AIADMK, Naam Tamilar Katchi (NTK), PMK, DMDK, MDMK, VCK, Makkal Needhi Maiam (MNM), Indian Union Muslim League (IUML).
- **National Parties in TN**: BJP, INC, CPI(M), CPI, AAP, BSP.

#### Core Financial Datasets:
1. **Supreme Court Mandated Electoral Bonds Disclosure**:
   - Exact transaction-level matching between **20,421 redemption records** and **18,871 SBI purchaser records** across prefix and bond numbers with **0 missing records**.
   - Sourced from official SBI disclosures mandated by the Supreme Court in *ADR & CPI(M) v. Union of India* (WP(C) 880/2017).
   - Tamil Nadu Redemptions:
     - **DMK**: ₹639.00 Crore (Top donors: Future Gaming & Hotel Services ₹503 Cr, Megha Engineering ₹105 Cr, India Cements ₹14 Cr).
     - **AIADMK**: ₹6.05 Crore (Pre-April 12, 2019 cutoff redemptions).
     - **Zero-Bond Transparency**: CPI(M), CPI, NTK refused to accept Electoral Bonds on principle.
2. **Annual Audit Reports & Balance Sheets (Section 139(4B) Income Tax Act, 1961)**:
   - Tracks general reserves, annual income, election expenditure, and fixed deposits over multiple fiscal years (FY 2020-21 through FY 2024-25).
   - Warchests:
     - **BJP**: ₹12,164.15 Cr reserves (₹6,769.15 Cr FY 2024-25 income).
     - **DMK**: ₹747.52 Cr reserves (₹737.5 Cr in bank fixed deposits; ₹406.40 Cr FY 2024-25 income).
     - **INC**: ₹365.50 Cr reserves (₹918.30 Cr FY 2024-25 income).
     - **AIADMK**: ₹327.16 Cr reserves (₹196.6 Cr in bank balances; ₹86.20 Cr FY 2024-25 income).
     - **NTK**: ₹0.56 Cr reserves (₹3.32 Cr FY 2024-25 income).
3. **Form 24A Contribution Reports (Section 29C Representation of the People Act, 1951)**:
   - Mandatory statutory disclosures of individual and corporate donations exceeding ₹20,000.
4. **Official ECI Document Archive**:
   - Direct access and downloads for 367+ official signed PDFs and balance sheets directly from ECI's server repository.

---

### 2. 🗺️ Pan-India Political Parties Master Database & Geocoded Map
A comprehensive registry of **every party in the ECI registry (3,942 parties, updated to the 10 Oct 2025 RUPP notification)**:
- **Recognized National Parties (6)**: AAP, BSP, BJP, CPI(M), INC, NPP.
- **Recognized State Parties (51)**: DMK, AIADMK, TMC, NCP, SP, JD(U), RJD, TDP, YSRCP, BRS, Shiv Sena, BJD, etc.
- **Registered Unrecognized Political Parties (RUPPs) (2,403)**: Active parties allotted free election symbols.
- **Declared Inactive Parties (251)**: Parties that failed to contest any assembly or parliamentary election for 6+ consecutive years (ECI September 2022 order).
- **Delisted / Cancelled Parties (505)**: Untraceable/non-existent parties delisted upon physical postal verification (Orders of Dec 2016, May 2022, June 2022, Sept 2022).

#### Geographic Features:
- Headquarters addresses parsed with **6-digit Indian PIN codes** and state/district centroids.
- Interactive Leaflet choropleth map shaded by state political party concentration.
- Color-coded micro-jittered circle markers preventing visual overlap.
- Click-to-filter state breakdown and live search across party names, addresses, PIN codes, and delisting orders.
- Direct CSV download: [`public/data/all_india_parties.csv`](public/data/all_india_parties.csv).

---

## 🌐 Live site and data

- Site: **https://mla.reclaimchennai.city/party/**
- Processed data is in this repo: `public/data/` (what the site loads, incl. `public/data/dash/*.json`) and `data/derived/`.
- Raw source files are attached to the [latest release](https://github.com/reclaimchennai/party-finance/releases/latest) as zips. Unzip each into `data/raw/` to rerun the pipeline:

| Asset | Contents |
|---|---|
| `eci-annual-audit-reports.zip` | 214 ECI annual audit reports (PDF) + `manifest.json` |
| `eci-contribution-reports.zip` | ECI Form 24A contribution reports (PDF) |
| `sbi-electoral-bonds.zip` | SBI electoral bond redemption and purchase disclosures (PDF) |
| `eci-party-notifications.zip` | ECI recognition / RUPP notifications and delisting orders (PDF) |
| `ocr-text.zip` | Page-marked text of every audit report, OCR of the 2025 RUPP notification |
| `tn-rupp-audit-reports.zip` | 88 TN RUPP audited-accounts PDFs from the CEO Tamil Nadu portal, with their page text |
| `election-expenditure-statements.zip` | 174 election-expenditure statements (ECI archive, ECI, CEO Tamil Nadu) for Tamil Nadu elections 2006–2026 |
| `myneta-pages.zip` | Cached ADR MyNeta statement and donor-list pages |

`SHA256SUMS.txt` in the release lists checksums.

### Sources and credits

- Election Commission of India: audited annual accounts, Form 24A contribution reports, election-expenditure statements, party recognition and RUPP notifications, delisting orders.
- Chief Electoral Officer, Tamil Nadu: RUPP filing register and the filed PDFs.
- State Bank of India electoral bond disclosures (Supreme Court order, *ADR v. Union of India*).
- Association for Democratic Reforms, [MyNeta](https://myneta.info/party/): transcribed income-expenditure statements and Form 24A donor lists for FY 2001-02 onward.
- State boundaries: [DataMeet](https://github.com/datameet/maps) (Survey of India boundaries, including all of Jammu & Kashmir and Ladakh), MIT licence.

## 📊 The explorer (`public/index.html`, `public/app.js`)

Six views, every filter kept in the URL hash so any view can be shared:

| View | What you can do |
|---|---|
| Overview | Headline figures, income and electoral-bond rankings, TN RUPP filing trend |
| Election spending | Every Tamil Nadu Lok Sabha and Assembly election 2006–2026: what each party spent, on what (travel, advertising, rallies, publicity, candidates), Tamil Nadu share of national parties' statements |
| Finances | Pick scope (TN focus / recognised / TN unrecognised / all), measure and year; ranked bars, multi-party trend, income mix, full table with source links + CSV |
| Electoral bonds | Filter all 20,421 bonds by party, buyer and year; monthly timeline, party shares, buyer rankings and table |
| Filing compliance | Party × year grid (on time / late / not filed) for TN RUPPs from the CEO TN portal, and ECI publication status for recognised parties |
| Party registry | 3,900+ parties on an India map; filter by status, state, 2025 delisting, registration after 2021 |
| Documents | Search 1,500+ source filings by party, type, year and source |

Click any party anywhere to open its file: profile, money in/out by year with sources, top bond buyers, filing record and documents. The previous card-based dashboard is kept at `/classic.html`.

## 🛠️ Data Pipeline & Architecture

Run in this order (Python deps: `python3 -m venv .venv && .venv/bin/pip install pymupdf requests beautifulsoup4 opencv-python-headless numpy`; also `poppler` and `tesseract` from Homebrew):

| Step | Script | Output |
|---|---|---|
| 1 | `pipeline/fetch_eci_catalog.py` — ECI audit / contribution / expenditure report catalogs | `data/raw/metadata/*.json` |
| 2 | `pipeline/download_reports.py --all-audits` — every recognised party's audited accounts (writes `manifest.json`) | `data/raw/annual_audits/` |
| 3 | `pipeline/extract_audit_text.py` — page-marked text, tesseract for image-only pages | `data/raw/ocr/audit_text/` |
| 4 | Figure extraction per report following `data/raw/ocr/audit_extract/INSTRUCTIONS.md` (done with Claude subagents; each value carries a page and confidence) | `data/raw/ocr/audit_extract/batch_*_output.json` |
| 5 | `pipeline/scrape_tn_rupps_erolls.py` — CEO Tamil Nadu RUPP filings incl. non-filers, receipts, expenditure, election statements | `public/data/tn_rupp_filings_erolls.json`, `tn_rupp_filing_summary.json` |
| 6 | `.venv/bin/python pipeline/build_electoral_bonds.py` — SBI redemption ↔ purchase join | `public/data/electoral_bonds_{summary,registry,all}.json` |
| 7 | `.venv/bin/python pipeline/build_all_india_parties.py` — 2021–2023 ECI lists + 2016–2022 delisting orders | `data/derived/all_india_parties.json` |
| 8 | `pipeline/parse_rupp_2025.py` — OCR of the scanned ECI notification No.56/2025/PPS-III (Tables I(A) 2,049 RUPPs, I(B) 334 and I(C) 474 delisted); `--reocr` to redo cells | `data/derived/rupp_2025_notification.json` |
| 9 | `pipeline/apply_rupp_2025.py` (`--rebase` after step 7) — merges the 2025 list into the registry | `public/data/all_india_parties.*` |
| 10 | `pipeline/download_tn_rupp_audits.py` + `extract_audit_text.py tn` — TN RUPP audited-accounts PDFs from the CEO Tamil Nadu portal (receipts ≥ ₹10 lakh plus profiled parties), itemised per `data/raw/ocr/tn_rupp_extract/INSTRUCTIONS.md` | `data/raw/ocr/tn_rupp_extract/` |
| 11 | `pipeline/scrape_myneta.py --donors` — ADR MyNeta: every income/expenditure head and balance sheet back to FY 2001-02 for 66 parties, plus Form 24A donor lists (pages cached in `data/raw/myneta/html/`) | `data/derived/myneta_*.json` |
| 12 | `pipeline/build_dashboard_data.py` — joins everything on one party key. Precedence per party-year: our own page-referenced reads (ECI, CEO TN) → ADR's transcription → CEO TN portal totals. Where ours and ADR's overlap they agree to a median 0.002% | `public/data/dash/*.json` |
| 12b | `pipeline/scrape_election_expenditure.py` + `extract_audit_text.py ee` — election-expenditure statements for Tamil Nadu (ECI archive 2006–2021, ECI 2024–26, CEO TN), first 20 pages OCR'd and read per `data/raw/ocr/ee_extract/INSTRUCTIONS.md` | `public/data/dash/elections.json` |
| 13 | `pipeline/stamp_site.py` — content-hash `app.js` / `app.css` in `index.html` (data files are versioned via `meta.json`) | `public/index.html` |

`pipeline/names.py` cleans display names (glued or broken words from PDFs, shouting caps) and merges spelling variants of the same buyer.

---

## 🚀 Running the Dashboard Locally

Start the native Node.js HTTP server:
```bash
node server.js
```
The dashboard will be live at **`http://localhost:4190`** (all paths are relative, so `public/` can be served from any sub-path).
