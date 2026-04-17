import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Settings,
  Type,
} from "lucide-react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";

export default function Teleprompter() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id?: string }>();
  const transcriptId = params.id ? parseInt(params.id) : undefined;

  const { data: transcripts } = trpc.transcripts.list.useQuery();
  const [selectedId, setSelectedId] = useState<string>(transcriptId ? String(transcriptId) : "");
  const [directText, setDirectText] = useState<string | null>(null);
  const [directTitle, setDirectTitle] = useState<string>("Generierter Hook");

  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(2); // px per frame
  const [fontSize, setFontSize] = useState(36);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  const [scrollPos, setScrollPos] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const scrollRef = useRef(0);
  const isPlayingRef = useRef(false);

  const selectedTranscript = transcripts?.find((t) => String(t.id) === selectedId);
  const displayText = directText ?? selectedTranscript?.content ?? null;
  const displayTitle = directText ? directTitle : (selectedTranscript?.title ?? null);

  // sessionStorage: Hook oder direkter Text aus HookGenerator laden
  useEffect(() => {
    const stored = sessionStorage.getItem("teleprompter_text");
    const storedTitle = sessionStorage.getItem("teleprompter_title");
    if (stored) {
      setDirectText(stored);
      if (storedTitle) setDirectTitle(storedTitle);
      sessionStorage.removeItem("teleprompter_text");
      sessionStorage.removeItem("teleprompter_title");
      toast.success("Hook im Teleprompter geladen!", { description: storedTitle || "Generierter Hook" });
    }
  }, []);

  // Sync selectedId when transcriptId param changes
  useEffect(() => {
    if (transcriptId) setSelectedId(String(transcriptId));
  }, [transcriptId]);

  // Auto-select first transcript if none selected
  useEffect(() => {
    if (!selectedId && !directText && transcripts && transcripts.length > 0) {
      setSelectedId(String(transcripts[0].id));
    }
  }, [transcripts, selectedId, directText]);

  // Scroll animation loop
  const animate = useCallback(() => {
    if (!containerRef.current || !isPlayingRef.current) return;
    scrollRef.current += speed * 0.5;
    containerRef.current.scrollTop = scrollRef.current;
    setScrollPos(scrollRef.current);

    // Stop at bottom
    const el = containerRef.current;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      return;
    }
    animFrameRef.current = requestAnimationFrame(animate);
  }, [speed]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (isPlaying) {
      animFrameRef.current = requestAnimationFrame(animate);
    } else {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, animate]);

  const handleReset = () => {
    setIsPlaying(false);
    isPlayingRef.current = false;
    scrollRef.current = 0;
    setScrollPos(0);
    if (containerRef.current) containerRef.current.scrollTop = 0;
  };

  const handleTranscriptChange = (id: string) => {
    setSelectedId(id);
    setDirectText(null);
    handleReset();
  };

  const clearDirectText = () => {
    setDirectText(null);
    handleReset();
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
      setShowSettings(false);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) setIsFullscreen(false);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        setIsPlaying((p) => !p);
      }
      if (e.code === "KeyR") handleReset();
      if (e.code === "ArrowUp") setSpeed((s) => Math.max(0.5, s - 0.5));
      if (e.code === "ArrowDown") setSpeed((s) => Math.min(10, s + 0.5));
      if (e.code === "Escape" && isFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isFullscreen]);

  const progressPercent =
    containerRef.current
      ? Math.min(100, (scrollPos / (containerRef.current.scrollHeight - containerRef.current.clientHeight)) * 100)
      : 0;

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/transcripts")}
              className="text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Transkripte
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Teleprompter</h1>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
            className="border-border/50"
          >
            <Settings className="h-4 w-4 mr-2" />
            Einstellungen
          </Button>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <Card className="bg-card border-border/50 mb-6">
            <CardContent className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Transcript Select */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Transkript
                  </label>
                  {directText && (
                    <div className="mb-2 flex items-center gap-2 px-2 py-1 rounded-md bg-primary/10 border border-primary/20">
                      <span className="text-xs text-primary font-medium flex-1 truncate">✦ {directTitle}</span>
                      <button onClick={clearDirectText} className="text-xs text-muted-foreground hover:text-foreground">Transkript wählen</button>
                    </div>
                  )}
                  <Select value={selectedId} onValueChange={handleTranscriptChange} disabled={!!directText}>
                    <SelectTrigger className="bg-input border-border/50">
                      <SelectValue placeholder="Transkript wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {transcripts?.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Speed */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Scrollgeschwindigkeit
                    </label>
                    <span className="text-xs font-mono text-primary">{speed.toFixed(1)}x</span>
                  </div>
                  <Slider
                    value={[speed]}
                    onValueChange={([v]) => setSpeed(v)}
                    min={0.5}
                    max={10}
                    step={0.5}
                    className="w-full"
                  />
                </div>

                {/* Font Size */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <Type className="h-3 w-3" />
                      Schriftgröße
                    </label>
                    <span className="text-xs font-mono text-primary">{fontSize}px</span>
                  </div>
                  <Slider
                    value={[fontSize]}
                    onValueChange={([v]) => setFontSize(v)}
                    min={18}
                    max={72}
                    step={2}
                    className="w-full"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Teleprompter Display */}
        <div className="relative rounded-2xl overflow-hidden border border-border/50 bg-black">
          {/* Progress bar */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-border/30 z-10">
            <div
              className="h-full bg-primary transition-all duration-100"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Text area */}
          <div
            ref={containerRef}
            className="overflow-hidden"
            style={{ height: isFullscreen ? "100vh" : "60vh" }}
          >
            {/* Top gradient fade */}
            <div className="sticky top-0 left-0 right-0 h-24 bg-gradient-to-b from-black to-transparent pointer-events-none z-10" />

            <div
              ref={textRef}
              className="teleprompter-text text-white px-8 md:px-16 lg:px-24 pt-24 pb-48"
              style={{ fontSize: `${fontSize}px` }}
            >
              {displayText ? (
                displayText.split("\n").map((line, i) => (
                  <p key={i} className={`mb-4 ${line.trim() === "" ? "mb-8" : ""}`}>
                    {line || "\u00A0"}
                  </p>
                ))
              ) : (
                <p className="text-white/30 text-center">
                  Wähle ein Transkript aus den Einstellungen oben.
                </p>
              )}
            </div>

            {/* Bottom gradient fade */}
            <div className="sticky bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black to-transparent pointer-events-none" />
          </div>

          {/* Controls overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-white/70 hover:text-white hover:bg-white/10 h-9 w-9 p-0 rounded-full"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>

            <Button
              onClick={() => setIsPlaying(!isPlaying)}
              disabled={!displayText}
              className="h-12 w-12 rounded-full bg-primary hover:bg-primary/90 p-0"
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 ml-0.5" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullscreen}
              className="text-white/70 hover:text-white hover:bg-white/10 h-9 w-9 p-0 rounded-full"
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Keyboard hints */}
        <div className="flex gap-4 mt-4 text-xs text-muted-foreground justify-center">
          <span><kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono">Space</kbd> Play/Pause</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono">R</kbd> Reset</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono">↑↓</kbd> Geschwindigkeit</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono">F11</kbd> Vollbild</span>
        </div>
      </div>
    </DashboardLayout>
  );
}
