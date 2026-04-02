

## Add Realistic Tagged Demo Data for Full Workflow Testing

### Tagging Convention
- All record `name` fields prefixed with `DEMO - `
- All `notes` fields set to `DEMO_TEST`
- Cleanup: `DELETE FROM table WHERE name LIKE 'DEMO -%'` or `WHERE notes = 'DEMO_TEST'`

### Reference IDs (from existing data)
- **Units**: KG (`8bb4f45c`), Mun (`e709a09a`, 40kg), Gram (`367a0f57`), Litre (`48f5c6f4`)
- **Categories**: Purchase (`3f488636`), Sales/Income (`c3bdee8c`)
- **Expense Categories**: Kitchen (`00615dba`), Machine Expenses (`8d48f4c5`) — will also create demo expense categories for Transport, Labor, Rent
- **Business Units**: `flour_mill`, `rice_hullar`

### Execution Order (all via insert tool)

#### Step 1: Demo Expense Categories
Create 3 new categories (tagged): `DEMO - Transport`, `DEMO - Labor`, `DEMO - Rent`

#### Step 2: Demo Contacts (10 total)

| Name | Type | Account Category |
|------|------|-----------------|
| DEMO - Ahmed Traders | customer | customer |
| DEMO - Bismillah Store | customer | customer |
| DEMO - Noor Enterprises | customer | customer |
| DEMO - Rahman Retail | customer | customer |
| DEMO - Sindh Grain Supplier | supplier | party |
| DEMO - Mehran Rice Supplier | supplier | party |
| DEMO - Pak Bardana House | supplier | party |
| DEMO - Al Kareem Oil Traders | supplier | party |
| DEMO - Ali Hassan (Worker) | supplier | employee |
| DEMO - Imran Khan (Driver) | supplier | employee |

All with `notes = 'DEMO_TEST'`, realistic phone/city.

#### Step 3: Demo Products (5 total)

| Name | Unit | Category | Default Price | Min Stock | Stock |
|------|------|----------|--------------|-----------|-------|
| DEMO - Wheat | Mun | Purchase | 3200 | 50 | 200 |
| DEMO - Wheat Atta | Mun | Sales | 3800 | 30 | 0 |
| DEMO - Rice Broken | Mun | Purchase | 2800 | 40 | 150 |
| DEMO - Rice Atta | Mun | Sales | 3500 | 20 | 0 |
| DEMO - Bran / Chokar | Mun | Sales | 1200 | 10 | 0 |

Stock starts at 0 for outputs (will be set via purchases/production). Wheat and Rice Broken get opening stock.

#### Step 4: Demo Purchases (6 invoices)

Spread across last 2 weeks, mix of `flour_mill` and `rice_hullar`. Using demo suppliers and demo products.

| # | Supplier | Product | Qty (Mun) | Price/Mun | Total | BU | Status |
|---|----------|---------|-----------|-----------|-------|----|--------|
| PUR-D001 | Sindh Grain | DEMO Wheat | 100 | 3200 | 320,000 | flour_mill | paid |
| PUR-D002 | Sindh Grain | DEMO Wheat | 80 | 3250 | 260,000 | flour_mill | paid |
| PUR-D003 | Mehran Rice | DEMO Rice Broken | 60 | 2800 | 168,000 | rice_hullar | paid |
| PUR-D004 | Mehran Rice | DEMO Rice Broken | 50 | 2850 | 142,500 | rice_hullar | credit |
| PUR-D005 | Pak Bardana | DEMO Wheat | 40 | 3100 | 124,000 | flour_mill | partial (50k paid) |
| PUR-D006 | Al Kareem Oil | DEMO Rice Broken | 30 | 2750 | 82,500 | rice_hullar | paid |

After purchases, update demo product stock_qty accordingly (total KG added).

#### Step 5: Demo Sales (6 invoices)

| # | Customer | Product | Qty (Mun) | Price/Mun | Total | BU | Status |
|---|----------|---------|-----------|-----------|-------|----|--------|
| SAL-D001 | Ahmed Traders | DEMO Wheat Atta | 30 | 3800 | 114,000 | flour_mill | paid |
| SAL-D002 | Bismillah Store | DEMO Bran | 20 | 1200 | 24,000 | flour_mill | paid |
| SAL-D003 | Noor Enterprises | DEMO Rice Atta | 25 | 3500 | 87,500 | rice_hullar | credit |
| SAL-D004 | Rahman Retail | DEMO Wheat Atta | 15 | 3850 | 57,750 | flour_mill | paid |
| SAL-D005 | Ahmed Traders | DEMO Rice Atta | 10 | 3500 | 35,000 | rice_hullar | partial (20k paid) |
| SAL-D006 | Bismillah Store | DEMO Bran | 15 | 1250 | 18,750 | flour_mill | paid |

After sales, update demo product stock_qty accordingly (subtract sold KG).

#### Step 6: Demo Expenses (6 records)

| Category | Amount | BU | Method | Date |
|----------|--------|----|--------|------|
| DEMO - Transport | 15,000 | flour_mill | cash | recent |
| DEMO - Labor | 25,000 | flour_mill | cash | recent |
| Machine Expenses | 8,000 | rice_hullar | cash | recent |
| DEMO - Rent | 30,000 | flour_mill | bank | recent |
| DEMO - Transport | 12,000 | rice_hullar | cash | recent |
| DEMO - Labor | 18,000 | rice_hullar | cash | recent |

All with `notes = 'DEMO_TEST'`.

#### Step 7: Demo Production (2 records)

1. **Flour Mill**: DEMO Wheat (50 Mun input) → DEMO Wheat Atta (45 Mun) + DEMO Bran (5 Mun)
2. **Rice Hullar**: DEMO Rice Broken (40 Mun input) → DEMO Rice Atta (35 Mun) + DEMO Bran (3 Mun)

Update stock_qty for source (subtract) and outputs (add).

#### Step 8: Demo Adjustments (2 records)

1. **Increase**: DEMO Wheat, +10 Mun (400 KG), reason: Correction, type: increase
2. **Decrease**: DEMO Rice Broken, -5 Mun (200 KG), reason: Wastage, type: decrease

Update stock_qty accordingly.

#### Step 9: Final Stock Reconciliation

After all operations, update each demo product's `stock_qty` to reflect the net of all purchases, sales, production, and adjustments.

### Files Changed
None — this is purely a data insertion task using the database insert tool.

### Cleanup Query (for later)
```sql
DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE notes = 'DEMO_TEST');
DELETE FROM invoices WHERE notes = 'DEMO_TEST';
DELETE FROM production_outputs WHERE production_id IN (SELECT id FROM productions WHERE notes = 'DEMO_TEST');
DELETE FROM productions WHERE notes = 'DEMO_TEST';
DELETE FROM inventory_adjustments WHERE notes = 'DEMO_TEST';
DELETE FROM expenses WHERE notes = 'DEMO_TEST';
DELETE FROM products WHERE name LIKE 'DEMO -%';
DELETE FROM contacts WHERE name LIKE 'DEMO -%';
DELETE FROM expense_categories WHERE name LIKE 'DEMO -%';
```

