import { NavLink, Outlet } from "react-router-dom";
import { Users, MessageSquare, Activity, ArrowLeft, FileText, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";

const tabs = [
  { to: "/admin", end: true, label: "Users", icon: Users },
  { to: "/admin/progress", end: false, label: "Progress", icon: TrendingUp },
  { to: "/admin/essays", end: false, label: "Essays", icon: FileText },
  { to: "/admin/feedback", end: false, label: "Feedback", icon: MessageSquare },
  { to: "/admin/health", end: false, label: "System Health", icon: Activity },
];

const AdminLayout = () => (
  <div className="min-h-screen bg-background">
    <header className="border-b border-border bg-card">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4 flex-wrap">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> App
        </Link>
        <h1 className="text-lg font-semibold font-display text-foreground">Beta admin</h1>
        <nav className="ml-auto flex gap-1">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                  isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground"
                }`
              }
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
    <main className="max-w-6xl mx-auto px-4 py-6">
      <Outlet />
    </main>
  </div>
);

export default AdminLayout;
