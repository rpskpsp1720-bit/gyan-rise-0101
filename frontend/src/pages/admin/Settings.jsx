import React, { useState } from "react";
import { api } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { KeyRound, Eye, EyeOff, ShieldCheck } from "lucide-react";

/**
 * Admin → Settings → Change Password.
 *
 * Pure presentational form. Posts to /api/auth/change-password (requires the
 * caller's CURRENT password, then sets the new one server-side using the
 * same bcrypt helper the rest of the project uses).
 *
 * No email/OTP reset flow is implemented here — by explicit user instruction.
 */
export default function AdminSettings() {
  const { user } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!current || !next || !confirm) {
      toast.error("All fields are required");
      return;
    }
    if (next.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (next === current) {
      toast.error("New password must be different from current password");
      return;
    }
    if (next !== confirm) {
      toast.error("New password and confirmation do not match");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/auth/change-password", {
        current_password: current,
        new_password: next,
      });
      toast.success("Password changed successfully");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to change password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl" data-testid="admin-settings-page">
      <div>
        <div className="text-xs uppercase tracking-[0.25em] text-[#1D4ED8]">Settings</div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tighter text-slate-900 mt-1">
          Account & Security
        </h1>
        <p className="text-slate-500 mt-2 text-sm">
          Signed in as <span className="font-semibold text-slate-900">{user?.email}</span>
        </p>
      </div>

      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="grr-hero-gradient h-1.5 w-full" aria-hidden="true" />
        <div className="p-5 sm:p-7">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-lg bg-blue-50 text-[#1D4ED8] grid place-items-center">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <div className="font-display text-lg font-bold text-slate-900 leading-tight">Change Password</div>
              <div className="text-xs text-slate-500 mt-0.5">
                Verifies your current password before saving the new one.
              </div>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-4" autoComplete="off">
            <PasswordField
              id="current-password"
              label="Current Password"
              value={current}
              onChange={setCurrent}
              shown={show.current}
              onToggle={() => setShow((s) => ({ ...s, current: !s.current }))}
              testid="change-pw-current"
              autoComplete="current-password"
            />
            <PasswordField
              id="new-password"
              label="New Password"
              value={next}
              onChange={setNext}
              shown={show.next}
              onToggle={() => setShow((s) => ({ ...s, next: !s.next }))}
              hint="At least 6 characters"
              testid="change-pw-new"
              autoComplete="new-password"
            />
            <PasswordField
              id="confirm-password"
              label="Confirm New Password"
              value={confirm}
              onChange={setConfirm}
              shown={show.confirm}
              onToggle={() => setShow((s) => ({ ...s, confirm: !s.confirm }))}
              testid="change-pw-confirm"
              autoComplete="new-password"
            />

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                type="submit"
                disabled={submitting}
                className="bg-[#1D4ED8] hover:bg-[#1E40AF] text-white min-w-[180px]"
                data-testid="change-pw-submit"
              >
                <ShieldCheck className="h-4 w-4 mr-2" />
                {submitting ? "Updating…" : "Update Password"}
              </Button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}

function PasswordField({ id, label, value, onChange, shown, onToggle, hint, testid, autoComplete }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm text-slate-700">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={shown ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          data-testid={testid}
          className="pr-10"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
          aria-label={shown ? "Hide password" : "Show password"}
          data-testid={`${testid}-toggle`}
        >
          {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hint && <div className="text-xs text-slate-400">{hint}</div>}
    </div>
  );
}
