import { useState, useEffect, useCallback } from "react";
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
import { AudioControlBar } from "./AudioControlBar";
import { PresetManager, PluginPreset } from "./PresetManager";
import { NeuralEnginePanel } from "./NeuralEnginePanel";
import { VocalChainPanel } from "./VocalChainPanel";
import { useAudioProcessor } from "@/hooks/useAudioProcessor";
import { Mic, Volume2 } from "lucide-react";
import { toast } from "sonner";

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

  // Key and scale selection
  const [selectedKey, setSelectedKey] = useState("C");
  const [selectedScale, setSelectedScale] = useState("Major");

  // Neural Engine controls
  const [predictorEnabled, setPredictorEnabled] = useState(true);
  const [contextAwareness, setContextAwareness] = useState(75);
  const [continuousPitch, setContinuousPitch] = useState(false);
  const [microtonalSensitivity, setMicrotonalSensitivity] = useState(50);
  const [vibratoModeling, setVibratoModeling] = useState(true);
  const [vibratoModelDepth, setVibratoModelDepth] = useState(50);
  const [vibratoModelRate, setVibratoModelRate] = useState(5);
  const [timbrePreservation, setTimbrePreservation] = useState(80);
  const [formantLock, setFormantLock] = useState(true);

  // Vocal Chain controls
  const [harmonicSculptor, setHarmonicSculptor] = useState(false);
  const [harmonicBoost, setHarmonicBoost] = useState(0);
  const [mixAwareDampening, setMixAwareDampening] = useState(false);
  const [dampeningAmount, setDampeningAmount] = useState(50);
  const [latencyMode, setLatencyMode] = useState<"realtime" | "quality" | "offline">("realtime");

  // Audio processor hook
  const audioProcessor = useAudioProcessor({
    retuneSpeed,
    humanize,
    formant,
    mix,
    selectedKey,
    selectedScale
  });

  // Loading and error states
  const [isLoading, setIsLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  // AIPE confidence simulation based on audio input
  const [aipeConfidence, setAipeConfidence] = useState(0);

  useEffect(() => {
    if (aipeEnabled && audioProcessor.isActive && audioProcessor.inputLevel > 5) {
      setAipeConfidence((prev) => {
        const target = 85 + Math.random() * 15;
        return prev + (target - prev) * 0.1;
      });
    } else if (!audioProcessor.isActive) {
      setAipeConfidence(0);
    }
  }, [aipeEnabled, audioProcessor.isActive, audioProcessor.inputLevel]);

  const handleDeviceSelect = useCallback((deviceId: string) => {
    audioProcessor.selectDevice(deviceId);
  }, [audioProcessor]);

  const handleAudioStart = useCallback(async (deviceId: string) => {
    setAudioError(null);
    setIsLoading(true);
    
    try {
      await audioProcessor.start(deviceId);
      toast.success("Microphone active - sing into your mic!");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to access microphone";
      setAudioError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [audioProcessor]);

  const handleBypassToggle = useCallback(() => {
    audioProcessor.setBypass(!audioProcessor.isBypassed);
    toast.info(audioProcessor.isBypassed ? "Plugin Active" : "Plugin Bypassed");
  }, [audioProcessor]);

  const handleAudioStop = useCallback(() => {
    audioProcessor.stop();
    toast.info("Audio stopped");
  }, [audioProcessor]);

  const handleRequestDevices = useCallback(async () => {
    try {
      return await audioProcessor.requestPermissionAndEnumerate();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to enumerate devices";
      setAudioError(errorMessage);
      toast.error(errorMessage);
      return [];
    }
  }, [audioProcessor]);

  // Get current settings for preset manager
  const getCurrentSettings = useCallback((): PluginPreset["settings"] => ({
    retuneSpeed,
    humanize,
    flexTune,
    formant,
    vibrato,
    vibratoRate,
    mix,
    selectedKey,
    selectedScale,
    realTimeMode,
    aipeEnabled,
    harmonicRetune,
    harmonicFocus,
    overtoneBias,
    adaptiveMode,
    vibratoIsolation,
    slidePreservation,
    intentSensitivity
  }), [
    retuneSpeed, humanize, flexTune, formant, vibrato, vibratoRate, mix,
    selectedKey, selectedScale, realTimeMode, aipeEnabled, harmonicRetune,
    harmonicFocus, overtoneBias, adaptiveMode, vibratoIsolation,
    slidePreservation, intentSensitivity
  ]);

  const handleLoadPreset = useCallback((settings: PluginPreset["settings"]) => {
    setRetuneSpeed(settings.retuneSpeed);
    setHumanize(settings.humanize);
    setFlexTune(settings.flexTune);
    setFormant(settings.formant);
    setVibrato(settings.vibrato);
    setVibratoRate(settings.vibratoRate);
    setMix(settings.mix);
    setSelectedKey(settings.selectedKey);
    setSelectedScale(settings.selectedScale);
    setRealTimeMode(settings.realTimeMode);
    setAipeEnabled(settings.aipeEnabled);
    setHarmonicRetune(settings.harmonicRetune);
    setHarmonicFocus(settings.harmonicFocus);
    setOvertoneBias(settings.overtoneBias);
    setAdaptiveMode(settings.adaptiveMode);
    setVibratoIsolation(settings.vibratoIsolation);
    setSlidePreservation(settings.slidePreservation);
    setIntentSensitivity(settings.intentSensitivity);
  }, []);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 flex items-center justify-center">
      <div
        className={cn(
          "w-full max-w-7xl",
          "bg-gradient-to-b from-card to-background",
          "rounded-2xl shadow-panel",
          "glow-border overflow-hidden",
          "animate-scale-in"
        )}
      >
        <Header />

        <div className="p-4 md:p-6 space-y-4 animate-fade-in" style={{ animationDelay: '200ms' }}>
          {/* Audio Control Bar */}
          <AudioControlBar
            isActive={audioProcessor.isActive}
            isBypassed={audioProcessor.isBypassed}
            onBypassToggle={handleBypassToggle}
            onDeviceSelect={handleDeviceSelect}
            onStart={handleAudioStart}
            onStop={handleAudioStop}
            availableDevices={audioProcessor.availableDevices}
            selectedDevice={audioProcessor.selectedDevice}
            detectedNote={audioProcessor.detectedNote}
            detectedPitch={audioProcessor.detectedPitch}
            correctedNote={audioProcessor.correctedNote}
            correctedPitch={audioProcessor.correctedPitch}
            pitchError={audioProcessor.pitchError}
            isLoading={isLoading}
            error={audioError}
            onRequestDevices={handleRequestDevices}
          />

          {/* Main controls row */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Left panel - Input/Key */}
            <div className="space-y-4">
              <ControlSection title="Input">
                <div className="flex items-center justify-center gap-4">
                  <VUMeter level={audioProcessor.inputLevel} peak={audioProcessor.inputLevel} label="In" />
                  <div className="flex flex-col items-center gap-2">
                    <div className={cn(
                      "w-12 h-12 rounded-full",
                      "bg-muted border border-border",
                      "flex items-center justify-center",
                      audioProcessor.inputLevel > 10 && "border-primary shadow-glow"
                    )}>
                      <Mic className={cn(
                        "w-6 h-6",
                        audioProcessor.inputLevel > 10 ? "text-primary" : "text-muted-foreground"
                      )} />
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {audioProcessor.isActive ? "LIVE" : "TRACKING"}
                    </span>
                  </div>
                </div>
              </ControlSection>

              <ControlSection title="Key & Scale">
                <KeyScaleSelector 
                  selectedKey={selectedKey}
                  onKeyChange={setSelectedKey}
                  selectedScale={selectedScale}
                  onScaleChange={setSelectedScale}
                />
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
                <PitchGraph 
                  className="h-48 md:h-56" 
                  pitchHistory={audioProcessor.pitchHistory}
                  isActive={audioProcessor.isActive}
                />
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
                      audioProcessor.outputLevel > 10 && !audioProcessor.isBypassed && "border-primary shadow-glow"
                    )}>
                      <Volume2 className={cn(
                        "w-6 h-6",
                        audioProcessor.outputLevel > 10 && !audioProcessor.isBypassed ? "text-primary" : "text-muted-foreground"
                      )} />
                    </div>
                    <span className="text-[10px] text-muted-foreground">OUTPUT</span>
                  </div>
                  <VUMeter level={audioProcessor.outputLevel} peak={audioProcessor.outputLevel} label="Out" />
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

            {/* Far right panel - Neural Engine & Vocal Chain */}
            <div className="space-y-4">
              <NeuralEnginePanel
                isActive={aipeEnabled}
                predictorEnabled={predictorEnabled}
                onPredictorEnabledChange={setPredictorEnabled}
                contextAwareness={contextAwareness}
                onContextAwarenessChange={setContextAwareness}
                continuousPitch={continuousPitch}
                onContinuousPitchChange={setContinuousPitch}
                microtonalSensitivity={microtonalSensitivity}
                onMicrotonalSensitivityChange={setMicrotonalSensitivity}
                vibratoModeling={vibratoModeling}
                onVibratoModelingChange={setVibratoModeling}
                vibratoDepth={vibratoModelDepth}
                onVibratoDepthChange={setVibratoModelDepth}
                vibratoRate={vibratoModelRate}
                onVibratoRateChange={setVibratoModelRate}
                timbrePreservation={timbrePreservation}
                onTimbrePreservationChange={setTimbrePreservation}
                formantLock={formantLock}
                onFormantLockChange={setFormantLock}
              />

              <VocalChainPanel
                harmonicSculptor={harmonicSculptor}
                onHarmonicSculptorChange={setHarmonicSculptor}
                harmonicBoost={harmonicBoost}
                onHarmonicBoostChange={setHarmonicBoost}
                mixAwareDampening={mixAwareDampening}
                onMixAwareDampeningChange={setMixAwareDampening}
                dampeningAmount={dampeningAmount}
                onDampeningAmountChange={setDampeningAmount}
                latencyMode={latencyMode}
                onLatencyModeChange={setLatencyMode}
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

            {/* Preset Manager */}
            <div className="ml-4 pl-4 border-l border-border/50">
              <PresetManager
                currentSettings={getCurrentSettings()}
                onLoadPreset={handleLoadPreset}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};