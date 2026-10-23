# Extracting audited figures from ECI annual audit reports

Each input file lists documents. For each, the text dump is
`data/raw/ocr/audit_text/<text_file>` with `=== PAGE k ===` markers. These are
political parties' audited annual accounts filed with the Election Commission
of India. Text comes from pdftotext (some pages tesseract OCR), so digits can be
noisy.

## How to work

Do NOT read whole files. For each document:
1. `grep -n -i -E "income and expenditure|income & expenditure|balance sheet|receipts and payments|excess of|total" <file>` to find the statement pages.
2. Read only those page ranges (Read with offset/limit).
3. Take figures for the **current financial year column** — statements print the
   current year and previous year side by side; the report's FY is in the input
   (`fy`). Never take the previous-year column.

## Output

Write a JSON array to `data/raw/ocr/audit_extract/batch_XX_output.json`
(same XX as your input), one object per input document, in this shape:

```json
{
  "n": 12,
  "party": "Example Party (from the title)",
  "fy": "2024-25",
  "revised": false,
  "doc_kind": "full_accounts | partial (e.g. only a schedule/notes) | unreadable",
  "basis": "income_expenditure | receipts_payments",
  "total_income": 150000000,
  "total_expenditure": 90000000,
  "surplus": 60000000,
  "income": {
    "donations_contributions": null,
    "electoral_bonds": null,
    "membership_fees_subscriptions": null,
    "interest_dividend": null,
    "other": null
  },
  "expenditure": {
    "election": null,
    "administrative_general": null,
    "employee_salaries": null,
    "publicity_propaganda": null,
    "other": null
  },
  "general_fund_closing": null,
  "cash_bank_and_deposits_closing": null,
  "total_assets": null,
  "auditor": "Name of CA firm, as signed",
  "pages": {"income_statement": 9, "balance_sheet": 8},
  "confidence": "high | medium | low",
  "notes": "short, e.g. 'statement in lakhs, converted' or 'deficit printed as excess of expenditure over income'"
}
```

## Rules

- Amounts are **whole rupees as plain numbers**. Indian grouping `3,65,82,46,915`
  = 3658246915. If a statement says "Rs. in lakhs" / "in thousands", convert and
  say so in `notes`.
- `surplus` = total income − total expenditure for the year (negative for a
  deficit). Use the printed "excess of income over expenditure" figure when
  present; otherwise compute it and say so.
- Only report numbers you can see in the text. Unknown → `null`. Never guess or
  fill from memory. If a line item exists but doesn't fit a bucket, add it to
  `other`.
- `electoral_bonds`: only when the statement names electoral bonds explicitly.
- `general_fund_closing`: closing balance of the general/corpus/capital fund on
  the balance sheet.
- `cash_bank_and_deposits_closing`: cash + bank balances + fixed/term deposits at
  year end (sum the balance-sheet lines; note if you summed).
- Sanity-check: income components should roughly add to `total_income`. If the
  OCR is too damaged to trust a total, set it `null`, `confidence: "low"`, and
  explain.
- If a document is only a covering letter, a schedule, or notes, set
  `doc_kind: "partial"` and leave totals null.
- Reply at the end with one line per document: `n | party | fy | income | expenditure | confidence`.
