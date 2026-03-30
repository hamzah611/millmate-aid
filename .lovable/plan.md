

## Add Filters to Contacts Page

### What
Add a filter bar with **contact type** and **city** filters alongside the existing search input, consistent with the Expenses page filter pattern.

### Changes

**`src/pages/Contacts.tsx`**
- Add state: `typeFilter` (default `"all"`) and `cityFilter` (default `"all"`)
- Derive unique cities from contacts data for the city dropdown
- Update `filtered` to chain: name search + type filter + city filter
- Render filter row with search input, type Select, and city Select in a flex-wrap row
- Type options: All, Customer, Supplier, Both, Broker
- City options: All + dynamically populated from data

**`src/contexts/LanguageContext.tsx`**
- Add translation keys: `common.all`, `contacts.filterByType`, `contacts.filterByCity`

### Layout
```text
[Search input]  [Type ▾]  [City ▾]
```

All three filters apply together (AND logic). The subtitle count updates to reflect filtered results. CSV export also respects active filters.

### Technical Details
- Filter is purely client-side (data already fully fetched)
- `useMemo` to derive unique cities list
- Select component with `"all"` as the default value mapped to "show everything"
- No database or routing changes needed

