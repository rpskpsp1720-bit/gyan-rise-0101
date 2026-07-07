import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard,
  BookOpen,
  Radio,
  GraduationCap,
  FileText,
  ClipboardList,
  Atom,
  Users,
  History,
  LogOut,
  Menu,
  X,
  Library,
  Video as VideoIcon,
  Bell,
  Settings as SettingsIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const studentNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/batches", label: "My Batches", icon: BookOpen, testid: "nav-batches" },
  { to: "/store", label: "Digital Store", icon: FileText, testid: "nav-store" },
  { to: "/recent", label: "Recently Viewed", icon: History, testid: "nav-recent" },
  { to: "/live-classes", label: "Live Classes", icon: Radio, testid: "nav-live-classes" },
];

const adminNav = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, testid: "nav-admin-dashboard", end: true },
  { to: "/admin/batches", label: "Batches", icon: Library, testid: "nav-admin-batches" },
  { to: "/admin/subjects", label: "Subjects", icon: Atom, testid: "nav-admin-subjects" },
  { to: "/admin/chapters", label: "Chapters", icon: BookOpen, testid: "nav-admin-chapters" },
  { to: "/admin/videos", label: "Videos", icon: VideoIcon, testid: "nav-admin-videos" },
  { to: "/admin/notes", label: "Notes", icon: FileText, testid: "nav-admin-notes" },
  { to: "/admin/digital-store", label: "Digital Store", icon: Library, testid: "nav-admin-digital-store" },
  { to: "/admin/tests", label: "MCQ Tests", icon: ClipboardList, testid: "nav-admin-tests" },
  { to: "/admin/live-classes", label: "Live Classes", icon: Radio, testid: "nav-admin-live" },
  { to: "/admin/notifications", label: "Notifications", icon: Bell, testid: "nav-admin-notifications" },
  { to: "/admin/students", label: "Students", icon: Users, testid: "nav-admin-students" },
  { to: "/admin/settings", label: "Settings", icon: SettingsIcon, testid: "nav-admin-settings" },
];

function NavItem({ to, label, icon: Icon, testid, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      data-testid={testid}
      className={({ isActive }) =>
        `relative flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? "text-[#1E40AF] bg-blue-50 side-active"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
        }`
      }
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </NavLink>
  );
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const nav = user?.role === "admin" ? adminNav : studentNav;

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-[#F5F7FB] flex">
      {/* Sidebar */}
      <aside
        data-testid="sidebar"
        className={`fixed lg:static z-40 inset-y-0 left-0 w-64 bg-white border-r border-slate-200 flex flex-col transform ${
          open ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 transition-transform`}
      >
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-lg overflow-hidden bg-white grid place-items-center shadow-sm border border-slate-100">
              <img src="/logo.png" alt="GYAN RISE" className="h-full w-full object-contain" data-testid="brand-logo-sidebar" />
            </div>
            <div>
              <div className="font-display font-extrabold tracking-tight text-[15px] leading-none text-slate-900">GYAN RISE</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-[#F97316] font-bold mt-0.5">Engr. RP Singh, E-learning</div>
            </div>
          </div>
          <button className="lg:hidden text-slate-500" onClick={() => setOpen(false)} data-testid="sidebar-close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto thin-scroll">
          <div className="text-xs uppercase tracking-widest text-slate-400 px-3 mb-2">
            {user?.role === "admin" ? "Admin" : "Learn"}
          </div>
          {nav.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>

        <div className="p-3 border-t border-slate-200">
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar className="h-9 w-9">
              <AvatarImage src={user?.avatar_url} alt={user?.name} />
              <AvatarFallback className="bg-slate-200 text-slate-700">
                {user?.name?.[0]?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-900 truncate" data-testid="current-user-name">
                {user?.name}
              </div>
              <div className="text-xs text-slate-500 truncate">{user?.email}</div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-2"
            onClick={handleLogout}
            data-testid="logout-btn"
          >
            <LogOut className="h-4 w-4 mr-2" /> Logout
          </Button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          onClick={() => setOpen(false)}
          data-testid="sidebar-overlay"
        />
      )}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-20">
          <button
            className="lg:hidden text-slate-600"
            onClick={() => setOpen(true)}
            data-testid="sidebar-open"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden lg:block font-display text-sm uppercase tracking-widest text-slate-500">
            {user?.role === "admin" ? "GYAN RISE — Admin Console" : "GYAN RISE — Student Portal"}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-slate-600 hidden sm:block" data-testid="header-greeting">
              Hi, <span className="font-semibold text-slate-900">{user?.name?.split(" ")[0]}</span>
            </div>
          </div>
        </header>
        <main className="flex-1 px-4 lg:px-8 py-6 lg:py-10 max-w-[1400px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
