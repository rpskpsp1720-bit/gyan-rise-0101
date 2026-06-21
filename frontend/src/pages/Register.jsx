import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraduationCap, ArrowRight, BookOpen, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErr("");
    try {
      const user = await register(name, email, password);
      toast.success(`Welcome to GYAN RISE, ${user.name}`);
      navigate("/dashboard");
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-5 bg-white">
      <div className="hidden lg:flex lg:col-span-3 relative overflow-hidden grr-hero-gradient">
        <div className="absolute inset-0 opacity-30 mix-blend-overlay" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1576086213369-97a306d36557?auto=format&fit=crop&q=85&w=2000')", backgroundSize: "cover", backgroundPosition: "center" }} />
        <div className="absolute inset-0 bg-gradient-to-br from-[#0B1E55]/80 via-transparent to-[#F97316]/40" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white/15 backdrop-blur grid place-items-center"><GraduationCap className="h-6 w-6" /></div>
            <div>
              <div className="font-display font-extrabold text-xl tracking-tight leading-none">GYAN RISE</div>
              <div className="text-[11px] uppercase tracking-[0.25em] text-[#FED7AA] font-bold mt-1">RANA E-LEARNING</div>
            </div>
          </div>
          <div>
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-orange-200 mb-4"><Sparkles className="h-3.5 w-3.5" />Join 1000+ aspirants</div>
            <h1 className="font-display text-4xl xl:text-6xl font-extrabold tracking-tighter leading-[0.95]">
              Build the rank you've <span className="text-[#FDBA74]">always imagined.</span>
            </h1>
            <p className="text-white/85 mt-6 max-w-md leading-relaxed">
              Get instant access to live YouTube classes, recorded lectures, PDF notes and MCQ tests — all organized by batch, subject and chapter.
            </p>
          </div>
          <div className="text-white/60 text-sm flex items-center gap-2"><BookOpen className="h-4 w-4" /> Student accounts only · Free to join</div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12 lg:col-span-2">
        <div className="w-full max-w-md">
          <div className="text-xs uppercase tracking-[0.3em] text-[#F97316] mb-3 font-semibold">Create student account</div>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">Start learning today</h2>
          <p className="text-slate-500 mt-2 text-sm">Sign up free — no credit card required.</p>

          <form onSubmit={submit} className="mt-8 space-y-4" data-testid="register-form">
            <div><Label htmlFor="name">Full name</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Aarav Sharma" required className="mt-1.5 rounded-lg h-11" data-testid="register-name-input" /></div>
            <div><Label htmlFor="email">Email</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required className="mt-1.5 rounded-lg h-11" data-testid="register-email-input" /></div>
            <div><Label htmlFor="password">Password</Label><Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 characters" required minLength={6} className="mt-1.5 rounded-lg h-11" data-testid="register-password-input" /></div>
            {err && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2" data-testid="register-error">{err}</div>}
            <Button type="submit" disabled={loading} className="w-full h-11 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg font-semibold" data-testid="register-submit-button">
              {loading ? "Creating..." : "Create student account"} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>

          <p className="mt-6 text-sm text-slate-500">
            Already have an account? <Link to="/login" className="text-[#1D4ED8] font-semibold hover:underline" data-testid="goto-login">Sign in</Link>
          </p>
          <p className="mt-3 text-[11px] text-slate-400">
            Only student accounts can register here. Admins are provisioned by the institute owner.
          </p>
        </div>
      </div>
    </div>
  );
}
