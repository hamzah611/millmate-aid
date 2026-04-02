## Add Bank Contact Type & Reclassify Bank Contacts

### 1. Database Migration — Add 'bank' to contact_type enum

```sql
ALTER TYPE contact_type ADD VALUE 'bank';
```

This allows `contact_type = 'bank'` in the contacts table.

### 2. Data Migration — Reclassify existing bank contacts

Update 3 contacts (MCB 4575, NBP K N Shah, Advance Cheques of MCB 4575) that already have `account_category = 'bank'` but `contact_type = 'both'`:

```sql
UPDATE contacts SET contact_type = 'bank' WHERE account_category = 'bank';
```

No changes to opening_balance or any transaction data.

### 3. Translation Keys

Add to `LanguageContext.tsx`:
```
"contacts.bank": { en: "Bank", ur: "بینک" }
```

### 4. ContactForm.tsx

- Add `"bank"` to the `ContactType` union type
- Add `<SelectItem value="bank">{t("contacts.bank")}</SelectItem>` in the type dropdown

### 5. Contacts.tsx (List Page)

- Add `<SelectItem value="bank">{t("contacts.bank")}</SelectItem>` to the type filter
- Add bank color dot in the type display column (e.g., `bg-chart-5`)

### 6. ContactEdit.tsx

- Add `"bank"` to the `contact_type` cast union

### 7. InvoiceForm.tsx — Validation

Currently filters by `contact_type IN (customer/both)` for sales and `(supplier/both)` for purchases. Bank contacts are NOT in these lists, so they're already excluded from invoice creation. No change needed for the type filter.

The existing `account_category` filter (line 68) also excludes `bank`. Double protection — no change needed.

### 8. BatchNew.tsx

Currently filters `contact_type IN (supplier, both)`. Bank is excluded. No change needed.

### 9. Financial Logic — Already Correct

The financial calculations in `financial-utils.ts` and `FinancialReports.tsx` use `account_category` (not `contact_type`) for:
- Cash in Hand → `account_category = 'cash'`
- Bank Balance → `account_category = 'bank'`
- Receivables → `account_category = 'customer'`
- Payables → `account_category = 'supplier'`

Since MCB/NBP already have `account_category = 'bank'`, the financial calculations are already correct. The `contact_type` change from `both` → `bank` won't affect any financial numbers.

### Files Changed

| File | Change |
|------|--------|
| DB migration | Add `'bank'` to `contact_type` enum |
| DB data update | Set `contact_type = 'bank'` for bank contacts |
| `src/contexts/LanguageContext.tsx` | Add `contacts.bank` translation |
| `src/components/ContactForm.tsx` | Add `bank` to type union + dropdown |
| `src/pages/Contacts.tsx` | Add bank to filter + type display color |
| `src/pages/ContactEdit.tsx` | Add `bank` to type cast |

No financial logic changes needed — all calculations use `account_category` which is already correct.