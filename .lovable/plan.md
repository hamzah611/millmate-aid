## Goal

Make `product_id` on the `payments` table the single source of truth for product-linked expenses. The product selector becomes universally available on payment vouchers (regardless of contact type), product expenses flow into Top Products and Product History, and the Balance Sheet stops double-counting them as standalone expense accounts.

## Changes

### 1. `src/pages/VoucherNew.tsx`

- Remove the `["expense","direct_expense"].includes(...)` gate around the product selector (line 375).
- Render the product selector block unconditionally for non-transfer vouchers, but only when `voucherType === "payment"` (hidden for receipts and transfers).
- Move the block to sit **after the contact field, before the invoice field** (currently it sits after invoice).
- Update the label to **"Link to Product (optional)"** and the helper text to **"Expense will be tracked in this product's history and reports."** (always shown, not gated by `productId`).
- Keep the existing `product_id: productId || null` save in the payment insert (already correct).

### 2. `src/pages/VoucherEdit.tsx`

- Same change: remove the contact-category gate around the product selector (line 195), show it whenever `voucherType === "payment"`.
- Move it to sit after the contact field, before the invoice field.
- Use the same label/helper copy as VoucherNew.
- The load (line 65) and save (line 123) of `product_id` are already correct — leave them.

### 3. `src/components/reports/TopProductsChart.tsx`

- Add a second query `productPayments` fetching from `payments` where `voucher_type = "payment"`, `product_id IS NOT NULL`, and within `[fromDate, toDate]`.
- Add a parallel `prevProductPayments` query for the previous range so the % change comparison stays accurate.
- In the `chartData` useMemo:
  - After populating `revenueMap` from `invoiceItems`, loop over `productPayments` and add each `amount` to `revenueMap.get(product_id).revenue` (creating the entry if absent — qty stays 0 for these).
  - Apply the same to `prevRevenueMap` from `prevProductPayments` so previous-period totals also include vouchers.
  - Respect `categoryFilter` (skip a payment if its product's category doesn't match).
  - Only add voucher amounts when `filter !== "sale"` (purchases/expenses align with the "purchase" or "both" toggle, not pure sales).

### 4. `src/components/reports/BalanceSheetProfessional.tsx`

Two filter additions to stop double-counting product-linked vouchers:

- **`expenseAccounts` query (lines 373–403):**
  - Change the payments select to `.select("amount, voucher_type, contact_id, product_id")`.
  - When computing `paymentTotal`, filter out rows with a non-null `product_id`:
    ```ts
    const paymentTotal = vouchers
      .filter(v => v.voucher_type === "payment" && !v.product_id)
      .reduce((s, v) => s + Number(v.amount), 0);
    ```
  - `receiptTotal` stays unchanged (receipts on expense contacts are rare and not a product cost).

- **`retainedEarningsData` query (lines 495–520):**
  - Change `expPayments` select to include `product_id`.
  - Skip payments with a non-null `product_id` when accumulating `expVoucherTotal`:
    ```ts
    if (p.product_id) continue;
    if (p.voucher_type === "payment") expVoucherTotal += Number(p.amount);
    if (p.voucher_type === "receipt") expVoucherTotal -= Number(p.amount);
    ```
  - This prevents product-linked vouchers paid through "expense" contacts from being subtracted from net profit twice (they already reduce profit via the product cost / inventory valuation path).

### 5. `src/pages/ProductHistory.tsx`

- No code changes. Verified: `voucherExpenses` query (lines 94–107) already fetches `payments` filtered by `product_id` and `voucher_type = "payment"`, renders them in the history table (lines 227–238), and includes them in the `totalExpenses` summary card (lines 254–256).

## Result

- A payment voucher to *anyone* (supplier, labourer, utility, employee, expense account) can be tagged with a product. The product field is always visible on payment vouchers.
- That payment shows up in Product History, contributes to the product's row in the Top Products chart, and feeds the product's avg cost / valuation flows already in place.
- The Balance Sheet's expense-account section and the Net Profit calculation both ignore voucher rows that have a `product_id`, so a product-tagged payment is counted exactly once — on the product, not also as an expense account balance.
