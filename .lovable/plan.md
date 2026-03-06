

## Plan: Units Management Page

### New Route
`/units` — a dedicated page to create, edit, and delete measurement units with name (English + Urdu) and base value in KG.

### Files to Create

**`src/pages/Units.tsx`**
- Full CRUD page with inline table editing (no separate create/edit pages needed since units are simple: name, name_ur, kg_value)
- Table showing all units with columns: Name, Name (Urdu), KG Value, Actions (edit/delete)
- "Add Unit" button opens an inline form row at the top (or a simple form above the table)
- Edit button makes the row editable inline
- Delete with confirmation dialog (only owners can delete per existing RLS)
- Search/filter support

### Files to Modify

**`src/components/AppSidebar.tsx`**
- Add "Units" nav item with `Ruler` icon pointing to `/units`, placed after Inventory

**`src/App.tsx`**
- Add `/units` route inside the authenticated layout

**`src/contexts/LanguageContext.tsx`**
- Add translations: `nav.units`, `units.title`, `units.add`, `units.name`, `units.nameUr`, `units.kgValue`, `units.kgValueHint`

### How It Works
- Units table already exists with RLS policies (authenticated can view, owners can manage)
- The page queries `units` table, allows CRUD operations
- KG value field lets users define how many KG one unit equals (e.g., 1 Maund = 40 KG, 1 Bag = 50 KG, 1 Litre = 1)
- These units already appear in product forms and invoice item rows — no changes needed there since they already query the `units` table

