import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface KeyScaleSelectorProps {
  className?: string;
}

const keys = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const scales = ["Major", "Minor", "Chromatic", "Pentatonic", "Blues", "Dorian", "Mixolydian"];

export const KeyScaleSelector = ({ className }: KeyScaleSelectorProps) => {
  const [selectedKey, setSelectedKey] = useState("C");
  const [selectedScale, setSelectedScale] = useState("Major");
  const [isKeyOpen, setIsKeyOpen] = useState(false);
  const [isScaleOpen, setIsScaleOpen] = useState(false);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider text-center">
        Key & Scale
      </span>

      <div className="flex gap-2">
        {/* Key Selector */}
        <div className="relative flex-1">
          <button
            onClick={() => setIsKeyOpen(!isKeyOpen)}
            className={cn(
              "w-full px-3 py-2 rounded-lg",
              "bg-muted border border-border",
              "flex items-center justify-between",
              "text-sm font-display text-foreground",
              "hover:border-primary/50 transition-colors",
              isKeyOpen && "border-primary shadow-glow"
            )}
          >
            <span>{selectedKey}</span>
            <ChevronDown className={cn(
              "w-4 h-4 text-muted-foreground transition-transform",
              isKeyOpen && "rotate-180"
            )} />
          </button>

          {isKeyOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-card border border-border rounded-lg shadow-panel overflow-hidden">
              <div className="grid grid-cols-4 gap-0.5 p-1">
                {keys.map((key) => (
                  <button
                    key={key}
                    onClick={() => {
                      setSelectedKey(key);
                      setIsKeyOpen(false);
                    }}
                    className={cn(
                      "px-2 py-1.5 rounded text-sm font-display",
                      "hover:bg-primary/20 transition-colors",
                      selectedKey === key
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground"
                    )}
                  >
                    {key}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Scale Selector */}
        <div className="relative flex-1">
          <button
            onClick={() => setIsScaleOpen(!isScaleOpen)}
            className={cn(
              "w-full px-3 py-2 rounded-lg",
              "bg-muted border border-border",
              "flex items-center justify-between",
              "text-sm font-display text-foreground",
              "hover:border-primary/50 transition-colors",
              isScaleOpen && "border-primary shadow-glow"
            )}
          >
            <span>{selectedScale}</span>
            <ChevronDown className={cn(
              "w-4 h-4 text-muted-foreground transition-transform",
              isScaleOpen && "rotate-180"
            )} />
          </button>

          {isScaleOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-card border border-border rounded-lg shadow-panel overflow-hidden">
              {scales.map((scale) => (
                <button
                  key={scale}
                  onClick={() => {
                    setSelectedScale(scale);
                    setIsScaleOpen(false);
                  }}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm font-display",
                    "hover:bg-primary/20 transition-colors",
                    selectedScale === scale
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground"
                  )}
                >
                  {scale}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Visual keyboard */}
      <div className="flex gap-0.5 h-8">
        {["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"].map((note, i) => {
          const isBlack = note.includes("#");
          const isInScale = selectedScale === "Chromatic" || 
            (selectedScale === "Major" && [0, 2, 4, 5, 7, 9, 11].includes(i)) ||
            (selectedScale === "Minor" && [0, 2, 3, 5, 7, 8, 10].includes(i));
          
          return (
            <div
              key={note}
              className={cn(
                "flex-1 rounded-sm transition-all",
                isBlack ? "bg-background" : "bg-muted",
                isInScale && "bg-primary/40 shadow-[0_0_6px_hsl(var(--primary)/0.5)]",
                note === selectedKey && "bg-primary shadow-glow"
              )}
            />
          );
        })}
      </div>
    </div>
  );
};
