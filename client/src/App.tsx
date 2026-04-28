import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import MetaConnect from "./pages/MetaConnect";
import Analytics from "./pages/Analytics";
import AdLibrary from "./pages/AdLibrary";
import Transcripts from "./pages/Transcripts";
import Teleprompter from "./pages/Teleprompter";
import Documents from "./pages/Documents";
import Competitors from "./pages/Competitors";
import Batches from "./pages/Batches";
import Settings from "./pages/Settings";
import VideoResearch from "./pages/VideoResearch";
import MetaAdsDashboard from "./pages/MetaAdsDashboard";
import BudgetRules from "./pages/BudgetRules";
import DriveToMeta from "./pages/DriveToMeta";
import ApiKeys from "./pages/ApiKeys";
import ContentBot from "./pages/ContentBot";
import Knowledge from "./pages/Knowledge";
import ImageAds from "./pages/ImageAds";
import VideoAds from "./pages/VideoAds";
import AdPerformance from "./pages/AdPerformance";
import CommentManager from "./pages/CommentManager";
import Login from "./pages/Login";
import AdminUsers from "./pages/AdminUsers";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Privacy from "./pages/Privacy";
import { useAuth } from "./_core/hooks/useAuth";

function ProtectedRouter() {
  const { isAuthenticated, loading } = useAuth({ redirectOnUnauthenticated: false });

  if (loading) {
    return (
      <div className="min-h-screen bg-[oklch(0.10_0.012_250)] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Allow public auth pages without login
    const path = window.location.pathname;
    if (path.startsWith("/forgot-password")) return <ForgotPassword />;
    if (path.startsWith("/reset-password")) return <ResetPassword />;
    if (path.startsWith("/privacy")) return <Privacy />;
    return <Login />;
  }

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/connect" component={MetaConnect} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/ad-library" component={AdLibrary} />
      <Route path="/competitors" component={Competitors} />
      <Route path="/batches" component={Batches} />
      <Route path="/transcripts" component={Transcripts} />
      <Route path="/teleprompter/:id?" component={Teleprompter} />
      <Route path="/documents" component={Documents} />
      <Route path="/settings" component={Settings} />
      <Route path="/video-research" component={VideoResearch} />
      <Route path="/telegram">{() => { window.location.replace("/content-bot"); return null; }}</Route>
      <Route path="/meta-ads" component={MetaAdsDashboard} />
      <Route path="/budget-rules" component={BudgetRules} />
      <Route path="/drive-to-meta" component={DriveToMeta} />
      <Route path="/api-keys" component={ApiKeys} />
      <Route path="/content-bot" component={ContentBot} />
      <Route path="/knowledge" component={Knowledge} />
      <Route path="/image-ads" component={ImageAds} />
      <Route path="/video-ads" component={VideoAds} />
      <Route path="/ad-performance" component={AdPerformance} />
      <Route path="/comment-manager" component={CommentManager} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password/:token" component={ResetPassword} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster
            theme="dark"
            toastOptions={{
              style: {
                background: "oklch(0.14 0.012 250)",
                border: "1px solid oklch(0.22 0.015 250)",
                color: "oklch(0.97 0.005 250)",
              },
            }}
          />
          <ProtectedRouter />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
