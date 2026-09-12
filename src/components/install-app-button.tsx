"use client";

import { useEffect, useState } from "react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

// Renders an "Install app" menu item only when the browser fires the PWA
// install prompt (Chromium desktop/Android). iOS users install via Share →
// Add to Home Screen; the manifest + apple touch icon cover that path.
export function InstallAppMenuItem() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!promptEvent) return null;

  return (
    <DropdownMenuItem
      onClick={async () => {
        try {
          await promptEvent.prompt();
          await promptEvent.userChoice;
        } catch { /* dismissed */ }
        setPromptEvent(null);
      }}
    >
      <Download className="mr-2 h-4 w-4" /> Install app
    </DropdownMenuItem>
  );
}
