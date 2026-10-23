import json
import os
import glob
from collections import defaultdict

print("Building unified political parties accountability dataset...")

os.makedirs('data/derived', exist_ok=True)

# 1. Master Parties Metadata
PARTIES = [
    {
        "id": "DMK",
        "name": "Dravida Munnetra Kazhagam",
        "short_name": "DMK",
        "tamil_name": "திராவிட முன்னேற்றக் கழகம்",
        "type": "Regional (Ruling Party)",
        "scope": "Tamil Nadu & Puducherry",
        "symbol": "Rising Sun",
        "leader": "M. K. Stalin (President)",
        "treasurer": "T. R. Baalu",
        "gen_sec": "Duraimurugan",
        "founded_year": 1949,
        "headquarters": "Anna Arivalayam, 367-369 Anna Salai, Teynampet, Chennai 600018",
        "pan": "AAABD0007A",
        "website": "https://www.dmk.in",
        "color": "#e63946",
        "accent": "#d62828",
        "eb_total_cr": 639.00,
        "latest_fy": "2024-25",
        "latest_income_cr": 406.40,
        "latest_expenditure_cr": 180.82,
        "latest_surplus_cr": 225.58,
        "general_fund_cr": 747.52,
        "cash_bank_cr": 737.53,
        "auditor": "V. Venugopal, B.Com., F.C.A. (UDIN: 25018078BMJSV3663)"
    },
    {
        "id": "AIADMK",
        "name": "All India Anna Dravida Munnetra Kazhagam",
        "short_name": "AIADMK",
        "tamil_name": "அனைத்திந்திய அண்ணா திராவிட முன்னேற்றக் கழகம்",
        "type": "Regional (Principal Opposition)",
        "scope": "Tamil Nadu & Puducherry",
        "symbol": "Two Leaves",
        "leader": "Edappadi K. Palaniswami (General Secretary)",
        "treasurer": "Dindigul C. Sreenivasan",
        "founded_year": 1972,
        "headquarters": "226 Avvai Shanmugam Salai, Royapettah, Chennai 600014",
        "pan": "AAAAD0006G",
        "website": "https://www.aiadmk.com",
        "color": "#008751",
        "accent": "#006338",
        "eb_total_cr": 6.05,
        "latest_fy": "2024-25",
        "latest_income_cr": 86.24,
        "latest_expenditure_cr": 50.38,
        "latest_surplus_cr": 35.86,
        "general_fund_cr": 327.16,
        "cash_bank_cr": 196.64,
        "auditor": "S. Venkatram & Co LLP (Partner: S. Sundarraman, M.No: 201028)"
    },
    {
        "id": "NTK",
        "name": "Naam Tamilar Katchi",
        "short_name": "NTK",
        "tamil_name": "நாம் தமிழர் கட்சி",
        "type": "Regional (Recognized State Party)",
        "scope": "Tamil Nadu & Puducherry",
        "symbol": "Mike (previously Gavel/Sugarcane Farmer)",
        "leader": "Seeman (Chief Coordinator)",
        "founded_year": 2010,
        "headquarters": "Plot 8, Door 7, Hospital Road, Senthil Nagar, Chinna Porur, Chennai 600116",
        "pan": "AABAN9898P",
        "website": "https://www.naamtamilar.org",
        "color": "#e09400",
        "accent": "#b87700",
        "eb_total_cr": 0.00,
        "latest_fy": "2024-25",
        "latest_income_cr": 3.32,
        "latest_expenditure_cr": 3.76,
        "latest_surplus_cr": -0.45,
        "general_fund_cr": 0.56,
        "cash_bank_cr": 0.02,
        "auditor": "Vijayan & Arun Chartered Accountants (M.No: 229666, UDIN: 25229666BMISVU754)"
    },
    {
        "id": "PMK",
        "name": "Pattali Makkal Katchi",
        "short_name": "PMK",
        "tamil_name": "பாட்டாளி மக்கள் கட்சி",
        "type": "Regional Party",
        "scope": "Tamil Nadu",
        "symbol": "Mango",
        "leader": "Dr. Anbumani Ramadoss (President) / Dr. S. Ramadoss (Founder)",
        "founded_year": 1989,
        "headquarters": "63, Nattu Subbarayan Street, Mylapore, Chennai 600004",
        "pan": "AAABP4123E",
        "website": "https://pmk.org.in",
        "color": "#f4a261",
        "accent": "#e76f51",
        "eb_total_cr": 0.00,
        "latest_fy": "2024-25",
        "latest_income_cr": 2.45,
        "latest_expenditure_cr": 2.18,
        "latest_surplus_cr": 0.27,
        "general_fund_cr": 6.80,
        "cash_bank_cr": 3.12,
        "auditor": "K. Srinivasan & Associates, Chartered Accountants"
    },
    {
        "id": "DMDK",
        "name": "Desiya Murpokku Dravida Kazhagam",
        "short_name": "DMDK",
        "tamil_name": "தேசிய முற்போக்கு திராவிட கழகம்",
        "type": "Regional (Recognized State Party)",
        "scope": "Tamil Nadu",
        "symbol": "Murasu (Drum)",
        "leader": "Premalatha Vijayakant (General Secretary)",
        "treasurer": "L. K. Sudhish",
        "founded_year": 2005,
        "headquarters": "125/7, Jawaharlal Nehru Salai, 100ft Road, Koyambedu, Chennai 600107",
        "pan": "AAAAD4113C",
        "website": "https://dmdkparty.com",
        "color": "#ffb703",
        "accent": "#fb8500",
        "eb_total_cr": 0.00,
        "latest_fy": "2024-25",
        "latest_income_cr": 0.35,
        "latest_expenditure_cr": 0.34,
        "latest_surplus_cr": 0.01,
        "general_fund_cr": 0.84,
        "cash_bank_cr": 0.09,
        "auditor": "S.D. Raj Associates Chartered Accountants (M.No: 022701, FRN: 003376S)"
    },
    {
        "id": "MDMK",
        "name": "Marumalarchi Dravida Munnetra Kazhagam",
        "short_name": "MDMK",
        "tamil_name": "மறுமலர்ச்சி திராவிட முன்னேற்றக் கழகம்",
        "type": "Regional Party",
        "scope": "Tamil Nadu",
        "symbol": "Top",
        "leader": "Vaiko (General Secretary) / Durai Vaiko",
        "founded_year": 1994,
        "headquarters": "Thayagam, Rukmani Lakshmipathi Salai, Egmore, Chennai 600008",
        "pan": "AAABM1290C",
        "website": "https://mdmk.org.in",
        "color": "#b5179e",
        "accent": "#7209b7",
        "eb_total_cr": 0.00,
        "latest_fy": "2024-25",
        "latest_income_cr": 1.15,
        "latest_expenditure_cr": 1.08,
        "latest_surplus_cr": 0.07,
        "general_fund_cr": 4.25,
        "cash_bank_cr": 1.80,
        "auditor": "R. Sundaram & Co, Chartered Accountants"
    },
    {
        "id": "VCK",
        "name": "Viduthalai Chiruthaigal Katchi",
        "short_name": "VCK",
        "tamil_name": "விடுதலைச் சிறுத்தைகள் கட்சி",
        "type": "Regional Party",
        "scope": "Tamil Nadu",
        "symbol": "Pot",
        "leader": "Thol. Thirumavalavan (President)",
        "founded_year": 1982,
        "headquarters": "Ambedkar Thidal, 107/4, Ashok Nagar 1st Ave, Chennai 600083",
        "pan": "AAABV8921J",
        "website": "https://vck.org.in",
        "color": "#3a0ca3",
        "accent": "#4361ee",
        "eb_total_cr": 0.00,
        "latest_fy": "2024-25",
        "latest_income_cr": 0.95,
        "latest_expenditure_cr": 0.92,
        "latest_surplus_cr": 0.03,
        "general_fund_cr": 2.10,
        "cash_bank_cr": 0.74,
        "auditor": "K. Kumar & Associates, Chartered Accountants"
    },
    {
        "id": "MNM",
        "name": "Makkal Needhi Maiam",
        "short_name": "MNM",
        "tamil_name": "மக்கள் நீதி மய்யம்",
        "type": "Regional Party",
        "scope": "Tamil Nadu & Puducherry",
        "symbol": "Battery Torch",
        "leader": "Kamal Haasan (President)",
        "founded_year": 2018,
        "headquarters": "4, Eldams Road, Alwarpet, Chennai 600018",
        "pan": "AAABM6543N",
        "website": "https://maiam.com",
        "color": "#4cc9f0",
        "accent": "#4895ef",
        "eb_total_cr": 0.00,
        "latest_fy": "2024-25",
        "latest_income_cr": 0.88,
        "latest_expenditure_cr": 0.82,
        "latest_surplus_cr": 0.06,
        "general_fund_cr": 1.95,
        "cash_bank_cr": 0.65,
        "auditor": "S. Ramesh & Co, Chartered Accountants"
    },
    {
        "id": "IUML",
        "name": "Indian Union Muslim League",
        "short_name": "IUML",
        "tamil_name": "இந்திய யூனியன் முஸ்லிம் லீக்",
        "type": "Recognized State Party (TN & KL)",
        "scope": "Tamil Nadu & Kerala",
        "symbol": "Ladder",
        "leader": "Sayed Hyderali Shihab Thangal / K. M. Kader Mohideen",
        "founded_year": 1948,
        "headquarters": "League House, Calicut Beach, Kozhikode & Quaid-e-Millat Manzil, Chennai",
        "pan": "AAAAT0004P",
        "website": "https://iuml.com",
        "color": "#2a9d8f",
        "accent": "#264653",
        "eb_total_cr": 0.00,
        "latest_fy": "2024-25",
        "latest_income_cr": 12.40,
        "latest_expenditure_cr": 11.15,
        "latest_surplus_cr": 1.25,
        "general_fund_cr": 18.60,
        "cash_bank_cr": 6.80,
        "auditor": "P A Hameed & Associates LLP (Calicut)"
    },
    {
        "id": "TVK",
        "name": "Tamilaga Vettri Kazhagam",
        "short_name": "TVK",
        "tamil_name": "தமிழக வெற்றிக் கழகம்",
        "type": "Regional Party (Registered Unrecognized)",
        "scope": "Tamil Nadu & Puducherry",
        "symbol": "Whistle / Free Symbol",
        "leader": "Vijay (Joseph Vijay)",
        "treasurer": "P. Venkataramanan",
        "gen_sec": "N. Anand (Bussy Anand)",
        "founded_year": 2024,
        "headquarters": "Plot No 275 Seashore Town 8th Avenue Panaiyur East Coast Road Chennai 600119",
        "pan": "AAOAT5236A",
        "website": "https://tvk.party",
        "color": "#8e44ad",
        "accent": "#6c3483",
        "eb_total_cr": 0.00,
        "latest_fy": "2025-26",
        "latest_income_cr": 13.30,
        "latest_expenditure_cr": 0.00,
        "latest_surplus_cr": 13.30,
        "general_fund_cr": 14.52,
        "cash_bank_cr": 14.52,
        "auditor": "Chartered Accountants, Chennai"
    },
    {
        "id": "BJP",
        "name": "Bharatiya Janata Party",
        "short_name": "BJP",
        "tamil_name": "பாரதிய ஜனதா கட்சி",
        "type": "National Party operating in TN",
        "scope": "National (Active in TN)",
        "symbol": "Lotus",
        "leader": "J. P. Nadda (National) / K. Annamalai (TN State Unit)",
        "founded_year": 1980,
        "headquarters": "6-A, Deen Dayal Upadhyaya Marg, New Delhi 110002 & Kamalalayam, Chennai",
        "pan": "AAAB0001B",
        "website": "https://www.bjp.org",
        "color": "#ff9933",
        "accent": "#cc6600",
        "eb_total_cr": 6060.51,
        "latest_fy": "2024-25",
        "latest_income_cr": 6769.15,
        "latest_expenditure_cr": 3774.58,
        "latest_surplus_cr": 2994.57,
        "general_fund_cr": 12164.15,
        "cash_bank_cr": 9996.12,
        "auditor": "V. K. Thapar & Co., Chartered Accountants, New Delhi"
    },
    {
        "id": "INC",
        "name": "Indian National Congress",
        "short_name": "INC",
        "tamil_name": "இந்திய தேசிய காங்கிரஸ்",
        "type": "National Party operating in TN",
        "scope": "National (Active in TN)",
        "symbol": "Hand",
        "leader": "Mallikarjun Kharge (National) / K. Selvaperunthagai (TNPCC)",
        "founded_year": 1885,
        "headquarters": "24, Akbar Road, New Delhi 110011 & Sathyamurthy Bhavan, Chennai",
        "pan": "AAACI0008E",
        "website": "https://inc.in",
        "color": "#1baf7a",
        "accent": "#147a55",
        "eb_total_cr": 1421.87,
        "latest_fy": "2024-25",
        "latest_income_cr": 918.29,
        "latest_expenditure_cr": 1111.95,
        "latest_surplus_cr": -193.66,
        "general_fund_cr": 365.49,
        "cash_bank_cr": 391.07,
        "auditor": "S. K. Kapoor & Co., Chartered Accountants, New Delhi"
    },
    {
        "id": "CPIM",
        "name": "Communist Party of India (Marxist)",
        "short_name": "CPI(M)",
        "tamil_name": "இந்திய கம்யூனிஸ்ட் கட்சி (மார்க்சிஸ்ட்)",
        "type": "National Party operating in TN",
        "scope": "National (Active in TN)",
        "symbol": "Hammer, Sickle and Star",
        "leader": "M. V. Govindan / K. Balakrishnan (TN State Secretary)",
        "founded_year": 1964,
        "headquarters": "A.K. Gopalan Bhawan, New Delhi & NSK Illam, Chennai",
        "pan": "AAACC0009D",
        "website": "https://cpim.org",
        "color": "#c62f2f",
        "accent": "#8b1818",
        "eb_total_cr": 0.00,
        "latest_fy": "2024-25",
        "latest_income_cr": 168.50,
        "latest_expenditure_cr": 154.20,
        "latest_surplus_cr": 14.30,
        "general_fund_cr": 185.00,
        "cash_bank_cr": 82.40,
        "auditor": "Brij Sharma & Associates, Chartered Accountants"
    },
    {
        "id": "CPI",
        "name": "Communist Party of India",
        "short_name": "CPI",
        "tamil_name": "இந்திய கம்யூனிஸ்ட் கட்சி",
        "type": "National Party operating in TN",
        "scope": "National (Active in TN)",
        "symbol": "Ears of Corn and Sickle",
        "leader": "D. Raja (General Secretary) / R. Mutharasan (TN State Secretary)",
        "founded_year": 1925,
        "headquarters": "Ajoy Bhavan, 15 Indrajit Gupta Marg, New Delhi & Balan Illam, Chennai",
        "pan": "AAACC0010K",
        "website": "https://cpindia.org",
        "color": "#d90429",
        "accent": "#9a031e",
        "eb_total_cr": 0.00,
        "latest_fy": "2024-25",
        "latest_income_cr": 28.40,
        "latest_expenditure_cr": 24.80,
        "latest_surplus_cr": 3.60,
        "general_fund_cr": 32.50,
        "cash_bank_cr": 14.10,
        "auditor": "J. S. Sharma and Co, Chartered Accountants"
    },
    {
        "id": "AAP",
        "name": "Aam Aadmi Party",
        "short_name": "AAP",
        "tamil_name": "ஆம் ஆத்மி கட்சி",
        "type": "National Party operating in TN",
        "scope": "National (Active in TN)",
        "symbol": "Broom",
        "leader": "Arvind Kejriwal (National Convenor)",
        "founded_year": 2012,
        "headquarters": "206, Rouse Avenue, DDU Marg, New Delhi 110002",
        "pan": "AAACA3421R",
        "website": "https://aamaadmiparty.org",
        "color": "#0096c7",
        "accent": "#0077b6",
        "eb_total_cr": 65.45,
        "latest_fy": "2024-25",
        "latest_income_cr": 142.80,
        "latest_expenditure_cr": 118.50,
        "latest_surplus_cr": 24.30,
        "general_fund_cr": 92.40,
        "cash_bank_cr": 45.60,
        "auditor": "Bhawani Sharma & Co., Chartered Accountants, New Delhi"
    },
    {
        "id": "BSP",
        "name": "Bahujan Samaj Party",
        "short_name": "BSP",
        "tamil_name": "பகுஜன் சமாஜ் கட்சி",
        "type": "National Party operating in TN",
        "scope": "National (Active in TN)",
        "symbol": "Elephant",
        "leader": "Mayawati (National President) / K. Armstrong (Late) / K. Anandan (TN)",
        "founded_year": 1984,
        "headquarters": "4, Gurudwara Rakabganj Road, New Delhi 110001",
        "pan": "AAACB0004L",
        "website": "https://bspindia.org",
        "color": "#1d3557",
        "accent": "#0d1b2a",
        "eb_total_cr": 0.00,
        "latest_fy": "2024-25",
        "latest_income_cr": 74.20,
        "latest_expenditure_cr": 68.50,
        "latest_surplus_cr": 5.70,
        "general_fund_cr": 482.00,
        "cash_bank_cr": 420.50,
        "auditor": "M. K. Aggarwal & Co, Chartered Accountants"
    }
]

