import { cn } from "@/lib/utils";
import { Wand2, Volume2, Zap, Settings2 } from "lucide-react";
import { Knob } from "./Knob";
import { ToggleSwitch } from "./ToggleSwitch";

interface VocalChainPanelProps {
  // Adaptive Harmonics
  harmonicSculptor: boolean;
  onHarmonicSculptorChange: (enabled: boolean) => void;
  harmonicBoost: number;
  onHarmonicBoostChange: (value: number) => void;
  // Mix-Aware Dampening
  mixAwareDampening: boolean;
  onMixAwareDampeningChange: (enabled: boolean) => void;
  dampeningAmount: number;
  onDampeningAmountChange: (value: number) => void;
  // Latency Mode
  latencyMode: "realtime" | "quality" | "offline";
  onLatencyModeChange: (mode: "realtime" | "quality" | "offline") => void;
}

export const VocalChainPanel = ({
  harmonicSculptor,
  onHarmonicSculptorChange,
  harmonicBoost,
  onHarmonicBoostChange,
  mixAwareDampening,
  onMixAwareDampeningChange,
  dampeningAmount,
  onDampeningAmountChange,
  latencyMode,
  onLatencyModeChange
}: VocalChainPanelProps) => {
  return (
    <div className={cn(
      "rounded-xl border p-4 space-y-4",
      "border-border bg-card/50",
      "transition-all duration-300"
    )}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Wand2 className="w-5 h-5 text-primary" />
        <span className="font-display text-sm uppercase tracking-wider">
          Vocal Chain
        </span>
      </div>

      {/* Adaptive Harmonics Sculptor */}
      <div className="space-y-3 p-3 rounded-lg bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium">Harmonic Sculptor</span>
          </div>
          <ToggleSwitch
            isOn={harmonicSculptor}
            onChange={onHarmonicSculptorChange}
            label=""
          />
        </div>
        {harmonicSculptor && (
          <div className="flex justify-center">
            <Knob
              value={harmonicBoost}
              min={-12}
              max={12}
              onChange={onHarmonicBoostChange}
              label="Boost"
              unit="dB"
              size="sm"
            />
          </div>
        )}
        <p className="text-[10px] text-muted-foreground">
          Auto EQ based on key and pitch
        </p>
      </div>

      {/* Mix-Aware Dampening */}
      <div className="space-y-3 p-3 rounded-lg bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium">Mix-Aware</span>
          </div>
          <ToggleSwitch
            isOn={mixAwareDampening}
            onChange={onMixAwareDampeningChange}
            label=""
          />
        </div>
        {mixAwareDampening && (
          <div className="flex justify-center">
            <Knob
              value={dampeningAmount}
              onChange={onDampeningAmountChange}
              label="Sensitivity"
              unit="%"
              size="sm"
            />
          </div>
        )}
        <p className="text-[10px] text-muted-foreground">
          Less correction when vocal is layered
        </p>
      </div>

      {/* Latency Mode Selector */}
      <div className="space-y-3 p-3 rounded-lg bg-muted/30">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium">Processing Mode</span>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {[
            { mode: "realtime" as const, label: "Real-Time", latency: "0ms" },
            { mode: "quality" as const, label: "Quality", latency: "10ms" },
            { mode: "offline" as const, label: "Offline", latency: "HQ" }
          ].map(({ mode, label, latency }) => (
            <button
              key={mode}
              onClick={() => onLatencyModeChange(mode)}
              className={cn(
                "flex flex-col items-center p-2 rounded-lg",
                "border transition-all duration-200",
                latencyMode === mode
                  ? "border-primary bg-primary/20 text-primary"
                  : "border-border bg-muted/50 text-muted-foreground hover:border-primary/50"
              )}
            >
              <span className="text-[10px] font-medium">{label}</span>
              <span className="text-[9px] opacity-70">{latency}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};