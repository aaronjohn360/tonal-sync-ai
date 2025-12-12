import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Knob } from "./Knob";
import { PitchGraph } from "./PitchGraph";
import { useAudioProcessor } from "@/hooks/useAudioProcessor";
import { 
  Mic, MicOff, Volume2, Power, Settings, ChevronDown, Check,
  Music, Zap, Headphones, Palette, X
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
  cyber: { primary: "rgb(0, 255, 136)", accent: "rgb(0, 200, 255)", name: "Cyber Green" },
  neon: { primary: "rgb(180, 100, 255)", accent: "rgb(255, 100, 200)", name: "Neon Purple" },
  sunset: { primary: "rgb(255, 140, 50)", accent: "rgb(255, 60, 60)", name: "Sunset Orange" },
  ocean: { primary: "rgb(50, 180, 255)", accent: "rgb(50, 255, 200)", name: "Ocean Blue" },
  matrix: { primary: "rgb(0, 255, 65)", accent: "rgb(0, 180, 40)", name: "Matrix" },
};

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTES_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const SCALES = ["Major", "Minor", "Chromatic", "Pentatonic", "Blues", "Dorian", "Mixolydian"];

// RGB Pulsing Icon Component
const RGBIcon = ({ size = 40 }: { size?: number }) => {
  const [colorIndex, setColorIndex] = useState(0);
  const colors = ["#3B82F6", "#8B5CF6", "#EF4444", "#EC4899"]; // Blue, Purple, Red, Pink
  
  useEffect(() => {
    const interval = setInterval(() => {
      setColorIndex(prev => (prev + 1) % colors.length);
    }, 1500);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div 
      className="relative flex items-center justify-center rounded-xl transition-all duration-1000"
      style={{ 
        width: size, 
        height: size,
        background: `linear-gradient(135deg, ${colors[colorIndex]}, ${colors[(colorIndex + 1) % colors.length]})`,
        boxShadow: `0 0 20px ${colors[colorIndex]}80, 0 0 40px ${colors[colorIndex]}40`
      }}
    >
      <span 
        className="font-display font-black text-white transition-all duration-500"
        style={{ fontSize: size * 0.5, textShadow: `0 0 10px white` }}
      >
        T
      </span>
    </div>
  );
};

export const TonalSyncPlugin = () => {
  // Intro state
  const [introPhase, setIntroPhase] = useState<"typing" | "waiting" | "glow" | "done">("typing");
  const [typedText, setTypedText] = useState("");
  const [showByLine, setShowByLine] = useState(false);
  const [showDot, setShowDot] = useState(false);
  const [glowOpacity, setGlowOpacity] = useState(0);
  
  // Core controls
  const [retuneSpeed, setRetuneSpeed] = useState(0);
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

  // Typewriter intro animation
  useEffect(() => {
    if (introPhase !== "typing") return;
    
    const fullText = "TONAL-SYNC";
    let i = 0;
    
    const typeInterval = setInterval(() => {
      if (i <= fullText.length) {
        setTypedText(fullText.slice(0, i));
        i++;
      } else {
        clearInterval(typeInterval);
        // Show "By Sweav" after typing
        setTimeout(() => {
          setShowByLine(true);
          // Wait 3 seconds then show dot
          setTimeout(() => {
            setShowDot(true);
            setIntroPhase("waiting");
            // After dot, start glow
            setTimeout(() => {
              setIntroPhase("glow");
              setGlowOpacity(1);
              // After glow, reveal interface
              setTimeout(() => {
                setIntroPhase("done");
              }, 2000);
            }, 500);
          }, 3000);
        }, 300);
      }
    }, 100);
    
    return () => clearInterval(typeInterval);
  }, [introPhase]);

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
  const currentTheme = THEMES[theme];
  const notesList = useFlats ? NOTES_FLAT : NOTES;

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div 
        className={cn(
          "w-full max-w-4xl relative",
          "bg-gradient-to-br from-gray-900/95 via-black/95 to-gray-900/95",
          "backdrop-blur-xl rounded-3xl",
          "border-2 shadow-2xl",
          "transition-all duration-500 overflow-hidden"
        )}
        style={{ 
          borderColor: currentTheme.primary,
          boxShadow: `0 0 60px ${currentTheme.primary}20, inset 0 0 60px ${currentTheme.primary}05`
        }}
      >
        {/* Intro Animation - Inside Plugin */}
        {introPhase !== "done" && (
          <div className={cn(
            "absolute inset-0 z-50 flex flex-col items-center justify-center bg-black",
            "transition-opacity duration-1000",
            introPhase === "glow" && "opacity-0"
          )}>
            {/* RGB Glow Overlay */}
            <div 
              className="absolute inset-0 transition-opacity duration-2000"
              style={{
                opacity: glowOpacity,
                background: `linear-gradient(135deg, 
                  rgba(59, 130, 246, 0.3), 
                  rgba(139, 92, 246, 0.3), 
                  rgba(236, 72, 153, 0.3), 
                  rgba(239, 68, 68, 0.3)
                )`,
                filter: "blur(50px)"
              }}
            />
            
            {/* Main Text */}
            <div className="relative z-10 text-center">
              <h1 className="text-5xl md:text-7xl font-display font-black tracking-wider">
                <span className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                  {typedText}
                </span>
                <span className={cn(
                  "inline-block w-1 h-12 md:h-16 bg-white ml-1 animate-pulse",
                  typedText.length === 10 && !showDot && "opacity-100",
                  showDot && "opacity-0"
                )} />
              </h1>
              
              {showByLine && (
                <p className={cn(
                  "mt-4 text-xl md:text-2xl text-gray-400 transition-opacity duration-500",
                  showByLine ? "opacity-100" : "opacity-0"
                )}>
                  By <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent font-semibold">Sweav</span>
                  <span className={cn(
                    "transition-opacity duration-300",
                    showDot ? "opacity-100" : "opacity-0"
                  )}>.</span>
                </p>
              )}
            </div>
          </div>
        )}
        
        {/* Settings Popup */}
        {showSettings && (
          <div className="absolute inset-4 bg-black/95 backdrop-blur-xl rounded-2xl z-40 p-6 border border-white/10 overflow-auto">
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
                      autoEQ ? "text-white" : "bg-white/10 text-muted-foreground"
                    )}
                    style={autoEQ ? { backgroundColor: currentTheme.primary } : {}}
                  >
                    {autoEQ ? "ON" : "OFF"}
                  </button>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Strength: {autoEQStrength}%</label>
                  <Slider value={[autoEQStrength]} onValueChange={([v]) => setAutoEQStrength(v)} max={100} disabled={!autoEQ} />
                </div>
              </div>

              {/* Transparency */}
              <div className="space-y-4 p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Transparency Mode</span>
                  <button
                    onClick={() => setTransparencyMode(!transparencyMode)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs transition-all",
                      transparencyMode ? "text-white" : "bg-white/10 text-muted-foreground"
                    )}
                    style={transparencyMode ? { backgroundColor: currentTheme.primary } : {}}
                  >
                    {transparencyMode ? "ON" : "OFF"}
                  </button>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Smoothing: {smoothing}%</label>
                  <Slider value={[smoothing]} onValueChange={([v]) => setSmoothing(v)} max={100} />
                </div>
              </div>

              {/* Color Theme */}
              <div className="space-y-4 p-4 rounded-xl bg-white/5 border border-white/10 md:col-span-2">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  <span className="font-medium">Interface Color</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(THEMES).map(([key, t]) => (
                    <button
                      key={key}
                      onClick={() => setTheme(key as keyof typeof THEMES)}
                      className={cn(
                        "w-12 h-12 rounded-full border-2 transition-all",
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
            <RGBIcon size={44} />
            <div>
              <h1 className="text-lg font-display font-bold tracking-wider">
                TONAL<span style={{ color: currentTheme.primary }}>SYNC</span>
              </h1>
              <p className="text-[10px] text-muted-foreground">BY SWEAV</p>
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

            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-4 space-y-4">
          {/* Input + Monitor + Bypass */}
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
                  <span>{isLoading ? "..." : audioProcessor.isActive ? "ACTIVE" : "INPUT"}</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 bg-gray-900 border-white/10">
                <DropdownMenuItem onClick={handleAudioStop}>
                  <MicOff className="w-4 h-4 mr-2" />None
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {audioProcessor.availableDevices.length === 0 ? (
                  <DropdownMenuItem onClick={handleRequestDevices}>Click for access</DropdownMenuItem>
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

          {/* Pitch Graph */}
          <div className="flex justify-center">
            <div className="w-full max-w-2xl h-36">
              <PitchGraph
                className="h-full rounded-xl border border-white/10"
                pitchHistory={audioProcessor.pitchHistory}
                isActive={audioProcessor.isActive}
              />
            </div>
          </div>

          {/* Control Knobs */}
          <div className="flex justify-center">
            <div className="grid grid-cols-5 gap-4 md:gap-8">
              {[
                { value: retuneSpeed, set: setRetuneSpeed, label: "Retune", unit: "ms" },
                { value: humanize, set: setHumanize, label: "Human", unit: "%" },
                { value: flexTune, set: setFlexTune, label: "Flex", unit: "%" },
                { value: formant, set: setFormant, label: "Formant", unit: "st", min: -12, max: 12 },
                { value: mix, set: setMix, label: "Mix", unit: "%" },
              ].map((ctrl, i) => (
                <div key={i} className="flex flex-col items-center">
                  <Knob value={ctrl.value} onChange={ctrl.set} min={ctrl.min || 0} max={ctrl.max || 100} size="sm" />
                  <span className="text-[10px] text-muted-foreground mt-1 uppercase">{ctrl.label}</span>
                  <span className="text-xs font-mono" style={{ color: currentTheme.primary }}>{ctrl.value}{ctrl.unit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Active Pitch Display */}
          {audioProcessor.isActive && audioProcessor.isProcessing && (
            <div className="flex justify-center">
              <div 
                className="flex items-center gap-4 px-6 py-2 rounded-xl border"
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
                <span className="text-xl">→</span>
                <span className="text-2xl font-display font-bold" style={{ color: currentTheme.primary }}>
                  {audioProcessor.correctedNote}
                </span>
              </div>
            </div>
          )}

          {/* Key/Scale + Meters + Piano */}
          <div className="border-t border-white/10 pt-4">
            <div className="flex items-start gap-4 mb-4">
              {/* Key & Scale */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">KEY</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="px-3 py-1.5 rounded-lg border border-white/20 bg-white/5 text-sm font-display" style={{ color: currentTheme.primary }}>
                        {selectedKey} <ChevronDown className="w-3 h-3 inline" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-gray-900 border-white/10">
                      {notesList.map(note => (
                        <DropdownMenuItem key={note} onClick={() => setSelectedKey(note)}>
                          {note} {selectedKey === note && <Check className="w-4 h-4 ml-2" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">SCALE</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="px-3 py-1.5 rounded-lg border border-white/20 bg-white/5 text-sm">
                        {selectedScale} <ChevronDown className="w-3 h-3 inline" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-gray-900 border-white/10">
                      {SCALES.map(scale => (
                        <DropdownMenuItem key={scale} onClick={() => setSelectedScale(scale)}>
                          {scale} {selectedScale === scale && <Check className="w-4 h-4 ml-2" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setUseFlats(false)}
                    className={cn("px-2 py-1 rounded text-xs transition-all", !useFlats ? "bg-white/20 text-white" : "text-muted-foreground")}
                  >
                    # Sharp
                  </button>
                  <button
                    onClick={() => setUseFlats(true)}
                    className={cn("px-2 py-1 rounded text-xs transition-all", useFlats ? "bg-white/20 text-white" : "text-muted-foreground")}
                  >
                    ♭ Flat
                  </button>
                </div>
              </div>

              {/* Real-time Level Meters */}
              <div className="flex-1 flex justify-end gap-6">
                <div className="text-center">
                  <div className="text-[10px] text-muted-foreground mb-1">INPUT</div>
                  <div className="w-4 h-24 bg-white/10 rounded-full overflow-hidden relative">
                    <div 
                      className="absolute bottom-0 w-full transition-all duration-75 rounded-full"
                      style={{ 
                        height: `${audioProcessor.inputLevel}%`,
                        backgroundColor: audioProcessor.inputLevel > 85 ? '#ef4444' : audioProcessor.inputLevel > 70 ? '#eab308' : currentTheme.primary
                      }}
                    />
                  </div>
                  <div className="text-[10px] font-mono mt-1" style={{ color: currentTheme.primary }}>
                    {Math.round(audioProcessor.inputLevel)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] text-muted-foreground mb-1">OUTPUT</div>
                  <div className="w-4 h-24 bg-white/10 rounded-full overflow-hidden relative">
                    <div 
                      className="absolute bottom-0 w-full transition-all duration-75 rounded-full"
                      style={{ 
                        height: `${audioProcessor.isBypassed ? 0 : audioProcessor.outputLevel}%`,
                        backgroundColor: audioProcessor.outputLevel > 85 ? '#ef4444' : audioProcessor.outputLevel > 70 ? '#eab308' : currentTheme.primary
                      }}
                    />
                  </div>
                  <div className="text-[10px] font-mono mt-1" style={{ color: currentTheme.primary }}>
                    {Math.round(audioProcessor.isBypassed ? 0 : audioProcessor.outputLevel)}
                  </div>
                </div>
              </div>
            </div>

            {/* Piano - Bigger */}
            <div className="flex justify-center">
              <div className="flex gap-0.5 relative">
                {NOTES.map((note, i) => {
                  const isSharp = note.includes("#");
                  const isSelected = selectedKey === note || (useFlats && NOTES_FLAT[i] === selectedKey);
                  const isPlaying = audioProcessor.activeNotes.includes(note);
                  const displayNote = useFlats ? NOTES_FLAT[i] : note;
                  
                  return (
                    <button
                      key={note}
                      onClick={() => setSelectedKey(displayNote)}
                      className={cn(
                        "transition-all duration-100 flex flex-col items-center justify-end pb-1",
                        isSharp 
                          ? "w-7 h-16 -mx-3.5 z-10 rounded-b-md bg-gray-800 hover:bg-gray-700 border border-gray-700"
                          : "w-10 h-24 rounded-b-lg bg-white/90 hover:bg-white border border-gray-300",
                        isSelected && "ring-2 ring-offset-2 ring-offset-black",
                        isPlaying && !isSharp && "bg-green-200",
                        isPlaying && isSharp && "bg-green-600"
                      )}
                      style={isSelected ? { 
                        borderColor: currentTheme.primary,
                        ringColor: currentTheme.primary
                      } : isPlaying ? {
                        backgroundColor: isSharp ? currentTheme.primary : `${currentTheme.primary}40`
                      } : {}}
                    >
                      <span className={cn(
                        "text-[9px] font-bold",
                        isSharp ? "text-white" : "text-gray-500",
                        (isSelected || isPlaying) && "text-white"
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
                Live
              </span>
            )}
            <span>{isClassicMode ? "T-Pain" : "Natural"}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
