

## Add City Field & Labels to Contact Form

### 1. Database Migration
Add a `city` column to the `contacts` table:
```sql
ALTER TABLE public.contacts ADD COLUMN city text;
```

### 2. Update ContactForm.tsx
- Add `city` field to `ContactData` interface and `emptyForm`
- Add proper `<Label>` elements above every input field (Name, Phone, City, Address, Contact Type, Credit Limit, Payment Terms)
- Include city in insert/update mutations
- Current form uses only placeholders with no visible labels -- this will be fixed

### 3. Update ContactEdit.tsx
- Include `city` in the query mapping so editing pre-fills the city field

### 4. Add Translation Keys (LanguageContext.tsx)
- `"contacts.city"`: `{ en: "City", ur: "شہر" }`

### Files Changed
| File | Change |
|------|--------|
| Migration SQL | Add `city` column to contacts |
| `src/components/ContactForm.tsx` | Add city field, add `<Label>` to all fields |
| `src/pages/ContactEdit.tsx` | Map `city` from query result |
| `src/contexts/LanguageContext.tsx` | Add city translation key |

