# Plan: Design Polish — Typography, Colors & Minimal Icons

## Context
The app is functionally complete. The user wants a visual refinement pass: keep the white/silver backgrounds but improve text legibility and hierarchy, and replace all emoji icons (nav, rows, functional) with clean minimalist SVG line icons. No layout or data changes.

---

## 1. Install lucide-react

Lucide is a clean, consistent icon library already popular in Vite/React projects. Install it once:

```
pnpm add lucide-react
```

Icons to use (all `size={18}` or `size={16}` unless noted):

| Replaces | Lucide component |
|---|---|
| Nav: ⊹ Inicio | `<Home />` |
| Nav: 📥 Por Cobrar | `<ArrowDownCircle />` |
| Nav: 📤 Por Pagar | `<ArrowUpCircle />` |
| Nav: 📊 Reporte | `<BarChart2 />` |
| Nav: 🏦 Ahorro | `<PiggyBank />` |
| Nav: ◈ Cuenta | `<User />` |
| Row: income ↑ | `<TrendingUp />` |
| Row: expense ↓ | `<TrendingDown />` |
| Row: pending cobrar 📥 | `<ArrowDownCircle />` |
| Row: pending hacer 📤 | `<ArrowUpCircle />` |
| Row: saving 🏦 | `<PiggyBank />` |
| Recurring 🔄 | `<RefreshCw />` |
| Method: card 💳 | `<CreditCard />` |
| Method: cash 💵 | `<Banknote />` |
| Reminder 🔔 | `<Bell />` |
| Urgent ⚠ | `<AlertCircle />` |
| Delete × | `<X />` |
| Mark paid ✓ | `<Check />` |
| Cuenta stats icons | `<RefreshCw />` `<ArrowUpCircle />` `<ArrowDownCircle />` `<PiggyBank />` `<BarChart2 />` |

Tag emojis (💼🛒🏠 etc.) → keep as-is; they're content labels, not UI chrome.

---

## 2. Typography Improvements

### Scale (apply via inline styles, no config change needed)

| Role | Current | Updated |
|---|---|---|
| Eyebrow label | 11px / `#9ca3af` / 500 | 11px / `#b0b7c3` / 600 / ls 0.08em |
| Row description | 14px / `#111827` / 500 | 14px / `#1a1d27` / 500 |
| Row meta (tag · method) | 12px / `#9ca3af` | 12px / `#a0a6b4` |
| Screen heading | 22px / 700 | 24px / 700 / `#0f1117` |
| Card section label | 13px / 600 | 13px / 600 / `#374151` |
| Amount (DM Mono, large) | 28px / 500 | 28px / 600 |
| Modal title | 17px / 700 | 18px / 700 |
| Input placeholder color | browser default | `#c4c9d4` |

### Text color pass
- Primary text: `#111827` → `#0f1117` (slightly richer black)
- Secondary text: `#6b7280` → `#68717f`
- Muted/placeholder: `#9ca3af` → `#a8b0bf`
- Nav label (inactive): `#9ca3af` → `#a8b0bf`
- Nav label (active): `#111827` → accent color of that tab

---

## 3. Color & Contrast Refinements

### Nav bar
- Background: `#fff` with top border `1px solid #eef0f4` (subtle separator instead of just shadow)
- Active icon: colored (green/indigo/amber/etc per tab), inactive: `#b8bfc9`
- Active label: colored, inactive: `#a8b0bf`

### Cards
- Border: `#eef0f4` (slightly cooler, less yellow than current `#f3f4f6`)
- Shadow: keep `sh` constant as-is (already subtle)

### Row icons (the circle behind the lucide icon)
- Make all icon circles `40×40`, `borderRadius: 12` consistently
- Income row: bg `#e8faf3`, icon color `#10b981`
- Expense row: bg `#fef0f0`, icon color `#ef4444`
- Cobrar row: bg `#fef9e7`, icon color `#f59e0b`
- Hacer row: bg `#eef2ff`, icon color `#6366f1`
- Saving row: bg `#fef9e7`, icon color `#f59e0b`
- Recurring row (hacer): bg `#eef2ff`, icon color `#6366f1`
- Recurring row (cobrar): bg `#fef9e7`, icon color `#f59e0b`

### Buttons
- Primary CTA buttons: keep accent colors (green gradient, red gradient, indigo, amber)
- Add `fontFamily: 'Outfit, sans-serif'` explicitly (already in CSS but reinforce)
- Remove any buttons that still use old gray (`#f3f4f6` bg + `#374151` text) → replace with a clean outlined style: `border: 1.5px solid #e5e7eb`, bg transparent, color `#374151`

---

## 4. Files to Modify

### `src/App.tsx` — primary file
Changes span the entire file but follow a simple pattern:
1. Add `import { Home, ArrowDownCircle, ArrowUpCircle, BarChart2, PiggyBank, User, TrendingUp, TrendingDown, RefreshCw, CreditCard, Banknote, Bell, AlertCircle, X, Check } from 'lucide-react'` at top
2. Replace emoji in NAV array icon strings with `<Component />` JSX (or render them in the nav render section)
3. In `TxRow`: replace emoji circle with Lucide icon circle
4. In `PendingRow`: replace 📤/📥 with `<ArrowUpCircle>`/`<ArrowDownCircle>`
5. In `SavingRow`: replace 🏦 with `<PiggyBank>`
6. Recurring row icons: `🔄` → `<RefreshCw>`
7. Modal method buttons: `💳` / `💵` → `<CreditCard>` / `<Banknote>`
8. Reminder field: `🔔` → `<Bell>`
9. Urgent warning: `⚠` → `<AlertCircle>`
10. Delete buttons `×` → `<X size={14} />`
11. Mark-paid button `✓` → `<Check size={14} />`
12. Modal income/expense icon: `↑`/`↓` → `<TrendingUp>`/`<TrendingDown>`
13. Nav render: change icon field from emoji string to Lucide JSX element, update active/inactive colors
14. Typography tweaks: update font sizes/weights/colors per table above throughout all screens and modals
15. Consistent icon circles: 40×40, borderRadius 12, per color table

### `src/index.css`
- Add `::placeholder { color: #c4c9d4; }` for cleaner input placeholder tones

---

## 5. Verification

1. Open the app preview — all 6 tabs should render without errors
2. Check nav bar: clean line icons, colored when active, gray when inactive
3. Check each tab screen for icon circles, typography, and colors
4. Open all 4 modals (add income, add expense, add pending, add saving/category) — icons replace emojis correctly, method buttons show card/cash icons
5. Add a transaction and verify the row icon renders correctly
6. Check recurring sections in Por Cobrar and Por Pagar — `<RefreshCw>` icon
