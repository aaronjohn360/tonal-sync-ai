import { cn } from "@/lib/utils";
import { ControlSection } from "./ControlSection";
import { ToggleSwitch } from "./ToggleSwitch";
import { Knob } from "./Knob";
import { Brain, Zap, Music, TrendingUp, Activity, Target } from "lucide-react";

interface AIPEAdvancedPanelProps {
  isActive: boolean;
  adaptiveMode: boolean;
  onAdaptiveModeChange: (value: boolean) => void;
  vibratoIsolation: number;
  onVibratoIsolationChange: (value: number) => void;
  slidePreservation: boolean;
  onSlidePreservationChange: (value: boolean) => void;
  intentSensitivity: number;
  onIntentSensitivityChange: (value: number) => void;
  confidence: number;
  className?: string;
}

export const AIPEAdvancedPanel = ({
  isActive,
  adaptiveMode,
  onAdaptiveModeChange,
  vibratoIsolation,
  onVibratoIsolationChange,
  slidePreservation,
  onSlidePreservationChange,
  intentSensitivity,
  onIntentSensitivityChange,
  confidence,
  className,
}: AIPEAdvancedPanelProps) => {
  // Simulated detection states
  const detections = [
    { label: "Vibrato", icon: Activity, active: isActive && confidence > 70 },
    { label: "Slide", icon: TrendingUp, active: isActive && confidence > 85 },
    { label: "Attack", icon: Target, active: isActive && confidence > 60 },
  ];

  return (
    <ControlSection
      title="AIPE Advanced"
      className={className}
      glowing={isActive}
    >
      <div className="space-y-4">
        {/* Header with brain animation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              "relative p-2 rounded-lg",
              isActive ? "bg-primary/20" : "bg-muted"
            )}>
              <Brain className={cn(
                "w-5 h-5",
                isActive ? "text-primary" : "text-muted-foreground"
              )} />
              {isActive && (
                <div className="absolute inset-0 rounded-lg bg-primary/30 animate-ai-thinking" />
              )}
            </div>
            <div>
              <span className="text-xs font-display text-primary block">
                Adaptive AI Engine
              </span>
              <span className="text-[10px] text-muted-foreground">
                Deep Learning Model v2.5
              </span>
            </div>
          </div>
          {isActive && (
            <Zap className="w-4 h-4 text-primary animate-pulse" />
          )}
        </div>

        {/* Detection indicators */}
        <div className="grid grid-cols-3 gap-2">
          {detections.map(({ label, icon: Icon, active }) => (
            <div
              key={label}
              className={cn(
                "flex flex-col items-center gap-1 py-2 rounded-lg transition-all duration-300",
                active
                  ? "bg-primary/15 border border-primary/30"
                  : "bg-muted/30 border border-transparent"
              )}
            >
              <Icon className={cn(
                "w-4 h-4",
                active ? "text-primary" : "text-muted-foreground"
              )} />
              <span className={cn(
                "text-[9px] font-medium uppercase",
                active ? "text-primary" : "text-muted-foreground"
              )}>
                {label}
              </span>
              <div className={cn(
                "w-1.5 h-1.5 rounded-full",
                active ? "bg-primary animate-pulse" : "bg-muted-foreground/30"
              )} />
            </div>
          ))}
        </div>

        {/* Main controls */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <ToggleSwitch
              isOn={adaptiveMode}
              onChange={onAdaptiveModeChange}
              label="Adaptive"
              sublabel="Mode"
            />
            <ToggleSwitch
              isOn={slidePreservation}
              onChange={onSlidePreservationChange}
              label="Preserve"
              sublabel="Slides"
            />
          </div>
        </div>

        {/* Knob controls */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col items-center">
            <Knob
              value={vibratoIsolation}
              onChange={onVibratoIsolationChange}
              label=""
              unit="%"
              size="sm"
            />
            <span className="text-[10px] text-muted-foreground mt-1">Vibrato Iso</span>
          </div>
          <div className="flex flex-col items-center">
            <Knob
              value={intentSensitivity}
              onChange={onIntentSensitivityChange}
              label=""
              unit="%"
              size="sm"
            />
            <span className="text-[10px] text-muted-foreground mt-1">Intent Sens</span>
          </div>
        </div>

        {/* Dynamic retune visualization */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[9px]">
            <span className="text-muted-foreground">Dynamic Retune</span>
            <span className={cn(
              "font-display",
              isActive ? "text-primary" : "text-muted-foreground"
            )}>
              {adaptiveMode ? "AUTO" : "MANUAL"}
            </span>
          </div>
          <div className="h-8 bg-muted/30 rounded-lg overflow-hidden relative">
            {/* Retune curve visualization */}
            <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="retuneGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
                  <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.2" />
                </linearGradient>
              </defs>
              {isActive && (
                <path
                  d="M 0 28 Q 20 5, 40 15 T 80 10 T 120 20 T 160 8 T 200 25"
                  fill="none"
                  stroke="url(#retuneGradient)"
                  strokeWidth="2"
                  className="animate-pulse"
                />
              )}
            </svg>
            
            {/* Phase labels */}
            <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 py-0.5">
              <span className="text-[7px] text-primary/60">ATTACK</span>
              <span className="text-[7px] text-primary/40">SUSTAIN</span>
              <span className="text-[7px] text-primary/20">DECAY</span>
            </div>
          </div>
        </div>

        {/* Confidence meter */}
        <div className="space-y-1">
          <div className="flex justify-between text-[9px]">
            <span className="text-muted-foreground">AI Confidence</span>
            <span className={cn(
              "font-display",
              isActive ? "text-primary" : "text-muted-foreground"
            )}>
              {confidence}%
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                isActive
                  ? "bg-primary shadow-[0_0_8px_hsl(var(--primary))]"
                  : "bg-muted-foreground"
              )}
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>
      </div>
    </ControlSection>
  );
};
