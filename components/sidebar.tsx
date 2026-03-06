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
          className="md:hidden fixed inset-0 bg-black/65 backdrop-blur-[2px] z-40"
          onClick={onMobileMenuToggle}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed md:relative inset-y-0 left-0 z-50 flex w-56 flex-col border-r border-white/8 bg-[#241b35] transition-transform duration-300",
          isMobileMenuOpen
            ? "translate-x-0"
            : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="flex h-full flex-col px-3 py-6 md:px-4">
          <div className="mb-8 flex items-center px-4">
            <Image
              src="/PythLight.svg"
              width={3285}
              height={1120}
              alt="Pyth Network"
              className="h-9 w-auto object-contain"
              priority
            />
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
                    "group flex h-[52px] w-full items-center justify-start gap-3 rounded-2xl px-4 text-sm font-medium text-[#978fb1] transition-colors",
                    active
                      ? "bg-[#3a2d48] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                      : "hover:bg-white/5 hover:text-white",
                  )}
                  title={item.label}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto w-full space-y-4 md:space-y-3">
            <button
              className="flex w-full items-center justify-between rounded-2xl bg-[#342645] px-4 py-3 text-left text-white ring-1 ring-white/8 transition-colors hover:bg-[#3a2b4d]"
              onClick={() =>
                window.open("https://staking.pyth.network/", "_blank")
              }
              type="button"
              title="Start Staking"
            >
              <span className="text-sm font-semibold">Start Staking</span>
              <ArrowUpRight className="h-4 w-4 shrink-0" />
            </button>

            <div className="flex flex-row items-center justify-between gap-2">
              <button
                className="flex h-10 w-10 items-center justify-center rounded-full text-[#978fb1] transition-colors hover:bg-white/5 hover:text-white"
                onClick={() =>
                  window.open(
                    "https://github.com/SCPassion/pyth-board",
                    "_blank",
                  )
                }
                type="button"
                title="GitHub"
              >
                <Github className="h-5 w-5" />
                <span className="sr-only">GitHub</span>
              </button>
              <button
                className="flex h-10 w-10 items-center justify-center rounded-full text-[#978fb1] transition-colors hover:bg-white/5 hover:text-white"
                onClick={() =>
                  window.open("https://x.com/KaiCryptohk", "_blank")
                }
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
