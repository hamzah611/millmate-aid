

## Plan: Replace Popups with Dedicated Form Pages

### What Changes
Convert all "create/edit" dialogs into full separate pages with proper routes. The forms themselves (`ContactForm`, `ProductForm`, `InvoiceForm`, `BatchTracking` form, `Production` form) stay largely the same — they just get wrapped in standalone page components instead of dialogs.

### New Routes
| Route | Purpose |
|---|---|
| `/contacts/new` | Add contact |
| `/contacts/:id/edit` | Edit contact |
| `/products/new` | Add product |
| `/products/:id/edit` | Edit product |
| `/sales/new` | Create sale invoice |
| `/purchases/new` | Create purchase invoice |
| `/production/new` | Create production record |
| `/inventory/batches/new` | Add new batch |

### New Page Files (8 files)
Each page will:
- Use the existing `AppLayout` (sidebar stays visible)
- Have a header with back button (← arrow + title)
- Wrap the existing form component in a `Card`
- On success, navigate back to the list page using `useNavigate()`

Files to create:
- `src/pages/ContactNew.tsx` / `src/pages/ContactEdit.tsx`
- `src/pages/ProductNew.tsx` / `src/pages/ProductEdit.tsx`
- `src/pages/SaleNew.tsx`
- `src/pages/PurchaseNew.tsx`
- `src/pages/ProductionNew.tsx`
- `src/pages/BatchNew.tsx`

### Changes to Existing Files

**`src/App.tsx`** — Add 8 new routes inside the authenticated layout.

**`src/pages/Contacts.tsx`** — Remove Dialog components. Change "Add" button to `<Link to="/contacts/new">`. Change edit button to navigate to `/contacts/:id/edit`.

**`src/pages/Products.tsx`** — Same pattern: remove dialogs, use navigation links.

**`src/pages/Sales.tsx`** — Remove create Dialog. "Create" button links to `/sales/new`.

**`src/pages/Purchases.tsx`** — Same as Sales.

**`src/pages/Production.tsx`** — Remove create Dialog. Button links to `/production/new`.

**`src/components/inventory/BatchTracking.tsx`** — Remove Dialog. Button links to `/inventory/batches/new`.

**Form components** (`ContactForm`, `ProductForm`, `InvoiceForm`) — Update `onSuccess` / `onCancel` props to accept navigation callbacks instead of dialog close handlers. Minor interface adjustments.

### Result
- All create/edit flows happen on full dedicated pages with proper URLs
- Back button returns to the list
- Forms have more room, especially on mobile
- Invoice detail dialog stays as-is (it's view-only, not a form)

