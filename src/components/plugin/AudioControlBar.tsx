import { cn } from "@/lib/utils";
import { Mic, MicOff, Volume2, VolumeX, AlertCircle } from "lucide-react";
import { useState } from "react";

interface AudioControlBarProps {
  isActive: boolean;
  onToggle: () => void;
  detectedNote: string;
  detectedPitch: number;
  correctedNote: string;
  correctedPitch: number;
  pitchError: number;
  isLoading?: boolean;
  error?: string | null;
}

export const AudioControlBar = ({
  isActive,
  onToggle,
  detectedNote,
  detectedPitch,
  correctedNote,
  correctedPitch,
  pitchError,
  isLoading,
  error
}: AudioControlBarProps) => {
  const [isMuted, setIsMuted] = useState(false);

  return (
    <div className={cn(
      "flex items-center justify-between gap-4 p-4",
      "bg-muted/50 rounded-xl border",
      isActive ? "border-primary/50 shadow-glow" : "border-border"
    )}>
      {/* Mic Toggle */}
      <button
        onClick={onToggle}
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
        <span>{isLoading ? "Starting..." : isActive ? "Live" : "Start Audio"}</span>
      </button>

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
              <span className="text-2xl font-display text-primary">
                {correctedNote}
              </span>
              <span className="text-xs text-muted-foreground">
                {correctedPitch > 0 ? `${correctedPitch}Hz` : "-"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Output Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsMuted(!isMuted)}
          className={cn(
            "p-3 rounded-lg border transition-all duration-200",
            isMuted 
              ? "border-destructive/50 text-destructive bg-destructive/10"
              : "border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
          )}
        >
          {isMuted ? (
            <VolumeX className="w-5 h-5" />
          ) : (
            <Volume2 className="w-5 h-5" />
          )}
        </button>

        {/* Status Indicator */}
        <div className={cn(
          "w-3 h-3 rounded-full transition-all duration-300",
          isActive 
            ? "bg-primary animate-pulse shadow-glow" 
            : "bg-muted-foreground/30"
        )} />
      </div>
    </div>
  );
};
