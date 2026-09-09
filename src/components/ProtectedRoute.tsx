import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import BetaLocked from "@/pages/BetaLocked";

const ProtectedRoute = ({
  role,
  admin,
  children,
}: {
  role?: "teacher" | "student";
  admin?: boolean;
  children: React.ReactNode;
}) => {
  const { user, role: userRole, isAdmin, betaStatus, loading } = useAuth();

  if (loading || (user && betaStatus === "loading")) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground font-display">Loading...</div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!user.email_confirmed_at) return <Navigate to="/verify-email" replace />;

  if (betaStatus !== "active") return <BetaLocked />;

  if (admin) {
    if (!isAdmin) return <Navigate to="/" replace />;
    return <>{children}</>;
  }

  if (isAdmin) return <>{children}</>;

  if (role && userRole && userRole !== role) {
    return <Navigate to={userRole === "teacher" ? "/teacher-dashboard" : "/student-dashboard"} replace />;
  }
  return <>{children}</>;
};

export default ProtectedRoute;
