# Information Architecture Spec v2 — Adviser Investment Platform

> **Status:** DRAFT — design only, no code changes
> **Date:** 2026-03-16
> **Design System:** IBM Plex Sans, dark slate (#0F172A) base, gold (#F59E0B) accent, glassmorphism cards
> **Chart Library:** Highcharts (primary), with fallback to Recharts for simple widgets

---

## 1. Navigation Structure by Role

### 1.1 Shell Layout

All roles share a common **App Shell**:
- **Collapsible left sidebar** (72px collapsed / 256px expanded)
- **Top bar**: breadcrumbs, search (cmd+K), notifications bell, user avatar + role badge
- **Content area**: max-w-7xl, responsive padding

Role determines which sidebar sections render. SUPER_ADMIN sees all sections.

### 1.2 SUPER_ADMIN Sidebar

| Order | Label | Route | Icon | Type |
|-------|-------|-------|------|------|
| 1 | Platform Dashboard | `/platform` | `LayoutDashboard` | Dashboard |
| 2 | Wealth Groups | `/platform/wealth-groups` | `Building2` | CRUD |
| 3 | Products (Truth) | `/platform/products` | `Package` | CRUD |
| 4 | PM Funds (Truth) | `/platform/pm-funds` | `Landmark` | CRUD + Detail |
| 5 | PM Templates | `/platform/pm-templates` | `FileSpreadsheet` | CRUD |
| 6 | Data Quality | `/platform/data-quality` | `ShieldCheck` | Dashboard |

### 1.3 ADMIN Sidebar (Wealth Group scoped)

| Order | Label | Route | Icon | Type |
|-------|-------|-------|------|------|
| 1 | Governance Dashboard | `/admin` | `LayoutDashboard` | Dashboard |
| — | **Policies** | — | `Settings2` | Group header |
| 2 | › Taxonomy | `/admin/taxonomy` | `GitBranch` | List → Wizard |
| 3 | › Liquidity Defaults | `/admin/liquidity-defaults` | `Droplets` | Form |
| 4 | › CMA | `/admin/cma` | `TrendingUp` | List → Detail |
| 5 | › Stress Scenarios | `/admin/stress-tests` | `Zap` | List → Wizard |
| 6 | Whitelist Funds | `/admin/whitelist` | `ListChecks` | CRUD |
| 7 | Adviser Oversight | `/admin/oversight` | `Users` | Dashboard |

### 1.4 ADVISER Sidebar

| Order | Label | Route | Icon | Type |
|-------|-------|-------|------|------|
| 1 | Adviser Dashboard | `/adviser` | `LayoutDashboard` | Dashboard |
| 2 | Clients | `/adviser/clients` | `Users` | List |
| 3 | Client Overview | `/adviser/clients/[id]` | `UserCircle` | Dashboard (deep) |
| — | **Workflows** | — | `Workflow` | Group header |
| 4 | › SAA Builder | `/adviser/saa` | `PieChart` | List → Wizard |
| 5 | › Rebalance | `/adviser/rebalance` | `Scale` | Wizard |
| 6 | › PM Sleeve | `/adviser/sleeve` | `Layers` | Wizard |

---

## 2. Screen Classification: Dashboard vs Wizard

### Dashboards (read-heavy, charts + KPIs + tables)

| Screen | Role | Key Panels |
|--------|------|------------|
| Platform Dashboard | SUPER_ADMIN | WG count, total AUM, product coverage %, PM fund health, data quality score |
| Data Quality | SUPER_ADMIN | Missing CMA coverage, unmapped products, stale NAVs, validation errors |
| Governance Dashboard | ADMIN | Policy completeness %, adviser activity, drift alerts, pending approvals |
| Adviser Oversight | ADMIN | Per-adviser AUM, client count, drift outliers, rebalance backlog |
| Adviser Dashboard | ADVISER | My AUM, client count, top drift alerts, pending rebalances, PM cash calls due |
| Client Overview | ADVISER | Holdings, allocation vs SAA, drift, liquidity ladder, PM sleeve, expected outcomes |

### Wizards (multi-step, write-heavy, guided flow)

| Wizard | Role | Steps (see §3) |
|--------|------|-----------------|
| Taxonomy Setup | ADMIN | 4 steps |
| Product Mapping | ADMIN | 3 steps |
| SAA Creation | ADVISER | 5 steps |
| Sleeve Setup | ADVISER | 4 steps |
| Stress Scenario Run | ADMIN | 3 steps |
| Rebalance Workflow | ADVISER | 4 steps |

### Wizard UX Pattern

All wizards share a consistent shell:
```
┌─────────────────────────────────────────────────┐
│  [Step 1]───[Step 2]───[Step 3]───[Step 4]      │  ← Stepper bar (clickable if valid)
│                                                   │
│  Step Title                                       │
│  Step description text                            │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  Form / table / interactive content          │ │  ← Glass card
│  │                                              │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  [← Back]                        [Next →]        │  ← Sticky footer
│                                   [Save Draft]   │
└─────────────────────────────────────────────────┘
```

- Each step validates before allowing forward navigation
- Draft persistence via server action (saves incomplete state to DB)
- Final step always shows a **Review Summary** before confirm

---

## 3. Wizard Specifications

### 3.1 Taxonomy Setup (ADMIN)

| Step | Title | Data Required | Validation |
|------|-------|---------------|------------|
| 1 | Name & Structure | Name, description, base currency | Name unique within WG |
| 2 | Build Tree | Asset class nodes (drag-to-reorder tree editor) | Min 2 top-level nodes; no orphans |
| 3 | Liquidity Defaults | Per-node: liquidity tier, notice period, redemption frequency | Every leaf node must have a tier |
| 4 | Review & Activate | Read-only summary; toggle active/draft | At least 1 leaf node exists |

**Persisted as:** `Taxonomy` + `TaxonomyNode` + `LiquidityDefault` records.

### 3.2 Product Mapping (ADMIN)

| Step | Title | Data Required | Validation |
|------|-------|---------------|------------|
| 1 | Select Taxonomy | Pick active taxonomy | Taxonomy must be active |
| 2 | Map Products | For each product: assign to taxonomy leaf node; confirm fund type (direct/fund-of-funds) | Every whitelisted product mapped to exactly 1 node |
| 3 | Review & Confirm | Summary table: product → node → liquidity tier | No unmapped products |

**Persisted as:** `ProductTaxonomyMapping` records.

### 3.3 SAA Creation + Tolerances + Assign (ADVISER)

| Step | Title | Data Required | Validation |
|------|-------|---------------|------------|
| 1 | Name & Taxonomy | SAA name, select taxonomy, risk profile label | Name unique per adviser |
| 2 | Set Target Allocations | Per taxonomy node: target % | Sum = 100% at each tree level |
| 3 | Set Tolerances | Per node: min %, max % (or ± band) | min ≤ target ≤ max; bands non-negative |
| 4 | Assign to Clients | Multi-select clients; optional effective date | At least 1 client selected |
| 5 | Review & Activate | Summary: allocation pie, tolerance bands table, assigned clients | — |

**Persisted as:** `SAA` + `SAAAllocation` + `ClientSAA` records.

### 3.4 Sleeve Setup (ADVISER)

| Step | Title | Data Required | Validation |
|------|-------|---------------|------------|
| 1 | Configure Liquid Bucket | Target cash buffer %, min buffer %, rebalance trigger | Buffer min ≤ target; trigger > 0 |
| 2 | Select PM Funds | Pick from whitelist; set commitment amount per fund | At least 1 fund; commitment > 0 |
| 3 | Waterfall Rules | Buy waterfall (priority order of liquid funds to sell); Sell waterfall (priority to buy on distribution) | At least 1 entry in each waterfall |
| 4 | Review & Activate | Timeline projection, buffer adequacy check, waterfall summary | Buffer covers next 12m calls (warning if not) |

**Persisted as:** `SleeveConfig` + `SleeveCommitment` + `WaterfallRule` records.

### 3.5 Stress Scenario Run (ADMIN)

| Step | Title | Data Required | Validation |
|------|-------|---------------|------------|
| 1 | Select Scenario | Pick existing scenario or create new (name + shock vector per asset class) | All taxonomy nodes have a shock value |
| 2 | Run & Review | Select scope (all clients / specific clients); execute stress calc | At least 1 client in scope |
| 3 | Results & Export | Heatmap of impact; ranked losers table; export CSV/PDF | — |

**Persisted as:** `StressScenario` + `StressResult` records.

### 3.6 Rebalance: Generate → Approve → Simulate Execute (ADVISER)

| Step | Title | Data Required | Validation |
|------|-------|---------------|------------|
| 1 | Generate Plan | Select client; system auto-generates trades from drift vs SAA | Client has active SAA + holdings |
| 2 | Review Trades | Trade list: product, direction (buy/sell), units, $ amount, impact on allocation | At least 1 trade |
| 3 | Approve / Reject | Approve (with optional notes) or reject with reason | Rejection requires reason text |
| 4 | Simulate Execution | Confirm; system updates holdings (simulated); generate trade confirmation CSV | Only if status = APPROVED |

**Persisted as:** `RebalancePlan` + `RebalanceTrade` records; status transitions: DRAFT → APPROVED → EXECUTED (or REJECTED).

---

## 4. Dashboard Chart Specifications (Highcharts)

### 4.1 Platform Dashboard (SUPER_ADMIN)

| Panel | Chart Type | Highcharts Module | Data Source |
|-------|-----------|-------------------|-------------|
| AUM by Wealth Group | Treemap | `highcharts/modules/treemap` | Aggregated holdings |
| Product Coverage | Gauge (solid) | `highcharts/modules/solid-gauge` | Mapped vs total products |
| PM Fund Health | Grouped bar (NAV trend + call schedule) | Core | PM fund truth layer |
| Data Quality Score | Bullet chart | `highcharts/modules/bullet` | Validation rule pass rates |
| Onboarding Funnel | Horizontal bar | Core | WG setup completion |

### 4.2 Governance Dashboard (ADMIN)

| Panel | Chart Type | Highcharts Module | Data Source |
|-------|-----------|-------------------|-------------|
| Policy Completeness | Radial bar (4 segments: Taxonomy, CMA, Stress, Liquidity) | `highcharts/modules/solid-gauge` | Config status |
| Drift Alert Distribution | Histogram (bands: green/amber/red) | Core | All clients drift |
| Pending Approvals | KPI cards (number badges) | — (HTML) | Rebalance plans |
| Adviser Activity | Heatmap (adviser × week) | `highcharts/modules/heatmap` | Login + action log |
| AUM Over Time | Area chart (stacked by adviser) | Core | Monthly snapshots |

### 4.3 Adviser Dashboard (ADVISER)

| Panel | Chart Type | Highcharts Module | Data Source |
|-------|-----------|-------------------|-------------|
| My AUM | KPI card + sparkline | Core | Holdings sum |
| Client Drift Summary | Bar chart with tolerance bands (overlay lines for min/max) | Core | Client drift calcs |
| Upcoming PM Calls | Timeline / Gantt-lite | `highcharts/modules/gantt` | Sleeve commitments |
| Rebalance Backlog | Stacked bar (by status: draft/approved/executed) | Core | Rebalance plans |
| Top Movers | Ranked horizontal bar (biggest allocation changes this month) | Core | Holdings delta |

### 4.4 Client Overview (ADVISER)

| Panel | Chart Type | Highcharts Module | Data Source |
|-------|-----------|-------------------|-------------|
| Current Allocation | Donut chart (outer ring = asset class, inner = sub-class) | Core | Holdings + taxonomy |
| Allocation vs SAA | Grouped bar (current % vs target %) | Core | Holdings + SAA |
| Drift | Bar chart with tolerance band overlay (min/max lines) | Core | Drift calc |
| Liquidity Ladder | Stacked bar by time horizon (0-7d, 7-30d, 30-90d, 90-365d, 365d+) | Core | Liquidity profiles |
| PM Projections | Dual-axis area chart (capital calls down, distributions up) | Core | PM curves + commitments |
| Stress Results | Heatmap (scenario × asset class → % loss) | `highcharts/modules/heatmap` | Stress calc |
| Expected Outcomes | Fan chart (median + P10/P90 bands) at 1/5/10yr | `highcharts/modules/arearange` | CMA Monte Carlo |

### 4.5 Adviser Oversight (ADMIN)

| Panel | Chart Type | Highcharts Module | Data Source |
|-------|-----------|-------------------|-------------|
| AUM per Adviser | Horizontal bar (sorted desc) | Core | Holdings by adviser |
| Client Count | Table with inline sparklines | Core | Client list |
| Worst Drift by Adviser | Grouped bar (top 5 worst drifting clients per adviser) | Core | Drift |
| Rebalance Compliance | Donut (% on-time vs overdue) | Core | Rebalance log |

---

## 5. Route Map (New vs Existing)

### Colour key: `[NEW]` `[MOVE]` `[KEEP]` `[DEPRECATE]`

```
/                                [KEEP]   Landing / redirect
/login                           [KEEP]   Auth

── SUPER_ADMIN ──────────────────────────────────────────
/platform                        [NEW]    Platform Dashboard
/platform/wealth-groups          [KEEP]   Wealth Group CRUD
/platform/products               [NEW]    Products truth layer (was /admin/products)
/platform/pm-funds               [KEEP]   PM Fund truth CRUD
/platform/pm-funds/[id]          [KEEP]   PM Fund detail
/platform/pm-funds/new           [KEEP]   Create PM Fund
/platform/pm-templates           [KEEP]   PM projection templates
/platform/data-quality           [NEW]    Data Quality dashboard

── ADMIN (Wealth Group) ─────────────────────────────────
/admin                           [NEW]    Governance Dashboard (replaces /dashboard for ADMIN)
/admin/taxonomy                  [KEEP]   Taxonomy list
/admin/taxonomy/new              [MOVE]   → Wizard (rewrite as multi-step)
/admin/taxonomy/[id]             [KEEP]   Taxonomy detail
/admin/taxonomy/[id]/mapping     [MOVE]   → Wizard step in Product Mapping wizard
/admin/liquidity-defaults        [NEW]    Liquidity defaults (was nested under taxonomy)
/admin/cma                       [KEEP]   CMA list
/admin/cma/[id]                  [KEEP]   CMA detail + correlation editor
/admin/stress-tests              [KEEP]   Stress scenario list
/admin/stress-tests/run          [NEW]    Stress Run wizard
/admin/whitelist                 [NEW]    Fund whitelist (was /admin/pm-funds, rename for clarity)
/admin/oversight                 [NEW]    Adviser Oversight dashboard

── ADVISER ──────────────────────────────────────────────
/adviser                         [NEW]    Adviser Dashboard (replaces /dashboard for ADVISER)
/adviser/clients                 [MOVE]   Client list (was /clients)
/adviser/clients/[id]            [MOVE]   Client Overview (was /clients/[id])
/adviser/saa                     [KEEP]   SAA list
/adviser/saa/new                 [MOVE]   → Wizard (rewrite as 5-step)
/adviser/saa/[id]                [KEEP]   SAA detail / edit allocations
/adviser/rebalance               [NEW]    Rebalance entry (select client → wizard)
/adviser/rebalance/[planId]      [NEW]    Rebalance wizard (steps 2-4)
/adviser/sleeve                  [NEW]    Sleeve setup entry
/adviser/sleeve/[clientId]       [NEW]    Sleeve wizard for client

── DEPRECATED ───────────────────────────────────────────
/dashboard                       [DEPRECATE]  → redirect based on role
/clients                         [DEPRECATE]  → /adviser/clients
/clients/[id]                    [DEPRECATE]  → /adviser/clients/[id]
/admin/products                  [DEPRECATE]  → /platform/products
/admin/pm-funds                  [DEPRECATE]  → /admin/whitelist
/admin/governance                [DEPRECATE]  → /admin (governance dashboard)
```

---

## 6. Phased Rollout Plan

### Phase 0 — Foundation (no user-facing changes)
- [ ] Create shared `<AppShell>` layout component (sidebar + topbar)
- [ ] Create `<WizardShell>` component (stepper, footer, draft persistence)
- [ ] Install Highcharts + `highcharts-react-official`
- [ ] Add role-based sidebar config (JSON-driven nav items per role)
- [ ] Add redirect middleware: `/dashboard` → role-appropriate home

### Phase 1 — SUPER_ADMIN Navigation
- [ ] Build `/platform` dashboard (KPI cards + treemap + gauge)
- [ ] Move Products from `/admin/products` → `/platform/products`
- [ ] Build `/platform/data-quality` dashboard
- [ ] Sidebar renders for SUPER_ADMIN

### Phase 2 — ADMIN Navigation + Wizards
- [ ] Build `/admin` governance dashboard
- [ ] Rewrite taxonomy creation as 4-step wizard
- [ ] Build product mapping wizard (3 steps)
- [ ] Build `/admin/whitelist` (rename from pm-funds)
- [ ] Build `/admin/oversight` dashboard
- [ ] Build stress-test run wizard
- [ ] Sidebar renders for ADMIN

### Phase 3 — ADVISER Navigation + Wizards
- [ ] Build `/adviser` dashboard
- [ ] Move `/clients` → `/adviser/clients` (add redirects)
- [ ] Rewrite SAA creation as 5-step wizard
- [ ] Build rebalance wizard (4 steps)
- [ ] Build sleeve wizard (4 steps)
- [ ] Add Highcharts to Client Overview (allocation donut, drift bars, liquidity ladder, PM area, stress heatmap, fan chart)
- [ ] Sidebar renders for ADVISER

### Phase 4 — Polish + Deprecation
- [ ] Remove old `/dashboard` grid (redirect only)
- [ ] Remove deprecated routes (add permanent redirects)
- [ ] Add `cmd+K` quick nav search
- [ ] Add notification system (drift alerts, approval requests)
- [ ] Responsive sidebar (mobile: bottom tab bar with 4 key items)
- [ ] Accessibility audit (focus management in wizards, chart alt-text tables)

---

## 7. Design Tokens (for implementation)

```
Font Family:     'IBM Plex Sans', system-ui, sans-serif
Background:      #0F172A (slate-900)
Surface:         rgba(255,255,255,0.05) + backdrop-blur-xl
Card Border:     1px solid rgba(255,255,255,0.1)
Primary Accent:  #F59E0B (amber-500) — gold/trust
CTA / Action:    #8B5CF6 (violet-500)
Success:         #10B981 (emerald-500)
Warning:         #F59E0B (amber-500)
Danger:          #EF4444 (red-500)
Text Primary:    #F8FAFC (slate-50)
Text Muted:      #94A3B8 (slate-400)
Sidebar Width:   256px expanded / 72px collapsed
Content Max:     max-w-7xl (1280px)
Border Radius:   12px cards, 8px inputs, 6px buttons
```

---

## 8. Key Design Decisions

1. **Sidebar over top-nav**: Financial platforms need persistent navigation with deep hierarchies. Collapsible sidebar gives screen real estate for data tables.

2. **Wizards over inline forms**: Multi-step processes (SAA, rebalance, sleeve) involve dependent data and validation gates. Wizards prevent partial saves and guide users through complex workflows.

3. **Highcharts over Recharts**: Highcharts has superior financial chart types (fan charts, heatmaps, Gantt) and better performance with large datasets. Recharts is simpler but lacks arearange/heatmap modules.

4. **Role-scoped sidebars over a single mega-nav**: Each role sees only their domain. SUPER_ADMIN can switch context via a role-switcher dropdown if they need to impersonate ADMIN/ADVISER views.

5. **Draft persistence in wizards**: All wizard state saves to DB on each step transition, not just on final submit. Users can resume incomplete workflows across sessions.

6. **Redirect-based deprecation**: Old routes redirect to new locations (HTTP 308). No breaking changes for bookmarks or shared links during rollout.
