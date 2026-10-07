import {
  BarChart3,
  CalendarClock,
  ChartPie,
  CreditCard,
  FileSpreadsheet,
  Gauge,
  Heart,
  House,
  Landmark,
  LayoutGrid,
  LineChart,
  type LucideIcon,
  ReceiptText,
  Repeat,
  Scale,
  Settings,
  Shapes,
  Wallet,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Other path prefixes that should highlight this item. */
  matches?: string[];
}

export interface PlanItem extends NavItem {
  description: string;
  section: PlanSection;
}

export const PLAN_SECTIONS = ["This month", "Money", "Plans", "Setup"] as const;
export type PlanSection = (typeof PLAN_SECTIONS)[number];

/** Everything reachable from the Plan tab (also listed in the desktop sidebar). */
export const PLAN_ITEMS: PlanItem[] = [
  { href: "/analytics", label: "Analytics & insights", icon: BarChart3, description: "Trends, breakdowns, patterns", section: "This month" },
  { href: "/summary", label: "Monthly summary", icon: ChartPie, description: "Income, spending, savings rate", section: "This month" },
  { href: "/budgets", label: "Budgets", icon: Gauge, description: "Monthly and category limits", section: "This month" },
  { href: "/upcoming", label: "Upcoming", icon: CalendarClock, description: "Bills, EMIs and income due soon", section: "This month" },
  { href: "/accounts", label: "Accounts & cards", icon: CreditCard, description: "Balances, transfers, card bills", section: "Money" },
  { href: "/investments", label: "Investments", icon: LineChart, description: "Funds, stocks, FDs, gold, crypto", section: "Money" },
  { href: "/net-worth", label: "Net worth", icon: Scale, description: "What you own minus what you owe", section: "Money" },
  { href: "/income", label: "Income & salary", icon: Wallet, description: "Salary, freelance, recurring", section: "Plans" },
  { href: "/recurring", label: "Recurring payments", icon: Repeat, description: "Rent, subscriptions, insurance", section: "Plans" },
  { href: "/emis", label: "EMIs", icon: Landmark, description: "Loans, due dates, balances", section: "Plans" },
  { href: "/wishlist", label: "Wishlist", icon: Heart, description: "Save towards things you want", section: "Plans" },
  { href: "/categories", label: "Categories", icon: Shapes, description: "Built-in and your own", section: "Setup" },
  { href: "/data", label: "Import & export", icon: FileSpreadsheet, description: "CSV import with preview, exports", section: "Setup" },
];

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: House },
  { href: "/expenses", label: "History", icon: ReceiptText },
  { href: "/plan", label: "Plan", icon: LayoutGrid, matches: PLAN_ITEMS.map((i) => i.href) },
  { href: "/settings", label: "Settings", icon: Settings },
];

function matchesPath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isActive(pathname: string, item: Pick<NavItem, "href" | "matches"> | string): boolean {
  if (typeof item === "string") return matchesPath(pathname, item);
  return matchesPath(pathname, item.href) || (item.matches ?? []).some((m) => matchesPath(pathname, m));
}
