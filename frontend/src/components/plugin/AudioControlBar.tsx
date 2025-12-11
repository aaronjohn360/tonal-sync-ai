import { cn } from "@/lib/utils";
import { Mic, MicOff, AlertCircle, Power, ChevronDown, Check, CircleSlash, Volume2, VolumeX, Headphones } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import type { AudioDevice } from "@/hooks/useAudioProcessor";

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
  // New props for monitoring
  monitorVolume?: number;
  onMonitorVolumeChange?: (volume: number) => void;
  isMonitoring?: boolean;
  onMonitoringToggle?: (enabled: boolean) => void;
  inputLevel?: number;
  outputLevel?: number;
}

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
  outputLevel = 0
}: AudioControlBarProps) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [hasRequestedDevices, setHasRequestedDevices] = useState(false);

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

  // Get level bar colors based on level
  const getLevelColor = (level: number) => {
    if (level > 85) return "bg-red-500";
    if (level > 70) return "bg-yellow-500";
    return "bg-primary";
  };

  return (
    <div className={cn(
      "flex flex-col gap-4 p-4",
      "bg-muted/50 rounded-xl border",
      "transition-all duration-500",
      "animate-fade-in",
      isActive && !isBypassed ? "border-primary/50 shadow-glow" : "border-border hover:border-primary/30"
    )}>
      {/* Top Row - Input Selection and Controls */}
      <div className="flex items-center justify-between gap-4">
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
                <Mic className="w-5 h-5 animate-bounce-subtle" />
              ) : (
                <MicOff className="w-5 h-5 transition-transform group-hover:scale-110" />
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
          <DropdownMenuContent 
            align="start" 
            className="w-[280px] bg-card border-border z-50 animate-scale-in"
          >
            {/* None option */}
            <DropdownMenuItem
              onClick={handleNoneClick}
              className={cn(
                "flex items-center gap-2 cursor-pointer",
                !selectedDevice && "bg-primary/20"
              )}
            >
              <CircleSlash className="w-4 h-4" />
              <span className="flex-1">None (No Input)</span>
              {!selectedDevice && (
                <Check className="w-4 h-4 text-primary" />
              )}
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
                  className={cn(
                    "flex items-center gap-2 cursor-pointer",
                    selectedDevice === device.deviceId && "bg-primary/20"
                  )}
                >
                  <Mic className="w-4 h-4" />
                  <span className="flex-1 truncate">{device.label}</span>
                  {selectedDevice === device.deviceId && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

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
                ? "border-destructive/50 text-destructive bg-destructive/10 hover:bg-destructive/20"
                : "border-primary/50 text-primary bg-primary/10 hover:bg-primary/20 hover:shadow-glow"
            )}
          >
            <Power className="w-4 h-4" />
            <span>{isBypassed ? "Bypassed" : "Active"}</span>
          </button>

          {/* Status Indicator */}
          <div className="relative">
            <div className={cn(
              "w-3 h-3 rounded-full transition-all duration-300",
              isActive && !isBypassed
                ? "bg-primary shadow-glow" 
                : isActive && isBypassed
                  ? "bg-yellow-500"
                  : "bg-muted-foreground/30"
            )} />
            {isActive && !isBypassed && (
              <div className="absolute inset-0 rounded-full bg-primary animate-pulse-ring" />
            )}
          </div>
        </div>
      </div>

      {/* Middle Row - Input/Output Meters and Pitch Display */}
      {isActive && !error && (
        <div className="grid grid-cols-3 gap-6 items-center">
          {/* Input Section */}
          <div className="flex items-center gap-4 p-3 bg-card/50 rounded-lg border border-border">
            <div className="flex flex-col items-center gap-1">
              <Mic className={cn(
                "w-6 h-6 transition-colors",
                inputLevel > 10 ? "text-primary" : "text-muted-foreground"
              )} />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Input</span>
            </div>
            
            {/* Input Level Meter */}
            <div className="flex-1 space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-display text-foreground">
                  {detectedNote}
                </span>
                <span className="text-xs text-muted-foreground">
                  {detectedPitch > 0 ? `${detectedPitch}Hz` : "-"}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all duration-75 rounded-full",
                    getLevelColor(inputLevel)
                  )}
                  style={{ width: `${Math.min(100, inputLevel)}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-muted-foreground">
                <span>-∞</span>
                <span>-12dB</span>
                <span>0dB</span>
              </div>
            </div>
          </div>

          {/* Center - Pitch Correction Display */}
          <div className="flex flex-col items-center gap-2 p-3 bg-card/50 rounded-lg border border-primary/30">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Pitch Correction
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <span className="text-lg font-mono text-muted-foreground">{detectedNote}</span>
              </div>
              <div className="flex flex-col items-center">
                <div className={cn(
                  "text-sm font-mono px-2 py-0.5 rounded",
                  Math.abs(pitchError) < 10 ? "text-primary bg-primary/20" : 
                  Math.abs(pitchError) < 25 ? "text-yellow-400 bg-yellow-400/20" : "text-red-400 bg-red-400/20"
                )}>
                  {pitchError > 0 ? `+${pitchError}` : pitchError}¢
                </div>
                <span className="text-xl">→</span>
              </div>
              <div className="text-center">
                <span className={cn(
                  "text-2xl font-display",
                  isBypassed ? "text-muted-foreground" : "text-primary"
                )}>
                  {isBypassed ? detectedNote : correctedNote}
                </span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              {isBypassed ? "Bypassed" : `${correctedPitch > 0 ? `${correctedPitch}Hz` : "-"}`}
            </div>
          </div>

          {/* Output Section */}
          <div className="flex items-center gap-4 p-3 bg-card/50 rounded-lg border border-border">
            {/* Output Level Meter */}
            <div className="flex-1 space-y-2">
              <div className="flex items-baseline gap-2 justify-end">
                <span className="text-xs text-muted-foreground">
                  {!isBypassed && correctedPitch > 0 ? `${correctedPitch}Hz` : "-"}
                </span>
                <span className={cn(
                  "text-2xl font-display",
                  isBypassed ? "text-muted-foreground" : "text-primary"
                )}>
                  {isBypassed ? "-" : correctedNote}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all duration-75 rounded-full",
                    isBypassed ? "bg-muted-foreground/30" : getLevelColor(outputLevel)
                  )}
                  style={{ width: `${Math.min(100, isBypassed ? 0 : outputLevel)}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-muted-foreground">
                <span>-∞</span>
                <span>-12dB</span>
                <span>0dB</span>
              </div>
            </div>

            <div className="flex flex-col items-center gap-1">
              <Volume2 className={cn(
                "w-6 h-6 transition-colors",
                outputLevel > 10 && !isBypassed ? "text-primary" : "text-muted-foreground"
              )} />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Output</span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Row - Monitor Volume Control */}
      {isActive && !error && (
        <div className="flex items-center gap-4 p-3 bg-card/30 rounded-lg border border-border/50">
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
            <Headphones className="w-4 h-4" />
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
              className={cn(
                "flex-1",
                !isMonitoring && "opacity-50"
              )}
            />
            
            <span className={cn(
              "text-sm font-mono w-12 text-right",
              isMonitoring ? "text-primary" : "text-muted-foreground"
            )}>
              {monitorVolume}%
            </span>
          </div>

          {/* HQ Processing Indicator */}
          <div className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg",
            "bg-gradient-to-r from-primary/20 to-transparent",
            "border border-primary/30"
          )}>
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-display uppercase tracking-wider text-primary">
              HQ Audio
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
