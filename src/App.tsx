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
import StudentFeedback from "./pages/StudentFeedback.tsx";
import EssayEvaluation from "./pages/EssayEvaluation.tsx";
import ResearchPilot from "./pages/ResearchPilot.tsx";
import VerifyEmail from "./pages/VerifyEmail.tsx";
import SecuritySettings from "./pages/SecuritySettings.tsx";
import OAuthConsent from "./pages/OAuthConsent.tsx";
import NotFound from "./pages/NotFound.tsx";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./hooks/useAuth";
import { SettingsProvider } from "./contexts/SettingsContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
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
            <Route path="/evaluation/:id" element={<ProtectedRoute role="student"><EssayEvaluation /></ProtectedRoute>} />
            <Route path="/feedback/:id" element={<ProtectedRoute role="student"><StudentFeedback /></ProtectedRoute>} />
            {/* Hidden, invitation-only research pilot. Intentionally unlinked from all public navigation. */}
            <Route path="/research-pilot" element={<ProtectedRoute role="student"><ResearchPilot /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
            </Routes>
          </SettingsProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
