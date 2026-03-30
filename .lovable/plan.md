

## Fix: Allow Staff Users to Create/Edit Units

### Problem
The `units` table has an RLS policy "Owners can manage units" that restricts INSERT, UPDATE, and DELETE to users with the `owner` role. Your father's account has the `staff` role, so he gets a row-level security error when trying to save units.

### Solution
Add explicit INSERT and UPDATE policies for authenticated users on the `units` table (matching the pattern used on most other tables like `contacts`, `products`, etc.). Keep DELETE restricted to owners only.

### Database Migration

```sql
-- Allow all authenticated users to insert units
CREATE POLICY "Authenticated can insert units"
ON public.units FOR INSERT TO authenticated
WITH CHECK (true);

-- Allow all authenticated users to update units
CREATE POLICY "Authenticated can update units"
ON public.units FOR UPDATE TO authenticated
USING (true);
```

### Files Changed

| File | Change |
|------|--------|
| Migration SQL | Add INSERT and UPDATE policies for authenticated role on `units` table |

No code changes needed.

