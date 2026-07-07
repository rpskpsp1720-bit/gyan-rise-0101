import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function BlockedAccess() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen grid place-items-center px-4 py-10">
      <div className="max-w-2xl bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-sm">
        <div className="text-[#b91c1c] text-sm font-semibold uppercase tracking-[0.25em] mb-3">
          External navigation blocked
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mb-4">
          YouTube links are restricted for student accounts
        </h1>
        <p className="text-slate-600 text-base leading-7 mb-6">
          The video remains playable inside Lecture Hub, but students cannot leave the LMS to open YouTube or share external content from this lesson.
          Please stay inside the platform to continue learning safely.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Stay in LMS
          </Button>
          <Button onClick={() => navigate("/dashboard")} className="bg-[#1D4ED8] hover:bg-[#1E40AF] text-white">
            Back to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
