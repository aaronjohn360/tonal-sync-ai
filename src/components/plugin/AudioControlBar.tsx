import { cn } from "@/lib/utils";
import { Mic, MicOff, AlertCircle, Power, ChevronDown, Check } from "lucide-react";
import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AudioDevice } from "@/hooks/useAudioProcessor";

interface AudioControlBarProps {
  isActive: boolean;
  isBypassed: boolean;
  onBypassToggle: () => void;
  onDeviceSelect: (deviceId: string) => void;
  onStart: (deviceId: string) => void;
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
}

export const AudioControlBar = ({
  isActive,
  isBypassed,
  onBypassToggle,
  onDeviceSelect,
  onStart,
  availableDevices,
  selectedDevice,
  detectedNote,
  detectedPitch,
  correctedNote,
  correctedPitch,
  pitchError,
  isLoading,
  error,
  onRequestDevices
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

  const selectedDeviceLabel = availableDevices.find(d => d.deviceId === selectedDevice)?.label || "Select Input";

  return (
    <div className={cn(
      "flex items-center justify-between gap-4 p-4",
      "bg-muted/50 rounded-xl border",
      isActive && !isBypassed ? "border-primary/50 shadow-glow" : "border-border"
    )}>
      {/* Input Selection Dropdown */}
      <DropdownMenu open={isDropdownOpen} onOpenChange={handleDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <button
            disabled={isLoading}
            className={cn(
              "flex items-center gap-3 px-5 py-3 rounded-xl",
              "font-display uppercase text-sm tracking-wider",
              "transition-all duration-300",
              isActive
                ? "bg-primary text-primary-foreground shadow-glow"
                : "bg-card border border-border hover:border-primary/50",
              isLoading && "opacity-50 cursor-not-allowed"
            )}
          >
            {isActive ? (
              <Mic className="w-5 h-5 animate-pulse" />
            ) : (
              <MicOff className="w-5 h-5" />
            )}
            <span className="max-w-[150px] truncate">
              {isLoading ? "Starting..." : isActive ? selectedDeviceLabel : "Select Input"}
            </span>
            <ChevronDown className="w-4 h-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="start" 
          className="w-[280px] bg-card border-border"
        >
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

      {/* Pitch Display */}
      {isActive && !error && (
        <div className="flex items-center gap-6">
          {/* Input Pitch */}
          <div className="text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
              Input
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-display text-foreground">
                {detectedNote}
              </span>
              <span className="text-xs text-muted-foreground">
                {detectedPitch > 0 ? `${detectedPitch}Hz` : "-"}
              </span>
            </div>
          </div>

          {/* Arrow & Error */}
          <div className="flex flex-col items-center">
            <div className={cn(
              "text-xs font-mono",
              Math.abs(pitchError) < 10 ? "text-primary" : 
              Math.abs(pitchError) < 25 ? "text-yellow-400" : "text-red-400"
            )}>
              {pitchError > 0 ? `+${pitchError}` : pitchError}¢
            </div>
            <div className="text-muted-foreground">→</div>
          </div>

          {/* Output Pitch */}
          <div className="text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
              Corrected
            </div>
            <div className="flex items-baseline gap-1">
              <span className={cn(
                "text-2xl font-display",
                isBypassed ? "text-muted-foreground" : "text-primary"
              )}>
                {isBypassed ? detectedNote : correctedNote}
              </span>
              <span className="text-xs text-muted-foreground">
                {isBypassed ? (detectedPitch > 0 ? `${detectedPitch}Hz` : "-") : (correctedPitch > 0 ? `${correctedPitch}Hz` : "-")}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Bypass Button & Status */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBypassToggle}
          disabled={!isActive}
          className={cn(
            "flex items-center gap-2 px-4 py-3 rounded-lg border transition-all duration-200",
            "font-display uppercase text-xs tracking-wider",
            !isActive && "opacity-50 cursor-not-allowed",
            isBypassed 
              ? "border-destructive/50 text-destructive bg-destructive/10"
              : "border-primary/50 text-primary bg-primary/10 hover:bg-primary/20"
          )}
        >
          <Power className="w-4 h-4" />
          <span>{isBypassed ? "Bypassed" : "Active"}</span>
        </button>

        {/* Status Indicator */}
        <div className={cn(
          "w-3 h-3 rounded-full transition-all duration-300",
          isActive && !isBypassed
            ? "bg-primary animate-pulse shadow-glow" 
            : isActive && isBypassed
              ? "bg-yellow-500"
              : "bg-muted-foreground/30"
        )} />
      </div>
    </div>
  );
};