

## Make Recent Activity Interactive

### What changes

**1. Clickable activity items** — Each activity row becomes a link to its relevant page:
- Sale created → `/sales`
- Purchase created → `/purchases`  
- Payment recorded → `/sales` (or `/purchases`)
- Adjustment → `/adjustments`
- Expense → `/expenses`

Store a `link` field on each `ActivityItem` so clicking navigates to the right page.

**2. Always show "Show More" button** — Change the condition from `activities.length > 10` to always visible. When fewer than 10 items exist, the button text says "View All Activity" and could still expand or just confirm all items are shown. Alternatively, show a "View All" link-style button at the bottom regardless of count.

**3. Show more detail on each row** — Add `amount` field to activity items where applicable (invoices have totals, expenses have amounts). Display as a secondary detail.

### File changes

| File | Change |
|------|--------|
| `src/components/dashboard/RecentActivity.tsx` | Add `link` + `amount` to ActivityItem; make rows clickable with `useNavigate`; always show footer button |

### Technical detail

```typescript
interface ActivityItem {
  action: string;
  reference: string;
  date: string;
  link: string;      // NEW — route path
  amount?: number;    // NEW — optional amount
}
```

Each row gets `onClick={() => navigate(item.link)}` with a cursor-pointer style. Footer button always visible — shows "Show More" when >10 items, otherwise "View All" that could link to a future activity page or just expand.

