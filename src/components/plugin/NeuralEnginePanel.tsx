import { cn } from "@/lib/utils";
import { Brain, Waves, Music, Gauge, Sliders } from "lucide-react";
import { Knob } from "./Knob";
import { ToggleSwitch } from "./ToggleSwitch";

interface NeuralEnginePanelProps {
  isActive: boolean;
  // Neural Pitch Predictor
  predictorEnabled: boolean;
  onPredictorEnabledChange: (enabled: boolean) => void;
  contextAwareness: number;
  onContextAwarenessChange: (value: number) => void;
  // Continuous Pitch
  continuousPitch: boolean;
  onContinuousPitchChange: (enabled: boolean) => void;
  microtonalSensitivity: number;
  onMicrotonalSensitivityChange: (value: number) => void;
  // Vibrato Modeling
  vibratoModeling: boolean;
  onVibratoModelingChange: (enabled: boolean) => void;
  vibratoDepth: number;
  onVibratoDepthChange: (value: number) => void;
  vibratoRate: number;
  onVibratoRateChange: (value: number) => void;
  // Timbre Engine
  timbrePreservation: number;
  onTimbrePreservationChange: (value: number) => void;
  formantLock: boolean;
  onFormantLockChange: (enabled: boolean) => void;
}

export const NeuralEnginePanel = ({
  isActive,
  predictorEnabled,
  onPredictorEnabledChange,
  contextAwareness,
  onContextAwarenessChange,
  continuousPitch,
  onContinuousPitchChange,
  microtonalSensitivity,
  onMicrotonalSensitivityChange,
  vibratoModeling,
  onVibratoModelingChange,
  vibratoDepth,
  onVibratoDepthChange,
  vibratoRate,
  onVibratoRateChange,
  timbrePreservation,
  onTimbrePreservationChange,
  formantLock,
  onFormantLockChange
}: NeuralEnginePanelProps) => {
  return (
    <div className={cn(
      "rounded-xl border p-4 space-y-4",
      isActive ? "border-primary/30 bg-primary/5" : "border-border bg-card/50",
      "transition-all duration-300"
    )}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Brain className={cn(
          "w-5 h-5",
          isActive ? "text-primary" : "text-muted-foreground"
        )} />
        <span className="font-display text-sm uppercase tracking-wider">
          Neural Engine
        </span>
        <div className={cn(
          "ml-auto px-2 py-0.5 rounded text-[10px] uppercase",
          isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
        )}>
          {isActive ? "Active" : "Inactive"}
        </div>
      </div>

      {/* Neural Pitch Predictor */}
      <div className="space-y-3 p-3 rounded-lg bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium">Context-Aware Tuning</span>
          </div>
          <ToggleSwitch
            isOn={predictorEnabled}
            onChange={onPredictorEnabledChange}
            label=""
          />
        </div>
        {predictorEnabled && (
          <div className="flex justify-center">
            <Knob
              value={contextAwareness}
              onChange={onContextAwarenessChange}
              label="Context"
              unit="%"
              size="sm"
            />
          </div>
        )}
      </div>

      {/* Continuous Pitch */}
      <div className="space-y-3 p-3 rounded-lg bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Waves className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium">Continuous Pitch</span>
          </div>
          <ToggleSwitch
            isOn={continuousPitch}
            onChange={onContinuousPitchChange}
            label=""
          />
        </div>
        {continuousPitch && (
          <div className="flex justify-center">
            <Knob
              value={microtonalSensitivity}
              onChange={onMicrotonalSensitivityChange}
              label="Microtonal"
              unit="%"
              size="sm"
            />
          </div>
        )}
        <p className="text-[10px] text-muted-foreground">
          Smooth pitch gliding for blues, jazz & world music
        </p>
      </div>

      {/* Vibrato Modeling */}
      <div className="space-y-3 p-3 rounded-lg bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium">Vibrato Modeling</span>
          </div>
          <ToggleSwitch
            isOn={vibratoModeling}
            onChange={onVibratoModelingChange}
            label=""
          />
        </div>
        {vibratoModeling && (
          <div className="grid grid-cols-2 gap-2">
            <Knob
              value={vibratoDepth}
              onChange={onVibratoDepthChange}
              label="Depth"
              unit="%"
              size="sm"
            />
            <Knob
              value={vibratoRate}
              min={1}
              max={10}
              onChange={onVibratoRateChange}
              label="Rate"
              unit="Hz"
              size="sm"
            />
          </div>
        )}
      </div>

      {/* Timbre/Formant Engine */}
      <div className="space-y-3 p-3 rounded-lg bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium">Timbre Consistency</span>
          </div>
          <ToggleSwitch
            isOn={formantLock}
            onChange={onFormantLockChange}
            label=""
          />
        </div>
        <div className="flex justify-center">
          <Knob
            value={timbrePreservation}
            onChange={onTimbrePreservationChange}
            label="Preserve"
            unit="%"
            size="sm"
          />
        </div>
        <p className="text-[10px] text-muted-foreground">
          Maintains vocal character during pitch shifts
        </p>
      </div>
    </div>
  );
};