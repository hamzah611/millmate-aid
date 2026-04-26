## Two fixes for Daily Transactions Report

Both fixes are display-level only inside `src/components/reports/DailyTransactionsReport.tsx`. Underlying queries, totals, subtotals, and the Cash in Hand summary continue to use the full unmerged dataset.

---

### Fix 1 — Show the cash-out leg of `[TRANSFER]` (bank deposits)

**Current behaviour:** The display filter drops every row with `r.isTransfer === true`, hiding *both* legs of a Cash → Bank deposit. The user can no longer see that cash left the till.

**Root cause:** Each transfer creates two payment rows in the DB (verified):
- Cash leg: `payment_method='cash'`, `voucher_type='payment'` (cash leaving till) — should be **shown**.
- Bank leg: `payment_method='bank'`, `voucher_type='receipt'` (bank receiving) — should be **hidden**.

**Change:**
1. Mark the transfer flag more precisely on each leg by reading `payment_method` together with `notes`. Both legs still get `isTransfer: true`, but the **cash leg keeps `category: 'cash'`** and the **bank leg keeps `category: 'bank'`** so we can tell them apart in the filter.
2. In the synthesis block, `!isTransfer` already prevents synthesizing a *third* bank-leg for transfers (kept).
3. In the display filter, replace `if (r.isTransfer) return false;` with:
   - Drop the transfer row only when it is the **bank leg** (`r.isTransfer && r.category === 'bank'`).
   - Keep the cash-out leg visible.
4. Improve the displayed contact for the surviving cash leg: instead of "Internal Transfer", show the destination bank name + the transfer note, e.g. `"→ HBL Bank (Cash Deposited)"`. This requires reading the sibling bank-leg's `bank_contact_id` for the same payment pair. Since the two payment rows are inserted as a pair but don't share an explicit FK, we group by `(payment_date, amount, notes)` to find the matching bank leg name.
5. Set `type` on the visible cash leg to **"Cash Deposit"** (or "Bank Withdrawal" when direction is bank→cash) so it reads naturally.

**Result:** Each Cash → Bank deposit becomes a single visible row in the "cash" group: cash account credited (CR), labelled "Cash Deposit → {Bank name}".

---

### Fix 2 — Counter Purchase residual row

**Investigation findings (from live DB):**
- Same-day cash purchases (e.g. PUR-0019 on Dec 10) collapse correctly today — the existing filter works for the strict same-date case.
- The double-row appears in two real cases I confirmed in the data:
  1. **Cross-date payment**: invoice dated Dec 8, cash payment dated Dec 10 (e.g. PUR-0011). On Dec 10, the report only sees the payment side → it shows as Counter Purchase (correct). On Dec 8 the report shows the invoice side as a plain "Purchase" row with no collapsing partner → looks like a duplicate when the user navigates between dates.
  2. **Reverse-direction voucher on a purchase invoice** (PUR-0010 has a `voucher_type='receipt'` row, i.e. a refund from supplier). The current `isCounterPurchase = r.debit > 0` test mislabels it as "Counter Sale".
- A subtler issue: the `paidInvoiceIds` set is built from `r.isCashPayment && r.invoiceId`, but the filter that uses it also requires `!r.isCashPayment` on the invoice side — which is fine — *however* if the invoice row arrives in `transactions` **before** the payment row and the array is later sorted, that's irrelevant (Set is order-independent). The actual gap is the cross-date case.

**Changes:**
1. **Same-date collapse (already works) — keep as-is** but tighten the invoice-side filter to also drop when a *bank* cash-equivalent payment for the same invoice exists today (i.e. extend `paidInvoiceIds` to include any payment-row whose `invoice_id` appears in today's payments, regardless of method). This way bank-paid invoices on the same day collapse too — only the payment row + synthesized bank leg remain (party DR + bank CR), no leftover invoice row.
2. **Cross-date case** — when the invoice row appears on its own date with no payment in today's data, leave it visible as a normal Purchase/Sale row (this is correct and not the bug the user is reporting). No change needed for this.
3. **Counter Purchase label correctness** — replace the heuristic `isCounterPurchase = r.debit > 0` with the explicit signal we already have on the source: use the linked invoice's `invoice_type`. Add `invoiceType?: 'sale' | 'purchase'` to `TransactionRow`, populated when the payment row is built (we already join `invoices` indirectly via `invoice_id`; add a small lookup map of `id → invoice_type` from today's invoices, falling back to a single extra fetch for invoices not in today's set). Then:
   - `invoice_type === 'purchase'` → "Counter Purchase", show DR only (credit forced to 0).
   - `invoice_type === 'sale'` → "Counter Sale", show CR only (debit forced to 0 — symmetric with Fix 3 from previous round; this also collapses the visible side cleanly).
4. **Hide CR side on Counter Purchase** — already done; keep it. Add the symmetric "hide DR on Counter Sale" so both forms render as a single-sided row consistently.

**Result:** Counter Purchase always renders as one row, DR side only, regardless of whether the matching payment was via cash or bank, and regardless of any reverse-direction vouchers on the invoice.

---

### Files to edit
- `src/components/reports/DailyTransactionsReport.tsx`

### Out of scope / unchanged
- Underlying `transactions` query (still fetches everything).
- Cash in Hand summary (still uses full unmerged data).
- CSV export (continues to export the displayed rows, which now match what the user sees on screen).
- Totals / subtotals (computed from `displayTransactions` after the collapse — unchanged behaviour).
