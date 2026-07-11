import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, formatDuration } from "@/lib/apiClient";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronRight, PlayCircle, FileText, ClipboardList, Clock, ExternalLink } from "lucide-react";

export default function ChapterDetail() {
  const { chapterId } = useParams();
  const [chapter, setChapter] = useState(null);
  const [subject, setSubject] = useState(null);
  const [batch, setBatch] = useState(null);
  const [videos, setVideos] = useState([]);
  const [notes, setNotes] = useState([]);
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: ch } = await api.get(`/chapters/${chapterId}`);
      setChapter(ch);
      const { data: s } = await api.get(`/subjects/${ch.subject_id}`);
      setSubject(s);
      const [{ data: b }, { data: v }, { data: n }, { data: t }] = await Promise.all([
        api.get(`/batches/${s.batch_id}`),
        api.get(`/videos`, { params: { chapter_id: chapterId } }),
        api.get(`/notes`, { params: { chapter_id: chapterId } }),
        api.get(`/tests`, { params: { chapter_id: chapterId } }),
      ]);
      setBatch(b);
      setVideos(v);
      setNotes(n);
      setTests(t);
      setLoading(false);
    })();
  }, [chapterId]);

  if (loading) return <Skeleton className="h-64 w-full rounded-lg" />;

  return (
    <div className="space-y-8">
      <div className="text-sm text-slate-500" data-testid="breadcrumb">
        <Link to="/batches" className="hover:text-slate-900">Batches</Link>
        <ChevronRight className="inline h-3 w-3 mx-1" />
        <Link to={`/batches/${batch?.id}`} className="hover:text-slate-900">{batch?.name}</Link>
        <ChevronRight className="inline h-3 w-3 mx-1" />
        <Link to={`/subjects/${subject?.id}`} className="hover:text-slate-900">{subject?.name}</Link>
        <ChevronRight className="inline h-3 w-3 mx-1" />
        <span className="text-slate-900">{chapter?.name}</span>
      </div>

      <div>
        <div className="text-xs uppercase tracking-[0.25em] text-[#1D4ED8]">{subject?.name}</div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tighter text-slate-900 mt-1">{chapter?.name}</h1>
        <div className="text-slate-500 mt-2 inline-flex items-center gap-4 text-sm">
          <span>{videos.length} videos</span>
          <span>{notes.length} notes</span>
          <span>{tests.length} tests</span>
        </div>
      </div>

      <Tabs defaultValue="videos">
        <TabsList className="bg-white border border-slate-200 rounded-md p-1">
          <TabsTrigger value="videos" data-testid="tab-videos"><PlayCircle className="h-4 w-4 mr-1.5" />Videos</TabsTrigger>
          <TabsTrigger value="notes" data-testid="tab-notes"><FileText className="h-4 w-4 mr-1.5" />Notes</TabsTrigger>
          <TabsTrigger value="tests" data-testid="tab-tests"><ClipboardList className="h-4 w-4 mr-1.5" />Tests</TabsTrigger>
        </TabsList>

        <TabsContent value="videos" className="mt-6">
          {videos.length === 0 ? (
            <Empty msg="No videos yet." />
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100" data-testid="videos-list">
              {videos.map((v, i) => (
                <Link key={v.id} to={`/videos/${v.id}`} className="flex items-center gap-4 p-4 hover:bg-slate-50" data-testid={`video-row-${v.id}`}>
                  <div className="h-10 w-10 rounded-md bg-blue-50 text-[#1D4ED8] grid place-items-center flex-shrink-0">
                    <PlayCircle className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 truncate">{v.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5 inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {formatDuration(v.duration_seconds)}
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">Lesson {i + 1}</span>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-6">
          {notes.length === 0 ? (
            <Empty msg="No notes yet." />
          ) : (
            <div className="grid sm:grid-cols-2 gap-4" data-testid="notes-list">
              {notes.map((n) => (
                <Link key={n.id} to={`/notes/${n.id}/view`} className="bg-white border border-slate-200 rounded-lg p-5 hover:border-slate-300 transition-colors" data-testid={`note-card-${n.id}`}>
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-md bg-blue-50 text-[#1E40AF] grid place-items-center"><FileText className="h-5 w-5" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900">{n.title}</div>
                      <div className="text-xs text-slate-500 mt-1 line-clamp-2">{n.description}</div>
                      <div className="text-xs text-[#1E40AF] mt-2 inline-flex items-center gap-1 font-medium">Open PDF <ExternalLink className="h-3 w-3" /></div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tests" className="mt-6">
          {tests.length === 0 ? (
            <Empty msg="No tests yet." />
          ) : (
            <div className="grid sm:grid-cols-2 gap-4" data-testid="tests-list">
              {tests.map((t) => (
                <div key={t.id} className="bg-white border border-slate-200 rounded-lg p-5" data-testid={`test-card-${t.id}`}>
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-md bg-blue-50 text-[#1D4ED8] grid place-items-center"><ClipboardList className="h-5 w-5" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900">{t.title}</div>
                      <div className="text-xs text-slate-500 mt-1">{t.questions?.length || 0} questions • {t.duration_minutes} minutes</div>
                      <Link to={`/tests/${t.id}`}>
                        <Button className="mt-3 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-md h-9" data-testid={`start-test-${t.id}`}>
                          Start Test
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Empty({ msg }) {
  return (
    <div className="bg-white border border-dashed border-slate-300 rounded-lg p-10 text-center text-slate-500">{msg}</div>
  );
}
