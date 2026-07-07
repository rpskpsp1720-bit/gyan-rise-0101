import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/apiClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Clock, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { toast } from "sonner";

export default function TestPage() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const [test, setTest] = useState(null);
  const [started, setStarted] = useState(false);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [startTs, setStartTs] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await api.get(`/tests/${testId}`);
      setTest(data);
      setTimeLeft((data.duration_minutes || 10) * 60);
    })();
  }, [testId]);

  useEffect(() => {
    if (!started) return;
    if (timeLeft <= 0) {
      handleSubmit();
      return;
    }
    const id = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, timeLeft]);

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const ss = String(timeLeft % 60).padStart(2, "0");

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    const payload = {
      test_id: testId,
      answers: Object.entries(answers).map(([qi, si]) => ({ question_index: Number(qi), selected_index: si })),
      time_taken_seconds: Math.max(0, Math.floor((Date.now() - startTs) / 1000)),
    };
    try {
      const { data } = await api.post(`/tests/submit`, payload);
      sessionStorage.setItem(`result_${testId}`, JSON.stringify(data));
      navigate(`/tests/${testId}/result`);
    } catch (e) {
      toast.error("Submission failed");
      setSubmitting(false);
    }
  };

  if (!test) return <Skeleton className="h-96 w-full rounded-lg" />;

  if (!started) {
    return (
      <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-lg p-8" data-testid="test-intro">
        <div className="text-xs uppercase tracking-[0.25em] text-[#1D4ED8]">MCQ Test</div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 mt-1">{test.title}</h1>
        <p className="text-slate-500 mt-2">{test.description}</p>
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="border border-slate-200 rounded-md p-4">
            <div className="text-xs uppercase tracking-widest text-slate-500">Questions</div>
            <div className="font-display text-3xl font-bold text-slate-900 mt-1">{test.questions.length}</div>
          </div>
          <div className="border border-slate-200 rounded-md p-4">
            <div className="text-xs uppercase tracking-widest text-slate-500">Duration</div>
            <div className="font-display text-3xl font-bold text-slate-900 mt-1">{test.duration_minutes} min</div>
          </div>
        </div>
        <ul className="mt-6 text-sm text-slate-600 space-y-1.5 list-disc list-inside">
          <li>Timer starts as soon as you click Start.</li>
          <li>Test auto-submits when time runs out.</li>
          <li>You can revisit questions before submitting.</li>
        </ul>
        <Button
          className="mt-8 w-full bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-md h-11"
          onClick={() => { setStarted(true); setStartTs(Date.now()); }}
          data-testid="start-test-btn"
        >
          Start Test
        </Button>
      </div>
    );
  }

  const q = test.questions[idx];
  const selected = answers[idx];
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Question {idx + 1} of {test.questions.length}</div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-50 text-[#1D4ED8] font-mono font-semibold" data-testid="timer">
            <Clock className="h-4 w-4" /> {mm}:{ss}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 shadow-sm" data-testid="question-card">
          <h2 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">{q.question}</h2>
          <div className="mt-6 space-y-3">
            {q.options.map((opt, i) => {
              const isSelected = selected === i;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setAnswers({ ...answers, [idx]: i })}
                  className={`w-full text-left p-4 border rounded-md transition-colors flex items-center gap-3 ${
                    isSelected
                      ? "border-[#1D4ED8] bg-blue-50 text-[#1D4ED8] font-medium"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700"
                  }`}
                  data-testid={`option-${idx}-${i}`}
                >
                  <span className={`h-6 w-6 rounded-full grid place-items-center text-xs font-semibold ${isSelected ? "bg-[#1D4ED8] text-white" : "bg-slate-100 text-slate-600"}`}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="flex-1">{opt}</span>
                  {isSelected && <Check className="h-4 w-4" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Button variant="outline" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)} className="rounded-md" data-testid="prev-question-btn">
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
          </Button>
          {idx < test.questions.length - 1 ? (
            <Button onClick={() => setIdx((i) => i + 1)} className="bg-[#1E40AF] hover:bg-[#1E40AF]/90 text-white rounded-md" data-testid="next-question-btn">
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting} className="bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-md" data-testid="submit-test-btn">
              {submitting ? "Submitting..." : "Submit Test"}
            </Button>
          )}
        </div>
      </div>

      <aside className="bg-white border border-slate-200 rounded-lg p-4 h-fit" data-testid="question-palette">
        <div className="text-xs uppercase tracking-widest text-slate-500 mb-3">Palette</div>
        <div className="grid grid-cols-5 gap-2">
          {test.questions.map((_, i) => {
            const ans = answers[i] != null;
            const current = i === idx;
            return (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`h-9 rounded-md text-xs font-semibold ${
                  current
                    ? "bg-[#1D4ED8] text-white"
                    : ans
                    ? "bg-green-100 text-green-700"
                    : "bg-slate-100 text-slate-600"
                }`}
                data-testid={`palette-${i}`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
        <div className="text-xs text-slate-500 mt-4">Answered: {answeredCount} / {test.questions.length}</div>
        <Button onClick={handleSubmit} disabled={submitting} className="mt-4 w-full bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-md" data-testid="palette-submit-btn">
          {submitting ? "Submitting..." : "Submit Test"}
        </Button>
      </aside>
    </div>
  );
}
