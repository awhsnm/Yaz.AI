import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Auth from "./pages/Auth.tsx";
import Landing from "./pages/Landing.tsx";
import StudentDashboard from "./pages/StudentDashboard.tsx";
import StudentWorkspace from "./pages/StudentWorkspace.tsx";
import JoinLesson from "./pages/JoinLesson.tsx";
import TeacherDashboard from "./pages/TeacherDashboard.tsx";
import TeacherReview from "./pages/TeacherReview.tsx";
import TeacherClassroom from "./pages/TeacherClassroom.tsx";
import TeacherAssignment from "./pages/TeacherAssignment.tsx";
import StudentFeedback from "./pages/StudentFeedback.tsx";
import EssayEvaluation from "./pages/EssayEvaluation.tsx";
import ResearchPilot from "./pages/ResearchPilot.tsx";
import VerifyEmail from "./pages/VerifyEmail.tsx";
import SecuritySettings from "./pages/SecuritySettings.tsx";
import OAuthConsent from "./pages/OAuthConsent.tsx";
import NotFound from "./pages/NotFound.tsx";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import FeedbackButton from "./components/FeedbackButton";
import { AuthProvider } from "./hooks/useAuth";
import { SettingsProvider } from "./contexts/SettingsContext";

const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminEssays = lazy(() => import("./pages/admin/AdminEssays"));
const AdminProgress = lazy(() => import("./pages/admin/AdminProgress"));
const AdminFeedback = lazy(() => import("./pages/admin/AdminFeedback"));
const AdminHealth = lazy(() => import("./pages/admin/AdminHealth"));

const queryClient = new QueryClient();

const AdminFallback = (
  <div className="min-h-screen flex items-center justify-center text-muted-foreground font-display">Loading...</div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ErrorBoundary>
        <BrowserRouter>
          <AuthProvider>
            <SettingsProvider>
              <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/settings/security" element={<ProtectedRoute><SecuritySettings /></ProtectedRoute>} />
              <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
              <Route path="/student-dashboard" element={<ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>} />
              <Route path="/join" element={<ProtectedRoute role="student"><JoinLesson /></ProtectedRoute>} />
              <Route path="/essay/:id" element={<ProtectedRoute role="student"><StudentWorkspace /></ProtectedRoute>} />
              <Route path="/teacher-dashboard" element={<ProtectedRoute role="teacher"><TeacherDashboard /></ProtectedRoute>} />
              <Route path="/review/:id" element={<ProtectedRoute role="teacher"><TeacherReview /></ProtectedRoute>} />
              <Route path="/classroom/:id" element={<ProtectedRoute role="teacher"><TeacherClassroom /></ProtectedRoute>} />
              <Route path="/assignment/:id" element={<ProtectedRoute role="teacher"><TeacherAssignment /></ProtectedRoute>} />
              <Route path="/evaluation/:id" element={<ProtectedRoute role="student"><EssayEvaluation /></ProtectedRoute>} />
              <Route path="/feedback/:id" element={<ProtectedRoute role="student"><StudentFeedback /></ProtectedRoute>} />
              {/* Admin-only beta console. */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute admin>
                    <Suspense fallback={AdminFallback}>
                      <AdminLayout />
                    </Suspense>
                  </ProtectedRoute>
                }
              >
                <Route index element={<Suspense fallback={AdminFallback}><AdminUsers /></Suspense>} />
                <Route path="progress" element={<Suspense fallback={AdminFallback}><AdminProgress /></Suspense>} />
                <Route path="essays" element={<Suspense fallback={AdminFallback}><AdminEssays /></Suspense>} />
                <Route path="feedback" element={<Suspense fallback={AdminFallback}><AdminFeedback /></Suspense>} />
                <Route path="health" element={<Suspense fallback={AdminFallback}><AdminHealth /></Suspense>} />
              </Route>
              {/* Hidden, invitation-only research pilot. Intentionally unlinked from all public navigation. */}
              <Route path="/research-pilot" element={<ProtectedRoute role="student"><ResearchPilot /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
              </Routes>
              <FeedbackButton />
            </SettingsProvider>
          </AuthProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