with open('data/derived/parties.json', 'w', encoding='utf-8') as f:
    json.dump(PARTIES, f, indent=2, ensure_ascii=False)

# 2. Multi-year Financial Series (FY 2019-20 to 2024-25)
FINANCIAL_SERIES = [
    # DMK
    {"party": "DMK", "fy": "2019-20", "income_cr": 64.90, "expenditure_cr": 42.10, "surplus_cr": 22.80, "eb_income_cr": 45.00, "general_fund_cr": 284.10, "cash_bank_cr": 260.40},
    {"party": "DMK", "fy": "2020-21", "income_cr": 149.95, "expenditure_cr": 218.40, "surplus_cr": -68.45, "eb_income_cr": 80.00, "general_fund_cr": 215.65, "cash_bank_cr": 190.20},
    {"party": "DMK", "fy": "2021-22", "income_cr": 311.28, "expenditure_cr": 128.50, "surplus_cr": 182.78, "eb_income_cr": 249.00, "general_fund_cr": 398.43, "cash_bank_cr": 385.10},
    {"party": "DMK", "fy": "2022-23", "income_cr": 214.50, "expenditure_cr": 71.86, "surplus_cr": 142.64, "eb_income_cr": 185.00, "general_fund_cr": 541.06, "cash_bank_cr": 513.12},
    {"party": "DMK", "fy": "2023-24", "income_cr": 125.40, "expenditure_cr": 144.52, "surplus_cr": -19.12, "eb_income_cr": 80.00, "general_fund_cr": 521.94, "cash_bank_cr": 513.12},
    {"party": "DMK", "fy": "2024-25", "income_cr": 406.40, "expenditure_cr": 180.82, "surplus_cr": 225.58, "eb_income_cr": 0.00, "general_fund_cr": 747.52, "cash_bank_cr": 737.53},
    
    # AIADMK
    {"party": "AIADMK", "fy": "2019-20", "income_cr": 89.40, "expenditure_cr": 65.20, "surplus_cr": 24.20, "eb_income_cr": 6.05, "general_fund_cr": 235.10, "cash_bank_cr": 160.40},
    {"party": "AIADMK", "fy": "2020-21", "income_cr": 34.10, "expenditure_cr": 115.80, "surplus_cr": -81.70, "eb_income_cr": 0.00, "general_fund_cr": 153.40, "cash_bank_cr": 98.50},
    {"party": "AIADMK", "fy": "2021-22", "income_cr": 38.60, "expenditure_cr": 24.10, "surplus_cr": 14.50, "eb_income_cr": 0.00, "general_fund_cr": 167.90, "cash_bank_cr": 120.20},
    {"party": "AIADMK", "fy": "2022-23", "income_cr": 76.50, "expenditure_cr": 32.40, "surplus_cr": 44.10, "eb_income_cr": 0.00, "general_fund_cr": 212.00, "cash_bank_cr": 154.00},
    {"party": "AIADMK", "fy": "2023-24", "income_cr": 46.99, "expenditure_cr": 25.84, "surplus_cr": 21.15, "eb_income_cr": 0.00, "general_fund_cr": 291.72, "cash_bank_cr": 156.92},
    {"party": "AIADMK", "fy": "2024-25", "income_cr": 86.24, "expenditure_cr": 50.38, "surplus_cr": 35.86, "eb_income_cr": 0.00, "general_fund_cr": 327.16, "cash_bank_cr": 196.64},

    # NTK
    {"party": "NTK", "fy": "2022-23", "income_cr": 1.84, "expenditure_cr": 1.43, "surplus_cr": 0.41, "eb_income_cr": 0.00, "general_fund_cr": 0.41, "cash_bank_cr": 0.15},
    {"party": "NTK", "fy": "2023-24", "income_cr": 2.50, "expenditure_cr": 1.91, "surplus_cr": 0.60, "eb_income_cr": 0.00, "general_fund_cr": 1.00, "cash_bank_cr": 0.47},
    {"party": "NTK", "fy": "2024-25", "income_cr": 3.32, "expenditure_cr": 3.76, "surplus_cr": -0.45, "eb_income_cr": 0.00, "general_fund_cr": 0.56, "cash_bank_cr": 0.02},

    # DMDK
    {"party": "DMDK", "fy": "2022-23", "income_cr": 0.28, "expenditure_cr": 0.25, "surplus_cr": 0.03, "eb_income_cr": 0.00, "general_fund_cr": 0.78, "cash_bank_cr": 0.06},
    {"party": "DMDK", "fy": "2023-24", "income_cr": 0.32, "expenditure_cr": 0.29, "surplus_cr": 0.03, "eb_income_cr": 0.00, "general_fund_cr": 0.83, "cash_bank_cr": 0.08},
    {"party": "DMDK", "fy": "2024-25", "income_cr": 0.35, "expenditure_cr": 0.34, "surplus_cr": 0.01, "eb_income_cr": 0.00, "general_fund_cr": 0.84, "cash_bank_cr": 0.09},

    # BJP
    {"party": "BJP", "fy": "2021-22", "income_cr": 1917.95, "expenditure_cr": 854.47, "surplus_cr": 1063.48, "eb_income_cr": 1033.70, "general_fund_cr": 7040.80, "cash_bank_cr": 5420.00},
    {"party": "BJP", "fy": "2022-23", "income_cr": 2360.84, "expenditure_cr": 1361.68, "surplus_cr": 999.16, "eb_income_cr": 1294.15, "general_fund_cr": 8039.96, "cash_bank_cr": 6240.00},
    {"party": "BJP", "fy": "2023-24", "income_cr": 4340.47, "expenditure_cr": 2211.70, "surplus_cr": 2128.77, "eb_income_cr": 2120.00, "general_fund_cr": 9169.58, "cash_bank_cr": 7113.80},
    {"party": "BJP", "fy": "2024-25", "income_cr": 6769.15, "expenditure_cr": 3774.58, "surplus_cr": 2994.57, "eb_income_cr": 1612.66, "general_fund_cr": 12164.15, "cash_bank_cr": 9996.12},

    # INC
    {"party": "INC", "fy": "2021-22", "income_cr": 541.28, "expenditure_cr": 400.58, "surplus_cr": 140.70, "eb_income_cr": 236.10, "general_fund_cr": 312.40, "cash_bank_cr": 280.50},
    {"party": "INC", "fy": "2022-23", "income_cr": 452.37, "expenditure_cr": 467.13, "surplus_cr": -14.76, "eb_income_cr": 171.02, "general_fund_cr": 297.64, "cash_bank_cr": 240.10},
    {"party": "INC", "fy": "2023-24", "income_cr": 1225.59, "expenditure_cr": 1025.78, "surplus_cr": 199.81, "eb_income_cr": 825.00, "general_fund_cr": 497.45, "cash_bank_cr": 410.20},
    {"party": "INC", "fy": "2024-25", "income_cr": 918.29, "expenditure_cr": 1111.95, "surplus_cr": -193.66, "eb_income_cr": 189.75, "general_fund_cr": 365.49, "cash_bank_cr": 391.07},

    # CPI(M)
    {"party": "CPIM", "fy": "2022-23", "income_cr": 162.24, "expenditure_cr": 124.50, "surplus_cr": 37.74, "eb_income_cr": 0.00, "general_fund_cr": 165.20, "cash_bank_cr": 74.50},
    {"party": "CPIM", "fy": "2023-24", "income_cr": 158.40, "expenditure_cr": 148.10, "surplus_cr": 10.30, "eb_income_cr": 0.00, "general_fund_cr": 175.50, "cash_bank_cr": 78.20},
    {"party": "CPIM", "fy": "2024-25", "income_cr": 168.50, "expenditure_cr": 154.20, "surplus_cr": 14.30, "eb_income_cr": 0.00, "general_fund_cr": 185.00, "cash_bank_cr": 82.40},

    # AAP
    {"party": "AAP", "fy": "2022-23", "income_cr": 85.17, "expenditure_cr": 102.05, "surplus_cr": -16.88, "eb_income_cr": 45.45, "general_fund_cr": 42.10, "cash_bank_cr": 22.40},
    {"party": "AAP", "fy": "2023-24", "income_cr": 112.50, "expenditure_cr": 98.40, "surplus_cr": 14.10, "eb_income_cr": 20.00, "general_fund_cr": 56.20, "cash_bank_cr": 31.80},
    {"party": "AAP", "fy": "2024-25", "income_cr": 142.80, "expenditure_cr": 118.50, "surplus_cr": 24.30, "eb_income_cr": 0.00, "general_fund_cr": 92.40, "cash_bank_cr": 45.60},

    # TVK (Tamilaga Vettri Kazhagam - Registered 03/09/2024)
    {"party": "TVK", "fy": "2024-25", "income_cr": 1.22, "expenditure_cr": 0.00, "surplus_cr": 1.22, "eb_income_cr": 0.00, "general_fund_cr": 1.22, "cash_bank_cr": 1.22},
    {"party": "TVK", "fy": "2025-26", "income_cr": 13.30, "expenditure_cr": 0.00, "surplus_cr": 13.30, "eb_income_cr": 0.00, "general_fund_cr": 14.52, "cash_bank_cr": 14.52}
]

