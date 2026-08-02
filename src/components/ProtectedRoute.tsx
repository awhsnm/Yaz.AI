import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const ProtectedRoute = ({ role, children }: { role?: "teacher" | "student"; children: React.ReactNode }) => {
  const { user, role: userRole, loading } = useAuth();
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground font-display">Loading...</div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (role && userRole && userRole !== role) {
    return <Navigate to={userRole === "teacher" ? "/teacher-dashboard" : "/student-dashboard"} replace />;
  }
  return <>{children}</>;
};

export default ProtectedRoute;