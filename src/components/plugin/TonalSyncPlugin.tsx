import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Header } from "./Header";
import { Knob } from "./Knob";
import { VUMeter } from "./VUMeter";
import { PitchGraph } from "./PitchGraph";
import { ToggleSwitch } from "./ToggleSwitch";
import { KeyScaleSelector } from "./KeyScaleSelector";
import { AIPEIndicator } from "./AIPEIndicator";
import { ControlSection } from "./ControlSection";
import { HarmonicRetunePanel } from "./HarmonicRetunePanel";
import { AIPEAdvancedPanel } from "./AIPEAdvancedPanel";
import { Mic, Volume2 } from "lucide-react";

export const TonalSyncPlugin = () => {
  // Control states
  const [retuneSpeed, setRetuneSpeed] = useState(50);
  const [humanize, setHumanize] = useState(25);
  const [flexTune, setFlexTune] = useState(40);
  const [formant, setFormant] = useState(0);
  const [vibrato, setVibrato] = useState(50);
  const [vibratoRate, setVibratoRate] = useState(5);
  const [mix, setMix] = useState(100);

  // Toggle states
  const [realTimeMode, setRealTimeMode] = useState(true);
  const [aipeEnabled, setAipeEnabled] = useState(true);
  const [harmonicRetune, setHarmonicRetune] = useState(true);

  // Harmonic Retune controls
  const [harmonicFocus, setHarmonicFocus] = useState(75);
  const [overtoneBias, setOvertoneBias] = useState(0);

  // AIPE Advanced controls
  const [adaptiveMode, setAdaptiveMode] = useState(true);
  const [vibratoIsolation, setVibratoIsolation] = useState(60);
  const [slidePreservation, setSlidePreservation] = useState(true);
  const [intentSensitivity, setIntentSensitivity] = useState(70);

  // Simulated levels
  const [inputLevel, setInputLevel] = useState(0);
  const [outputLevel, setOutputLevel] = useState(0);
  const [aipeConfidence, setAipeConfidence] = useState(0);

  // Simulate audio levels
  useEffect(() => {
    const interval = setInterval(() => {
      const base = 50 + Math.sin(Date.now() / 500) * 30;
      const noise = Math.random() * 20;
      setInputLevel(Math.min(100, Math.max(0, base + noise)));
      setOutputLevel(Math.min(100, Math.max(0, base + noise - 5 + Math.random() * 10)));
      
      if (aipeEnabled) {
        setAipeConfidence((prev) => {
          const target = 85 + Math.random() * 15;
          return prev + (target - prev) * 0.1;
        });
      }
    }, 50);
    return () => clearInterval(interval);
  }, [aipeEnabled]);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 flex items-center justify-center">
      <div
        className={cn(
          "w-full max-w-6xl",
          "bg-gradient-to-b from-card to-background",
          "rounded-2xl shadow-panel",
          "glow-border overflow-hidden"
        )}
      >
        <Header />

        <div className="p-4 md:p-6 space-y-4">
          {/* Main controls row */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Left panel - Input/Key */}
            <div className="space-y-4">
              <ControlSection title="Input">
                <div className="flex items-center justify-center gap-4">
                  <VUMeter level={inputLevel} peak={inputLevel} label="In" />
                  <div className="flex flex-col items-center gap-2">
                    <div className={cn(
                      "w-12 h-12 rounded-full",
                      "bg-muted border border-border",
                      "flex items-center justify-center",
                      inputLevel > 10 && "border-primary shadow-glow"
                    )}>
                      <Mic className={cn(
                        "w-6 h-6",
                        inputLevel > 10 ? "text-primary" : "text-muted-foreground"
                      )} />
                    </div>
                    <span className="text-[10px] text-muted-foreground">TRACKING</span>
                  </div>
                </div>
              </ControlSection>

              <ControlSection title="Key & Scale">
                <KeyScaleSelector />
              </ControlSection>

              <AIPEIndicator
                isActive={aipeEnabled}
                confidence={Math.round(aipeConfidence)}
              />

              <HarmonicRetunePanel
                harmonicFocus={harmonicFocus}
                onHarmonicFocusChange={setHarmonicFocus}
                overtoneBias={overtoneBias}
                onOvertoneBiasChange={setOvertoneBias}
                isActive={harmonicRetune}
              />
            </div>

            {/* Center panel - Graph and main knobs */}
            <div className="lg:col-span-2 space-y-4">
              <ControlSection title="Pitch Graph" glowing>
                <PitchGraph className="h-48 md:h-56" />
              </ControlSection>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <ControlSection title="Retune Speed">
                  <div className="flex justify-center">
                    <Knob
                      value={retuneSpeed}
                      onChange={setRetuneSpeed}
                      label=""
                      unit="ms"
                      size="lg"
                    />
                  </div>
                </ControlSection>

                <ControlSection title="Humanize">
                  <div className="flex justify-center">
                    <Knob
                      value={humanize}
                      onChange={setHumanize}
                      label=""
                      unit="%"
                      size="lg"
                    />
                  </div>
                </ControlSection>

                <ControlSection title="Flex-Tune">
                  <div className="flex justify-center">
                    <Knob
                      value={flexTune}
                      onChange={setFlexTune}
                      label=""
                      unit="%"
                      size="lg"
                    />
                  </div>
                </ControlSection>

                <ControlSection title="Formant">
                  <div className="flex justify-center">
                    <Knob
                      value={formant}
                      min={-12}
                      max={12}
                      onChange={setFormant}
                      label=""
                      unit="st"
                      size="lg"
                    />
                  </div>
                </ControlSection>
              </div>
            </div>

            {/* Right panel - Output/Advanced */}
            <div className="space-y-4">
              <ControlSection title="Output">
                <div className="flex items-center justify-center gap-4">
                  <div className="flex flex-col items-center gap-2">
                    <div className={cn(
                      "w-12 h-12 rounded-full",
                      "bg-muted border border-border",
                      "flex items-center justify-center",
                      outputLevel > 10 && "border-primary shadow-glow"
                    )}>
                      <Volume2 className={cn(
                        "w-6 h-6",
                        outputLevel > 10 ? "text-primary" : "text-muted-foreground"
                      )} />
                    </div>
                    <span className="text-[10px] text-muted-foreground">OUTPUT</span>
                  </div>
                  <VUMeter level={outputLevel} peak={outputLevel} label="Out" />
                </div>
              </ControlSection>

              <ControlSection title="Vibrato">
                <div className="grid grid-cols-2 gap-4">
                  <Knob
                    value={vibrato}
                    onChange={setVibrato}
                    label="Depth"
                    unit="%"
                    size="sm"
                  />
                  <Knob
                    value={vibratoRate}
                    min={1}
                    max={10}
                    onChange={setVibratoRate}
                    label="Rate"
                    unit="Hz"
                    size="sm"
                  />
                </div>
              </ControlSection>

              <ControlSection title="Mix">
                <div className="flex justify-center">
                  <Knob
                    value={mix}
                    onChange={setMix}
                    label="Wet/Dry"
                    unit="%"
                    size="md"
                  />
                </div>
              </ControlSection>

              <AIPEAdvancedPanel
                isActive={aipeEnabled}
                adaptiveMode={adaptiveMode}
                onAdaptiveModeChange={setAdaptiveMode}
                vibratoIsolation={vibratoIsolation}
                onVibratoIsolationChange={setVibratoIsolation}
                slidePreservation={slidePreservation}
                onSlidePreservationChange={setSlidePreservation}
                intentSensitivity={intentSensitivity}
                onIntentSensitivityChange={setIntentSensitivity}
                confidence={Math.round(aipeConfidence)}
              />
            </div>
          </div>

          {/* Bottom controls */}
          <div className="flex flex-wrap items-center justify-center gap-6 pt-4 border-t border-border/50">
            <ToggleSwitch
              isOn={realTimeMode}
              onChange={setRealTimeMode}
              label="Real-Time"
              sublabel="0ms Latency"
            />
            <ToggleSwitch
              isOn={aipeEnabled}
              onChange={setAipeEnabled}
              label="AIPE"
              sublabel="AI Engine"
            />
            <ToggleSwitch
              isOn={harmonicRetune}
              onChange={setHarmonicRetune}
              label="Harmonic"
              sublabel="Retune"
            />

            {/* Preset buttons */}
            <div className="flex gap-2 ml-4 pl-4 border-l border-border/50">
              {["Init", "Natural", "Robot", "Custom"].map((preset) => (
                <button
                  key={preset}
                  className={cn(
                    "px-4 py-2 rounded-lg text-xs font-display uppercase",
                    "border border-border bg-muted",
                    "hover:border-primary/50 hover:bg-primary/10",
                    "transition-all duration-200",
                    preset === "Natural" && "border-primary bg-primary/20 text-primary"
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
