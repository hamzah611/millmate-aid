

## Plan: Major System Upgrade (8 Modules)

This is a large scope request. Due to the number of changes, I recommend implementing in **3 phases** across multiple messages to keep each change set reviewable and stable.

---

### Phase 1: Database & New Modules (Inventory Adjustments + Expenses)

**Database Migration** — Create two new tables + one categories seed:

```sql
-- inventory_adjustments table
CREATE TABLE public.inventory_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_number text NOT NULL,
  adjustment_date date NOT NULL DEFAULT CURRENT_DATE,
  product_id uuid NOT NULL REFERENCES products(id),
  batch_id uuid REFERENCES batches(id),
  adjustment_type text NOT NULL, -- 'increase' or 'decrease'
  quantity_kg numeric NOT NULL,
  reason text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view adjustments" ON public.inventory_adjustments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert adjustments" ON public.inventory_adjustments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update adjustments" ON public.inventory_adjustments FOR UPDATE TO authenticated USING (true);

-- expense_categories table
CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_ur text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view expense_categories" ON public.expense_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage expense_categories" ON public.expense_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.expense_categories (name, name_ur) VALUES
  ('Electricity', 'بجلی'),
  ('Labor', 'مزدوری'),
  ('Transport', 'ٹرانسپورٹ'),
  ('Maintenance', 'مرمت'),
  ('Packaging', 'پیکنگ'),
  ('Rent', 'کرایہ'),
  ('Miscellaneous', 'متفرق');

-- expenses table
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  category_id uuid REFERENCES expense_categories(id),
  amount numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash', -- cash, bank, other
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view expenses" ON public.expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update expenses" ON public.expenses FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete expenses" ON public.expenses FOR DELETE TO authenticated USING (true);
```

**New Files:**
- `src/pages/Adjustments.tsx` — List page at `/inventory/adjustments` with table (Adjustment #, Date, Product, Qty change, Reason, Notes) + "New Adjustment" button
- `src/pages/AdjustmentNew.tsx` — Form page: Date, Product selector, Batch selector (optional), Type toggle (increase/decrease), Quantity, Reason dropdown (Damage/Wastage/Physical Count Difference/Expired/Correction/Other), Notes. On save: insert adjustment record + update `products.stock_qty`
- `src/pages/Expenses.tsx` — List page at `/expenses` with table (Date, Category, Amount, Payment Method, Notes) + "New Expense" button + CSV export
- `src/pages/ExpenseNew.tsx` — Form page: Date, Category dropdown, Amount, Payment method (cash/bank/other), Notes

**Modified Files:**
- `src/App.tsx` — Add routes: `/inventory/adjustments`, `/inventory/adjustments/new`, `/expenses`, `/expenses/new`
- `src/components/AppSidebar.tsx` — Add "Expenses" nav item (with `Receipt` icon)
- `src/pages/Inventory.tsx` — Add "Adjustments" tab linking to `/inventory/adjustments`
- `src/contexts/LanguageContext.tsx` — Add ~30 translation keys for adjustments & expenses
- `src/components/reports/FinancialReports.tsx` — Update P&L to subtract expenses from net profit

---

### Phase 2: Contact Ledger + Dashboard Intelligence

**New Files:**
- `src/pages/ContactLedger.tsx` — Dedicated page at `/contacts/:id/ledger` showing:
  - Summary cards: Total Sales, Total Purchases, Total Paid, Total Outstanding, Last Transaction Date
  - Invoice history table with filtering
  - Payment history table
  - "Download Statement CSV" button

**New Dashboard Components:**
- `src/components/dashboard/TopSellingProducts.tsx` — Bar chart (recharts) of top 5 products by revenue
- `src/components/dashboard/TopCustomers.tsx` — Top 5 customers by revenue
- `src/components/dashboard/RecentActivity.tsx` — Last 10 actions across sales, purchases, payments, production, adjustments, expenses
- `src/components/dashboard/InactiveProducts.tsx` — Products with no sales in 30 days

**Modified Files:**
- `src/App.tsx` — Add `/contacts/:id/ledger` route
- `src/pages/Contacts.tsx` — Add ledger icon button per contact row
- `src/pages/Index.tsx` — Add Inventory Value card + all 4 new dashboard panels
- `src/contexts/LanguageContext.tsx` — Add ~25 translation keys

---

### Phase 3: Global Search + CSV Export + Notifications

**New Files:**
- `src/components/GlobalSearch.tsx` — Command palette (using existing `cmdk` package) triggered from search bar in header. Searches contacts, invoices, products, batches. Shows results with type badge and navigates on click.
- `src/components/NotificationPanel.tsx` — Bell icon dropdown in header. Queries: low stock products, overdue invoices, predicted stockouts (from replenishment data), batches nearing expiry. Shows notification title, message, timestamp, link.

**Modified Files:**
- `src/components/AppLayout.tsx` — Add GlobalSearch and NotificationPanel to header bar
- `src/pages/Sales.tsx` — Add "Export CSV" button
- `src/pages/Purchases.tsx` — Add "Export CSV" button
- `src/pages/Contacts.tsx` — Add "Export CSV" button
- `src/pages/Products.tsx` — Add "Export CSV" button + "Stock Value" column
- `src/pages/Expenses.tsx` — Already has CSV export from Phase 1
- `src/pages/Adjustments.tsx` — Already has CSV export from Phase 1
- `src/contexts/LanguageContext.tsx` — Add ~15 translation keys

---

### Implementation Approach

I will implement **Phase 1 first** (database tables + Inventory Adjustments + Expenses + P&L update). After verifying it works, we proceed to Phase 2, then Phase 3.

Each phase produces working, testable features. The total scope covers:
- 2 new database tables + 1 seed table
- ~8 new page/component files
- ~6 modified files
- ~70 new translation keys (English + Urdu)

