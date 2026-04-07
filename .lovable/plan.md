

## Prettify Dashboard UI

### Changes — `src/pages/Index.tsx` and `src/index.css` only

**1. Summary cards — enhanced visual polish**

- Add a subtle colored left border accent per card type (using the existing `iconBg` color map) instead of the generic top gradient strip
- Increase icon size slightly and add a soft background glow effect
- Make the value text larger (`text-2xl`) with better font weight hierarchy
- Add a subtle "sparkle" micro-animation on hover (scale up icon slightly)
- Show a thin colored top bar matching each card's category color (sales=blue, purchases=orange, cash=green, etc.)

**2. Header area — more presence**

- Add a greeting line based on time of day ("Good morning", etc.)
- Style the business unit selector with a subtle icon prefix

**3. Card grid — better responsive layout**

- Change from `xl:grid-cols-7` (too cramped) to `xl:grid-cols-4` with cards wrapping naturally
- Add slightly more gap (`gap-5`)

**4. Section cards — visual consistency**

- Add colored top accent bars to the Top Selling, Top Customers, Recent Activity, Inactive Products, Low Stock, and Overdue cards matching the project's pastel tint convention (from the visual identity memory)
- Slightly increase card border radius and shadow depth

**5. CSS enhancements in `index.css`**

- Update `.stat-card` to use a colored left border instead of top gradient
- Add `.stat-card-accent-sales`, `.stat-card-accent-purchases`, etc. modifier classes for per-category left border colors
- Add hover scale micro-interaction (`transform: scale(1.02)`)
- Add more stagger delays (6, 7) for the expanded card count

### Files changed

| File | Changes |
|---|---|
| `src/pages/Index.tsx` | Card grid layout, greeting text, per-card accent class, larger values |
| `src/index.css` | Updated stat-card styles, accent color modifiers, hover scale, extra stagger utilities |

### No database or logic changes. All existing functionality preserved.

