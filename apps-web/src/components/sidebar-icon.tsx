"use client";

import {
  LayoutDashboard,
  Building2,
  Package,
  Landmark,
  FileSpreadsheet,
  ShieldCheck,
  Settings2,
  GitBranch,
  Droplets,
  TrendingUp,
  Zap,
  ListChecks,
  Users,
  PieChart,
  Scale,
  Layers,
  Workflow,
  type LucideProps,
} from "lucide-react";

const iconMap: Record<string, React.FC<LucideProps>> = {
  LayoutDashboard,
  Building2,
  Package,
  Landmark,
  FileSpreadsheet,
  ShieldCheck,
  Settings2,
  GitBranch,
  Droplets,
  TrendingUp,
  Zap,
  ListChecks,
  Users,
  PieChart,
  Scale,
  Layers,
  Workflow,
};

export function SidebarIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = iconMap[name];
  if (!Icon) return null;
  return <Icon {...props} />;
}
