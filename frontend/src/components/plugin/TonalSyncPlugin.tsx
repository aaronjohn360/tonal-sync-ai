import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Knob } from "./Knob";
import { VUMeter } from "./VUMeter";
import { PitchGraph } from "./PitchGraph";
import { KeyScaleSelector } from "./KeyScaleSelector";
import { useAudioProcessor } from "@/hooks/useAudioProcessor";
import { 
  Mic, MicOff, Volume2, VolumeX, Power, Settings, ChevronDown, Check,
  Music, Zap, Menu, X, Sliders, AudioWaveform, Headphones
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";

export const TonalSyncPlugin = () => {
  // Core controls
  const [retuneSpeed, setRetuneSpeed] = useState(50);
  const [humanize, setHumanize] = useState(25);
  const [flexTune, setFlexTune] = useState(40);
  const [formant, setFormant] = useState(0);
  const [mix, setMix] = useState(100);
  
  // Key/Scale
  const [selectedKey, setSelectedKey] = useState("C");
  const [selectedScale, setSelectedScale] = useState("Major");
  
  // Advanced settings (in menu)
  const [vibrato, setVibrato] = useState(50);
  const [vibratoRate, setVibratoRate] = useState(5);
  const [harmonicFocus, setHarmonicFocus] = useState(75);
  const [contextAwareness, setContextAwareness] = useState(75);
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Audio processor
  const audioProcessor = useAudioProcessor({
    retuneSpeed,
    humanize,
    formant,
    mix,
    selectedKey,
    selectedScale
  });

  const handleAudioStart = useCallback(async (deviceId: string) => {
    setIsLoading(true);
    setAudioError(null);
    try {
      await audioProcessor.start(deviceId);
      toast.success("Audio started");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to start";
      setAudioError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [audioProcessor]);

  const handleAudioStop = useCallback(() => {
    audioProcessor.stop();
    toast.info("Audio stopped");
  }, [audioProcessor]);

  const handleRequestDevices = useCallback(async () => {
    try {
      return await audioProcessor.requestPermissionAndEnumerate();
    } catch (e) {
      setAudioError(e instanceof Error ? e.message : "Failed to get devices");
      return [];
    }
  }, [audioProcessor]);

  const isClassicMode = audioProcessor.correctionMode === "classic";

  return (
    <div className={cn(
      "min-h-screen bg-gradient-to-br from-background via-background to-muted/20",
      "flex items-center justify-center p-4"
    )}>
      <div className={cn(
        "w-full max-w-3xl",
        "bg-card/95 backdrop-blur-xl",
        "rounded-2xl border-2",
        "shadow-2xl",
        "transition-all duration-500",
        isClassicMode ? "border-orange-500/50 shadow-orange-500/10" : "border-primary/30 shadow-primary/10"
      )}>
        {/* Compact Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              "bg-gradient-to-br",
              isClassicMode ? "from-orange-500 to-red-500" : "from-primary to-cyan-500"
            )}>
              <AudioWaveform className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-display font-bold tracking-wider">
                TONAL<span className={isClassicMode ? "text-orange-400" : "text-primary"}>SYNC</span>
              </h1>
              <p className="text-[10px] text-muted-foreground">PRO 2026</p>
            </div>
          </div>

          {/* Status indicators */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <span>CPU: 2.3%</span>
              <span>|</span>
              <span className="text-primary">0ms</span>
            </div>
            
            {/* Mode Toggle */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50 border border-border">
              <button
                onClick={() => audioProcessor.setCorrectionMode("modern")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-display transition-all",
                  !isClassicMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Music className="w-3 h-3 inline mr-1" />
                Modern
              </button>
              <button
                onClick={() => audioProcessor.setCorrectionMode("classic")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-display transition-all",
                  isClassicMode ? "bg-gradient-to-r from-orange-500 to-red-500 text-white" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Zap className="w-3 h-3 inline mr-1" />
                Classic
              </button>
            </div>

            {/* Advanced Settings Button */}
            <Sheet open={showAdvanced} onOpenChange={setShowAdvanced}>
              <SheetTrigger asChild>
                <button className="p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <Menu className="w-5 h-5" />
                </button>
              </SheetTrigger>
              <SheetContent className="bg-card border-border">
                <SheetHeader>
                  <SheetTitle className="font-display">Advanced Settings</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-6">
                  {/* Vibrato */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Vibrato Depth: {vibrato}%</label>
                    <Slider value={[vibrato]} onValueChange={([v]) => setVibrato(v)} max={100} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Vibrato Rate: {vibratoRate}Hz</label>
                    <Slider value={[vibratoRate]} onValueChange={([v]) => setVibratoRate(v)} min={1} max={10} />
                  </div>
                  {/* Harmonic Focus */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Harmonic Focus: {harmonicFocus}%</label>
                    <Slider value={[harmonicFocus]} onValueChange={([v]) => setHarmonicFocus(v)} max={100} />
                  </div>
                  {/* Context Awareness */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Context Awareness: {contextAwareness}%</label>
                    <Slider value={[contextAwareness]} onValueChange={([v]) => setContextAwareness(v)} max={100} />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Main Content - Compact Layout */}
        <div className="p-4 space-y-4">
          {/* Input Section */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Mic Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  disabled={isLoading}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl",
                    "font-display uppercase text-sm tracking-wider",
                    "transition-all duration-300",
                    audioProcessor.isActive
                      ? "bg-primary text-primary-foreground shadow-glow"
                      : "bg-muted border border-border hover:border-primary/50",
                    isLoading && "opacity-50"
                  )}
                >
                  {audioProcessor.isActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  <span className="max-w-[120px] truncate">
                    {isLoading ? "..." : audioProcessor.isActive ? 
                      (audioProcessor.availableDevices.find(d => d.deviceId === audioProcessor.selectedDevice)?.label || "Active") : 
                      "Select Input"}
                  </span>
                  <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 bg-card border-border">
                <DropdownMenuItem onClick={handleAudioStop} className="text-muted-foreground">
                  <MicOff className="w-4 h-4 mr-2" />
                  None (Stop)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {audioProcessor.availableDevices.length === 0 ? (
                  <DropdownMenuItem onClick={handleRequestDevices}>
                    Click to request access
                  </DropdownMenuItem>
                ) : (
                  audioProcessor.availableDevices.map(device => (
                    <DropdownMenuItem
                      key={device.deviceId}
                      onClick={() => {
                        audioProcessor.selectDevice(device.deviceId);
                        if (!audioProcessor.isActive) handleAudioStart(device.deviceId);
                      }}
                      className={cn(audioProcessor.selectedDevice === device.deviceId && "bg-primary/20")}
                    >
                      <Mic className="w-4 h-4 mr-2" />
                      <span className="truncate flex-1">{device.label}</span>
                      {audioProcessor.selectedDevice === device.deviceId && <Check className="w-4 h-4" />}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Monitor Volume */}
            <div className="flex items-center gap-2 flex-1 min-w-[150px]">
              <button
                onClick={() => audioProcessor.setMonitoring(!audioProcessor.isMonitoring)}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  audioProcessor.isMonitoring ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Headphones className="w-4 h-4" />
              </button>
              <Slider
                value={[audioProcessor.monitorVolume]}
                onValueChange={([v]) => audioProcessor.setMonitorVolume(v)}
                max={100}
                disabled={!audioProcessor.isMonitoring}
                className="flex-1"
              />
              <span className="text-xs font-mono w-8 text-right">{audioProcessor.monitorVolume}%</span>
            </div>

            {/* Bypass */}
            <button
              onClick={() => audioProcessor.setBypass(!audioProcessor.isBypassed)}
              disabled={!audioProcessor.isActive}
              className={cn(
                "px-3 py-2 rounded-lg border text-xs font-display uppercase transition-all",
                !audioProcessor.isActive && "opacity-50",
                audioProcessor.isBypassed
                  ? "border-red-500/50 text-red-400 bg-red-500/10"
                  : "border-primary/50 text-primary bg-primary/10"
              )}
            >
              <Power className="w-3 h-3 inline mr-1" />
              {audioProcessor.isBypassed ? "OFF" : "ON"}
            </button>
          </div>

          {/* Pitch Graph + Key/Scale Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Key & Scale - Compact */}
            <div className="md:col-span-1 space-y-2">
              <KeyScaleSelector
                selectedKey={selectedKey}
                selectedScale={selectedScale}
                onKeyChange={setSelectedKey}
                onScaleChange={setSelectedScale}
              />
              
              {/* Pitch Display */}
              {audioProcessor.isActive && (
                <div className={cn(
                  "p-3 rounded-lg border text-center",
                  isClassicMode ? "border-orange-500/30 bg-orange-500/5" : "border-primary/30 bg-primary/5"
                )}>
                  <div className="text-xs text-muted-foreground mb-1">DETECTED → CORRECTED</div>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-lg font-mono text-muted-foreground">{audioProcessor.detectedNote}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full",
                      Math.abs(audioProcessor.pitchError) < 10 ? "bg-primary/20 text-primary" :
                      Math.abs(audioProcessor.pitchError) < 25 ? "bg-yellow-500/20 text-yellow-400" :
                      "bg-red-500/20 text-red-400"
                    )}>
                      {audioProcessor.pitchError > 0 ? "+" : ""}{audioProcessor.pitchError}¢
                    </span>
                    <span className={cn("text-2xl font-display", isClassicMode ? "text-orange-400" : "text-primary")}>
                      {audioProcessor.correctedNote}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Pitch Graph */}
            <div className="md:col-span-3 h-40 md:h-48">
              <PitchGraph
                className="h-full rounded-lg border border-border"
                pitchHistory={audioProcessor.pitchHistory}
                isActive={audioProcessor.isActive}
              />
            </div>
          </div>

          {/* Main Controls - Compact Knob Row */}
          <div className="grid grid-cols-5 gap-2 md:gap-4">
            <div className="flex flex-col items-center">
              <Knob
                value={retuneSpeed}
                onChange={setRetuneSpeed}
                min={0}
                max={100}
                size="sm"
                color={isClassicMode ? "orange" : "green"}
              />
              <span className="text-[10px] md:text-xs text-center text-muted-foreground mt-1">RETUNE</span>
              <span className="text-xs font-mono text-primary">{retuneSpeed}ms</span>
            </div>
            
            <div className="flex flex-col items-center">
              <Knob
                value={humanize}
                onChange={setHumanize}
                min={0}
                max={100}
                size="sm"
                color={isClassicMode ? "orange" : "green"}
              />
              <span className="text-[10px] md:text-xs text-center text-muted-foreground mt-1">HUMANIZE</span>
              <span className="text-xs font-mono text-primary">{humanize}%</span>
            </div>
            
            <div className="flex flex-col items-center">
              <Knob
                value={flexTune}
                onChange={setFlexTune}
                min={0}
                max={100}
                size="sm"
                color={isClassicMode ? "orange" : "green"}
              />
              <span className="text-[10px] md:text-xs text-center text-muted-foreground mt-1">FLEX-TUNE</span>
              <span className="text-xs font-mono text-primary">{flexTune}%</span>
            </div>
            
            <div className="flex flex-col items-center">
              <Knob
                value={formant}
                onChange={setFormant}
                min={-12}
                max={12}
                size="sm"
                color={isClassicMode ? "orange" : "green"}
              />
              <span className="text-[10px] md:text-xs text-center text-muted-foreground mt-1">FORMANT</span>
              <span className="text-xs font-mono text-primary">{formant}st</span>
            </div>
            
            <div className="flex flex-col items-center">
              <Knob
                value={mix}
                onChange={setMix}
                min={0}
                max={100}
                size="sm"
                color={isClassicMode ? "orange" : "green"}
              />
              <span className="text-[10px] md:text-xs text-center text-muted-foreground mt-1">MIX</span>
              <span className="text-xs font-mono text-primary">{mix}%</span>
            </div>
          </div>

          {/* Level Meters - Compact */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Mic className={cn("w-3 h-3", audioProcessor.inputLevel > 10 ? "text-primary" : "text-muted-foreground")} />
                <span className="text-[10px] text-muted-foreground uppercase">Input</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all duration-75 rounded-full",
                    audioProcessor.inputLevel > 85 ? "bg-red-500" :
                    audioProcessor.inputLevel > 70 ? "bg-yellow-500" :
                    isClassicMode ? "bg-orange-500" : "bg-primary"
                  )}
                  style={{ width: `${audioProcessor.inputLevel}%` }}
                />
              </div>
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 justify-end">
                <span className="text-[10px] text-muted-foreground uppercase">Output</span>
                <Volume2 className={cn("w-3 h-3", audioProcessor.outputLevel > 10 ? "text-primary" : "text-muted-foreground")} />
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all duration-75 rounded-full",
                    audioProcessor.outputLevel > 85 ? "bg-red-500" :
                    audioProcessor.outputLevel > 70 ? "bg-yellow-500" :
                    isClassicMode ? "bg-orange-500" : "bg-primary"
                  )}
                  style={{ width: `${audioProcessor.isBypassed ? 0 : audioProcessor.outputLevel}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border/50 text-[10px] text-muted-foreground">
          <span>© 2026 TonalSync Pro</span>
          <div className="flex items-center gap-2">
            {audioProcessor.isProcessing && (
              <span className={cn("flex items-center gap-1", isClassicMode ? "text-orange-400" : "text-primary")}>
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                Processing
              </span>
            )}
            <span>{isClassicMode ? "T-Pain Mode" : "Natural Mode"}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
