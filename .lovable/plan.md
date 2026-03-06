

# Design Modernization Plan

## Current State
The app uses a basic card/table layout with minimal visual hierarchy, no gradient accents, plain headers, and utilitarian styling throughout. The dashboard summary cards are flat and monotone. Tables lack visual polish. The sidebar and header are plain.

## Design Direction
Modern business SaaS aesthetic: subtle gradients on key cards, better spacing and typography hierarchy, softer shadows, rounded elements, icon backgrounds with color coding, improved table row styling, and a polished sidebar with a branded header area.

## Changes

### 1. CSS Variables & Global Styles (`src/index.css`)
- Refine shadow variables to be softer and more layered
- Add subtle gradient utility classes (`.gradient-card`, `.glass-card`)
- Add hover transition utilities for cards
- Improve table row hover styling globally

### 2. Dashboard (`src/pages/Index.tsx`)
- Summary cards: Add colored icon backgrounds (small rounded circle behind each icon), use gradient top-border accent per card type
- Better page header with subtitle text ("Welcome back" / greeting)
- Add `animate-fade-in` to card grid with staggered delays
- Space the grid sections with better visual separation (dividers or section headers)

### 3. Sidebar (`src/components/AppSidebar.tsx`)
- Add a branded header area with the Wheat icon, app title, and a subtle gradient or colored background
- Improve active nav item styling: left border accent + background tint instead of flat muted bg
- Add subtle hover transitions on nav items
- Style the footer buttons with more polish

### 4. App Header (`src/components/AppLayout.tsx`)
- Add a subtle bottom shadow instead of just border
- Improve search button styling with a more modern pill shape
- Add user greeting text or breadcrumb area

### 5. List Pages (Products, Contacts, Sales, Purchases, Expenses)
- Page headers: use a flex layout with icon + title + count badge
- Search input: pill-shaped with subtle background
- Table cards: add `overflow-hidden` with rounded corners, remove inner padding inconsistencies
- Table header row: use a slightly tinted background (`bg-muted/30`)
- Table rows: improve hover state with smooth transition
- Action buttons: use a more visible but still subtle styling
- Status badges: use colored dot indicators + text instead of just background color

### 6. Dashboard Cards (TopSellingProducts, TopCustomers, RecentActivity, InactiveProducts)
- Add subtle colored left border accent per card type
- Improve list item styling with alternating subtle backgrounds
- Add small colored dots/indicators next to list items
- Better spacing in card headers with icon backgrounds

### 7. Notification Panel (`src/components/NotificationPanel.tsx`)
- Add a header with gradient accent
- Improve notification items with left-side colored bar indicators
- Better hover states and transitions

### 8. Auth Page (`src/pages/Auth.tsx`)
- Add a subtle background pattern or gradient
- Card: add more shadow depth, slightly larger border radius
- Input fields: larger with more padding
- Button: add gradient or more prominent styling
- Add a subtle decorative element (brand color accent line)

### 9. Loading Skeletons (`src/components/ui/loading-skeletons.tsx`)
- Match new card styling with rounded corners and shadows

### 10. Badge Component Enhancement
- Add colored dot variant for status indicators (green dot for paid, amber for partial, red for credit)

## Files to Modify
1. `src/index.css` — utility classes, transitions, refined variables
2. `src/pages/Index.tsx` — dashboard layout and card styling  
3. `src/components/AppSidebar.tsx` — branded header, improved nav
4. `src/components/AppLayout.tsx` — header polish
5. `src/pages/Products.tsx` — table and header modernization
6. `src/pages/Contacts.tsx` — same pattern
7. `src/pages/Sales.tsx` — same pattern
8. `src/pages/Purchases.tsx` — same pattern
9. `src/pages/Expenses.tsx` — same pattern
10. `src/pages/Auth.tsx` — login page polish
11. `src/components/dashboard/TopSellingProducts.tsx` — card accent
12. `src/components/dashboard/TopCustomers.tsx` — card accent
13. `src/components/dashboard/RecentActivity.tsx` — card accent
14. `src/components/dashboard/InactiveProducts.tsx` — card accent
15. `src/components/NotificationPanel.tsx` — panel polish
16. `src/components/GlobalSearch.tsx` — search button style
17. `src/components/ui/loading-skeletons.tsx` — match new style

No database changes needed. Pure frontend styling update.

