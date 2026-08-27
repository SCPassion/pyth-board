import {
  BriefcaseBusiness,
  Building2,
  Image as ImageIcon,
  LayoutDashboard,
  Newspaper,
  Wallet,
} from "lucide-react";

export const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/wallets", label: "Wallets", icon: Wallet },
  { href: "/pythenians", label: "Pythenians", icon: ImageIcon },
  { href: "/reserve", label: "Reserve", icon: Building2 },
  { href: "/revenue", label: "Revenue", icon: BriefcaseBusiness },
  { href: "/news", label: "News", icon: Newspaper },
];