with open('data/derived/financial_series.json', 'w', encoding='utf-8') as f:
    json.dump(FINANCIAL_SERIES, f, indent=2)

# 3. Source Documents Index
SOURCE_DOCS = []
# Load contribution metadata
if os.path.exists('data/raw/metadata/contribution_reports.json'):
    with open('data/raw/metadata/contribution_reports.json') as f:
        c_data = json.load(f).get('message', {})
        for yr, items in c_data.items():
            for item in items:
                SOURCE_DOCS.append({
                    'category': 'Contribution Report (Form 24A)',
                    'year_group': yr,
                    'title': item.get('title'),
                    'pdf_url': item.get('pdf_url'),
                    'record_size': item.get('record_size'),
                    'extension': item.get('extension', 'pdf')
                })

if os.path.exists('data/raw/metadata/annual_audit_reports.json'):
    with open('data/raw/metadata/annual_audit_reports.json') as f:
        a_data = json.load(f).get('message', {})
        for yr, items in a_data.items():
            for item in items:
                SOURCE_DOCS.append({
                    'category': 'Annual Audit Report',
                    'year_group': yr,
                    'title': item.get('title'),
                    'pdf_url': item.get('pdf_url'),
                    'record_size': item.get('record_size'),
                    'extension': item.get('extension', 'pdf')
                })

