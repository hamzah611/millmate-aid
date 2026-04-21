

## Plan: Add Loan and Fixed Asset account categories (approved + clarification applied)

Implementing the previously approved plan with the user's clarification: in `InvoiceForm.tsx`, the `!isFixedAsset` guard wraps **all three** post-purchase side-effects — stock update, avg_cost recalculation, AND price_history insert.

### 1. Category picker
- **`src/lib/account-categories.ts`** — append `{ value: "loan", labelKey: "accountCategory.loan" }` and `{ value: "fixed_asset", labelKey: "accountCategory.fixedAsset" }` to `ACCOUNT_CATEGORIES`.
- **`src/contexts/LanguageContext.tsx`** — add `accountCategory.loan` (en: "Loan", ur: "قرض"), `accountCategory.fixedAsset` (en: "Fixed Asset", ur: "مستقل اثاثہ"), and matching `contacts.loan` / `contacts.fixedAsset` keys.
- **`src/components/ContactForm.tsx`** — append `"loan"` and `"fixed_asset"` to the local `ACCOUNT_CATEGORIES` array so they appear in the form's category dropdown.
- No DB migration: `account_category` is free text.

### 2. Loan accounts → Liability on Balance Sheet
- **`src/components/reports/BalanceSheetProfessional.tsx`** — add `loanAccounts` query (`account_category = 'loan'`).
  - Per loan: `closingBalance = opening_balance + sum(receipt vouchers) − sum(payment vouchers)`.
  - Render new **"Loans"** sub-section in LIABILITIES (after Supplier Payables), expandable details, always credit side.
  - Add `loanTotal` to `totalLiabilities` and `totalLiabilitiesAndEquity`. Add to `isLoading`.

### 3. Fixed Asset accounts → Asset on Balance Sheet
- **`src/components/reports/BalanceSheetProfessional.tsx`** — add `fixedAssetAccounts` query (`account_category = 'fixed_asset'`).
  - Per asset: `closingBalance = opening_balance + sum(purchase invoice totals where contact_id = asset) + sum(payment vouchers DR) − sum(receipt vouchers CR for disposals)`.
  - Render new **"Fixed Assets"** sub-section in ASSETS (after Inventory), expandable details, always debit side.
  - Add `fixedAssetTotal` to `totalAssets`. Add to `isLoading`.

### 4. Skip ALL inventory side-effects for fixed-asset purchases
- **`src/components/InvoiceForm.tsx`** — before the post-save loops, fetch the contact's `account_category` once:
  ```ts
  const { data: contactData } = await supabase
    .from("contacts").select("account_category").eq("id", contactId).single();
  const isFixedAsset = contactData?.account_category === "fixed_asset";
  ```
- Wrap with `if (!isFixedAsset) { ... }`:
  - **Edit-mode reverse loop** (lines ~274-286) — reverses old stock.
  - **Forward purchase loop** (lines ~386-426) — covers all three: `stock_qty` update, `avg_cost` weighted recalculation, AND `price_history` insert. Single guard wraps the whole block so none of the three side-effects fire for fixed-asset invoices.
- Sale invoices unaffected (fixed-asset sales aren't a use case here, but no filter needed since `isFixedAsset` is only computed/used in the purchase path).

### 5. Keep P&L clean
- **`src/components/reports/FinancialReports.tsx`** — fetch a `contacts` map (`id → account_category`) and exclude invoices whose contact has `account_category IN ('loan','fixed_asset')` from both sale totals and `purchaseCost` in `ProfitLossReport` and `BreakdownTable`.
- No change to expenses query (expenses don't reference loan/fixed-asset contacts).
- Trial Balance / Daily Transactions: no changes — loan and fixed-asset rows naturally appear with their category labels.

### Out of scope
- `ContactLedger.tsx` untouched.
- No changes to Customer/Supplier/Bank/Expense/Employee/Broker behavior.
- No DB migration.

### Files changed
1. `src/lib/account-categories.ts`
2. `src/contexts/LanguageContext.tsx`
3. `src/components/ContactForm.tsx`
4. `src/components/InvoiceForm.tsx`
5. `src/components/reports/BalanceSheetProfessional.tsx`
6. `src/components/reports/FinancialReports.tsx`

