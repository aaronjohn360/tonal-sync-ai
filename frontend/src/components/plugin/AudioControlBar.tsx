import { cn } from "@/lib/utils";
import { Mic, MicOff, AlertCircle, Power, ChevronDown, Check, CircleSlash, Volume2, VolumeX, Headphones, Zap, Music } from "lucide-react";
import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import type { AudioDevice, CorrectionMode } from "@/hooks/useAudioProcessor";

interface AudioControlBarProps {
  isActive: boolean;
  isBypassed: boolean;
  onBypassToggle: () => void;
  onDeviceSelect: (deviceId: string | null) => void;
  onStart: (deviceId: string) => void;
  onStop: () => void;
  availableDevices: AudioDevice[];
  selectedDevice: string | null;
  detectedNote: string;
  detectedPitch: number;
  correctedNote: string;
  correctedPitch: number;
  pitchError: number;
  isLoading?: boolean;
  error?: string | null;
  onRequestDevices: () => Promise<AudioDevice[]>;
  monitorVolume?: number;
  onMonitorVolumeChange?: (volume: number) => void;
  isMonitoring?: boolean;
  onMonitoringToggle?: (enabled: boolean) => void;
  inputLevel?: number;
  outputLevel?: number;
  correctionMode?: CorrectionMode;
  onCorrectionModeChange?: (mode: CorrectionMode) => void;
  isProcessing?: boolean;
  currentPitchShift?: number; // Debug: shows current pitch shift ratio
}

// Pulsating effect component
const PulsingDot = ({ active, color = "primary" }: { active: boolean; color?: string }) => (
  <div className="relative">
    <div className={cn(
      "w-2 h-2 rounded-full transition-all duration-300",
      active ? `bg-${color}` : "bg-muted-foreground/30",
      color === "primary" && active && "bg-primary",
      color === "yellow" && active && "bg-yellow-500",
      color === "red" && active && "bg-red-500",
      color === "cyan" && active && "bg-cyan-400"
    )} />
    {active && (
      <>
        <div className={cn(
          "absolute inset-0 rounded-full animate-ping",
          color === "primary" && "bg-primary/50",
          color === "yellow" && "bg-yellow-500/50",
          color === "red" && "bg-red-500/50",
          color === "cyan" && "bg-cyan-400/50"
        )} />
        <div className={cn(
          "absolute inset-[-4px] rounded-full animate-pulse opacity-30",
          color === "primary" && "bg-primary",
          color === "yellow" && "bg-yellow-500",
          color === "red" && "bg-red-500",
          color === "cyan" && "bg-cyan-400"
        )} />
      </>
    )}
  </div>
);

// Animated level bar with glow
const LevelBar = ({ level, color = "primary" }: { level: number; color?: string }) => {
  const getBarColor = () => {
    if (level > 85) return "from-red-500 to-red-400";
    if (level > 70) return "from-yellow-500 to-yellow-400";
    return "from-primary to-primary/80";
  };

  return (
    <div className="h-3 bg-muted/50 rounded-full overflow-hidden relative">
      <div 
        className={cn(
          "h-full rounded-full transition-all duration-75",
          "bg-gradient-to-r",
          getBarColor()
        )}
        style={{ width: `${Math.min(100, level)}%` }}
      />
      {level > 50 && (
        <div 
          className={cn(
            "absolute top-0 h-full rounded-full opacity-50 blur-sm",
            "bg-gradient-to-r",
            getBarColor()
          )}
          style={{ width: `${Math.min(100, level)}%` }}
        />
      )}
    </div>
  );
};