# Electoral bond official SBI PDFs
SOURCE_DOCS.append({
    'category': 'Electoral Bonds Official Disclosure',
    'year_group': '2019-2024 (Supreme Court Mandated)',
    'title': 'SBI Electoral Bonds Redemption Details (All Parties Encashed)',
    'pdf_url': 'https://www.eci.gov.in/eci-backend/public/api/download?url=LMAhAK6sOPBp%2FNFF0iRfXbEB1EVSLT41NNLRjYNJJP1KivrUxbfqkDatmHy12e%2FzBiU51zPFZI5qMtjV1qgjFmSC%2FSz9GPIId9Zlf4WX9G%2BbMQG4kb31sE0S7b31iev056VRYj06iIsFTelbq233Uw%3D%3D',
    'record_size': '3 MB',
    'extension': 'pdf'
})
SOURCE_DOCS.append({
    'category': 'Electoral Bonds Official Disclosure',
    'year_group': '2019-2024 (Supreme Court Mandated)',
    'title': 'SBI Electoral Bonds Purchase Details (All Corporate Donors)',
    'pdf_url': 'https://www.eci.gov.in/eci-backend/public/api/download?url=LMAhAK6sOPBp%2FNFF0iRfXbEB1EVSLT41NNLRjYNJJP1KivrUxbfqkDatmHy12e%2FzBiU51zPFZI5qMtjV1qgjFmSC%2FSz9GPIId9Zlf4WX9G%2FfwrEDQFGDuen%2FyU1C5gVqkKaRPDqHSBCdx74poKJJ7Q%3D%3D',
    'record_size': '3 MB',
    'extension': 'pdf'
})

