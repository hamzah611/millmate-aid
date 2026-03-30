

## Add 153 Opening Balance Accounts

### Overview
Add all accounts from the A.G Aata Chaki opening balance sheet. This requires a database schema change (new column), then bulk data insertion across contacts, products, and expense_categories tables.

### 1. Database Migration — Add `opening_balance` column

Add a signed numeric column to the `contacts` table:
- Positive values = DR (receivable/asset)
- Negative values = CR (payable/liability)

```sql
ALTER TABLE public.contacts ADD COLUMN opening_balance numeric DEFAULT 0;
```

### 2. Data Mapping (153 accounts)

| # | Category | Destination | contact_type | account_category | Count |
|---|----------|-------------|-------------|-----------------|-------|
| 1-3 | Current Assets | contacts | both | cash | 3 |
| 4-6 | Bank Accounts | contacts | both | bank | 3 |
| 7-37 | Customers (Will Be Closed) | contacts | customer | closing | 31 |
| 38-45 | Employee Accounts | contacts | both | employee | 8 |
| 46-47 | Liabilities | contacts | supplier | supplier | 2 |
| 48-104 | Customer Accounts | contacts | customer | customer | 57 |
| 105-136 | Party/Suppliers/Brokers | contacts | supplier or broker | supplier | 32 |
| 137-141 | Sales/Income | products | — | — | 5 |
| 142-145 | Purchase Accounts | products | — | — | 4 |
| 146-147 | Direct Expenses | expense_categories | — | — | 2 |
| 148-149 | Rice Hullar | contacts | customer | customer | 2 |
| 150-153 | Flour Mill/Capital | contacts | both | cash | 4 |

**Broker detection**: Accounts with "Broker" in the name → `contact_type: broker`

**Opening balance sign convention**:
- DR amount → stored as positive (e.g., 1,504,495)
- CR amount → stored as negative (e.g., -5,914)

### 3. Products (items 137-145)

Will need at least one unit and category to insert products. Will create:
- Unit: "KG" (kg_value: 1)
- Categories: "Sales / Income" and "Purchase"

Products will be inserted with:
- `name` from account name
- `default_price: 0`
- `stock_qty: 0`
- `notes` field doesn't exist on products, so opening stock values will be noted in the `name_ur` field or skipped

Actually, products don't have a notes or opening_balance field. The DR values for items 137-145 represent stock values, not quantities. These will be added as products with name only — the monetary values can't be stored without a new column.

### 4. Expense Categories (items 146-147)

Insert "Kitchen" and "Machine Expenses" into `expense_categories` table.

### 5. Code Changes

After migration, update `ContactForm.tsx` and related components to handle the new `opening_balance` field:
- Add an opening balance input field to the contact form
- Display opening balance in the contacts list table
- Include in CSV export

### 6. Verification

After all inserts, run a verification query to confirm:
- Total positive balances (DR) = 14,853,741
- Total negative balances (CR) = -14,853,741 (absolute = 14,853,741)

### Files Changed

| File | Change |
|------|--------|
| Migration SQL | Add `opening_balance` column to contacts |
| Data inserts | 148 contacts, 9 products, 2 expense categories |
| `src/components/ContactForm.tsx` | Add opening_balance input |
| `src/pages/Contacts.tsx` | Show opening_balance column, include in CSV |
| `src/contexts/LanguageContext.tsx` | Translation keys for opening balance |

