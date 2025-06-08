"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutDashboard, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface SidebarProps {
  currentView: "dashboard" | "wallets";
  onViewChange: (view: "dashboard" | "wallets") => void;
}

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
  return (
    <div className="w-64 bg-[#1a1f2e] border-r border-gray-800 flex flex-col">
      {/* Pyth Network Logo */}
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <span className="text-white font-semibold text-lg">
            <Image
              src="/PythLight.svg"
              width={3285}
              height={1120}
              alt="Pyth image"
            />
          </span>
        </div>
      </div>

      <div className="p-4">
        <nav className="space-y-2">
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start gap-3 text-gray-300 hover:text-white hover:bg-purple-500/10",
              currentView === "dashboard" &&
                "bg-purple-500/20 text-white border-r-2 border-purple-500"
            )}
            onClick={() => onViewChange("dashboard")}
          >
            <LayoutDashboard className="h-5 w-5" />
            Dashboard
          </Button>

          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start gap-3 text-gray-300 hover:text-white hover:bg-purple-500/10",
              currentView === "wallets" &&
                "bg-purple-500/20 text-white border-r-2 border-purple-500"
            )}
            onClick={() => onViewChange("wallets")}
          >
            <Wallet className="h-5 w-5" />
            Wallets
          </Button>
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
            <Button className="w-full bg-purple-600 hover:bg-purple-700">
              Start Staking
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