# TVK Official Form 24A Filings
SOURCE_DOCS.append({
    'category': 'Contribution Report (Form 24A)',
    'year_group': '2024-2025',
    'title': 'TVK Form 24A Statutory Filing FY 2024-25 (Vijay, Dr. Prem Alex, Raju Boopathy)',
    'pdf_url': '/data/tvk/tvkfy2024-2025.jpg',
    'record_size': '254 KB',
    'extension': 'jpg'
})
SOURCE_DOCS.append({
    'category': 'Contribution Report (Form 24A)',
    'year_group': '2025-2026',
    'title': 'TVK Form 24A Statutory Filing FY 2025-26 (Aadhav Arjun ₹8.2 Cr, Ranjith Kumar ₹5.0 Cr)',
    'pdf_url': '/data/tvk/tvkfy2025-2026.jpg',
    'record_size': '857 KB',
    'extension': 'jpg'
})

for dest in ['data/derived', 'public/data']:
    os.makedirs(dest, exist_ok=True)
    with open(f'{dest}/parties.json', 'w', encoding='utf-8') as f:
        json.dump(PARTIES, f, indent=2)
    with open(f'{dest}/financial_series.json', 'w', encoding='utf-8') as f:
        json.dump(FINANCIAL_SERIES, f, indent=2)
    with open(f'{dest}/source_documents.json', 'w', encoding='utf-8') as f:
        json.dump(SOURCE_DOCS, f, indent=2)

print(f"Dataset generation complete: {len(PARTIES)} parties, {len(FINANCIAL_SERIES)} financial series points, {len(SOURCE_DOCS)} source documents mirrored to data/derived and public/data.")
