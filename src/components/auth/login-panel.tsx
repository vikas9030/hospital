"use client";

import { useState } from "react";
import { useAppStore, demoUsers } from "@/store/app-store";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft,
  ShieldCheck, Fingerprint, KeyRound, Smartphone, CheckCircle2,
  Stethoscope, Activity, BedDouble, Pill, Users, Building2,
  Sun, Moon, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const quickRoles: { key: keyof typeof demoUsers; label: string; icon: typeof Users; color: string }[] = [
  { key: "admin", label: "Admin", icon: ShieldCheck, color: "bg-primary/10 text-primary" },
  { key: "doctor", label: "Doctor", icon: Stethoscope, color: "bg-success/10 text-success" },
  { key: "reception", label: "Reception", icon: Users, color: "bg-info/10 text-info" },
  { key: "nurse", label: "Nurse", icon: Activity, color: "bg-warning/10 text-warning" },
  { key: "pharmacist", label: "Pharmacy", icon: Pill, color: "bg-destructive/10 text-destructive" },
];

export function LoginPanel() {
  const { authMode, setAuthMode, login, theme, toggleTheme } = useAppStore();
  const { toast } = useToast();
  const [email, setEmail] = useState("aditya.sharma@medicore.com");
  const [password, setPassword] = useState("medicore123");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState("");
  const [selectedRole, setSelectedRole] = useState<keyof typeof demoUsers>("admin");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      login(demoUsers[selectedRole]);
      toast({
        title: "Welcome back!",
        description: `Logged in as ${demoUsers[selectedRole].name}`,
      });
    }, 1200);
  };

  const handleOtpLogin = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      login(demoUsers[selectedRole]);
      toast({
        title: "OTP Verified!",
        description: `Logged in as ${demoUsers[selectedRole].name}`,
      });
    }, 1000);
  };

  const handleQuickLogin = (roleKey: keyof typeof demoUsers) => {
    setSelectedRole(roleKey);
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      login(demoUsers[roleKey]);
      toast({
        title: "Welcome back!",
        description: `Logged in as ${demoUsers[roleKey].name} (${demoUsers[roleKey].role})`,
      });
    }, 800);
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left: Branding / Hero Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary via-primary to-info">
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

        <div className="relative z-10 flex flex-col justify-between p-12 text-primary-foreground w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20">
              <Heart className="h-6 w-6" fill="currentColor" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">MediCore CRM</h1>
              <p className="text-xs text-primary-foreground/70">Enterprise Hospital Management</p>
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
              <h2 className="text-4xl font-bold leading-tight tracking-tight">
                Healthcare, <br />
                <span className="text-primary-foreground/80">reimagined.</span>
              </h2>
              <p className="mt-4 text-base text-primary-foreground/80 max-w-md leading-relaxed">
                The complete hospital management platform — patient care, billing, pharmacy, lab, radiology, insurance, and analytics in one unified system.
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
            <span>© 2026 MediCore Systems. All rights reserved.</span>
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

        <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-md">
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
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-info text-primary-foreground shadow-lg shadow-primary/30">
                      <Heart className="h-5 w-5" fill="currentColor" />
                    </div>
                    <div>
                      <h1 className="text-lg font-bold tracking-tight">MediCore CRM</h1>
                      <p className="text-xs text-muted-foreground">Hospital Management</p>
                    </div>
                  </div>

                  <div className="mb-8">
                    <h2 className="text-2xl font-bold tracking-tight">Sign in to your account</h2>
                    <p className="text-sm text-muted-foreground mt-1.5">
                      Welcome back! Please enter your credentials to continue.
                    </p>
                  </div>

                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="you@medicore.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
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
                          onChange={(e) => setPassword(e.target.value)}
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

                    {/* Divider */}
                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-border" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-3 text-muted-foreground font-medium">Or continue with</span>
                      </div>
                    </div>

                    {/* Alt login buttons */}
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 rounded-xl gap-2"
                        onClick={() => setAuthMode("otp")}
                      >
                        <Smartphone className="h-4 w-4 text-primary" /> OTP Login
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 rounded-xl gap-2"
                        onClick={() => setAuthMode("mfa")}
                      >
                        <Fingerprint className="h-4 w-4 text-primary" /> Biometric
                      </Button>
                    </div>
                  </form>

                  {/* Quick Role Login */}
                  <div className="mt-8">
                    <p className="text-xs font-medium text-muted-foreground mb-3 text-center">
                      Quick demo login — select a role
                    </p>
                    <div className="grid grid-cols-5 gap-2">
                      {quickRoles.map((role) => {
                        const Icon = role.icon;
                        const isActive = selectedRole === role.key;
                        return (
                          <button
                            key={role.key}
                            type="button"
                            onClick={() => handleQuickLogin(role.key)}
                            disabled={loading}
                            className={`group flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all ${
                              isActive
                                ? "border-primary bg-primary/5 shadow-sm"
                                : "border-border hover:border-primary/40 hover:bg-muted/40"
                            }`}
                          >
                            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${role.color}`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <span className="text-[10px] font-medium">{role.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ===== OTP Mode ===== */}
              {authMode === "otp" && (
                <motion.div
                  key="otp"
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
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
                      <Smartphone className="h-7 w-7" />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight">Verify with OTP</h2>
                    <p className="text-sm text-muted-foreground mt-1.5">
                      We&apos;ve sent a 6-digit code to <span className="font-medium text-foreground">+91 98765 43210</span>
                    </p>
                  </div>

                  <div className="space-y-6">
                    <div className="flex justify-center">
                      <InputOTP
                        maxLength={6}
                        value={otp}
                        onChange={(v) => setOtp(v)}
                      >
                        <InputOTPGroup>
                          <InputOTPSlot index={0} className="h-12 w-12 text-lg" />
                          <InputOTPSlot index={1} className="h-12 w-12 text-lg" />
                          <InputOTPSlot index={2} className="h-12 w-12 text-lg" />
                          <InputOTPSlot index={3} className="h-12 w-12 text-lg" />
                          <InputOTPSlot index={4} className="h-12 w-12 text-lg" />
                          <InputOTPSlot index={5} className="h-12 w-12 text-lg" />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>

                    <div className="text-center text-sm text-muted-foreground">
                      Didn&apos;t receive code?{" "}
                      <button className="text-primary font-medium hover:underline">Resend in 0:42</button>
                    </div>

                    <Button
                      onClick={handleOtpLogin}
                      className="w-full h-11 rounded-xl text-sm font-semibold gap-2"
                      disabled={loading || otp.length < 6}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Verifying...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" /> Verify & Continue
                        </>
                      )}
                    </Button>

                    <div className="rounded-xl bg-info/5 border border-info/20 p-3 text-center">
                      <p className="text-xs text-muted-foreground">
                        Demo: Enter any 6 digits to continue
                      </p>
                    </div>
                  </div>
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

              {/* ===== MFA Mode ===== */}
              {authMode === "mfa" && (
                <motion.div
                  key="mfa"
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
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success/10 text-success mb-4">
                      <ShieldCheck className="h-7 w-7" />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight">Two-Factor Authentication</h2>
                    <p className="text-sm text-muted-foreground mt-1.5">
                      Enter the 6-digit code from your authenticator app to continue.
                    </p>
                  </div>

                  <div className="space-y-6">
                    <div className="flex justify-center">
                      <InputOTP
                        maxLength={6}
                        value={otp}
                        onChange={(v) => setOtp(v)}
                      >
                        <InputOTPGroup>
                          <InputOTPSlot index={0} className="h-12 w-12 text-lg" />
                          <InputOTPSlot index={1} className="h-12 w-12 text-lg" />
                          <InputOTPSlot index={2} className="h-12 w-12 text-lg" />
                          <InputOTPSlot index={3} className="h-12 w-12 text-lg" />
                          <InputOTPSlot index={4} className="h-12 w-12 text-lg" />
                          <InputOTPSlot index={5} className="h-12 w-12 text-lg" />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>

                    <div className="rounded-xl bg-muted/50 p-3 flex items-center gap-3">
                      <Fingerprint className="h-5 w-5 text-primary shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-medium">Biometric authentication enabled</p>
                        <p className="text-xs text-muted-foreground">Use fingerprint or face ID on your device</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleOtpLogin}
                        className="text-xs h-7"
                      >
                        Use Biometric
                      </Button>
                    </div>

                    <Button
                      onClick={handleOtpLogin}
                      className="w-full h-11 rounded-xl text-sm font-semibold gap-2"
                      disabled={loading || otp.length < 6}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Verifying...
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="h-4 w-4" /> Verify & Sign In
                        </>
                      )}
                    </Button>
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
  );
}
