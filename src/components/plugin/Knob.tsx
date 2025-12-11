import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

interface KnobProps {
  value: number;
  min?: number;
  max?: number;
  onChange?: (value: number) => void;
  label: string;
  unit?: string;
  size?: "sm" | "md" | "lg";
  showValue?: boolean;
  className?: string;
}

export const Knob = ({
  value,
  min = 0,
  max = 100,
  onChange,
  label,
  unit = "",
  size = "md",
  showValue = true,
  className,
}: KnobProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const knobRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const startValue = useRef(value);

  const sizeClasses = {
    sm: "w-12 h-12",
    md: "w-16 h-16",
    lg: "w-20 h-20",
  };

  const indicatorSizes = {
    sm: "w-1 h-3",
    md: "w-1.5 h-4",
    lg: "w-2 h-5",
  };

  const normalizedValue = ((value - min) / (max - min)) * 100;
  const rotation = (normalizedValue / 100) * 270 - 135;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      startY.current = e.clientY;
      startValue.current = value;
    },
    [value]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaY = startY.current - e.clientY;
      const sensitivity = (max - min) / 150;
      const newValue = Math.max(min, Math.min(max, startValue.current + deltaY * sensitivity));
      onChange?.(Math.round(newValue));
    },
    [isDragging, min, max, onChange]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Use document-level listeners to ensure mouseup is always caught
  useEffect(() => {
    const handleDocumentMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      handleMouseMove(e);
    };

    const handleDocumentMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
      }
    };

    // Always add listeners to document for reliable tracking
    document.addEventListener("mousemove", handleDocumentMouseMove);
    document.addEventListener("mouseup", handleDocumentMouseUp);
    document.addEventListener("mouseleave", handleDocumentMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleDocumentMouseMove);
      document.removeEventListener("mouseup", handleDocumentMouseUp);
      document.removeEventListener("mouseleave", handleDocumentMouseUp);
    };
  }, [isDragging, handleMouseMove]);

  return (
    <div className={cn("flex flex-col items-center gap-2 group", className)}>
      <div
        ref={knobRef}
        className={cn(
          sizeClasses[size],
          "relative rounded-full cursor-pointer select-none",
          "bg-gradient-to-b from-muted to-background",
          "shadow-knob border border-border/50",
          "transition-all duration-300",
          "hover:scale-105 hover:border-primary/50",
          "active:scale-95",
          isDragging && "scale-110 shadow-glow"
        )}
        onMouseDown={handleMouseDown}
      >
        {/* Track background */}
        <div className="absolute inset-1 rounded-full bg-muted/50" />
        
        {/* Value arc */}
        <svg
          className="absolute inset-0 w-full h-full -rotate-[135deg]"
          viewBox="0 0 100 100"
        >
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${270 * 2.64} 1000`}
          />
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${normalizedValue * 2.7 * 2.64} 1000`}
            className="drop-shadow-[0_0_6px_hsl(var(--primary))] transition-all duration-200"
          />
        </svg>

        {/* Knob center */}
        <div
          className={cn(
            "absolute inset-3 rounded-full",
            "bg-gradient-to-b from-card to-background",
            "border border-border/30 shadow-inner",
            "flex items-center justify-center",
            "transition-transform duration-150"
          )}
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          {/* Indicator */}
          <div
            className={cn(
              indicatorSizes[size],
              "absolute top-2 rounded-full",
              "bg-primary shadow-[0_0_8px_hsl(var(--primary))]",
              "transition-all duration-200"
            )}
          />
        </div>

        {/* Glow effect when active */}
        {isDragging && (
          <div className="absolute inset-0 rounded-full bg-primary/10 animate-glow-pulse" />
        )}
        
        {/* Pulse ring on hover */}
        <div className={cn(
          "absolute inset-0 rounded-full border-2 border-primary/30",
          "opacity-0 group-hover:opacity-100 transition-opacity duration-300",
          isDragging && "animate-pulse-ring"
        )} />
      </div>

      {/* Label */}
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider group-hover:text-foreground transition-colors duration-200">
        {label}
      </span>

      {/* Value display */}
      {showValue && (
        <span className={cn(
          "text-sm font-display text-primary tabular-nums",
          "transition-all duration-200",
          isDragging && "scale-110 font-bold"
        )}>
          {value}
          {unit && <span className="text-muted-foreground ml-0.5">{unit}</span>}
        </span>
      )}
    </div>
  );
};
