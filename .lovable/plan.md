

## Fix RTL (Urdu) Layout Issues

The Urdu mode has several layout problems because the codebase uses physical CSS properties (`mr-2`, `pl-9`, `left-3`, `border-r`) instead of logical ones that respect `dir="rtl"`. The sidebar also doesn't flip to the right side in RTL mode.

### Key Issues

1. **Sidebar stays on the left in RTL** — should appear on the right
2. **`mr-2` on all icons** — margin stays on the right instead of flipping. Need `me-2` (margin-end)
3. **Search input icon** — `left-3` and `pl-9` don't flip. Need `start-3`/`ps-9`
4. **Back arrow buttons** — `ArrowLeft` icon should become `ArrowRight` in RTL
5. **Header border** — `border-b` is fine, but sidebar `border-r` doesn't flip

### Changes

**`src/components/AppSidebar.tsx`**
- Change all `mr-2` → `me-2`
- Use `useLanguage()` `isRtl` to pass to sidebar if needed

**`src/components/AppLayout.tsx`**
- Make sidebar aware of RTL by reading `isRtl` from context and rendering sidebar on right side in RTL mode

**All page files with `mr-2` on icons** (Units, Sales, Purchases, Products, Production, Contacts, Index, BatchTracking):
- Replace `mr-2` → `me-2` everywhere

**Search inputs in Contacts.tsx and Products.tsx**:
- `left-3` → `start-3` (or use `ltr:left-3 rtl:right-3`)
- `pl-9` → `ps-9` (or use `ltr:pl-9 rtl:pr-9`)

**Back buttons in all New/Edit pages** (ContactNew, ContactEdit, ProductNew, ProductEdit, SaleNew, PurchaseNew, ProductionNew, BatchNew):
- Import both `ArrowLeft` and `ArrowRight`
- Use `isRtl ? ArrowRight : ArrowLeft` for the back button icon

**`src/components/ui/sidebar.tsx`**
- The Sidebar component already supports `side` prop. We just need to pass it dynamically.

**`src/components/ui/sheet.tsx`**
- The Sheet already supports `side` prop — just needs correct value passed from sidebar.

**`src/components/InvoiceForm.tsx`** and **`src/components/InvoiceItemRow.tsx`**:
- Fix any `mr-2`/`ml-2` → `me-2`/`ms-2`

### Result
- Sidebar appears on the right in Urdu mode
- All icons and text spacing flips correctly
- Back arrows point the right direction
- Search inputs work correctly in both directions

