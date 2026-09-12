"use client";

import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/store/app-store";
import { useToast } from "@/hooks/use-toast";
import {
  isSessionTimeoutEnabled, sessionTimeoutMinutes,
  isIpWhitelistEnabled, parseAllowlist, ipAllowed, fetchClientIp,
} from "@/lib/security";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const WARN_SECONDS = 120;

/** Enforces Settings → Security while a session is active:
 *  inactivity auto-logout (with stay-signed-in warning) + IP re-checks. */
export function SessionGuard() {
  const { toast } = useToast();
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const lastActivity = useRef(Date.now());
  const [warnIn, setWarnIn] = useState<number | null>(null);

  // Any interaction counts as activity; (re)login resets the clock.
  useEffect(() => {
    if (!isAuthenticated) return;
    lastActivity.current = Date.now();
    const bump = () => {
      lastActivity.current = Date.now();
      setWarnIn(null);
    };
    const opts: AddEventListenerOptions = { passive: true };
    window.addEventListener("pointerdown", bump, opts);
    window.addEventListener("keydown", bump);
    window.addEventListener("touchstart", bump, opts);
    window.addEventListener("scroll", bump, opts);
    return () => {
      window.removeEventListener("pointerdown", bump);
      window.removeEventListener("keydown", bump);
      window.removeEventListener("touchstart", bump);
      window.removeEventListener("scroll", bump);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let ipCheckedAt = 0;
    const id = setInterval(async () => {
      const st = useAppStore.getState();
      if (!st.isAuthenticated) return;
      // --- Session timeout ---
      if (isSessionTimeoutEnabled(st.settings)) {
        const timeoutMs = sessionTimeoutMinutes(st.settings) * 60 * 1000;
        const idleMs = Date.now() - lastActivity.current;
        const remaining = timeoutMs - idleMs;
        if (remaining <= 0) {
          const name = st.currentUser.name || "User";
          st.addAuditLog({
            actor: name,
            actorEmail: st.currentUser.email,
            action: "SESSION_TIMEOUT",
            branch: st.currentUser.branch || "",
            details: `${name} was signed out after ${sessionTimeoutMinutes(st.settings)} minutes of inactivity.`,
          });
          st.logout();
          toast({ title: "Session expired", description: "You were signed out for inactivity. Please sign in again." });
          setWarnIn(null);
          return;
        }
        setWarnIn(remaining <= WARN_SECONDS * 1000 ? Math.ceil(remaining / 1000) : null);
      } else {
        setWarnIn(null);
      }
      // --- IP whitelist re-check (once a minute) ---
      if (isIpWhitelistEnabled(st.settings) && Date.now() - ipCheckedAt > 60000) {
        ipCheckedAt = Date.now();
        const ip = await fetchClientIp();
        const fresh = useAppStore.getState();
        if (!fresh.isAuthenticated) return;
        if (!ipAllowed(ip, parseAllowlist(fresh.settings["security_ip_allowlist"]))) {
          fresh.addAuditLog({
            actor: fresh.currentUser.name,
            actorEmail: fresh.currentUser.email,
            action: "SECURITY_IP_SESSION_BLOCKED",
            branch: fresh.currentUser.branch || "",
            details: `Active session ended: IP ${ip} is not allowlisted.`,
          });
          fresh.logout();
          toast({ title: "Access revoked", description: `Your IP (${ip}) is no longer allowlisted. You have been signed out.`, variant: "destructive" });
        }
      }
    }, 1000);
    return () => clearInterval(id);
  }, [isAuthenticated, toast]);

  const stay = () => {
    lastActivity.current = Date.now();
    setWarnIn(null);
  };

  return (
    <Dialog open={isAuthenticated && warnIn !== null} onOpenChange={(v) => { if (!v) stay(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Session expiring soon</DialogTitle>
          <DialogDescription>
            You&apos;ll be signed out for inactivity in {warnIn ?? 0}s. Press Stay signed in to keep working.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button size="sm" onClick={stay}>Stay signed in</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