export const AudioControlBar = ({
  isActive,
  isBypassed,
  onBypassToggle,
  onDeviceSelect,
  onStart,
  onStop,
  availableDevices,
  selectedDevice,
  detectedNote,
  detectedPitch,
  correctedNote,
  correctedPitch,
  pitchError,
  isLoading,
  error,
  onRequestDevices,
  monitorVolume = 75,
  onMonitorVolumeChange,
  isMonitoring = true,
  onMonitoringToggle,
  inputLevel = 0,
  outputLevel = 0,
  correctionMode = "modern",
  onCorrectionModeChange,
  isProcessing = false
}: AudioControlBarProps) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [hasRequestedDevices, setHasRequestedDevices] = useState(false);
  const [flickerState, setFlickerState] = useState(false);

  // Create flicker effect for active processing
  useEffect(() => {
    if (isProcessing && isActive) {
      const interval = setInterval(() => {
        setFlickerState(prev => !prev);
      }, 100 + Math.random() * 100);
      return () => clearInterval(interval);
    }
  }, [isProcessing, isActive]);

  const handleDropdownOpen = async (open: boolean) => {
    setIsDropdownOpen(open);
    if (open && !hasRequestedDevices) {
      await onRequestDevices();
      setHasRequestedDevices(true);
    }
  };

  const handleDeviceClick = (deviceId: string) => {
    onDeviceSelect(deviceId);
    if (!isActive) {
      onStart(deviceId);
    }
    setIsDropdownOpen(false);
  };

  const handleNoneClick = () => {
    onStop();
    onDeviceSelect(null);
    setIsDropdownOpen(false);
  };

  const selectedDeviceLabel = selectedDevice 
    ? (availableDevices.find(d => d.deviceId === selectedDevice)?.label || "Select Input")
    : "None";

  const isClassicMode = correctionMode === "classic";

  return (
    <div className={cn(
      "flex flex-col gap-4 p-4",
      "bg-muted/50 rounded-xl border",
      "transition-all duration-500",
      isActive && !isBypassed ? "border-primary/50" : "border-border hover:border-primary/30",
      isActive && !isBypassed && "shadow-[0_0_30px_rgba(0,255,136,0.15)]",
      isClassicMode && isActive && "shadow-[0_0_30px_rgba(255,100,0,0.2)]"
    )}>
      {/* Top Row - Input Selection, Mode Toggle, and Controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Input Selection Dropdown */}
        <DropdownMenu open={isDropdownOpen} onOpenChange={handleDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <button
              disabled={isLoading}
              className={cn(
                "flex items-center gap-3 px-5 py-3 rounded-xl",
                "font-display uppercase text-sm tracking-wider",
                "transition-all duration-300",
                "hover:scale-105 active:scale-95",
                isActive
                  ? "bg-primary text-primary-foreground shadow-glow"
                  : "bg-card border border-border hover:border-primary/50 hover:shadow-glow",
                isLoading && "opacity-50 cursor-not-allowed animate-pulse"
              )}
            >
              {isActive ? (
                <Mic className={cn(
                  "w-5 h-5",
                  isProcessing && "animate-pulse"
                )} />
              ) : (
                <MicOff className="w-5 h-5" />
              )}
              <span className="max-w-[150px] truncate">
                {isLoading ? "Starting..." : isActive ? selectedDeviceLabel : "Select Input"}
              </span>
              <ChevronDown className={cn(
                "w-4 h-4 transition-transform duration-300",
                isDropdownOpen && "rotate-180"
              )} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[280px] bg-card border-border z-50">
            <DropdownMenuItem
              onClick={handleNoneClick}
              className={cn("flex items-center gap-2 cursor-pointer", !selectedDevice && "bg-primary/20")}
            >
              <CircleSlash className="w-4 h-4" />
              <span className="flex-1">None (No Input)</span>
              {!selectedDevice && <Check className="w-4 h-4 text-primary" />}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {availableDevices.length === 0 ? (
              <DropdownMenuItem disabled className="text-muted-foreground">
                No devices found. Click to request access.
              </DropdownMenuItem>
            ) : (
              availableDevices.map((device) => (
                <DropdownMenuItem
                  key={device.deviceId}
                  onClick={() => handleDeviceClick(device.deviceId)}
                  className={cn("flex items-center gap-2 cursor-pointer", selectedDevice === device.deviceId && "bg-primary/20")}
                >
                  <Mic className="w-4 h-4" />
                  <span className="flex-1 truncate">{device.label}</span>
                  {selectedDevice === device.deviceId && <Check className="w-4 h-4 text-primary" />}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Mode Toggle - Modern/Classic */}
        <div className={cn(
          "flex items-center gap-1 p-1 rounded-lg",
          "bg-card border border-border",
          isClassicMode && "border-orange-500/50"
        )}>
          <button
            onClick={() => onCorrectionModeChange?.("modern")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md transition-all duration-300",
              "font-display uppercase text-xs tracking-wider",
              !isClassicMode 
                ? "bg-primary text-primary-foreground shadow-glow" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Music className="w-4 h-4" />
            <span>Modern</span>
          </button>
          <button
            onClick={() => onCorrectionModeChange?.("classic")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md transition-all duration-300",
              "font-display uppercase text-xs tracking-wider",
              isClassicMode 
                ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-[0_0_15px_rgba(255,100,0,0.5)]" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Zap className={cn("w-4 h-4", isClassicMode && "animate-pulse")} />
            <span>Classic</span>
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        {/* Bypass Button & Status */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBypassToggle}
            disabled={!isActive}
            className={cn(
              "flex items-center gap-2 px-4 py-3 rounded-lg border transition-all duration-300",
              "font-display uppercase text-xs tracking-wider",
              "hover:scale-105 active:scale-95",
              !isActive && "opacity-50 cursor-not-allowed",
              isBypassed 
                ? "border-destructive/50 text-destructive bg-destructive/10"
                : "border-primary/50 text-primary bg-primary/10 hover:shadow-glow"
            )}
          >
            <Power className="w-4 h-4" />
            <span>{isBypassed ? "Bypassed" : "Active"}</span>
          </button>

          <PulsingDot 
            active={isActive && !isBypassed} 
            color={isClassicMode ? "yellow" : "primary"} 
          />
        </div>
      </div>

      {/* Middle Row - HD Input/Output Meters and Pitch Display */}
      {isActive && !error && (
        <div className="grid grid-cols-3 gap-4 items-stretch">
          {/* HD Input Section */}
          <div className={cn(
            "flex flex-col gap-3 p-4 rounded-lg border",
            "bg-gradient-to-br from-card/80 to-card/40",
            "border-border",
            inputLevel > 10 && "border-primary/30",
            inputLevel > 10 && "shadow-[inset_0_0_20px_rgba(0,255,136,0.05)]"
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mic className={cn(
                  "w-5 h-5 transition-colors",
                  inputLevel > 10 ? "text-primary" : "text-muted-foreground",
                  isProcessing && flickerState && "text-cyan-400"
                )} />
                <span className="text-xs font-display uppercase tracking-wider text-muted-foreground">
                  HD Input
                </span>
              </div>
              <div className={cn(
                "px-2 py-0.5 rounded text-[10px] font-mono",
                "bg-primary/20 text-primary",
                isProcessing && "animate-pulse"
              )}>
                48kHz
              </div>
            </div>
            
            <div className="flex items-baseline gap-2">
              <span className={cn(
                "text-3xl font-display transition-all duration-150",
                inputLevel > 10 ? "text-foreground" : "text-muted-foreground",
                isProcessing && "text-primary"
              )}>
                {detectedNote}
              </span>
              <span className="text-sm text-muted-foreground font-mono">
                {detectedPitch > 0 ? `${detectedPitch}Hz` : "-"}
              </span>
            </div>
            
            <LevelBar level={inputLevel} />
            
            <div className="flex justify-between text-[9px] text-muted-foreground font-mono">
              <span>-∞</span>
              <span>-12dB</span>
              <span>0dB</span>
            </div>
          </div>

          {/* Center - Pitch Correction Display with Effects */}
          <div className={cn(
            "flex flex-col items-center justify-center gap-3 p-4 rounded-lg border",
            "bg-gradient-to-br",
            isClassicMode 
              ? "from-orange-500/10 to-red-500/5 border-orange-500/30" 
              : "from-primary/10 to-cyan-500/5 border-primary/30",
            isProcessing && !isBypassed && "shadow-[0_0_20px_rgba(0,255,136,0.1)]"
          )}>
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-[10px] font-display uppercase tracking-wider",
                isClassicMode ? "text-orange-400" : "text-primary"
              )}>
                {isClassicMode ? "T-Pain Mode" : "Natural Correction"}
              </span>
              <PulsingDot active={isProcessing && !isBypassed} color={isClassicMode ? "yellow" : "cyan"} />
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-center">
                <span className={cn(
                  "text-2xl font-mono",
                  "text-muted-foreground"
                )}>
                  {detectedNote}
                </span>
              </div>
              
              <div className="flex flex-col items-center">
                <div className={cn(
                  "text-sm font-mono px-3 py-1 rounded-full transition-all",
                  Math.abs(pitchError) < 10 
                    ? "text-primary bg-primary/20" 
                    : Math.abs(pitchError) < 25 
                      ? "text-yellow-400 bg-yellow-400/20" 
                      : "text-red-400 bg-red-400/20",
                  isProcessing && Math.abs(pitchError) > 10 && "animate-pulse"
                )}>
                  {pitchError > 0 ? `+${pitchError}` : pitchError}¢
                </div>
                <div className={cn(
                  "text-2xl my-1",
                  isClassicMode ? "text-orange-400" : "text-primary"
                )}>
                  →
                </div>
              </div>
              
              <div className="text-center">
                <span className={cn(
                  "text-3xl font-display transition-all",
                  isBypassed 
                    ? "text-muted-foreground" 
                    : isClassicMode 
                      ? "text-orange-400" 
                      : "text-primary",
                  isProcessing && !isBypassed && flickerState && "brightness-125"
                )}>
                  {isBypassed ? detectedNote : correctedNote}
                </span>
              </div>
            </div>
            
            <div className={cn(
              "text-xs font-mono",
              isBypassed ? "text-muted-foreground" : "text-primary/70"
            )}>
              {isBypassed ? "Bypassed" : correctedPitch > 0 ? `${correctedPitch}Hz` : "-"}
            </div>
          </div>

          {/* HD Output Section */}
          <div className={cn(
            "flex flex-col gap-3 p-4 rounded-lg border",
            "bg-gradient-to-br from-card/80 to-card/40",
            "border-border",
            outputLevel > 10 && !isBypassed && "border-primary/30",
            outputLevel > 10 && !isBypassed && isClassicMode && "border-orange-500/30"
          )}>
            <div className="flex items-center justify-between">
              <div className={cn(
                "px-2 py-0.5 rounded text-[10px] font-mono",
                isClassicMode ? "bg-orange-500/20 text-orange-400" : "bg-primary/20 text-primary"
              )}>
                {isClassicMode ? "CLASSIC" : "HD"}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-display uppercase tracking-wider text-muted-foreground">
                  Output
                </span>
                <Volume2 className={cn(
                  "w-5 h-5 transition-colors",
                  outputLevel > 10 && !isBypassed 
                    ? isClassicMode ? "text-orange-400" : "text-primary" 
                    : "text-muted-foreground"
                )} />
              </div>
            </div>
            
            <div className="flex items-baseline gap-2 justify-end">
              <span className="text-sm text-muted-foreground font-mono">
                {!isBypassed && correctedPitch > 0 ? `${correctedPitch}Hz` : "-"}
              </span>
              <span className={cn(
                "text-3xl font-display transition-all",
                isBypassed 
                  ? "text-muted-foreground" 
                  : isClassicMode 
                    ? "text-orange-400" 
                    : "text-primary"
              )}>
                {isBypassed ? "-" : correctedNote}
              </span>
            </div>
            
            <LevelBar level={isBypassed ? 0 : outputLevel} />
            
            <div className="flex justify-between text-[9px] text-muted-foreground font-mono">
              <span>-∞</span>
              <span>-12dB</span>
              <span>0dB</span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Row - Monitor Volume Control */}
      {isActive && !error && (
        <div className={cn(
          "flex items-center gap-4 p-3 rounded-lg border",
          "bg-card/30",
          "border-border/50"
        )}>
          {/* Monitor Toggle */}
          <button
            onClick={() => onMonitoringToggle?.(!isMonitoring)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-300",
              "font-display uppercase text-xs tracking-wider",
              "hover:scale-105 active:scale-95",
              isMonitoring 
                ? "border-primary/50 text-primary bg-primary/10"
                : "border-muted-foreground/30 text-muted-foreground bg-muted/30"
            )}
          >
            <Headphones className={cn("w-4 h-4", isMonitoring && isProcessing && "animate-pulse")} />
            <span>Monitor</span>
          </button>

          {/* Volume Slider */}
          <div className="flex-1 flex items-center gap-3">
            <button
              onClick={() => onMonitorVolumeChange?.(monitorVolume > 0 ? 0 : 75)}
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              {monitorVolume === 0 || !isMonitoring ? (
                <VolumeX className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5 text-primary" />
              )}
            </button>
            
            <Slider
              value={[monitorVolume]}
              onValueChange={([value]) => onMonitorVolumeChange?.(value)}
              min={0}
              max={100}
              step={1}
              disabled={!isMonitoring}
              className={cn("flex-1", !isMonitoring && "opacity-50")}
            />
            
            <span className={cn(
              "text-sm font-mono w-12 text-right",
              isMonitoring ? "text-primary" : "text-muted-foreground"
            )}>
              {monitorVolume}%
            </span>
          </div>

          {/* Processing Indicators */}
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg",
              "bg-gradient-to-r from-primary/20 to-transparent",
              "border border-primary/30"
            )}>
              <PulsingDot active={isProcessing && !isBypassed} color="primary" />
              <span className="text-xs font-display uppercase tracking-wider text-primary">
                HD Audio
              </span>
            </div>
            
            {isClassicMode && (
              <div className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg",
                "bg-gradient-to-r from-orange-500/20 to-red-500/10",
                "border border-orange-500/30",
                "animate-pulse"
              )}>
                <Zap className="w-3 h-3 text-orange-400" />
                <span className="text-xs font-display uppercase tracking-wider text-orange-400">
                  T-Pain FX
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
