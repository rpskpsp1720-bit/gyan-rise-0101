import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Award, Repeat2 } from "lucide-react";

export default function TestResult() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const raw = sessionStorage.getItem(`result_${testId}`);
  const data = raw ? JSON.parse(raw) : null;

  if (!data) {
    return (
      <div className="text-center text-slate-500 py-20" data-testid="no-result">
        No result found. <button onClick={() => navigate(-1)} className="text-[#1D4ED8] underline">Go back</button>
      </div>
    );
  }

  const passed = data.score_pct >= 60;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className={`rounded-lg p-8 text-white ${passed ? "bg-gradient-to-br from-[#16A34A] to-[#1D4ED8]" : "bg-gradient-to-br from-[#F97316] to-[#1E40AF]"}`} data-testid="result-hero">
        <Award className="h-10 w-10 mb-3 opacity-90" />
        <div className="text-xs uppercase tracking-[0.3em] text-white/80">Result</div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mt-1">{data.test_title}</h1>
        <div className="mt-6 grid grid-cols-3 gap-4">
          <Stat label="Score" value={`${data.score}/${data.total}`} />
          <Stat label="Percentage" value={`${data.score_pct}%`} />
          <Stat label="Time taken" value={`${Math.floor((data.time_taken_seconds || 0) / 60)} min`} />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100" data-testid="result-breakdown">
        {data.breakdown.map((b, i) => (
          <div key={i} className="p-5">
            <div className="flex items-start gap-3">
              <div className={`h-8 w-8 rounded-full grid place-items-center flex-shrink-0 ${b.is_correct ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                {b.is_correct ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-slate-500">Question {i + 1}</div>
                <div className="font-semibold text-slate-900 mt-0.5">{b.question}</div>
                <div className="mt-3 space-y-1.5 text-sm">
                  {b.options.map((opt, oi) => {
                    const isCorrect = oi === b.correct_index;
                    const isSelected = oi === b.selected_index;
                    return (
                      <div
                        key={oi}
                        className={`px-3 py-2 rounded-md border text-sm flex items-center gap-2 ${
                          isCorrect
                            ? "border-green-200 bg-green-50 text-green-800"
                            : isSelected
                            ? "border-red-200 bg-blue-50 text-red-800"
                            : "border-slate-200 text-slate-600"
                        }`}
                      >
                        <span className="font-semibold">{String.fromCharCode(65 + oi)}.</span>
                        <span className="flex-1">{opt}</span>
                        {isCorrect && <span className="text-xs font-medium">Correct</span>}
                        {isSelected && !isCorrect && <span className="text-xs font-medium">Your answer</span>}
                      </div>
                    );
                  })}
                </div>
                {b.explanation && (
                  <div className="mt-3 text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-md p-3">
                    <span className="font-semibold text-slate-900">Explanation: </span>{b.explanation}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <Button onClick={() => navigate(`/tests/${testId}`)} className="bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-md" data-testid="retake-btn">
          <Repeat2 className="h-4 w-4 mr-2" /> Retake Test
        </Button>
        <Button variant="outline" onClick={() => navigate(-2)} className="rounded-md" data-testid="back-to-chapter-btn">
          Back to Chapter
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-white/70">{label}</div>
      <div className="font-display font-bold text-2xl sm:text-3xl mt-1">{value}</div>
    </div>
  );
}
