# Extracting election-expenditure statements

Each input file lists documents. For each, the text dump is
`data/raw/ocr/ee_text/<text_file>` with `=== PAGE k ===` markers, and the PDF is
`data/raw/election_expenditure/<pdf_file>`. These are statements political parties file
with the Election Commission (or the CEO Tamil Nadu) after an election, listing what
the party spent between the announcement and the completion of the election.

Most are scans. Text dumps are OCR and can be wrong: when a figure matters and the
text is doubtful, render the page (`pdftoppm -r 130 -f N -l N -png <pdf> <out>` into
your session scratchpad) and read the image. Don't read whole dumps; grep for
`expenditure|propaganda|star campaign|lump sum|candidate|closing balance|opening balance|total`
and read those pages.

## Two formats

- **2014 onward (standard form)**: Part A = party central headquarters
  (5.1 opening balance, 5.2 receipts incl. electoral bonds, 5.3 general party propaganda
  with heads (i) star campaigners' travel, (ii) other leaders' travel, (iii) media
  advertisement, (iv) publicity materials, (v) public meetings/rallies, (vi) other;
  5.4 spending on candidates incl. lump sums; 5.5 lump sums to state units / other
  parties; 5.6 closing balance). Part B = the same for state units. Schedule 1 may give
  state-wise totals when the statement covers several states.
- **Before 2014**: free-form statements, often a single table of heads (publicity,
  travel, payments to candidates, ...) and a total. Map heads to the buckets below
  as best fits and put the rest in `other`.

## Output

Write a JSON array to `data/raw/ocr/ee_extract/batch_XX_output.json` (same XX as the
input), one object per input document:

```json
{
  "n": 7,
  "party": "Example Party (as on the statement)",
  "election": "Tamil Nadu Assembly 2021 (from the input)",
  "states_covered": ["Tamil Nadu", "Puducherry"],
  "doc_kind": "full | part | covering_letter_only | unreadable",
  "period": {"announced": "27/02/2021", "completed": "05/05/2021"},
  "opening_balance": null,
  "receipts": {"cash": null, "cheque_bank": null, "electoral_bonds": null, "in_kind": null, "total": null},
  "propaganda": {"star_campaigner_travel": null, "other_leaders_travel": null, "media_advertisement": null,
                 "publicity_materials": null, "public_meetings": null, "other": null, "total": null},
  "candidates": {"lump_sum_to_candidates": null, "media_for_candidates": null, "publicity_for_candidates": null,
                 "meetings_for_candidates": null, "criminal_antecedents_publicity": null, "other": null, "total": null},
  "to_state_units_or_other_parties": null,
  "state_unit": {"propaganda_total": null, "candidates_total": null},
  "total_expenditure": null,
  "tamil_nadu_share": null,
  "closing_balance": null,
  "pages": {"part_a": 2, "schedule_1": null},
  "confidence": "high | medium | low",
  "notes": "short"
}
```

## Rules

- Whole rupees, plain numbers (`39,78,93,891.00` -> 3978893891). Convert lakh/crore
  statements and say so in `notes`.
- `propaganda` / `candidates`: Part A (central HQ) figures. `state_unit`: Part B totals,
  summed across states if several sheets.
- `total_expenditure`: everything the party spent on the election =
  Part A propaganda + Part A candidates + Part B propaganda + Part B candidates.
  Do **not** add 5.5 transfers to state units on top (that money is spent in Part B), and
  say in `notes` if Part B was blank. For old free-form statements use the printed
  grand total of expenditure.
- `tamil_nadu_share`: the Tamil Nadu figure when the statement covers several states and
  gives a state-wise split (Schedule 1 or similar); else null.
- Only numbers you can see. Unknown -> null; a printed NIL -> 0. Never fill from memory.
- Check sums: the heads should add to their printed totals. If not, trust the printed
  totals, set confidence to medium, and explain.
- Reply at the end with one line per document: `n | party | election | total_expenditure | confidence`.
