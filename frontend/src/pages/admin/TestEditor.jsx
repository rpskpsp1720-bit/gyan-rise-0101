import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ArrowLeft, Save, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const emptyQ = { question: "", options: ["", "", "", ""], correct_index: 0, explanation: "" };

export default function AdminTestEditor() {
  const { testId } = useParams();
  const isNew = !testId;
  const navigate = useNavigate();
  const [chapters, setChapters] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [form, setForm] = useState({
    chapter_id: "",
    title: "",
    description: "",
    duration_minutes: 10,
    questions: [{ ...emptyQ }],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: ch }, { data: s }] = await Promise.all([api.get("/chapters"), api.get("/subjects")]);
      setChapters(ch);
      setSubjects(s);
      if (!isNew) {
        const { data } = await api.get(`/tests/${testId}`);
        setForm({
          chapter_id: data.chapter_id,
          title: data.title,
          description: data.description || "",
          duration_minutes: data.duration_minutes,
          questions: data.questions.map((q) => ({
            question: q.question,
            options: q.options,
            correct_index: q.correct_index ?? 0,
            explanation: q.explanation || "",
          })),
        });
      }
    })();
  }, [testId, isNew]);

  const chapterLabel = (id) => {
    const c = chapters.find(x => x.id === id);
    if (!c) return "—";
    const s = subjects.find(x => x.id === c.subject_id);
    return `${c.name} • ${s?.name || ""}`;
  };

  const updateQ = (i, patch) => {
    setForm(f => {
      const qs = [...f.questions];
      qs[i] = { ...qs[i], ...patch };
      return { ...f, questions: qs };
    });
  };
  const updateOpt = (qi, oi, val) => updateQ(qi, { options: form.questions[qi].options.map((o, i) => i === oi ? val : o) });
  const addQ = () => setForm(f => ({ ...f, questions: [...f.questions, { ...emptyQ, options: ["", "", "", ""] }] }));
  const delQ = (i) => setForm(f => ({ ...f, questions: f.questions.filter((_, x) => x !== i) }));

  const save = async () => {
    if (!form.chapter_id || !form.title) { toast.error("Chapter and title required"); return; }
    for (let i = 0; i < form.questions.length; i++) {
      const q = form.questions[i];
      if (!q.question.trim() || q.options.some(o => !o.trim())) {
        toast.error(`Question ${i + 1}: fill question and all 4 options`); return;
      }
    }
    setSaving(true);
    try {
      const payload = { ...form, duration_minutes: Number(form.duration_minutes) || 10 };
      if (isNew) await api.post(`/tests`, payload);
      else await api.put(`/tests/${testId}`, payload);
      toast.success("Test saved");
      navigate("/admin/tests");
    } catch (e) { toast.error("Save failed"); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <Link to="/admin/tests" className="text-sm text-slate-500 hover:text-slate-900 inline-flex items-center gap-1" data-testid="back-to-tests">
        <ArrowLeft className="h-4 w-4" /> All Tests
      </Link>

      <div>
        <div className="text-xs uppercase tracking-[0.25em] text-[#1D4ED8]">{isNew ? "Create" : "Edit"}</div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tighter text-slate-900 mt-1">MCQ Test</h1>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <div>
          <Label>Chapter</Label>
          <Select value={form.chapter_id} onValueChange={(v) => setForm({ ...form, chapter_id: v })}>
            <SelectTrigger data-testid="test-chapter-select"><SelectValue placeholder="Select chapter" /></SelectTrigger>
            <SelectContent>{chapters.map(c => <SelectItem key={c.id} value={c.id}>{chapterLabel(c.id)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} data-testid="test-title-input" /></div>
          <div><Label>Duration (minutes)</Label><Input type="number" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: e.target.value })} data-testid="test-duration-input" /></div>
        </div>
        <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} data-testid="test-description-input" /></div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold tracking-tight text-slate-900">Questions ({form.questions.length})</h2>
          <Button onClick={addQ} variant="outline" className="rounded-md" data-testid="add-question-btn"><Plus className="h-4 w-4 mr-2" />Add Question</Button>
        </div>

        {form.questions.map((q, qi) => (
          <div key={qi} className="bg-white border border-slate-200 rounded-lg p-5 space-y-3" data-testid={`question-editor-${qi}`}>
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-widest text-slate-500">Question {qi + 1}</div>
              {form.questions.length > 1 && (
                <Button variant="ghost" size="sm" onClick={() => delQ(qi)} className="text-red-600" data-testid={`delete-question-${qi}`}><Trash2 className="h-4 w-4" /></Button>
              )}
            </div>
            <Textarea
              value={q.question}
              onChange={(e) => updateQ(qi, { question: e.target.value })}
              placeholder="Type the question..."
              data-testid={`question-text-${qi}`}
            />
            <div className="grid sm:grid-cols-2 gap-2">
              {q.options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <button
                    onClick={() => updateQ(qi, { correct_index: oi })}
                    type="button"
                    className={`h-9 w-9 rounded-md grid place-items-center text-sm font-semibold flex-shrink-0 ${q.correct_index === oi ? "bg-green-100 text-green-700 ring-2 ring-green-500" : "bg-slate-100 text-slate-600"}`}
                    data-testid={`correct-${qi}-${oi}`}
                    title="Mark as correct"
                  >
                    {q.correct_index === oi ? <CheckCircle2 className="h-4 w-4" /> : String.fromCharCode(65 + oi)}
                  </button>
                  <Input
                    value={opt}
                    onChange={(e) => updateOpt(qi, oi, e.target.value)}
                    placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                    data-testid={`option-${qi}-${oi}`}
                  />
                </div>
              ))}
            </div>
            <div>
              <Label className="text-xs">Explanation (optional)</Label>
              <Textarea value={q.explanation} onChange={(e) => updateQ(qi, { explanation: e.target.value })} placeholder="Why is the correct answer correct?" data-testid={`explanation-${qi}`} />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving} className="bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-md" data-testid="save-test-btn">
          <Save className="h-4 w-4 mr-2" /> {saving ? "Saving..." : "Save Test"}
        </Button>
        <Button variant="outline" onClick={() => navigate("/admin/tests")} className="rounded-md">Cancel</Button>
      </div>
    </div>
  );
}
