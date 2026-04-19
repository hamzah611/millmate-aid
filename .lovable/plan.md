

## Plan: Fix transaction_mode case mismatch

### Root cause
Earlier `UPDATE contacts SET transaction_mode = 'Both'` wrote capitalized `"Both"` to 146 rows, but the entire UI uses lowercase values:
- `ContactForm.tsx` Select options: `"sale"`, `"purchase"`, `"both"`
- `InvoiceForm.tsx` filter: `c.transaction_mode === "both"`

Result: the Select on the account edit page shows blank (no matching option), and invoice account dropdowns may filter incorrectly.

### Current DB state
- 146 rows: `"Both"` (wrong case)
- 1 row: `"both"` (correct)

### Fix — single SQL UPDATE
Normalize all values to lowercase to match the UI:

```sql
UPDATE contacts SET transaction_mode = 'both';
```

This also confirms every account ends up with the intended "both" value.

### Files changed
None. Data-only fix via Supabase update.

### Verification after apply
- `SELECT transaction_mode, COUNT(*) FROM contacts GROUP BY transaction_mode;` should return one row: `both | 147`
- Open any account in edit → "Transaction Mode" dropdown shows "Both" selected
- Sale/Purchase invoice forms list all customer/supplier accounts

