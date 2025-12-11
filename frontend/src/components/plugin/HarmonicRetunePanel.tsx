import { cn } from "@/lib/utils";
import { Knob } from "./Knob";
import { ControlSection } from "./ControlSection";
import { Waves, Sparkles } from "lucide-react";

interface HarmonicRetunePanelProps {
  harmonicFocus: number;
  onHarmonicFocusChange: (value: number) => void;
  overtoneBias: number;
  onOvertoneBiasChange: (value: number) => void;
  isActive: boolean;
  className?: string;
}

export const HarmonicRetunePanel = ({
  harmonicFocus,
  onHarmonicFocusChange,
  overtoneBias,
  onOvertoneBiasChange,
  isActive,
  className,
}: HarmonicRetunePanelProps) => {
  // Generate harmonic bar heights
  const harmonics = Array.from({ length: 8 }, (_, i) => {
    const baseHeight = 100 / (i + 1);
    const correction = isActive ? harmonicFocus / 100 : 0;
    return {
      original: baseHeight * (0.7 + Math.random() * 0.3),
      corrected: baseHeight * (0.9 + correction * 0.1),
    };
  });

  return (
    <ControlSection
      title="Harmonic Retune"
      className={className}
      glowing={isActive}
    >
      <div className="space-y-4">
        {/* Harmonic Visualization */}
        <div className="relative h-20 bg-muted/30 rounded-lg p-2 overflow-hidden">
          <div className="absolute inset-0 flex items-end justify-around px-2 gap-1">
            {harmonics.map((h, i) => (
              <div key={i} className="relative flex-1 flex items-end justify-center gap-0.5">
                {/* Original harmonic */}
                <div
                  className={cn(
                    "w-1.5 rounded-t transition-all duration-300",
                    isActive ? "bg-destructive/50" : "bg-muted-foreground/30"
                  )}
                  style={{ height: `${h.original}%` }}
                />
                {/* Corrected harmonic */}
                <div
                  className={cn(
                    "w-1.5 rounded-t transition-all duration-500",
                    isActive
                      ? "bg-primary shadow-[0_0_6px_hsl(var(--primary))]"
                      : "bg-muted-foreground/50"
                  )}
                  style={{ height: `${h.corrected}%` }}
                />
              </div>
            ))}
          </div>
          
          {/* Labels */}
          <div className="absolute bottom-0 left-0 right-0 flex justify-around px-2 pt-1 border-t border-border/30">
            {harmonics.map((_, i) => (
              <span key={i} className="text-[8px] text-muted-foreground">
                {i === 0 ? "f₀" : `${i + 1}f`}
              </span>
            ))}
          </div>
          
          {/* Status badge */}
          <div className={cn(
            "absolute top-1 right-1 flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px]",
            isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
          )}>
            <Waves className="w-2.5 h-2.5" />
            {isActive ? "CORRECTING" : "BYPASS"}
          </div>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col items-center">
            <Knob
              value={harmonicFocus}
              onChange={onHarmonicFocusChange}
              label=""
              unit="%"
              size="sm"
            />
            <span className="text-[10px] text-muted-foreground mt-1">Focus</span>
          </div>
          <div className="flex flex-col items-center">
            <Knob
              value={overtoneBias}
              min={-50}
              max={50}
              onChange={onOvertoneBiasChange}
              label=""
              unit=""
              size="sm"
            />
            <span className="text-[10px] text-muted-foreground mt-1">Bias</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex justify-center gap-4 text-[9px]">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-destructive/50" />
            <span className="text-muted-foreground">Original</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-muted-foreground">Corrected</span>
          </div>
        </div>
      </div>
    </ControlSection>
  );
};
