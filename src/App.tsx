import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Auth from "./pages/Auth.tsx";
import StudentDashboard from "./pages/StudentDashboard.tsx";
import StudentWorkspace from "./pages/StudentWorkspace.tsx";
import JoinLesson from "./pages/JoinLesson.tsx";
import TeacherDashboard from "./pages/TeacherDashboard.tsx";
import TeacherReview from "./pages/TeacherReview.tsx";
import NotFound from "./pages/NotFound.tsx";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./hooks/useAuth";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Auth />} />
            <Route path="/student-dashboard" element={<ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>} />
            <Route path="/join" element={<ProtectedRoute role="student"><JoinLesson /></ProtectedRoute>} />
            <Route path="/essay/:id" element={<ProtectedRoute role="student"><StudentWorkspace /></ProtectedRoute>} />
            <Route path="/teacher-dashboard" element={<ProtectedRoute role="teacher"><TeacherDashboard /></ProtectedRoute>} />
            <Route path="/review/:id" element={<ProtectedRoute role="teacher"><TeacherReview /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
