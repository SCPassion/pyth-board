import {
  BriefcaseBusiness,
  Building2,
  Image as ImageIcon,
  Info,
  LayoutDashboard,
  Newspaper,
  Wallet,
  TrendingUp,
} from "lucide-react";

export const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/wallets", label: "Wallets", icon: Wallet },
  { href: "/pythenians", label: "Pythenians", icon: ImageIcon },
  { href: "/reserve", label: "DAO Reserve", icon: Building2 },
  { href: "/revenue", label: "Protocol Revenue", icon: BriefcaseBusiness },
  { href: "/growth", label: "Growth", icon: TrendingUp },
  { href: "/news", label: "News", icon: Newspaper },
  { href: "/about", label: "About", icon: Info },
];
