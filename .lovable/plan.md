

## Rename "Opening Balance" → "Outstanding Balance" (UI Labels Only)

This is a label-only change across translation strings and a few hardcoded strings. No variable names, DB columns, or logic changes.

### File 1: `src/contexts/LanguageContext.tsx`

Update translation values (not keys — keys stay the same for code compatibility):

| Key | Old English | New English | Old Urdu | New Urdu |
|-----|------------|-------------|----------|----------|
| `contacts.openingBalance` | Opening Balance | Outstanding Balance | ابتدائی بیلنس | بقایا بیلنس |
| `contacts.openingBalanceDate` | Opening Balance Date | Outstanding Balance Date | ابتدائی بیلنس کی تاریخ | بقایا بیلنس کی تاریخ |
| `reports.openingReceivables` | Opening Receivables | Outstanding Receivables | ابتدائی وصولیاں | بقایا وصولیاں |
| `reports.openingPayables` | Opening Payables | Outstanding Payables | ابتدائی واجبات | بقایا واجبات |
| `ledger.openingBalance` | Opening Balance | Outstanding Balance | ابتدائی بیلنس | بقایا بیلنس |

Also update the section comment from `// Opening Balance` to `// Outstanding Balance`.

### File 2: `src/components/reports/BalanceSheetProfessional.tsx`

Replace all hardcoded `"Opening Balance"` strings in `DetailLine` labels with `"Outstanding Balance"` (approximately 6 occurrences: cash, bank, customer, employee, supplier, inventory sections).

### File 3: `src/pages/Contacts.tsx`

Update CSV export header from `"Opening Balance"` to `"Outstanding Balance"` (line 109).

### No other files changed. No database changes.

