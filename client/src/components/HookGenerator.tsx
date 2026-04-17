import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Sparkles, Copy, Check, Loader2, Zap, AlertCircle, Target, TrendingUp,
  RefreshCw, ChevronDown, ChevronUp, Play
} from "lucide-react";
import { useLocation } from "wouter";

type Hook = {
  type: string;
  label: string;
  text: string;
  index: number;
};

type HookGeneratorProps = {
  /** Vorausgefüllter Skript-Text (z.B. aus Transkript oder Batch-Body) */
  initialScript?: string;
  /** Ob die Textarea editierbar ist oder nur als Vorschau dient */
  scriptEditable?: boolean;
  /** Callback wenn ein Hook in den Teleprompter geladen werden soll */
  onLoadToTeleprompter?: (text: string) => void;
  /** Kompakter Modus: kein eigener Card-Wrapper, nur der Inhalt */
  compact?: boolean;
};

const HOOK_TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string; border: string }> = {
  neugier: {
    icon: <Zap className="w-3.5 h-3.5" />,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  schmerz: {
    icon: <AlertCircle className="w-3.5 h-3.5" />,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
  },
  ergebnis: {
    icon: <TrendingUp className="w-3.5 h-3.5" />,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
};

function HookCard({
  hook,
  onCopy,
  onLoadToTeleprompter,
  copiedIndex,
}: {
  hook: Hook;
  onCopy: (text: string, index: number) => void;
  onLoadToTeleprompter?: (text: string) => void;
  copiedIndex: number | null;
}) {
  const [editedText, setEditedText] = useState(hook.text);
  const [isEditing, setIsEditing] = useState(false);
  const config = HOOK_TYPE_CONFIG[hook.type] ?? HOOK_TYPE_CONFIG.neugier;

  return (
    <div className={`rounded-xl border ${config.border} ${config.bg} p-4 space-y-3 transition-all`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className={`flex items-center gap-1.5 text-xs font-semibold ${config.color}`}>
          {config.icon}
          <span>Hook {hook.index}: {hook.label}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1"
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {isEditing ? "Schließen" : "Bearbeiten"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1"
            onClick={() => onCopy(editedText, hook.index)}
          >
            {copiedIndex === hook.index
              ? <><Check className="w-3 h-3 text-emerald-400" /> Kopiert</>
              : <><Copy className="w-3 h-3" /> Kopieren</>
            }
          </Button>
          {onLoadToTeleprompter && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              onClick={() => onLoadToTeleprompter(editedText)}
            >
              <Play className="w-3 h-3" />
              Teleprompter
            </Button>
          )}
        </div>
      </div>

      {/* Text */}
      {isEditing ? (
        <Textarea
          value={editedText}
          onChange={e => setEditedText(e.target.value)}
          className="min-h-[80px] text-sm bg-background/50 border-border resize-none"
          autoFocus
        />
      ) : (
        <p className="text-sm text-foreground leading-relaxed font-medium">
          "{editedText}"
        </p>
      )}
    </div>
  );
}

export default function HookGenerator({
  initialScript = "",
  scriptEditable = true,
  onLoadToTeleprompter,
  compact = false,
}: HookGeneratorProps) {
  const [, navigate] = useLocation();
  const [scriptText, setScriptText] = useState(initialScript);
  const [hooks, setHooks] = useState<Hook[] | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const generateMutation = trpc.hooks.generate.useMutation({
    onSuccess: (data) => {
      setHooks(data.hooks);
      setGeneratedAt(data.generatedAt);
      toast.success("3 Hooks erfolgreich generiert!", {
        description: "Klicke auf 'Bearbeiten' um einen Hook anzupassen.",
      });
    },
    onError: (err) => {
      toast.error("Hook-Generierung fehlgeschlagen", { description: err.message });
    },
  });

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast.success("Hook kopiert!");
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleLoadToTeleprompter = (text: string) => {
    if (onLoadToTeleprompter) {
      onLoadToTeleprompter(text);
    } else {
      // Fallback: in Teleprompter-Seite navigieren mit Text als Query-Param
      sessionStorage.setItem("teleprompter_text", text);
      navigate("/teleprompter");
      toast.success("Hook in Teleprompter geladen!");
    }
  };

  const handleCopyAll = () => {
    if (!hooks) return;
    const allText = hooks.map(h => `${h.label}:\n"${h.text}"`).join("\n\n");
    navigator.clipboard.writeText(allText);
    toast.success("Alle 3 Hooks kopiert!");
  };

  const content = (
    <div className="space-y-5">
      {/* Skript-Eingabe */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Anzeigenskript
          </label>
          <span className="text-xs text-muted-foreground">{scriptText.length} Zeichen</span>
        </div>
        <Textarea
          value={scriptText}
          onChange={e => setScriptText(e.target.value)}
          placeholder="Füge hier dein Anzeigenskript ein – Body, Transkript oder beliebigen Ad-Text..."
          className="min-h-[120px] text-sm bg-muted/30 border-border resize-none"
          readOnly={!scriptEditable}
        />
      </div>

      {/* Generieren-Button */}
      <Button
        className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
        onClick={() => generateMutation.mutate({ scriptText, language: "de" })}
        disabled={scriptText.trim().length < 10 || generateMutation.isPending}
      >
        {generateMutation.isPending ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> KI generiert Hooks...</>
        ) : (
          <><Sparkles className="w-4 h-4" /> 3 Hooks automatisch generieren</>
        )}
      </Button>

      {scriptText.trim().length < 10 && scriptText.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Mindestens 10 Zeichen erforderlich
        </p>
      )}

      {/* Ergebnis */}
      {hooks && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Generierte Hooks</span>
              <Badge variant="secondary" className="text-xs">
                {generatedAt ? new Date(generatedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : ""}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={handleCopyAll}
              >
                <Copy className="w-3 h-3" />
                Alle kopieren
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={() => generateMutation.mutate({ scriptText, language: "de" })}
                disabled={generateMutation.isPending}
              >
                <RefreshCw className={`w-3 h-3 ${generateMutation.isPending ? "animate-spin" : ""}`} />
                Neu generieren
              </Button>
            </div>
          </div>

          {/* Hook-Typ Legende */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(HOOK_TYPE_CONFIG).map(([key, cfg]) => (
              <div key={key} className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                {cfg.icon}
                <span className="capitalize">{key === "neugier" ? "Neugier" : key === "schmerz" ? "Schmerz/Problem" : "Ergebnis/Transformation"}</span>
              </div>
            ))}
          </div>

          {/* Hook-Cards */}
          <div className="space-y-3">
            {hooks.map(hook => (
              <HookCard
                key={hook.index}
                hook={hook}
                onCopy={handleCopy}
                onLoadToTeleprompter={handleLoadToTeleprompter}
                copiedIndex={copiedIndex}
              />
            ))}
          </div>

          {/* HeyGen-Skript Hinweis */}
          <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20 text-xs text-muted-foreground">
            <span className="font-medium text-purple-300">Tipp:</span> Kopiere einen Hook und kombiniere ihn mit deinem Body-Skript für das vollständige HeyGen-Skript im Batch Generator.
          </div>
        </div>
      )}
    </div>
  );

  if (compact) return content;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">Hook-Generator</CardTitle>
            <CardDescription className="text-xs">
              KI erstellt automatisch 3 verschiedene Hooks für dein Skript
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
}
