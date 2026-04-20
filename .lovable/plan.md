

## Plan: Show all account types in Invoice & Voucher dropdowns

### Root cause
After the Contacts → Accounts restructure, accounts can be created with `contact_type` values like `"other"` (or custom) but with the correct `account_category` set. Dropdowns that filter strictly on `contact_type` exclude these accounts.

### Findings per file
- **InvoiceForm.tsx** — filters by `contact_type IN ("customer"|"supplier", "both")`. Misses accounts where `account_category = "customer"|"supplier"` but `contact_type` is something else. **Needs fix.**
- **VoucherNew.tsx** — only excludes cash/bank via `account_category`, no `contact_type` filter, so it already shows all non-cash/bank accounts. But `transaction_mode` is **not** respected here. **Minor fix: also honor `transaction_mode`** so the same account-visibility model applies (optional but consistent). User's directive only asks for type/category combo — VoucherNew already passes that test. Will leave query as-is to avoid scope creep, **only the sublabel mapping** stays untouched.
- **VoucherEdit.tsx** — same shape as VoucherNew. Same conclusion: already shows all non-cash/bank accounts, no fix needed for the user's stated bug.
- **RecordPayment.tsx** — does NOT fetch a contacts list (uses `contactId` from props). **No fix needed.**
- **PaymentVouchers.tsx / ReceiptVouchers.tsx** — list pages. Their contact queries already do `select("id, name")` with no `contact_type` filter (used only for name lookup). **No fix needed.**

So only **InvoiceForm.tsx** actually has the described bug. The user's instructions tell me to apply the same pattern in the others — I'll do a light pass to confirm correctness but no code change is needed where the query is already permissive.

### Fix — `src/components/InvoiceForm.tsx` (lines ~56-75)

Replace the strict `.in("contact_type", ...)` filter with a JS-side OR check on both `contact_type` and `account_category`, keeping the existing cash/bank exclusion and `transaction_mode` rules.

```ts
const wantedRole = type === "sale" ? "customer" : "supplier";
const wantedMode = type === "sale" ? "sale" : "purchase";

const { data: contacts } = useQuery({
  queryKey: ["contacts-for-invoice", type],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, name, contact_type, account_category, transaction_mode")
      .order("name");
    if (error) throw error;
    return (data || []).filter(c => {
      const isCorrectType =
        c.contact_type === "both" ||
        c.contact_type === wantedRole ||
        c.account_category === wantedRole;
      const isNotCashBank = !["cash", "bank"].includes(c.account_category || "");
      const isCorrectMode =
        !c.transaction_mode ||
        c.transaction_mode === "both" ||
        c.transaction_mode === wantedMode;
      return isCorrectType && isNotCashBank && isCorrectMode;
    });
  },
});
```

Sublabel mapping below (lines 231-234) already handles `"both" | "customer" | "supplier"` — accounts whose `contact_type` is something else but matched via `account_category` will fall into the "supplier" branch by default. To avoid mislabeling, update the sublabel to fall back to the matched role:

```ts
sublabel:
  c.contact_type === "both" ? t("contacts.both")
  : c.contact_type === "customer" ? t("contacts.customer")
  : c.contact_type === "supplier" ? t("contacts.supplier")
  : t(type === "sale" ? "contacts.customer" : "contacts.supplier"),
```

### Files changed
1. `src/components/InvoiceForm.tsx` — query + sublabel mapping only.

No other files need edits — the voucher pages and RecordPayment do not have the strict `contact_type` filter described.

