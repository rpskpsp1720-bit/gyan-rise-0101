import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { GraduationCap, ArrowRight, Sparkles, ShieldCheck, UserPlus, Mail, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/apiClient";
import FounderCard from "@/components/FounderCard";
import DeveloperFooter from "@/components/DeveloperFooter";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Forgot-password modal state
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErr("");
    try {
      const user = await login(email, password);
      toast.success(`Welcome back, ${user.name}`);
      navigate(user.role === "admin" ? "/admin" : "/dashboard");
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const submitForgot = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    try {
      await api.post("/auth/forgot-password", { email: forgotEmail });
      setForgotSent(true);
    } catch (err) {
      // Backend intentionally returns 200 even if email not found (no enumeration);
      // any error here is a transport/server issue.
      toast.error(err?.response?.data?.detail || "Could not process request. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  };

  const closeForgot = () => {
    setForgotOpen(false);
    setTimeout(() => { setForgotEmail(""); setForgotSent(false); }, 300);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-5 bg-white">
      {/* Visual side */}
      <div className="hidden lg:flex lg:col-span-3 relative overflow-hidden grr-hero-gradient">
        <div className="absolute inset-0 opacity-30 mix-blend-overlay" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=85&w=2000')", backgroundSize: "cover", backgroundPosition: "center" }} />
        <div className="absolute inset-0 bg-gradient-to-tr from-[#0B1E55]/80 via-transparent to-[#F97316]/40" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white/15 backdrop-blur grid place-items-center">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <div className="font-display font-extrabold text-xl tracking-tight leading-none">GYAN RISE</div>
              <div className="text-[11px] uppercase tracking-[0.25em] text-[#FED7AA] font-bold mt-1">RANA E-LEARNING</div>
            </div>
          </div>

          <div>
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-orange-200 mb-4">
              <Sparkles className="h-3.5 w-3.5" /> Premium Coaching LMS
            </div>
            <h1 className="font-display text-4xl xl:text-6xl font-extrabold tracking-tighter leading-[0.95]">
              From <span className="text-[#FDBA74]">classroom</span> to <span className="text-[#FDBA74]">rankings.</span> Built for serious coaching.
            </h1>
            <p className="text-white/85 mt-6 max-w-md leading-relaxed text-base">
              Batches, recorded lectures, live YouTube classes with real-time chat, MCQ tests with timers, and structured chapters. One platform for your entire coaching institute.
            </p>

            <div className="mt-8 grid grid-cols-3 gap-3 max-w-md">
              {[{n:"3+",l:"Premium Batches"},{n:"200+",l:"Video Lectures"},{n:"Live",l:"YouTube Classes"}].map((s,i)=> (
                <div key={i} className="bg-white/10 backdrop-blur rounded-lg p-3 border border-white/15">
                  <div className="font-display text-2xl font-bold text-[#FDBA74]">{s.n}</div>
                  <div className="text-[11px] text-white/80 mt-0.5">{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-white/60 text-sm flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Secure JWT auth · Encrypted at rest
          </div>
        </div>
      </div>

      {/* Form side */}
      <div className="flex items-center justify-center p-6 sm:p-12 lg:col-span-2">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl grr-hero-gradient grid place-items-center text-white">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <div className="font-display font-extrabold text-lg tracking-tight leading-none text-slate-900">GYAN RISE</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-[#F97316] font-bold mt-1">RANA E-LEARNING</div>
            </div>
          </div>

          <div className="text-xs uppercase tracking-[0.3em] text-[#1D4ED8] mb-3 font-semibold">Welcome back</div>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Sign in to your account
          </h2>
          <p className="text-slate-500 mt-2 text-sm">Pick up right where you left off.</p>

          {/* Registration call-out — prominent, above the form */}
          <div className="mt-6 rounded-xl border border-[#FED7AA] bg-gradient-to-br from-orange-50 to-white p-4 shadow-sm" data-testid="new-student-callout">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-[#F97316] text-white grid place-items-center shrink-0">
                <UserPlus className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900">New to GYAN RISE?</div>
                <div className="text-xs text-slate-600 mt-0.5">Create your free student account in under a minute.</div>
              </div>
            </div>
            <Link to="/register" data-testid="goto-register">
              <Button type="button" className="mt-3 w-full h-11 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg font-semibold shadow-sm" data-testid="create-student-account-button">
                Create Student Account <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" />
            <div className="text-[11px] uppercase tracking-[0.25em] text-slate-400 font-semibold">Already have an account?</div>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <form onSubmit={submit} className="space-y-4" data-testid="login-form">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="mt-1.5 rounded-lg h-11" required data-testid="login-email-input" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  className="text-xs font-semibold text-[#1D4ED8] hover:text-[#1E40AF] hover:underline"
                  data-testid="login-forgot-password-link"
                >
                  Forgot password?
                </button>
              </div>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="mt-1.5 rounded-lg h-11" required data-testid="login-password-input" />
            </div>
            {err && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2" data-testid="login-error">{err}</div>
            )}
            <Button type="submit" className="w-full h-11 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-lg font-semibold" disabled={loading} data-testid="login-submit-button">
              {loading ? "Signing in..." : "Sign In"} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>

          <p className="mt-8 text-[11px] text-slate-400">
            This is the student portal. Authorized institute staff: please use your private admin URL.
          </p>

          {/* Founder welcome */}
          <FounderCard variant="compact" className="mt-8" />

          {/* Platform development credit */}
          <DeveloperFooter />
        </div>
      </div>

      {/* Forgot-password modal */}
      <Dialog open={forgotOpen} onOpenChange={(open) => (open ? setForgotOpen(true) : closeForgot())}>
        <DialogContent data-testid="forgot-password-dialog">
          {!forgotSent ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-[#1D4ED8]" /> Reset your password
                </DialogTitle>
                <DialogDescription>
                  Enter the email you used to register. We'll send a password reset link to that address.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={submitForgot} className="space-y-4 mt-2">
                <div>
                  <Label htmlFor="forgot-email">Registered email</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="mt-1.5 rounded-lg h-11"
                    required
                    data-testid="forgot-password-email-input"
                  />
                </div>
                <DialogFooter className="gap-2">
                  <Button type="button" variant="outline" onClick={closeForgot} data-testid="forgot-password-cancel">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={forgotLoading} className="bg-[#1D4ED8] hover:bg-[#1E40AF] text-white" data-testid="forgot-password-submit">
                    {forgotLoading ? "Sending..." : "Send reset link"}
                  </Button>
                </DialogFooter>
              </form>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" /> Check your inbox
                </DialogTitle>
                <DialogDescription>
                  If an account exists for <span className="font-semibold text-slate-800">{forgotEmail}</span>, we've sent a password reset link to it. The link will expire in 30 minutes.
                </DialogDescription>
              </DialogHeader>
              <p className="text-xs text-slate-500 mt-2">
                Didn't receive an email? Check your spam folder, or contact your institute admin for help.
              </p>
              <DialogFooter>
                <Button onClick={closeForgot} className="bg-[#1D4ED8] hover:bg-[#1E40AF] text-white" data-testid="forgot-password-done">
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
