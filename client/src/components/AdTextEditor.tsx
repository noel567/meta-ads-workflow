/**
 * AdTextEditor – Interaktiver Drag-and-Drop Editor für Composite Ad Textelemente
 *
 * Features:
 * - Drag-and-Drop: Textelemente frei auf dem Vorschau-Bild positionieren
 * - Resize-Handle: Schriftgröße per vertikalem Ziehen anpassen
 * - Inline-Editing: Doppelklick zum Bearbeiten des Textes
 * - Toolbar: Farbe, Fett/Normal, Ausrichtung pro Element
 * - Echtzeit-Vorschau: Positionen werden sofort im Editor angezeigt
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bold, AlignLeft, AlignCenter, AlignRight, Plus, Trash2, RotateCcw, Type, Move } from "lucide-react";

export type TextElementType = "headline" | "subheadline" | "bullet" | "cta" | "branding" | "custom";

export interface TextElement {
  id: string;
  type: TextElementType;
  text: string;
  xPct: number;   // 0–100, Position in % der Canvas-Breite
  yPct: number;   // 0–100, Position in % der Canvas-Höhe
  fontSize: number;
  color: string;
  bold: boolean;
  align: "left" | "center" | "right";
  bgColor?: string;
  bgPadding?: number;
  bgRadius?: number;
  bulletIcon?: boolean;
  accentLine?: boolean;
  maxWidthPct?: number;
}

interface AdTextEditorProps {
  elements: TextElement[];
  onChange: (elements: TextElement[]) => void;
  backgroundImageUrl?: string;  // Vorschau-Hintergrundbild (Livio-Foto)
  accentColor?: string;
  template?: string;
}

const TYPE_LABELS: Record<TextElementType, string> = {
  headline: "Headline",
  subheadline: "Subheadline",
  bullet: "Bullet",
  cta: "CTA-Button",
  branding: "Branding",
  custom: "Text",
};

const TYPE_COLORS: Record<TextElementType, string> = {
  headline: "#f472b6",
  subheadline: "#60a5fa",
  bullet: "#34d399",
  cta: "#fbbf24",
  branding: "#a78bfa",
  custom: "#94a3b8",
};

// Hilfsfunktion: Farbe mit Opacity
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function AdTextEditor({ elements, onChange, backgroundImageUrl, accentColor = "#22c55e", template }: AdTextEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [containerSize, setContainerSize] = useState({ w: 540, h: 540 });

  // Container-Größe messen
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ w: rect.width, h: rect.height });
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const updateElement = useCallback((id: string, patch: Partial<TextElement>) => {
    onChange(elements.map(el => el.id === id ? { ...el, ...patch } : el));
  }, [elements, onChange]);

  const deleteElement = useCallback((id: string) => {
    onChange(elements.filter(el => el.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [elements, onChange, selectedId]);

  const addElement = useCallback(() => {
    const newEl: TextElement = {
      id: `custom_${Date.now()}`,
      type: "custom",
      text: "Neuer Text",
      xPct: 10,
      yPct: 50,
      fontSize: 32,
      color: "#ffffff",
      bold: false,
      align: "left",
      maxWidthPct: 60,
    };
    onChange([...elements, newEl]);
    setSelectedId(newEl.id);
  }, [elements, onChange]);

  // Drag-Handler für Textblock
  const handleDragStart = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(id);

    const el = elements.find(x => x.id === id);
    if (!el || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const origXPct = el.xPct;
    const origYPct = el.yPct;

    const handleMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const newXPct = Math.max(0, Math.min(95, origXPct + (dx / containerRect.width) * 100));
      const newYPct = Math.max(2, Math.min(98, origYPct + (dy / containerRect.height) * 100));
      updateElement(id, { xPct: newXPct, yPct: newYPct });
    };

    const handleUp = () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
  }, [elements, updateElement]);

  // Resize-Handle (vertikales Ziehen = Schriftgröße)
  const handleResizeStart = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();

    const el = elements.find(x => x.id === id);
    if (!el || !containerRef.current) return;

    const startY = e.clientY;
    const origFontSize = el.fontSize;
    const containerH = containerRef.current.getBoundingClientRect().height;

    const handleMove = (ev: MouseEvent) => {
      const dy = ev.clientY - startY;
      // 1px Drag = ~0.5px Schriftgröße (relativ zur Canvas-Größe)
      const scaleFactor = 1080 / containerH;
      const newFontSize = Math.max(10, Math.min(200, origFontSize + dy * 0.5 * (scaleFactor / 10)));
      updateElement(id, { fontSize: Math.round(newFontSize) });
    };

    const handleUp = () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
  }, [elements, updateElement]);

  // Doppelklick = Inline-Edit
  const handleDoubleClick = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const el = elements.find(x => x.id === id);
    if (!el) return;
    setEditingId(id);
    setEditText(el.text);
  }, [elements]);

  const commitEdit = useCallback(() => {
    if (editingId && editText.trim()) {
      updateElement(editingId, { text: editText });
    }
    setEditingId(null);
  }, [editingId, editText, updateElement]);

  // Klick auf Hintergrund = Auswahl aufheben
  const handleBackgroundClick = useCallback(() => {
    setSelectedId(null);
    if (editingId) commitEdit();
  }, [editingId, commitEdit]);

  const selectedEl = elements.find(el => el.id === selectedId);

  return (
    <div className="flex flex-col gap-3">
      {/* Canvas-Editor */}
      <div
        ref={containerRef}
        className="relative w-full aspect-square rounded-xl overflow-hidden bg-zinc-900 cursor-default select-none"
        style={{ maxHeight: 540 }}
        onClick={handleBackgroundClick}
      >
        {/* Hintergrundbild */}
        {backgroundImageUrl ? (
          <img
            src={backgroundImageUrl}
            alt="Ad Hintergrund"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-zinc-800 pointer-events-none" />
        )}

        {/* Dunkles Overlay für bessere Lesbarkeit */}
        <div className="absolute inset-0 bg-black/40 pointer-events-none" />

        {/* Grid-Hilfslinien */}
        <div className="absolute inset-0 pointer-events-none opacity-10"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)",
            backgroundSize: "10% 10%",
          }}
        />

        {/* Textelemente */}
        {elements.map((el) => {
          const isSelected = selectedId === el.id;
          const isEditing = editingId === el.id;
          const typeColor = TYPE_COLORS[el.type] ?? "#94a3b8";
          const scaledFontSize = (el.fontSize / 1080) * containerSize.w;

          return (
            <div
              key={el.id}
              className="absolute group"
              style={{
                left: `${el.xPct}%`,
                top: `${el.yPct}%`,
                transform: "translateY(-50%)",
                cursor: "grab",
                zIndex: isSelected ? 20 : 10,
              }}
              onMouseDown={(e) => handleDragStart(e, el.id)}
              onDoubleClick={(e) => handleDoubleClick(e, el.id)}
              onClick={(e) => { e.stopPropagation(); setSelectedId(el.id); }}
            >
              {/* Auswahl-Rahmen */}
              {isSelected && (
                <div
                  className="absolute -inset-2 rounded border-2 pointer-events-none"
                  style={{ borderColor: typeColor, boxShadow: `0 0 0 1px ${hexToRgba(typeColor, 0.3)}` }}
                />
              )}

              {/* Typ-Label */}
              {isSelected && (
                <div
                  className="absolute -top-7 left-0 px-1.5 py-0.5 rounded text-[10px] font-medium text-black whitespace-nowrap z-30"
                  style={{ backgroundColor: typeColor }}
                >
                  <Move className="h-2.5 w-2.5 inline mr-0.5" />
                  {TYPE_LABELS[el.type]}
                </div>
              )}

              {/* Text-Inhalt */}
              {isEditing ? (
                <input
                  autoFocus
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingId(null); }}
                  className="bg-black/70 text-white border border-white/30 rounded px-1 outline-none"
                  style={{
                    fontSize: scaledFontSize,
                    fontWeight: el.bold ? "bold" : "normal",
                    minWidth: 80,
                    width: `${(el.maxWidthPct ?? 60) * containerSize.w / 100}px`,
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <div
                  style={{
                    fontSize: scaledFontSize,
                    fontWeight: el.bold ? "bold" : "normal",
                    color: el.color,
                    textAlign: el.align,
                    textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                    maxWidth: `${(el.maxWidthPct ?? 60) * containerSize.w / 100}px`,
                    lineHeight: 1.25,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    backgroundColor: el.bgColor ? el.bgColor : undefined,
                    padding: el.bgColor ? `${(el.bgPadding ?? 10) * containerSize.w / 1080}px ${(el.bgPadding ?? 10) * containerSize.w / 1080}px` : undefined,
                    borderRadius: el.bgColor ? `${(el.bgRadius ?? 6) * containerSize.w / 1080}px` : undefined,
                  }}
                >
                  {el.bulletIcon && (
                    <span style={{ color: accentColor, marginRight: scaledFontSize * 0.4 }}>●</span>
                  )}
                  {el.text}
                </div>
              )}

              {/* Resize-Handle (unten rechts) */}
              {isSelected && !isEditing && (
                <div
                  className="absolute -bottom-3 -right-3 w-5 h-5 rounded-full border-2 border-white bg-zinc-800 cursor-ns-resize flex items-center justify-center z-30"
                  style={{ borderColor: typeColor }}
                  onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, el.id); }}
                  title="Schriftgröße anpassen"
                >
                  <Type className="h-2.5 w-2.5 text-white" />
                </div>
              )}

              {/* Delete-Button */}
              {isSelected && !isEditing && (
                <div
                  className="absolute -top-3 -right-3 w-5 h-5 rounded-full bg-red-500 cursor-pointer flex items-center justify-center z-30 hover:bg-red-600"
                  onMouseDown={(e) => { e.stopPropagation(); deleteElement(el.id); }}
                  title="Element löschen"
                >
                  <Trash2 className="h-2.5 w-2.5 text-white" />
                </div>
              )}
            </div>
          );
        })}

        {/* Hinweis */}
        <div className="absolute bottom-2 left-2 right-2 flex justify-center pointer-events-none">
          <span className="text-[10px] text-white/40 bg-black/30 px-2 py-0.5 rounded">
            Drag: verschieben · Doppelklick: Text bearbeiten · Resize-Handle: Größe ändern
          </span>
        </div>
      </div>

      {/* Toolbar für ausgewähltes Element */}
      {selectedEl && (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-accent/20 border border-border/40">
          <span className="text-xs font-medium" style={{ color: TYPE_COLORS[selectedEl.type] }}>
            {TYPE_LABELS[selectedEl.type]}
          </span>
          <div className="h-4 w-px bg-border/50" />

          {/* Schriftgröße */}
          <div className="flex items-center gap-1">
            <Type className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="number"
              value={selectedEl.fontSize}
              onChange={(e) => updateElement(selectedEl.id, { fontSize: Math.max(10, Math.min(200, parseInt(e.target.value) || 32)) })}
              className="w-14 h-6 text-xs bg-background border border-border/50 rounded px-1 text-center"
              min={10}
              max={200}
            />
            <span className="text-[10px] text-muted-foreground">px</span>
          </div>

          <div className="h-4 w-px bg-border/50" />

          {/* Fett */}
          <Button
            size="sm"
            variant={selectedEl.bold ? "default" : "outline"}
            className="h-6 w-6 p-0"
            onClick={() => updateElement(selectedEl.id, { bold: !selectedEl.bold })}
            title="Fett"
          >
            <Bold className="h-3 w-3" />
          </Button>

          {/* Ausrichtung */}
          <Button size="sm" variant={selectedEl.align === "left" ? "default" : "outline"} className="h-6 w-6 p-0" onClick={() => updateElement(selectedEl.id, { align: "left" })}>
            <AlignLeft className="h-3 w-3" />
          </Button>
          <Button size="sm" variant={selectedEl.align === "center" ? "default" : "outline"} className="h-6 w-6 p-0" onClick={() => updateElement(selectedEl.id, { align: "center" })}>
            <AlignCenter className="h-3 w-3" />
          </Button>
          <Button size="sm" variant={selectedEl.align === "right" ? "default" : "outline"} className="h-6 w-6 p-0" onClick={() => updateElement(selectedEl.id, { align: "right" })}>
            <AlignRight className="h-3 w-3" />
          </Button>

          <div className="h-4 w-px bg-border/50" />

          {/* Farbe */}
          <div className="flex items-center gap-1">
            <label className="text-[10px] text-muted-foreground">Farbe</label>
            <input
              type="color"
              value={selectedEl.color.startsWith("rgba") ? "#ffffff" : selectedEl.color}
              onChange={(e) => updateElement(selectedEl.id, { color: e.target.value })}
              className="w-6 h-6 rounded cursor-pointer border border-border/50"
              title="Textfarbe"
            />
          </div>

          {/* Position anzeigen */}
          <div className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
            <span>X: {Math.round(selectedEl.xPct)}%</span>
            <span>Y: {Math.round(selectedEl.yPct)}%</span>
          </div>
        </div>
      )}

      {/* Element-Liste + Aktionen */}
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-1">
          {elements.map(el => (
            <button
              key={el.id}
              onClick={() => setSelectedId(el.id === selectedId ? null : el.id)}
              className={`px-2 py-0.5 rounded text-[10px] border transition-all ${
                selectedId === el.id
                  ? "border-current text-current"
                  : "border-border/40 text-muted-foreground hover:border-border"
              }`}
              style={selectedId === el.id ? { color: TYPE_COLORS[el.type], borderColor: TYPE_COLORS[el.type] } : {}}
            >
              {TYPE_LABELS[el.type]}: {el.text.slice(0, 15)}{el.text.length > 15 ? "…" : ""}
            </button>
          ))}
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addElement}>
          <Plus className="h-3 w-3 mr-1" /> Text hinzufügen
        </Button>
      </div>
    </div>
  );
}
