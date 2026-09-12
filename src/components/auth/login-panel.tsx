"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/app-store";
import {
  isTwoFactorEnabled, isIpWhitelistEnabled, parseAllowlist, ipAllowed, fetchClientIp,
} from "@/lib/security";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft,
  ShieldCheck, KeyRound,
  Stethoscope, Activity, BedDouble, Users, Building2,
  Sun, Moon, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useBranding, loginThemeOf } from "@/lib/branding";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

interface OtpInfo {
  delivered: "email" | "sms" | "none";
  destination?: string;
  hint?: string;
  devCode?: string;
}

async function auditSecurity(entry: { actor: string; actorEmail: string; action: string; branch: string; details: string }) {
  useAppStore.getState().addAuditLog({ ...entry, target: "security" });
  try {
    await fetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...entry, target: "security" }),
    });
  } catch {
    // Server audit is best-effort.
  }
}

export function LoginPanel() {
  const { authMode, setAuthMode, login, theme, toggleTheme } = useAppStore();
  const storeBranches = useAppStore((s) => s.branches);
  const { toast } = useToast();
  const branding = useBranding();
  const theme_ = loginThemeOf(branding);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  // Two-factor step state (Settings → Security → Two-Factor Authentication).
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [pendingUser, setPendingUser] = useState<any>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpInfo, setOtpInfo] = useState<OtpInfo | null>(null);
  const [otpError, setOtpError] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [coolUntil, setCoolUntil] = useState(0);
  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    if (step !== "otp") return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [step]);

  // Admins leave this empty and get all-branch access; staff must pick theirs
  // (required — every record they save is pinned to that branch).
  const effectiveBranch = selectedBranch;

  const finishLogin = async (user: any, via2FA: boolean) => {
    const ip = await fetchClientIp();
    login({
      name: user.name,
      role: user.role,
      email: user.email,
      avatar: user.avatar,
      // Fall back to the account's own branch when none was selected, so
      // staff land on their branch dashboard directly.
      branch: effectiveBranch || user.branch || "",
      branchId: user.branchId,
      password: user.password,
      mustChangePassword: user.mustChangePassword,
      staffId: user.staffId,
    });
    await auditSecurity({
      actor: user.name,
      actorEmail: user.email,
      action: via2FA ? "LOGIN_2FA_SUCCESS" : "LOGIN_SUCCESS",
      branch: effectiveBranch || user.branch || "",
      details: `${user.name} signed in${via2FA ? " with two-factor verification" : ""} from IP ${ip}.`,
    });
    toast({
      title: "Welcome back!",
      description: `Logged in as ${user.name} (${user.role})`,
    });
  };

  const requestOtp = async (addr: string): Promise<boolean> => {
    setOtpError("");
    setOtpLoading(true);
    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", email: addr }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not send the verification code.");
      setOtpInfo({ delivered: body.delivered, destination: body.destination, hint: body.hint, devCode: body.devCode });
      setCoolUntil(Date.now() + 45000);
      return true;
    } catch (e: any) {
      setOtpError(e.message);
      return false;
    } finally {
      setOtpLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoading(true);
    (async () => {
      try {
        // Fetch the latest login accounts first, so staff created by the
        // admin on another device can sign in here directly.
        await useAppStore.getState().refreshUsers();
      } catch {
        // Offline: fall back to locally cached accounts.
      }
      const st = useAppStore.getState();
      const result = st.authenticateUser(email.trim().toLowerCase(), password, effectiveBranch);
      if (!result.success) {
        setLoginError(result.error || "Login failed.");
        setLoading(false);
        return;
      }
      const user = result.user!;
      // IP whitelist enforcement (Settings → Security).
      if (isIpWhitelistEnabled(st.settings)) {
        const ip = await fetchClientIp();
        const list = parseAllowlist(st.settings["security_ip_allowlist"]);
        if (!ipAllowed(ip, list)) {
          await auditSecurity({
            actor: user.name,
            actorEmail: user.email,
            action: "SECURITY_IP_BLOCKED",
            branch: effectiveBranch || user.branch || "",
            details: `Blocked sign-in for ${user.name} from non-allowlisted IP ${ip}.`,
          });
          setLoginError(`Access denied: your IP (${ip}) is not allowlisted. Ask an admin to add it in Settings → Security → IP Whitelisting.`);
          setLoading(false);
          return;
        }
      }
      // Two-factor challenge when enabled.
      if (isTwoFactorEnabled(st.settings)) {
        const ok = await requestOtp(user.email);
        setLoading(false);
        if (ok) {
          setPendingUser(user);
          setOtpCode("");
          setStep("otp");
        }
        return;
      }
      await finishLogin(user, false);
      setLoading(false);
    })();
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (otpCode.trim().length !== 6 || !pendingUser) return;
    setOtpError("");
    setOtpLoading(true);
    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", email: pendingUser.email, code: otpCode.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Verification failed.");
      const user = pendingUser;
      setPendingUser(null);
      setStep("credentials");
      await finishLogin(user, true);
    } catch (err: any) {
      setOtpError(err.message);
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left: Branding / Hero Panel (admin-designed in Settings) */}
      <div className={`hidden lg:flex lg:w-1/2 relative bg-gradient-to-br ${theme_.hero}`}>
        {/* Decorative shapes */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute top-1/3 -left-32 h-96 w-96 rounded-full bg-info/30 blur-3xl" />
          <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-white/5 blur-2xl" />
          {/* Grid pattern */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
              backgroundSize: "40px 40px",
            }}
          />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 text-primary-foreground w-full overflow-y-auto">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 overflow-hidden">
              {branding.appLogo ? (
                <img src={branding.appLogo} alt="App logo" className="h-10 w-10 object-contain" />
              ) : (
                <Heart className="h-6 w-6" fill="currentColor" />
              )}
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{branding.appName}</h1>
              <p className="text-xs text-primary-foreground/70">{branding.appTagline}</p>
            </div>
          </div>

          {/* Hero content */}
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Badge className="bg-white/15 text-primary-foreground border-white/20 backdrop-blur-sm mb-4">
                <ShieldCheck className="h-3 w-3 mr-1" /> HIPAA Compliant · ISO 27001
              </Badge>
              <h2 className="text-4xl font-bold leading-tight tracking-tight whitespace-pre-line">
                {branding.loginTitle}
              </h2>
              <p className="mt-4 text-base text-primary-foreground/80 max-w-md leading-relaxed">
                {branding.loginSubtitle}
              </p>
            </motion.div>

            {/* Feature pills */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="grid grid-cols-2 gap-3 max-w-md"
            >
              {[
                { icon: Users, label: "12,480+ Patients" },
                { icon: Stethoscope, label: "340+ Doctors" },
                { icon: BedDouble, label: "180+ Beds" },
                { icon: Activity, label: "Real-time Updates" },
              ].map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.label} className="flex items-center gap-2.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 px-3 py-2.5">
                    <Icon className="h-4 w-4 text-primary-foreground/90" />
                    <span className="text-xs font-medium">{f.label}</span>
                  </div>
                );
              })}
            </motion.div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-primary-foreground/60">
            <span>{branding.loginFooter}</span>
            <div className="flex items-center gap-4">
              <span>v2.4.1</span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                All systems operational
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Login Form Panel */}
      <div className="flex-1 flex flex-col relative">
        {/* Theme toggle */}
        <div className="absolute top-6 right-6 z-10">
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9 rounded-full border border-border">
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-6 sm:py-12 sm:px-12">
            <div className="w-full max-w-md py-8">
            <AnimatePresence mode="wait">
              {/* ===== Login Mode ===== */}
              {authMode === "login" && (
                <motion.div
                  key="login"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.25 }}
                >
                  {/* Mobile logo */}
                  <div className="flex lg:hidden items-center gap-3 mb-8">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${theme_.hero} text-white shadow-lg overflow-hidden`}>
                      {branding.appLogo ? (
                        <img src={branding.appLogo} alt="App logo" className="h-9 w-9 object-contain" />
                      ) : (
                        <Heart className="h-5 w-5" fill="currentColor" />
                      )}
                    </div>
                    <div>
                      <h1 className="text-lg font-bold tracking-tight">{branding.appName}</h1>
                      <p className="text-xs text-muted-foreground">{branding.appTagline}</p>
                    </div>
                  </div>

                  <div className="mb-8">
                    <h2 className="text-2xl font-bold tracking-tight">Sign in to your account</h2>
                      <p className="text-sm text-muted-foreground mt-1.5">
                        Enter your credentials. You can skip the branch — it defaults to your assigned branch.
                      </p>
                  </div>

                  {step === "credentials" ? (
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="branch" className="text-sm font-medium">
                        Branch <span className="text-[11px] font-normal text-muted-foreground">(optional — uses your assigned branch)</span>
                      </Label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Select value={effectiveBranch} onValueChange={setSelectedBranch}>
                          <SelectTrigger className="pl-10 h-11 rounded-xl">
                            <SelectValue placeholder="Required for staff — pick your branch" />
                          </SelectTrigger>
                          <SelectContent>
                            {storeBranches.map((b) => (
                              <SelectItem key={b.id} value={b.name}>
                                <span className="flex items-center gap-2">
                                  <Building2 className="h-3 w-3" />
                                  {b.name} — {b.location}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="you@medicore.com"
                          value={email}
                          onChange={(e) => { setEmail(e.target.value); setLoginError(""); }}
                          className="pl-10 h-11 rounded-xl"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                        <button
                          type="button"
                          onClick={() => setAuthMode("forgot")}
                          className="text-xs text-primary hover:underline font-medium"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => { setPassword(e.target.value); setLoginError(""); }}
                          className="pl-10 pr-10 h-11 rounded-xl"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {loginError && (
                      <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-3 text-center">
                        <p className="text-xs text-destructive font-medium">{loginError}</p>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="remember"
                          checked={rememberMe}
                          onCheckedChange={(v) => setRememberMe(v === true)}
                        />
                        <Label htmlFor="remember" className="text-sm cursor-pointer">Remember me for 30 days</Label>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-11 rounded-xl text-sm font-semibold gap-2"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Signing in...
                        </>
                      ) : (
                        <>
                          Sign In <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </form>
                  ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 text-center">
                      <ShieldCheck className="h-8 w-8 mx-auto text-primary mb-2" />
                      <p className="text-sm font-semibold">Two-factor verification</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {otpInfo?.delivered === "none"
                          ? "No Email/SMS delivery is configured, so your code is shown below (demo mode)."
                          : `We sent a 6-digit code to ${otpInfo?.destination ?? "your contact"}. It expires in 10 minutes.`}
                      </p>
                      {otpInfo?.delivered === "none" && otpInfo?.devCode && (
                        <p className="mt-2 inline-block rounded-lg bg-background border px-4 py-2 text-2xl font-mono font-bold tracking-[0.3em]">
                          {otpInfo.devCode}
                        </p>
                      )}
                    </div>
                    <div className="flex justify-center">
                      <InputOTP maxLength={6} value={otpCode} onChange={(v) => { setOtpCode(v); setOtpError(""); }}>
                        <InputOTPGroup>
                          {[0, 1, 2, 3, 4, 5].map((i) => (
                            <InputOTPSlot key={i} index={i} />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    {otpError && (
                      <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-3 text-center">
                        <p className="text-xs text-destructive font-medium">{otpError}</p>
                      </div>
                    )}
                    <Button
                      type="submit"
                      className="w-full h-11 rounded-xl text-sm font-semibold gap-2"
                      disabled={otpLoading || otpCode.trim().length !== 6}
                    >
                      {otpLoading ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Verifying...</>
                      ) : (
                        <>Verify & Sign In <ArrowRight className="h-4 w-4" /></>
                      )}
                    </Button>
                    <div className="flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => { setStep("credentials"); setPendingUser(null); setOtpCode(""); setOtpError(""); }}
                        className="text-muted-foreground hover:text-foreground font-medium"
                      >
                        ← Back to password
                      </button>
                      <button
                        type="button"
                        disabled={otpLoading || nowTick < coolUntil}
                        onClick={() => pendingUser && requestOtp(pendingUser.email)}
                        className="text-primary hover:underline font-medium disabled:opacity-50 disabled:no-underline"
                      >
                        {nowTick < coolUntil ? `Resend in ${Math.ceil((coolUntil - nowTick) / 1000)}s` : "Resend code"}
                      </button>
                    </div>
                  </form>
                  )}
                </motion.div>
              )}


              {/* ===== Forgot Password ===== */}
              {authMode === "forgot" && (
                <motion.div
                  key="forgot"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.25 }}
                >
                  <button
                    onClick={() => setAuthMode("login")}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" /> Back to login
                  </button>

                  <div className="mb-8">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-warning/10 text-warning mb-4">
                      <KeyRound className="h-7 w-7" />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight">Reset your password</h2>
                    <p className="text-sm text-muted-foreground mt-1.5">
                      Enter your email and we&apos;ll send you a secure link to reset your password.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="reset-email" className="text-sm font-medium">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="reset-email"
                          type="email"
                          placeholder="you@medicore.com"
                          defaultValue={email}
                          className="pl-10 h-11 rounded-xl"
                        />
                      </div>
                    </div>

                    <Button
                      onClick={() => {
                        toast({
                          title: "Reset link sent!",
                          description: "Check your email for password reset instructions.",
                        });
                        setAuthMode("login");
                      }}
                      className="w-full h-11 rounded-xl text-sm font-semibold gap-2"
                    >
                      Send Reset Link <ArrowRight className="h-4 w-4" />
                    </Button>

                    <div className="rounded-xl bg-muted/50 p-3 text-center">
                      <p className="text-xs text-muted-foreground">
                        Need help? Contact IT support at{" "}
                        <span className="font-medium text-foreground">support@medicore.com</span>
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Footer */}
            <div className="mt-10 pt-6 border-t border-border text-center">
              <p className="text-xs text-muted-foreground">
                By signing in, you agree to our{" "}
                <button className="text-primary hover:underline font-medium">Terms of Service</button>
                {" "}and{" "}
                <button className="text-primary hover:underline font-medium">Privacy Policy</button>
              </p>
              <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> Multi-branch
                </span>
                <span className="flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" /> HIPAA Compliant
                </span>
                <span className="flex items-center gap-1">
                  <Lock className="h-3 w-3" /> 256-bit SSL
                </span>
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
