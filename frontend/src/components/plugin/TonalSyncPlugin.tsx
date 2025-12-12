import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Knob } from "./Knob";
import { PitchGraph } from "./PitchGraph";
import { useAudioProcessor } from "@/hooks/useAudioProcessor";
import { 
  Mic, MicOff, Volume2, Power, Settings, ChevronDown, Check,
  Music, Zap, Headphones, Palette, Sliders, Sparkles, X
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";

// Color themes
const THEMES = {
  cyber: { primary: "hsl(150, 100%, 45%)", accent: "hsl(180, 100%, 50%)", name: "Cyber Green" },
  neon: { primary: "hsl(280, 100%, 60%)", accent: "hsl(320, 100%, 60%)", name: "Neon Purple" },
  sunset: { primary: "hsl(30, 100%, 55%)", accent: "hsl(0, 100%, 60%)", name: "Sunset Orange" },
  ocean: { primary: "hsl(200, 100%, 55%)", accent: "hsl(180, 100%, 50%)", name: "Ocean Blue" },
  matrix: { primary: "hsl(120, 100%, 45%)", accent: "hsl(120, 100%, 30%)", name: "Matrix" },
};

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTES_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const SCALES = ["Major", "Minor", "Chromatic", "Pentatonic", "Blues", "Dorian", "Mixolydian"];

export const TonalSyncPlugin = () => {
  // Intro state
  const [showIntro, setShowIntro] = useState(true);
  const [introFading, setIntroFading] = useState(false);
  
  // Core controls
  const [retuneSpeed, setRetuneSpeed] = useState(0); // Default to 0 for instant
  const [humanize, setHumanize] = useState(15);
  const [flexTune, setFlexTune] = useState(30);
  const [formant, setFormant] = useState(0);
  const [mix, setMix] = useState(100);
  
  // Key/Scale
  const [selectedKey, setSelectedKey] = useState("C");
  const [selectedScale, setSelectedScale] = useState("Major");
  const [useFlats, setUseFlats] = useState(false);
  
  // Advanced settings
  const [autoEQ, setAutoEQ] = useState(true);
  const [autoEQStrength, setAutoEQStrength] = useState(50);
  const [transparencyMode, setTransparencyMode] = useState(true);
  const [smoothing, setSmoothing] = useState(80);
  const [vibrato, setVibrato] = useState(50);
  const [vibratoRate, setVibratoRate] = useState(5);
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState<keyof typeof THEMES>("cyber");
  
  // Audio processor
  const audioProcessor = useAudioProcessor({
    retuneSpeed,
    humanize,
    formant,
    mix,
    selectedKey,
    selectedScale
  });

  // Intro animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setIntroFading(true);
      setTimeout(() => setShowIntro(false), 1000);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  const handleAudioStart = useCallback(async (deviceId: string) => {
    setIsLoading(true);
    setAudioError(null);
    try {
      await audioProcessor.start(deviceId);
      toast.success("Audio started - 0ms latency");
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
  const currentTheme = THEMES[theme];
  const notesList = useFlats ? NOTES_FLAT : NOTES;

  // Intro Screen
  if (showIntro) {
    return (
      <div className={cn(
        "fixed inset-0 bg-black flex items-center justify-center z-50",
        "transition-opacity duration-1000",
        introFading && "opacity-0"
      )}>
        <div className="text-center">
          <h1 className={cn(
            "text-6xl md:text-8xl font-display font-bold tracking-widest",
            "bg-gradient-to-r from-primary via-cyan-400 to-primary bg-clip-text text-transparent",
            "animate-pulse"
          )}>
            TONAL-SYNC
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mt-4 tracking-wider">
            By <span className="text-primary font-semibold">Sweav</span>
          </p>
          <div className="mt-8 flex justify-center gap-1">
            {[...Array(5)].map((_, i) => (
              <div 
                key={i}
                className="w-2 h-8 bg-primary rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-black flex items-center justify-center p-4"
      style={{ 
        '--theme-primary': currentTheme.primary,
        '--theme-accent': currentTheme.accent 
      } as React.CSSProperties}
    >
      <div className={cn(
        "w-full max-w-4xl relative",
        "bg-gradient-to-br from-gray-900/95 via-black/95 to-gray-900/95",
        "backdrop-blur-xl rounded-3xl",
        "border-2 shadow-2xl",
        "transition-all duration-500"
      )}
      style={{ 
        borderColor: currentTheme.primary,
        boxShadow: `0 0 60px ${currentTheme.primary}20, inset 0 0 60px ${currentTheme.primary}05`
      }}>
        
        {/* Settings Popup - On Plugin */}
        {showSettings && (
          <div className="absolute inset-4 bg-black/95 backdrop-blur-xl rounded-2xl z-50 p-6 border border-white/10 overflow-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-display font-bold" style={{ color: currentTheme.primary }}>
                Advanced Settings
              </h2>
              <button 
                onClick={() => setShowSettings(false)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Auto EQ */}
              <div className="space-y-4 p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Auto EQ (Note-Based)</span>
                  <button
                    onClick={() => setAutoEQ(!autoEQ)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs transition-all",
                      autoEQ ? "bg-primary/20 text-primary" : "bg-white/10 text-muted-foreground"
                    )}
                    style={autoEQ ? { backgroundColor: `${currentTheme.primary}20`, color: currentTheme.primary } : {}}
                  >
                    {autoEQ ? "ON" : "OFF"}
                  </button>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Strength: {autoEQStrength}%</label>
                  <Slider 
                    value={[autoEQStrength]} 
                    onValueChange={([v]) => setAutoEQStrength(v)} 
                    max={100}
                    disabled={!autoEQ}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Automatically adjusts EQ based on detected notes for transparent, strong autotune
                </p>
              </div>

              {/* Transparency Mode */}
              <div className="space-y-4 p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Transparency Mode</span>
                  <button
                    onClick={() => setTransparencyMode(!transparencyMode)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs transition-all",
                      transparencyMode ? "bg-primary/20 text-primary" : "bg-white/10 text-muted-foreground"
                    )}
                    style={transparencyMode ? { backgroundColor: `${currentTheme.primary}20`, color: currentTheme.primary } : {}}
                  >
                    {transparencyMode ? "ON" : "OFF"}
                  </button>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Smoothing: {smoothing}%</label>
                  <Slider value={[smoothing]} onValueChange={([v]) => setSmoothing(v)} max={100} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Ultra-smooth pitch transitions for natural, transparent correction
                </p>
              </div>

              {/* Vibrato */}
              <div className="space-y-4 p-4 rounded-xl bg-white/5 border border-white/10">
                <span className="font-medium">Vibrato Control</span>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Depth: {vibrato}%</label>
                  <Slider value={[vibrato]} onValueChange={([v]) => setVibrato(v)} max={100} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Rate: {vibratoRate}Hz</label>
                  <Slider value={[vibratoRate]} onValueChange={([v]) => setVibratoRate(v)} min={1} max={10} />
                </div>
              </div>

              {/* Color Theme */}
              <div className="space-y-4 p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  <span className="font-medium">Interface Color</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(THEMES).map(([key, t]) => (
                    <button
                      key={key}
                      onClick={() => setTheme(key as keyof typeof THEMES)}
                      className={cn(
                        "w-10 h-10 rounded-full border-2 transition-all",
                        theme === key ? "scale-110 border-white" : "border-transparent hover:scale-105"
                      )}
                      style={{ backgroundColor: t.primary }}
                      title={t.name}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{currentTheme.name}</p>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${currentTheme.primary}, ${currentTheme.accent})` }}
            >
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-display font-bold tracking-wider">
                TONAL<span style={{ color: currentTheme.primary }}>SYNC</span>
              </h1>
              <p className="text-[10px] text-muted-foreground">BY SWEAV • 0ms LATENCY</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode Toggle */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5 border border-white/10">
              <button
                onClick={() => audioProcessor.setCorrectionMode("modern")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-display transition-all",
                  !isClassicMode ? "text-white" : "text-muted-foreground hover:text-white"
                )}
                style={!isClassicMode ? { backgroundColor: currentTheme.primary } : {}}
              >
                <Music className="w-3 h-3 inline mr-1" />
                Natural
              </button>
              <button
                onClick={() => audioProcessor.setCorrectionMode("classic")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-display transition-all",
                  isClassicMode ? "bg-gradient-to-r from-orange-500 to-red-500 text-white" : "text-muted-foreground hover:text-white"
                )}
              >
                <Zap className="w-3 h-3 inline mr-1" />
                T-Pain
              </button>
            </div>

            {/* Settings Button */}
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={cn(
                "p-2 rounded-lg transition-all",
                showSettings ? "bg-white/20" : "hover:bg-white/10"
              )}
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-4 space-y-4">
          {/* Top Row: Input + Monitor + Bypass */}
          <div className="flex items-center gap-3 flex-wrap">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  disabled={isLoading}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl",
                    "font-display text-sm transition-all",
                    audioProcessor.isActive ? "text-white" : "bg-white/5 border border-white/10 hover:border-white/30",
                    isLoading && "opacity-50"
                  )}
                  style={audioProcessor.isActive ? { backgroundColor: currentTheme.primary } : {}}
                >
                  {audioProcessor.isActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  <span className="max-w-[100px] truncate">
                    {isLoading ? "..." : audioProcessor.isActive ? "ACTIVE" : "INPUT"}
                  </span>
                  <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 bg-gray-900 border-white/10">
                <DropdownMenuItem onClick={handleAudioStop} className="text-muted-foreground">
                  <MicOff className="w-4 h-4 mr-2" />None (Stop)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {audioProcessor.availableDevices.length === 0 ? (
                  <DropdownMenuItem onClick={handleRequestDevices}>Click to request access</DropdownMenuItem>
                ) : (
                  audioProcessor.availableDevices.map(device => (
                    <DropdownMenuItem
                      key={device.deviceId}
                      onClick={() => {
                        audioProcessor.selectDevice(device.deviceId);
                        if (!audioProcessor.isActive) handleAudioStart(device.deviceId);
                      }}
                    >
                      <Mic className="w-4 h-4 mr-2" />
                      <span className="truncate flex-1">{device.label}</span>
                      {audioProcessor.selectedDevice === device.deviceId && <Check className="w-4 h-4" />}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Monitor */}
            <div className="flex items-center gap-2 flex-1 min-w-[120px]">
              <button
                onClick={() => audioProcessor.setMonitoring(!audioProcessor.isMonitoring)}
                className="p-2 rounded-lg transition-colors"
                style={{ color: audioProcessor.isMonitoring ? currentTheme.primary : undefined }}
              >
                <Headphones className="w-4 h-4" />
              </button>
              <Slider
                value={[audioProcessor.monitorVolume]}
                onValueChange={([v]) => audioProcessor.setMonitorVolume(v)}
                max={100}
                className="flex-1"
              />
              <span className="text-xs font-mono w-8">{audioProcessor.monitorVolume}%</span>
            </div>

            {/* Bypass */}
            <button
              onClick={() => audioProcessor.setBypass(!audioProcessor.isBypassed)}
              disabled={!audioProcessor.isActive}
              className={cn(
                "px-4 py-2 rounded-xl border text-xs font-display transition-all",
                !audioProcessor.isActive && "opacity-50",
                audioProcessor.isBypassed ? "border-red-500/50 text-red-400 bg-red-500/10" : "border-white/20 bg-white/5"
              )}
              style={!audioProcessor.isBypassed && audioProcessor.isActive ? { borderColor: currentTheme.primary, color: currentTheme.primary } : {}}
            >
              <Power className="w-3 h-3 inline mr-1" />
              {audioProcessor.isBypassed ? "OFF" : "ON"}
            </button>
          </div>

          {/* Pitch Graph - Centered */}
          <div className="flex justify-center">
            <div className="w-full max-w-2xl h-32 md:h-40">
              <PitchGraph
                className="h-full rounded-xl border border-white/10"
                pitchHistory={audioProcessor.pitchHistory}
                isActive={audioProcessor.isActive}
              />
            </div>
          </div>

          {/* Control Knobs - Centered */}
          <div className="flex justify-center">
            <div className="grid grid-cols-5 gap-4 md:gap-8">
              <div className="flex flex-col items-center">
                <Knob value={retuneSpeed} onChange={setRetuneSpeed} min={0} max={100} size="sm" />
                <span className="text-[10px] text-muted-foreground mt-1 uppercase">Retune</span>
                <span className="text-xs font-mono" style={{ color: currentTheme.primary }}>{retuneSpeed}ms</span>
              </div>
              <div className="flex flex-col items-center">
                <Knob value={humanize} onChange={setHumanize} min={0} max={100} size="sm" />
                <span className="text-[10px] text-muted-foreground mt-1 uppercase">Human</span>
                <span className="text-xs font-mono" style={{ color: currentTheme.primary }}>{humanize}%</span>
              </div>
              <div className="flex flex-col items-center">
                <Knob value={flexTune} onChange={setFlexTune} min={0} max={100} size="sm" />
                <span className="text-[10px] text-muted-foreground mt-1 uppercase">Flex</span>
                <span className="text-xs font-mono" style={{ color: currentTheme.primary }}>{flexTune}%</span>
              </div>
              <div className="flex flex-col items-center">
                <Knob value={formant} onChange={setFormant} min={-12} max={12} size="sm" />
                <span className="text-[10px] text-muted-foreground mt-1 uppercase">Formant</span>
                <span className="text-xs font-mono" style={{ color: currentTheme.primary }}>{formant}st</span>
              </div>
              <div className="flex flex-col items-center">
                <Knob value={mix} onChange={setMix} min={0} max={100} size="sm" />
                <span className="text-[10px] text-muted-foreground mt-1 uppercase">Mix</span>
                <span className="text-xs font-mono" style={{ color: currentTheme.primary }}>{mix}%</span>
              </div>
            </div>
          </div>

          {/* Pitch Display - When Active */}
          {audioProcessor.isActive && (
            <div className="flex justify-center">
              <div 
                className="flex items-center gap-4 px-6 py-3 rounded-xl border"
                style={{ borderColor: `${currentTheme.primary}50`, backgroundColor: `${currentTheme.primary}10` }}
              >
                <span className="text-lg font-mono text-muted-foreground">{audioProcessor.detectedNote}</span>
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded-full",
                  Math.abs(audioProcessor.pitchError) < 10 ? "bg-green-500/20 text-green-400" :
                  Math.abs(audioProcessor.pitchError) < 25 ? "bg-yellow-500/20 text-yellow-400" :
                  "bg-red-500/20 text-red-400"
                )}>
                  {audioProcessor.pitchError > 0 ? "+" : ""}{audioProcessor.pitchError}¢
                </span>
                <span className="text-2xl">→</span>
                <span className="text-2xl font-display font-bold" style={{ color: currentTheme.primary }}>
                  {audioProcessor.correctedNote}
                </span>
              </div>
            </div>
          )}

          {/* Bottom Section: Key/Scale + Piano */}
          <div className="border-t border-white/10 pt-4">
            {/* Key & Scale Selector - Left */}
            <div className="flex items-start gap-4 mb-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground uppercase">Key</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button 
                        className="px-3 py-1.5 rounded-lg border border-white/20 bg-white/5 text-sm font-display"
                        style={{ color: currentTheme.primary }}
                      >
                        {selectedKey} <ChevronDown className="w-3 h-3 inline ml-1" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-gray-900 border-white/10">
                      {notesList.map(note => (
                        <DropdownMenuItem key={note} onClick={() => setSelectedKey(note)}>
                          {note}
                          {selectedKey === note && <Check className="w-4 h-4 ml-2" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground uppercase">Scale</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="px-3 py-1.5 rounded-lg border border-white/20 bg-white/5 text-sm">
                        {selectedScale} <ChevronDown className="w-3 h-3 inline ml-1" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-gray-900 border-white/10">
                      {SCALES.map(scale => (
                        <DropdownMenuItem key={scale} onClick={() => setSelectedScale(scale)}>
                          {scale}
                          {selectedScale === scale && <Check className="w-4 h-4 ml-2" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Sharp/Flat Toggle */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setUseFlats(false)}
                    className={cn(
                      "px-2 py-1 rounded text-xs transition-all",
                      !useFlats ? "bg-white/20 text-white" : "text-muted-foreground hover:text-white"
                    )}
                  >
                    # Sharp
                  </button>
                  <button
                    onClick={() => setUseFlats(true)}
                    className={cn(
                      "px-2 py-1 rounded text-xs transition-all",
                      useFlats ? "bg-white/20 text-white" : "text-muted-foreground hover:text-white"
                    )}
                  >
                    ♭ Flat
                  </button>
                </div>
              </div>

              {/* Level Meters - Right */}
              <div className="flex-1 flex justify-end gap-4">
                <div className="text-center">
                  <div className="text-[10px] text-muted-foreground mb-1">IN</div>
                  <div className="w-3 h-16 bg-white/10 rounded-full overflow-hidden relative">
                    <div 
                      className="absolute bottom-0 w-full transition-all duration-75 rounded-full"
                      style={{ 
                        height: `${audioProcessor.inputLevel}%`,
                        backgroundColor: audioProcessor.inputLevel > 85 ? '#ef4444' : currentTheme.primary
                      }}
                    />
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] text-muted-foreground mb-1">OUT</div>
                  <div className="w-3 h-16 bg-white/10 rounded-full overflow-hidden relative">
                    <div 
                      className="absolute bottom-0 w-full transition-all duration-75 rounded-full"
                      style={{ 
                        height: `${audioProcessor.isBypassed ? 0 : audioProcessor.outputLevel}%`,
                        backgroundColor: audioProcessor.outputLevel > 85 ? '#ef4444' : currentTheme.primary
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Piano Keyboard */}
            <div className="flex justify-center">
              <div className="flex gap-0.5">
                {NOTES.map((note, i) => {
                  const isSharp = note.includes("#");
                  const isSelected = selectedKey === note || (useFlats && NOTES_FLAT[i] === selectedKey);
                  const displayNote = useFlats ? NOTES_FLAT[i] : note;
                  
                  return (
                    <button
                      key={note}
                      onClick={() => setSelectedKey(displayNote)}
                      className={cn(
                        "transition-all duration-150",
                        isSharp 
                          ? "w-6 h-12 -mx-3 z-10 rounded-b-md bg-gray-800 hover:bg-gray-700 border border-gray-700"
                          : "w-8 h-16 rounded-b-lg bg-white/90 hover:bg-white border border-gray-300",
                        isSelected && !isSharp && "ring-2 ring-offset-2 ring-offset-black",
                        isSelected && isSharp && "ring-2"
                      )}
                      style={isSelected ? { 
                        backgroundColor: isSharp ? currentTheme.primary : undefined,
                        borderColor: !isSharp ? currentTheme.primary : undefined,
                        ringColor: currentTheme.primary
                      } : {}}
                    >
                      <span className={cn(
                        "text-[8px] font-bold",
                        isSharp ? "text-white" : "text-gray-600",
                        isSelected && "text-white"
                      )}>
                        {displayNote.replace("#", "").replace("b", "")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-white/10 text-[10px] text-muted-foreground">
          <span>© 2026 TonalSync Pro by Sweav</span>
          <div className="flex items-center gap-2">
            {audioProcessor.isProcessing && (
              <span className="flex items-center gap-1" style={{ color: currentTheme.primary }}>
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
