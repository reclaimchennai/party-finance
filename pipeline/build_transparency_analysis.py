import json

data = {
    "key_findings": [
        {
            "title": "DMK: #1 Recipient in Tamil Nadu, #6 Nationally in Electoral Bonds",
            "stat": "₹639.00 Cr",
            "detail": "DMK received ₹639.00 Crore through electoral bonds, making it by far the largest recipient in Tamil Nadu and the 6th highest political party in India, ahead of large national parties like AAP (₹65 Cr) and regional parties like JD(U) (₹14 Cr) and SP (₹14 Cr).",
            "type": "critical"
        },
        {
            "title": "Lottery King Santiago Martin's Future Gaming Alone Gave 78.7% of DMK's Bonds",
            "stat": "₹503.00 Cr",
            "detail": "Future Gaming and Hotel Services PR (Santiago Martin), which was under investigation by the Enforcement Directorate, donated ₹503.00 Crore to DMK alone between 2020 and 2024. Megha Engineering (MEIL) was #2 with ₹85.00 Crore.",
            "type": "warning"
        },
        {
            "title": "AIADMK Encashed All Bonds in Single Window (April 2019)",
            "stat": "₹6.05 Cr",
            "detail": "Unlike DMK, AIADMK only encashed electoral bonds during the April 2019 Lok Sabha elections (38 bonds totaling ₹6.05 Crore). AIADMK's primary funding comes from application fees, corpus interest, and general party funds.",
            "type": "info"
        },
        {
            "title": "The Principle of Zero: Parties that Stood Against Electoral Bonds",
            "stat": "₹0.00",
            "detail": "CPI(M), CPI, and regional parties like NTK took zero electoral bonds. CPI(M) was the lead petitioner before the Supreme Court of India in Association for Democratic Reforms & CPI(M) v. Union of India, which declared the electoral bond scheme unconstitutional on February 15, 2024.",
            "type": "good"
        },
        {
            "title": "NTK's Crowdfunding Model vs Mega-Donors",
            "stat": "293 Donors",
            "detail": "Naam Tamilar Katchi (NTK) declared ₹3.32 Crore in FY 2024-25, almost entirely powered by micro-contributions aggregated through Cashfree Payments India and individual cadre donations with full PAN declarations.",
            "type": "info"
        },
        {
            "title": "TVK: Vijay's Political Entry & High-Value Direct Contributions",
            "stat": "₹13.30 Cr (FY 25-26)",
            "detail": "Tamilaga Vettri Kazhagam (TVK), registered with the ECI on 03/09/2024 by actor-politician Vijay, submitted statutory Form 24A reports declaring ₹1.22 Cr in FY 2024-25 (with ₹65.82 Lakh personal cheque from Vijay) and ₹13.30 Cr in FY 2025-26, powered by ₹8.20 Cr via RTGS from Aadhav Arjun and ₹5.00 Cr via RTGS from Ranjith Kumar.",
            "type": "info"
        },
        {
            "title": "The Warchest Asymmetry in Tamil Nadu Politics",
            "stat": "₹12,164 Cr vs ₹747 Cr vs ₹327 Cr",
            "detail": "In total reserves, National ruling party BJP holds ₹12,164.15 Crore in General Reserves (with ₹9,996 Crore in bank deposits). DMK holds ₹747.52 Crore (with ₹737.5 Crore in bank deposits), AIADMK holds ₹327.16 Crore, and INC holds ₹365.49 Crore.",
            "type": "warning"
        }
    ],
    "party_transparency_scores": [
        {"party": "CPI(M)", "score": 95, "eb_taken": False, "audited_on_time": True, "pan_disclosed": True, "verdict": "Highest Compliance (Petitioner against EB, 0 bonds taken)"},
        {"party": "CPI", "score": 92, "eb_taken": False, "audited_on_time": True, "pan_disclosed": True, "verdict": "High Transparency (0 bonds taken, accounts audited)"},
        {"party": "NTK", "score": 90, "eb_taken": False, "audited_on_time": True, "pan_disclosed": True, "verdict": "Grassroots Crowdfunding (Transparent micro-donations via Cashfree)"},
        {"party": "TVK", "score": 88, "eb_taken": False, "audited_on_time": True, "pan_disclosed": True, "verdict": "High Disclosure (Prompt Form 24A filed with 100% PAN details for ₹13.30 Cr)"},
        {"party": "DMDK", "score": 85, "eb_taken": False, "audited_on_time": True, "pan_disclosed": True, "verdict": "Compliant (Detailed CA audit, 0 bonds encashed)"},
        {"party": "IUML", "score": 84, "eb_taken": False, "audited_on_time": True, "pan_disclosed": True, "verdict": "Compliant (Regular audits, no bond redemptions)"},
        {"party": "AIADMK", "score": 80, "eb_taken": True, "eb_cr": 6.05, "audited_on_time": True, "pan_disclosed": True, "verdict": "Standard Compliance (Disclosed ₹6.05 Cr bonds in 2019)"},
        {"party": "AAP", "score": 76, "eb_taken": True, "eb_cr": 65.45, "audited_on_time": True, "pan_disclosed": True, "verdict": "Moderate (Encashed ₹65.45 Cr in bonds)"},
        {"party": "INC", "score": 72, "eb_taken": True, "eb_cr": 1421.87, "audited_on_time": True, "pan_disclosed": True, "verdict": "High Bond Reliance (₹1,421.87 Cr in bonds, severe 2024 deficit)"},
        {"party": "DMK", "score": 68, "eb_taken": True, "eb_cr": 639.00, "audited_on_time": True, "pan_disclosed": True, "verdict": "High Corporate Concentration (₹503 Cr from single lottery group)"},
        {"party": "BJP", "score": 62, "eb_taken": True, "eb_cr": 6060.51, "audited_on_time": True, "pan_disclosed": True, "verdict": "Massive Corporate Warchest (55% of all electoral bonds in India)"}
    ],
    "tn_corporate_donors": [
        {"donor": "Future Gaming and Hotel Services PR (Santiago Martin)", "party": "DMK", "amount_cr": 503.00, "sector": "Lottery & Gaming", "hq": "Coimbatore / Chennai"},
        {"donor": "Megha Engineering & Infrastructures Ltd (MEIL)", "party": "DMK", "amount_cr": 85.00, "sector": "Infrastructure & Construction", "hq": "Hyderabad / Regional Projects"},
        {"donor": "Aadhav Arjun (Voice of Common Man)", "party": "TVK", "amount_cr": 8.20, "sector": "Sports Administration & Media", "hq": "Chennai, TN"},
        {"donor": "Ranjith Kumar", "party": "TVK", "amount_cr": 5.00, "sector": "Business / Enterprise", "hq": "Kancheepuram, TN"},
        {"donor": "Westwell Gases Pvt Ltd", "party": "DMK", "amount_cr": 8.00, "sector": "Industrial Gases", "hq": "Chennai, TN"},
        {"donor": "Askus Logistics Pvt Ltd", "party": "DMK", "amount_cr": 7.00, "sector": "Logistics & Transport", "hq": "Chennai, TN"},
        {"donor": "Fertileland Foods Pvt Ltd", "party": "DMK", "amount_cr": 5.00, "sector": "Food Processing", "hq": "Tamil Nadu"},
        {"donor": "The India Cements Ltd (N. Srinivasan)", "party": "DMK & AIADMK", "amount_cr": 14.00, "sector": "Cement & Sports (CSK)", "hq": "Chennai, TN"},
        {"donor": "Herald Beverages Pvt Ltd", "party": "DMK", "amount_cr": 4.00, "sector": "Beverages", "hq": "Tamil Nadu"},
        {"donor": "Kal Radio Ltd (Sun TV Network / Maran Group)", "party": "DMK", "amount_cr": 3.50, "sector": "Media & Broadcasting", "hq": "Chennai, TN"},
        {"donor": "Chennai Super Kings Cricket Ltd", "party": "AIADMK", "amount_cr": 5.00, "sector": "Sports Franchise", "hq": "Chennai, TN"}
    ]
}

for dest in ['data/derived', 'public/data']:
    with open(f'{dest}/transparency_analysis.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

print("Saved transparency_analysis.json to data/derived and public/data")
