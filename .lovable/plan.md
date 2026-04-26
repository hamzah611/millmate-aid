## Plan: Bank selection in inline "Record Payment" on invoice detail

### Problem
On the **Purchases** (and Sales) invoice detail page, the inline **Record Payment** form (`src/components/RecordPayment.tsx`) lets the user choose payment method = "Cash" or "Bank", but when "Bank" is selected there is **no dropdown to pick which bank**. The payment row is therefore inserted with `payment_method = "bank"` and `bank_contact_id = null`, so the Daily Transactions / Ledger reports cannot post the bank-side leg correctly.

`VoucherNew.tsx` and `VoucherEdit.tsx` already implement this correctly — we just mirror that pattern in `RecordPayment.tsx`.

### Fix (single file: `src/components/RecordPayment.tsx`)

1. **Add state** for the selected bank:
   ```ts
   const [bankContactId, setBankContactId] = useState("");
   ```

2. **Fetch bank accounts** with React Query, filtering `contacts` where `account_category = "bank"`:
   ```ts
   const { data: bankContacts } = useQuery({
     queryKey: ["bank-contacts-all"],
     queryFn: async () => {
       const { data } = await supabase
         .from("contacts")
         .select("id, name")
         .eq("account_category", "bank")
         .order("name");
       return data || [];
     },
   });
   ```

3. **Render bank picker** conditionally below the method `Select`, using the existing `SearchableCombobox` component (same UX as `VoucherNew`):
   - Shown only when `paymentMethod === "bank"`.
   - Required field — block submit if empty with toast `t("voucher.bankRequired")`.
   - When user switches method back to "cash", reset `bankContactId` to `""`.

4. **Persist on insert** — extend the `payments` insert payload with:
   ```ts
   bank_contact_id: paymentMethod === "bank" ? bankContactId : null,
   ```

5. **Reset on success** — clear `bankContactId` alongside `amount` and `notes`.

### Out of scope
- No changes to `VoucherNew.tsx`, `VoucherEdit.tsx`, `InvoiceDetail.tsx`, `DailyTransactionsReport.tsx`, or any other file.
- No DB migration — `payments.bank_contact_id` already exists.
- No change to the report rendering logic; once `bank_contact_id` is saved, the existing bank-leg synthesis in `DailyTransactionsReport.tsx` will correctly post the DR/CR bank entry.

### Files changed
1. `src/components/RecordPayment.tsx`
