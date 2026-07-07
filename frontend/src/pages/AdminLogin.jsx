import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, KeyRound, ArrowRight } from "lucide-react";
import { toast } from "sonner";

/**
 * Hidden admin login route — accessible only at /admin-login.
 * Not linked from anywhere public; not indexed.
 */
export default function AdminLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErr("");
    try {
      const user = await login(email, password);
      if (user.role !== "admin") {
        setErr("This portal is restricted to administrators.");
        setLoading(false);
        return;
      }
      toast.success(`Welcome, ${user.name}`);
      navigate("/admin");
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 grid place-items-center p-6 relative overflow-hidden no-context"
         onContextMenu={(e) => e.preventDefault()}>
      <noscript />
      <meta name="robots" content="noindex,nofollow" />
      <div className="absolute inset-0 opacity-30" style={{
        backgroundImage: "radial-gradient(800px 400px at 20% 20%, rgba(29,78,216,0.35), transparent 60%), radial-gradient(700px 360px at 80% 80%, rgba(249,115,22,0.25), transparent 60%)"
      }} />

      <div className="relative z-10 w-full max-w-md bg-slate-900/90 backdrop-blur border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-11 w-11 rounded-xl bg-white grid place-items-center overflow-hidden shadow-md">
            <img src="/logo.png" alt="GYAN RISE" className="h-full w-full object-contain" data-testid="brand-logo-admin-login" />
          </div>
          <div>
            <div className="font-display font-extrabold text-lg tracking-tight text-white leading-none">GYAN RISE</div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-[#FDBA74] font-bold mt-1">Restricted Admin Portal</div>
          </div>
        </div>

        <h1 className="font-display text-2xl font-bold tracking-tight text-white">
          Administrator sign-in
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          This portal is reserved for institute staff with provisioned admin accounts.
        </p>

        <form onSubmit={submit} className="mt-7 space-y-4" data-testid="admin-login-form">
          <div>
            <Label htmlFor="aemail" className="text-slate-300">Admin email</Label>
            <Input
              id="aemail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@institute.com"
              className="mt-1.5 rounded-lg h-11 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              required
              autoComplete="off"
              data-testid="admin-email-input"
            />
          </div>
          <div>
            <Label htmlFor="apass" className="text-slate-300">Password</Label>
            <Input
              id="apass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1.5 rounded-lg h-11 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              required
              autoComplete="off"
              data-testid="admin-password-input"
            />
          </div>
          {err && (
            <div className="text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-md px-3 py-2" data-testid="admin-login-error">
              {err}
            </div>
          )}
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-lg font-semibold"
            data-testid="admin-login-submit"
          >
            <KeyRound className="h-4 w-4 mr-2" />
            {loading ? "Authenticating..." : "Sign in to Admin"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>

        <p className="mt-6 text-[11px] text-slate-500 text-center">
          Not staff? Return to the <a href="/login" className="text-[#FDBA74] hover:underline">student portal</a>.
        </p>
      </div>
    </div>
  );
}
