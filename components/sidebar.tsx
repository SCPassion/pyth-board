"use client";

import {
  Github,
  LayoutDashboard,
  Wallet,
  Image as ImageIcon,
  Building2,
  ArrowUpRight,
} from "lucide-react";
import { TwitterIcon } from "@/components/icons/twitter-icon";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarProps {
  isMobileMenuOpen: boolean;
  onMobileMenuToggle: () => void;
}

export function Sidebar({
  isMobileMenuOpen,
  onMobileMenuToggle,
}: SidebarProps) {
  const pathname = usePathname();
  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/wallets", label: "Wallets", icon: Wallet },
    { href: "/pythenians", label: "Pythenians", icon: ImageIcon },
    { href: "/reserve", label: "Reserve", icon: Building2 },
  ];

  const isActive = (path: string) => {
    if (path === "/" && pathname === "/") return true;
    if (path !== "/" && pathname.startsWith(path)) return true;
    return false;
  };
  return (
    <>
      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onMobileMenuToggle}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed md:relative inset-y-0 left-0 z-50 flex w-64 md:w-24 flex-col border-r border-white/8 bg-[#241b35] transition-transform duration-300",
          isMobileMenuOpen
            ? "translate-x-0"
            : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="flex h-full flex-col px-4 py-6 md:px-0 md:items-center">
          <div className="mb-8 flex w-full items-center justify-start md:justify-center">
            <div className="relative h-9 w-9 overflow-hidden rounded-2xl bg-[#37294f] ring-1 ring-white/10">
              <Image
                src="/PythLight.svg"
                width={3285}
                height={1120}
                alt="Pyth Network"
                className="h-full w-full object-contain p-1.5"
                priority
              />
            </div>
          </div>
          <nav className="flex flex-col gap-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => onMobileMenuToggle()}
                  className={cn(
                    "group flex h-[52px] w-full items-center gap-3 rounded-2xl px-4 text-sm font-medium text-[#978fb1] transition-colors md:h-10 md:w-10 md:justify-center md:px-0",
                    active
                      ? "bg-[#3a2d48] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                      : "hover:bg-white/5 hover:text-white"
                  )}
                  title={item.label}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="md:hidden">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto w-full space-y-4 md:flex md:flex-col md:items-center md:space-y-3">
            <button
              className="flex w-full items-center justify-between rounded-2xl bg-[#342645] px-4 py-3 text-left text-white ring-1 ring-white/8 transition-colors hover:bg-[#3a2b4d] md:h-10 md:w-10 md:justify-center md:rounded-full md:p-0"
              onClick={() => window.open("https://staking.pyth.network/", "_blank")}
              type="button"
              title="Start Staking"
            >
              <span className="text-sm font-semibold md:hidden">Stake</span>
              <ArrowUpRight className="h-4 w-4 shrink-0" />
            </button>

            <div className="flex items-center gap-3 md:flex-col">
              <button
                className="flex h-10 w-10 items-center justify-center rounded-full text-[#978fb1] transition-colors hover:bg-white/5 hover:text-white"
                onClick={() =>
                  window.open("https://github.com/SCPassion/pyth-board", "_blank")
                }
                type="button"
                title="GitHub"
              >
                <Github className="h-5 w-5" />
                <span className="sr-only">GitHub</span>
              </button>
              <button
                className="flex h-10 w-10 items-center justify-center rounded-full text-[#978fb1] transition-colors hover:bg-white/5 hover:text-white"
                onClick={() => window.open("https://x.com/KaiCryptohk", "_blank")}
                type="button"
                title="Twitter"
              >
                <TwitterIcon className="h-5 w-5" />
                <span className="sr-only">Twitter</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
