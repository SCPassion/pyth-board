"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Download, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallPrompt(true);
    };

    // Listen for the appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      console.log("User accepted the install prompt");
    } else {
      console.log("User dismissed the install prompt");
    }

    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    // Store dismissal in localStorage to avoid showing again immediately
    localStorage.setItem("pwa-install-dismissed", Date.now().toString());
  };

  // Don't show if already installed or if user recently dismissed
  if (isInstalled || !showInstallPrompt) return null;

  // Check if user recently dismissed (within 24 hours)
  const dismissedTime = localStorage.getItem("pwa-install-dismissed");
  if (
    dismissedTime &&
    Date.now() - parseInt(dismissedTime) < 24 * 60 * 60 * 1000
  ) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <div className="rounded-[20px] border border-white/10 bg-[linear-gradient(148deg,rgba(58,48,84,0.98)_0%,rgba(44,36,66,0.98)_100%)] p-4 shadow-[0_24px_60px_rgba(8,5,18,0.4)]">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#312940] ring-1 ring-white/8">
              <Smartphone className="w-4 h-4 text-[#c4a6ff]" />
            </div>
            <div>
              <h3 className="text-white font-medium text-sm">
                Install Pyth Dashboard
              </h3>
              <p className="text-[#a8a1bf] text-xs">
                Add to home screen for quick access
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-8 w-8 rounded-full p-0 text-[#8f88a9] hover:bg-white/5 hover:text-white"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleInstallClick}
            className="flex-1 rounded-xl bg-[#9f1df0] hover:bg-[#b12bff] text-white text-sm gap-2 shadow-[0_12px_26px_rgba(159,29,240,0.32)]"
          >
            <Download className="w-4 h-4" />
            Install
          </Button>
          <Button
            variant="outline"
            onClick={handleDismiss}
            className="rounded-xl border-white/8 bg-[#241d34] text-[#b4aec8] hover:bg-white/5 hover:text-white text-sm"
          >
            Later
          </Button>
        </div>
      </div>
    </div>
  );
}
