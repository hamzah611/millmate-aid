

## Boost Color Contrast & Visibility

### Problem
Borders, cards, and muted elements blend together — especially in light mode where `--border` is at 91% lightness and `--muted` at 96%, making boxes nearly invisible.

### Changes (single file: `src/index.css`)

**Light mode (`:root`):**
- `--border`: `220 13% 91%` → `220 15% 84%` (darker borders, visible card edges)
- `--input`: match new border value
- `--muted`: `220 14% 96%` → `220 14% 93%` (slightly more visible backgrounds)
- `--muted-foreground`: `220 10% 46%` → `220 12% 38%` (darker secondary text)
- `--primary`: `220 60% 50%` → `220 70% 48%` (more saturated blue)
- `--secondary`: `220 14% 96%` → `220 16% 93%`
- `--accent`: `220 14% 96%` → `220 16% 93%`
- `--sidebar-border`: match new border
- `--sidebar-accent`: match new accent
- Card shadow in `.stat-card` and `.table-card`: bump shadow opacity slightly

**Dark mode (`.dark`):**
- `--border`: `222 16% 18%` → `222 18% 22%` (brighter borders)
- `--input`: match
- `--muted`: `220 16% 14%` → `220 16% 16%`
- `--muted-foreground`: `220 12% 56%` → `220 14% 62%` (brighter secondary text)
- `--card`: `222 24% 10%` → `222 24% 12%` (slightly lifted cards)
- `--sidebar-border`: match new border
- `--primary`: `220 65% 62%` → `220 70% 65%` (punchier blue)

**Component layer tweaks:**
- `.stat-card`: add `ring-1 ring-border` for a subtle outline reinforcement
- `.table-card`: same ring treatment

All changes are CSS variable tweaks — no component files modified.

