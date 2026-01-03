"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Github,
  LayoutDashboard,
  Wallet,
  Image as ImageIcon,
  Building2,
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
          "w-64 bg-[#1a1f2e] border-r border-gray-800 flex flex-col fixed md:relative h-full z-50 transition-transform duration-300",
          isMobileMenuOpen
            ? "translate-x-0"
            : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Pyth Network Logo */}
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-3 w-full overflow-hidden">
            <div className="relative w-full max-w-[200px] h-auto">
              <Image
                src="/PythLight.svg"
                width={3285}
                height={1120}
                alt="Pyth Network"
                className="w-full h-auto object-contain"
                priority
              />
            </div>
          </div>
        </div>

        <div className="p-4">
          <nav className="space-y-2">
            <Link href="/" onClick={() => onMobileMenuToggle()}>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-3 text-gray-300 hover:text-white hover:bg-purple-500/10 cursor-pointer",
                  isActive("/") &&
                    "bg-purple-500/20 text-white border-r-2 border-purple-500"
                )}
              >
                <LayoutDashboard className="h-5 w-5" />
                Dashboard
              </Button>
            </Link>

            <Link href="/wallets" onClick={() => onMobileMenuToggle()}>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-3 text-gray-300 hover:text-white hover:bg-purple-500/10 cursor-pointer",
                  isActive("/wallets") &&
                    "bg-purple-500/20 text-white border-r-2 border-purple-500"
                )}
              >
                <Wallet className="h-5 w-5" />
                Wallets
              </Button>
            </Link>

            <Link href="/pythenians" onClick={() => onMobileMenuToggle()}>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-3 text-gray-300 hover:text-white hover:bg-purple-500/10 cursor-pointer",
                  isActive("/pythenians") &&
                    "bg-purple-500/20 text-white border-r-2 border-purple-500"
                )}
              >
                <ImageIcon className="h-5 w-5" />
                Pythenians
              </Button>
            </Link>

            <Link href="/reserve" onClick={() => onMobileMenuToggle()}>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-3 text-gray-300 hover:text-white hover:bg-purple-500/10 cursor-pointer",
                  isActive("/reserve") &&
                    "bg-purple-500/20 text-white border-r-2 border-purple-500"
                )}
              >
                <Building2 className="h-5 w-5" />
                Reserve
              </Button>
            </Link>
          </nav>
        </div>

        {/* Staking Rewards - Bottom Left */}
        <div className="mt-auto p-4">
          <Card className="bg-[#2a2f3e] border-gray-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-lg">
                Staking Rewards
              </CardTitle>
              <p className="text-gray-400 text-sm">
                Earn rewards by staking PYTH
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              <Button
                className="w-full bg-purple-600 hover:bg-purple-700 cursor-pointer hover:shadow-lg transition-all duration-200"
                onClick={() =>
                  window.open("https://staking.pyth.network/", "_blank")
                }
              >
                Start Staking
              </Button>
            </CardContent>
          </Card>

          {/* Social Links */}
          <div className="flex items-center justify-center gap-3 pt-2 border-t border-gray-800">
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white hover:bg-gray-800/50 p-2 cursor-pointer"
              onClick={() =>
                window.open("https://github.com/SCPassion/pyth-board", "_blank")
              }
            >
              <Github className="h-10 w-10" />
              <span className="sr-only">GitHub</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white hover:bg-gray-800/50 p-2 cursor-pointer"
              onClick={() => window.open("https://x.com/KaiCryptohk", "_blank")}
            >
              <TwitterIcon className="h-10 w-10" />
              <span className="sr-only">Twitter</span>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
