
## Add Bank Contact Type & Reclassify Bank Contacts

### 1. Database Migration — Add 'bank' to contact_type enum

```sql
ALTER TYPE contact_type ADD VALUE 'bank';
```

### 2. Data Migration — Reclassify existing bank contacts

Update 3 contacts that already have `account_category = 'bank'` but `contact_type = 'both'`:

```sql
UPDATE contacts SET contact_type = 'bank' WHERE account_category = 'bank';
```

No changes to opening_balance or transaction data.

### 3. Code Changes

| File | Change |
|------|--------|
| `src/contexts/LanguageContext.tsx` | Add `"contacts.bank": { en: "Bank", ur: "بینک" }` |
| `src/components/ContactForm.tsx` | Add `"bank"` to ContactType union + dropdown |
| `src/pages/Contacts.tsx` | Add bank to type filter + type display dot color |
| `src/pages/ContactEdit.tsx` | Add `"bank"` to type cast |

### 4. What Does NOT Need Changing

- **InvoiceForm.tsx**: Already excludes bank contacts (type filter only allows customer/supplier/both, and account_category filter excludes 'bank')
- **BatchNew.tsx**: Only allows supplier/both — bank excluded
- **Financial calculations**: All use `account_category` (not `contact_type`) — MCB/NBP already have `account_category = 'bank'`, so Cash in Hand, Bank Balance, Balance Sheet are all already correct
- **No data loss**: Only `contact_type` field changes from 'both' to 'bank'
