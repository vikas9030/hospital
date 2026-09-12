"use client";

import { useState } from "react";
import { useAppStore } from "@/store/app-store";
import { motion } from "framer-motion";
import {
  Heart, Mail, Lock, Eye, EyeOff, ArrowRight,
  ShieldCheck, UserPlus, Sun, Moon, Loader2,
  Building2, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export function SetupPanel() {
  const { theme, toggleTheme, createAdmin } = useAppStore();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Full name is required.");
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("A valid email address is required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    let branchId = "";
    let branchName = "Main Branch";
    try {
      // The API returns the canonical branch — created now, or the existing
      // "Main Branch" if a previous setup already made one.
      const branchRes = await fetch("/api/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Main Branch", location: "Headquarters", patients: 0, revenue: 0, staff: 1, status: "Active" }),
      });
      if (!branchRes.ok) {
        const body = await branchRes.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create the initial branch.");
      }
      const savedBranch = await branchRes.json();
      branchId = savedBranch.id;
      branchName = savedBranch.name || branchName;
      const userRes = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          role: "Admin",
          email: email.trim().toLowerCase(),
          avatar: name.trim().split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase(),
          branch: branchName,
          branchId,
          password,
          mustChangePassword: false,
        }),
      });
      if (!userRes.ok) {
        const body = await userRes.json().catch(() => ({}));
        throw new Error(body.error || "Failed to save the account to the database.");
      }
    } catch (err: any) {
      setError(err.message || "Setup failed. Please try again.");
      setLoading(false);
      return;
    }
    createAdmin(name.trim(), email.trim().toLowerCase(), password, branchId);
    toast({
      title: "Admin Account Created",
      description: "Your account has been set up. Please sign in with your credentials.",
    });
    setLoading(false);
  };

  const strength = (() => {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  })();

  const strengthLabel = ["Very Weak", "Weak", "Fair", "Good", "Strong"][Math.min(strength, 4)];
  const strengthColor = ["bg-destructive", "bg-warning", "bg-yellow-500", "bg-success/80", "bg-success"][Math.min(strength, 4)];

  return (
    <div className="min-h-screen flex bg-background">
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-primary via-primary to-info">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute top-1/3 -left-32 h-96 w-96 rounded-full bg-info/30 blur-3xl" />
          <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-white/5 blur-2xl" />
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
              backgroundSize: "40px 40px",
            }}
          />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 text-primary-foreground w-full overflow-y-auto">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20">
              <Heart className="h-6 w-6" fill="currentColor" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">MediCore CRM</h1>
              <p className="text-xs text-primary-foreground/70">Enterprise Hospital Management</p>
            </div>
          </div>

          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Badge className="bg-white/15 text-primary-foreground border-white/20 backdrop-blur-sm mb-4">
                <ShieldCheck className="h-3 w-3 mr-1" /> Initial Setup
              </Badge>
              <h2 className="text-4xl font-bold leading-tight tracking-tight">
                Welcome to<br />
                <span className="text-primary-foreground/80">MediCore.</span>
              </h2>
              <p className="mt-4 text-base text-primary-foreground/80 max-w-md leading-relaxed">
                Create your Admin account to get started. This account will have full system access and the ability to manage all hospital operations, branches, staff, and settings.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="grid grid-cols-1 gap-3 max-w-md"
            >
              {[
                { icon: ShieldCheck, label: "Full system control" },
                { icon: Building2, label: "Manage all branches" },
                { icon: UserPlus, label: "Create staff & roles" },
                { icon: CheckCircle2, label: "One-time setup" },
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

          <div className="flex items-center justify-between text-xs text-primary-foreground/60">
            <span>&copy; 2026 MediCore Systems. All rights reserved.</span>
            <span>v2.4.1</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col relative">
        <div className="absolute top-6 right-6 z-10">
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9 rounded-full border border-border">
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-6 sm:py-12 sm:px-12">
            <div className="w-full max-w-md py-8">
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25 }}
            >
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
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
                  <ShieldCheck className="h-7 w-7" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">Create Admin Account</h2>
                <p className="text-sm text-muted-foreground mt-1.5">
                  This is the initial setup. Create your Admin account to start managing the system.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="setup-name" className="text-sm font-medium">Full Name *</Label>
                  <div className="relative">
                    <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="setup-name"
                      type="text"
                      placeholder="Dr. John Smith"
                      value={name}
                      onChange={(e) => { setName(e.target.value); setError(""); }}
                      className="pl-10 h-11 rounded-xl"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="setup-email" className="text-sm font-medium">Email Address *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="setup-email"
                      type="email"
                      placeholder="admin@medicore.com"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(""); }}
                      className="pl-10 h-11 rounded-xl"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="setup-password" className="text-sm font-medium">Password *</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="setup-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Min 8 characters"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(""); }}
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
                  {password && (
                    <div className="space-y-1">
                      <div className="flex gap-1">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className={`h-1.5 flex-1 rounded-full ${i < strength ? strengthColor : "bg-muted"}`}
                          />
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground">{strengthLabel}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="setup-confirm" className="text-sm font-medium">Confirm Password *</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="setup-confirm"
                      type={showConfirm ? "text" : "password"}
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                      className="pl-10 pr-10 h-11 rounded-xl"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-3 text-center">
                    <p className="text-xs text-destructive font-medium">{error}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-11 rounded-xl text-sm font-semibold gap-2"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Creating account...
                    </>
                  ) : (
                    <>
                      Create Admin Account <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-6 rounded-xl bg-warning/5 border border-warning/20 p-3">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    The Admin has unrestricted access to all system features, including the ability to delete all data, and can sign in without selecting a branch. Keep your credentials secure.
                  </p>
                </div>
              </div>
            </motion.div>

            <div className="mt-10 pt-6 border-t border-border text-center">
              <p className="text-xs text-muted-foreground">
                By creating an account, you agree to our{" "}
                <button className="text-primary hover:underline font-medium">Terms of Service</button>
                {" "}and{" "}
                <button className="text-primary hover:underline font-medium">Privacy Policy</button>
              </p>
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
