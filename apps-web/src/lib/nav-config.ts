/**
 * Role-scoped sidebar navigation configuration.
 * Icon names reference lucide-react icon component names.
 */

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  /** If true, this item is a non-clickable group header */
  isGroup?: boolean;
  /** Indent level (0 = top, 1 = nested under group) */
  indent?: number;
}

export const SUPER_ADMIN_NAV: NavItem[] = [
  { label: "Platform Dashboard", href: "/platform", icon: "LayoutDashboard" },
  { label: "Wealth Groups", href: "/platform/wealth-groups", icon: "Building2" },
  { label: "Products (Truth)", href: "/platform/products", icon: "Package" },
  { label: "PM Funds (Truth)", href: "/platform/pm-funds", icon: "Landmark" },
  { label: "PM Templates", href: "/platform/pm-templates", icon: "FileSpreadsheet" },
  { label: "Data Quality", href: "/platform/data-quality", icon: "ShieldCheck" },
];

export const ADMIN_NAV: NavItem[] = [
  { label: "Governance Dashboard", href: "/admin", icon: "LayoutDashboard" },
  { label: "Policies", href: "", icon: "Settings2", isGroup: true },
  { label: "Taxonomy", href: "/admin/taxonomy", icon: "GitBranch", indent: 1 },
  { label: "Liquidity Defaults", href: "/admin/liquidity-defaults", icon: "Droplets", indent: 1 },
  { label: "CMA", href: "/admin/cma", icon: "TrendingUp", indent: 1 },
  { label: "Stress Scenarios", href: "/admin/stress-tests", icon: "Zap", indent: 1 },
  { label: "Whitelist Funds", href: "/admin/whitelist", icon: "ListChecks" },
  { label: "Adviser Oversight", href: "/admin/oversight", icon: "Users" },
];

export const ADVISER_NAV: NavItem[] = [
  { label: "Adviser Dashboard", href: "/adviser", icon: "LayoutDashboard" },
  { label: "Clients", href: "/adviser/clients", icon: "Users" },
  { label: "Workflows", href: "", icon: "Workflow", isGroup: true },
  { label: "SAA Builder", href: "/adviser/saa", icon: "PieChart", indent: 1 },
  { label: "Rebalance", href: "/adviser/rebalance", icon: "Scale", indent: 1 },
  { label: "PM Sleeve", href: "/adviser/sleeve", icon: "Layers", indent: 1 },
];

/** Get the nav config for a given role */
export function getNavForRole(role: string): NavItem[] {
  switch (role) {
    case "SUPER_ADMIN":
      return SUPER_ADMIN_NAV;
    case "ADMIN":
      return ADMIN_NAV;
    case "ADVISER":
      return ADVISER_NAV;
    default:
      return ADVISER_NAV;
  }
}

/** Get the home route for a role (used by /dashboard redirect) */
export function getHomeRoute(role: string): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/platform";
    case "ADMIN":
      return "/admin";
    case "ADVISER":
      return "/adviser";
    default:
      return "/adviser";
  }
}
