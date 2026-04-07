

## Refactor Transfer UI in VoucherNew.tsx

### Current state
Transfer mode already exists but uses a single combined cash+bank dropdown for From/To. The user wants separate type selectors (Cash/Bank) with conditional account dropdowns for each side.

### Changes — `src/pages/VoucherNew.tsx` only

**1. Replace transfer state variables** (lines 32-34)

Remove `fromAccountId`, `toAccountId`. Add:
```ts
const [transferFromType, setTransferFromType] = useState("cash");
const [transferFromId, setTransferFromId] = useState("");
const [transferToType, setTransferToType] = useState("bank");
const [transferToId, setTransferToId] = useState("");
```

**2. Add cash contacts query** (after bankContacts query, ~line 62)
```ts
const { data: cashContacts } = useQuery({
  queryKey: ["cash-contacts"],
  queryFn: async () => {
    const { data } = await supabase.from("contacts")
      .select("id, name").eq("account_category", "cash").order("name");
    return data || [];
  }
});
```

**3. Remove the `cashBankContacts` query** (lines 64-77) and its derived `cashBankOptions`/`toAccountOptions` (lines 218-223) — no longer needed.

**4. Add new derived options**
```ts
const cashOptions = (cashContacts || []).map(c => ({ value: c.id, label: c.name }));
```
`bankOptions` already exists.

**5. Replace transfer UI** (lines 254-274)

Show two sections, each with a type dropdown + conditional account dropdown:

- **FROM**: Select type (Cash/Bank) then select specific account from cashOptions or bankOptions
- **TO**: Select type (Cash/Bank) then select specific account from cashOptions or bankOptions, excluding the selected From account

**6. Update save logic** (lines 100-144)

Replace the `cashBankContacts` lookups with the new state:
- `payment_method` uses `transferFromType` / `transferToType` directly
- `bank_contact_id` uses `transferFromId` / `transferToId` when type is "bank", null when "cash"
- Notes prefix `[TRANSFER]` stays
- Validation uses `transferFromId`, `transferToId`

**7. Update reset logic** (line 240-243)

Reset the new transfer state variables when switching voucher type.

### No other files changed
- `financial-utils.ts`: No changes needed — cash/bank transfers are already handled correctly by existing `calculateCashInHand` and `calculateBankBalances` functions.
- No database changes needed.

