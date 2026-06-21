import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraduationCap, ArrowRight, Sparkles, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
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
      toast.success(`Welcome back, ${user.name}`);
      navigate(user.role === "admin" ? "/admin" : "/dashboard");
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const quickFillStudent = () => { setEmail("student@lms.com"); setPassword("student123"); };

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

          <form onSubmit={submit} className="mt-8 space-y-4" data-testid="login-form">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="mt-1.5 rounded-lg h-11" required data-testid="login-email-input" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="mt-1.5 rounded-lg h-11" required data-testid="login-password-input" />
            </div>
            {err && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2" data-testid="login-error">{err}</div>
            )}
            <Button type="submit" className="w-full h-11 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-lg font-semibold" disabled={loading} data-testid="login-submit-button">
              {loading ? "Signing in..." : "Sign In"} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>

          <div className="mt-6">
            <div className="text-xs uppercase tracking-widest text-slate-400 mb-2">Demo student account</div>
            <button type="button" onClick={quickFillStudent} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-left hover:bg-blue-50 hover:border-blue-200 transition-colors" data-testid="demo-student-btn">
              <div className="font-semibold text-slate-800">Try as Student</div>
              <div className="text-xs text-slate-500">student@lms.com · click to autofill</div>
            </button>
          </div>

          <p className="mt-8 text-sm text-slate-500">
            New here?{" "}
            <Link to="/register" className="text-[#1D4ED8] font-semibold hover:underline" data-testid="goto-register">
              Create a student account
            </Link>
          </p>
          <p className="mt-2 text-[11px] text-slate-400">
            This is the student portal. Authorized institute staff: please use your private admin URL.
          </p>
        </div>
      </div>
    </div>
  );
}
