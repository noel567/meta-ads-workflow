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

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/connect" component={MetaConnect} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/ad-library" component={AdLibrary} />
      <Route path="/transcripts" component={Transcripts} />
      <Route path="/teleprompter/:id?" component={Teleprompter} />
      <Route path="/documents" component={Documents} />
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
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
