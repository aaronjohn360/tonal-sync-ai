import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface VUMeterProps {
  level: number;
  peak?: number;
  label: string;
  className?: string;
}

export const VUMeter = ({ level, peak, label, className }: VUMeterProps) => {
  const [displayLevel, setDisplayLevel] = useState(level);
  const [displayPeak, setDisplayPeak] = useState(peak ?? level);

  useEffect(() => {
    // Smooth animation for level changes
    const animate = () => {
      setDisplayLevel((prev) => prev + (level - prev) * 0.3);
      if (peak !== undefined) {
        setDisplayPeak((prev) => Math.max(prev * 0.99, peak));
      }
    };
    const interval = setInterval(animate, 16);
    return () => clearInterval(interval);
  }, [level, peak]);

  const segments = 20;
  const activeSegments = Math.floor((displayLevel / 100) * segments);
  const peakSegment = Math.floor((displayPeak / 100) * segments);

  return (
    <div className={cn("flex flex-col items-center gap-2 group", className)}>
      <div className="flex gap-0.5 h-32 items-end">
        {Array.from({ length: segments }).map((_, i) => {
          const isActive = i < activeSegments;
          const isPeak = i === peakSegment && peak !== undefined;
          const isRed = i >= segments - 3;
          const isYellow = i >= segments - 8 && i < segments - 3;

          return (
            <div
              key={i}
              className={cn(
                "w-2 rounded-sm transition-all duration-100",
                "transform hover:scale-y-110",
                isActive || isPeak
                  ? isRed
                    ? "bg-destructive shadow-[0_0_8px_hsl(var(--destructive))] animate-pulse"
                    : isYellow
                    ? "bg-yellow-500 shadow-[0_0_6px_rgb(234,179,8)]"
                    : "bg-primary shadow-[0_0_6px_hsl(var(--primary))]"
                  : "bg-muted/50",
                isPeak && "opacity-100",
                !isActive && !isPeak && "opacity-30 group-hover:opacity-50"
              )}
              style={{
                height: `${((i + 1) / segments) * 100}%`,
                animationDelay: `${i * 30}ms`,
              }}
            />
          );
        })}
      </div>
      
      {/* dB scale markers */}
      <div className="flex justify-between w-full text-[10px] text-muted-foreground font-display">
        <span>-∞</span>
        <span>-12</span>
        <span>-6</span>
        <span>0</span>
      </div>

      <span className={cn(
        "text-xs font-medium uppercase tracking-wider",
        "transition-colors duration-200",
        displayLevel > 80 ? "text-destructive" : displayLevel > 10 ? "text-primary" : "text-muted-foreground"
      )}>
        {label}
      </span>
    </div>
  );
};
