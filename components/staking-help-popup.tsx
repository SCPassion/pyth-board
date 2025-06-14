"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpCircle, X, ExternalLink } from "lucide-react";

export function StakingHelpPopup() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="text-gray-400 hover:text-white p-1 h-6 w-6 cursor-pointer"
      >
        <HelpCircle className="h-4 w-4" />
        <span className="sr-only">Help - Where to find staking account</span>
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setIsOpen(false)}
          />

          {/* Popup */}
          <Card className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-[#2a2f3e] border-gray-700 z-50 max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-white text-xl">
                Where to find your Staking Account Address
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <p className="text-gray-300 leading-relaxed">
                  To find your staking account address, follow these steps on{" "}
                  <a
                    href="https://staking.pyth.network"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 hover:text-purple-300 underline inline-flex items-center gap-1"
                  >
                    staking.pyth.network
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  :
                </p>

                <div className="bg-[#1a1f2e] rounded-lg p-4 border border-gray-700">
                  <img
                    src="/pyth_stakingLocation.png"
                    alt="Pyth Network staking interface showing wallet management"
                    className="w-full rounded-lg border border-gray-600"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5">
                      1
                    </div>
                    <div>
                      <p className="text-white font-medium">
                        Connect your Solana wallet
                      </p>
                      <p className="text-gray-400 text-sm">
                        Click "Connect Wallet" and connect your Solana wallet
                        (Phantom, Solflare, etc.)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5">
                      2
                    </div>
                    <div>
                      <p className="text-white font-medium">
                        Navigate to "Stake account"
                      </p>
                      <p className="text-gray-400 text-sm">
                        Copy your stake account address and paste it into the
                        form.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white text-xs font-bold">i</span>
                    </div>
                    <div>
                      <p className="text-blue-300 font-medium text-sm">
                        Important Note
                      </p>
                      <p className="text-blue-200 text-sm">
                        Your staking account address is automatically generated
                        when you first stake with the Pyth OIS program. If you
                        haven't staked before, you'll need to create a staking
                        position first on staking.pyth.network.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
                <Button
                  variant="outline"
                  onClick={() =>
                    window.open("https://staking.pyth.network", "_blank")
                  }
                  className="border-purple-500/50 text-purple-300 hover:bg-purple-500/10"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Pyth Staking
                </Button>
                <Button
                  onClick={() => setIsOpen(false)}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Got it!
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
