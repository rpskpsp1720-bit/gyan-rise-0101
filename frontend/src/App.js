import "@/App.css";
import "@/index.css";
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster, toast } from "@/components/ui/sonner";
import Login from "@/pages/Login";
import AdminLogin from "@/pages/AdminLogin";
import Register from "@/pages/Register";
import AppLayout from "@/components/AppLayout";
import StudentDashboard from "@/pages/student/Dashboard";
import StudentBatches from "@/pages/student/Batches";
import BatchDetail from "@/pages/student/BatchDetail";
import SubjectDetail from "@/pages/student/SubjectDetail";
import ChapterDetail from "@/pages/student/ChapterDetail";
import NoteViewer from "@/pages/student/NoteViewer";
import VideoPlayer from "@/pages/student/VideoPlayer";
import LiveClasses from "@/pages/student/LiveClasses";
import BlockedAccess from "@/pages/student/BlockedAccess";
import TestPage from "@/pages/student/TestPage";
import TestResult from "@/pages/student/TestResult";
import RecentlyViewed from "@/pages/student/RecentlyViewed";
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminBatches from "@/pages/admin/Batches";
import AdminSubjects from "@/pages/admin/Subjects";
import AdminChapters from "@/pages/admin/Chapters";
import AdminVideos from "@/pages/admin/Videos";
import AdminNotes from "@/pages/admin/Notes";
import AdminTests from "@/pages/admin/Tests";
import AdminTestEditor from "@/pages/admin/TestEditor";
import AdminLiveClasses from "@/pages/admin/LiveClasses";
import AdminNotifications from "@/pages/admin/Notifications";
import AdminStudents from "@/pages/admin/Students";
import AdminDigitalStore from "@/pages/admin/DigitalStore";
import AdminSettings from "@/pages/admin/Settings";
import StudentDigitalStore from "@/pages/student/DigitalStore";
import DigitalPdfDetail from "@/pages/student/DigitalPdfDetail";
import DigitalPdfViewer from "@/pages/student/DigitalPdfViewer";
import Checkout from "@/pages/student/Checkout";

function Guard({ children, role }) {
  const { user } = useAuth();
  const location = useLocation();
  if (user === null) {
    return (
      <div className="min-h-screen grid place-items-center text-slate-400">
        <div data-testid="loading-state">Loading…</div>
      </div>
    );
  }
  const onAdminPath = location.pathname.startsWith("/admin");
  if (!user) return <Navigate to={onAdminPath ? "/admin-login" : "/login"} replace />;
  if (role && user.role !== role) return <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} replace />;
  return children;
}

function RootRedirect() {
  const { user } = useAuth();
  if (user === null) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} replace />;
}

function StudentNavigationLock() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!user || user.role !== "student") return undefined;

    const isYouTubeUrl = (u) => {
      try {
        const host = new URL(u, window.location.origin).hostname.toLowerCase();
        return host.endsWith("youtube.com") || host.endsWith("youtu.be") || host.endsWith("youtube-nocookie.com");
      } catch {
        return false;
      }
    };

    const isExternalLink = (u) => {
      try {
        const url = new URL(u, window.location.href);
        return url.origin !== window.location.origin;
      } catch {
        return false;
      }
    };

    const blockStudentNavigation = () => {
      toast.error("External navigation is restricted for student accounts.");
      if (location.pathname !== "/blocked-access") navigate("/blocked-access");
    };

    const origOpen = window.open;
    window.open = function patchedOpen(url, ...rest) {
      if (typeof url === "string" && (isYouTubeUrl(url) || isExternalLink(url))) {
        blockStudentNavigation();
        return null;
      }
      return origOpen.call(window, url, ...rest);
    };

    const onClickCapture = (e) => {
      let el = e.target;
      while (el && el !== document.body) {
        if (el.tagName === "A" && el.href) {
          if (isYouTubeUrl(el.href) || isExternalLink(el.href)) {
            e.preventDefault();
            e.stopPropagation();
            blockStudentNavigation();
            return;
          }
        }
        el = el.parentElement;
      }
    };

    document.addEventListener("click", onClickCapture, true);
    return () => {
      document.removeEventListener("click", onClickCapture, true);
      window.open = origOpen;
    };
  }, [user, navigate, location.pathname]);

  return null;
}

function App() {
  useEffect(() => {
    // App-wide content protection
    const isInteractiveTarget = (el) => {
      if (!el) return false;
      const tag = (el.tagName || "").toLowerCase();
      return tag === "input" || tag === "textarea" || el.isContentEditable;
    };
    const onContext = (e) => {
      if (!isInteractiveTarget(e.target)) e.preventDefault();
    };
    const onDragStart = (e) => {
      const tag = (e.target?.tagName || "").toLowerCase();
      if (tag === "img" || tag === "video" || tag === "iframe") e.preventDefault();
    };
    const onKey = (e) => {
      // Block save (Ctrl/Cmd+S), select-all on the page (allow inside inputs), and view-source shortcuts
      const k = e.key?.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && ["s", "p"].includes(k)) {
        if (!isInteractiveTarget(e.target)) e.preventDefault();
      }
      // Block F12 / DevTools-ish keys is unreliable across browsers; intentionally NOT trying to block DevTools
    };

    document.addEventListener("contextmenu", onContext, true);
    document.addEventListener("dragstart", onDragStart, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("contextmenu", onContext, true);
      document.removeEventListener("dragstart", onDragStart, true);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster richColors position="top-right" />
        <StudentNavigationLock />
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/register" element={<Register />} />

          {/* Student */}
          <Route element={<Guard role="student"><AppLayout /></Guard>}>
            <Route path="/dashboard" element={<StudentDashboard />} />
            <Route path="/batches" element={<StudentBatches />} />
            <Route path="/batches/:batchId" element={<BatchDetail />} />
            <Route path="/subjects/:subjectId" element={<SubjectDetail />} />
            <Route path="/chapters/:chapterId" element={<ChapterDetail />} />
            <Route path="/notes/:noteId/view" element={<NoteViewer />} />
            <Route path="/videos/:videoId" element={<VideoPlayer />} />
            <Route path="/live-classes" element={<LiveClasses />} />
            <Route path="/recent" element={<RecentlyViewed />} />
            <Route path="/store" element={<StudentDigitalStore />} />
            <Route path="/store/view/:pdfId" element={<DigitalPdfDetail />} />
            <Route path="/store/read/:pdfId" element={<DigitalPdfViewer />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/tests/:testId" element={<TestPage />} />
            <Route path="/tests/:testId/result" element={<TestResult />} />
            <Route path="/blocked-access" element={<BlockedAccess />} />
          </Route>

          {/* Admin */}
          <Route element={<Guard role="admin"><AppLayout /></Guard>}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/batches" element={<AdminBatches />} />
            <Route path="/admin/subjects" element={<AdminSubjects />} />
            <Route path="/admin/chapters" element={<AdminChapters />} />
            <Route path="/admin/videos" element={<AdminVideos />} />
            <Route path="/admin/notes" element={<AdminNotes />} />
            <Route path="/admin/tests" element={<AdminTests />} />
            <Route path="/admin/tests/:testId/edit" element={<AdminTestEditor />} />
            <Route path="/admin/tests/new" element={<AdminTestEditor />} />
            <Route path="/admin/live-classes" element={<AdminLiveClasses />} />
            <Route path="/admin/notifications" element={<AdminNotifications />} />
            <Route path="/admin/students" element={<AdminStudents />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
            <Route path="/admin/digital-store" element={<AdminDigitalStore />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
