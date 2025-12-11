import { cn } from "@/lib/utils";
import { Brain, Zap } from "lucide-react";

interface AIPEIndicatorProps {
  isActive: boolean;
  confidence: number;
  className?: string;
}

export const AIPEIndicator = ({ isActive, confidence, className }: AIPEIndicatorProps) => {
  return (
    <div className={cn(
      "glass-panel rounded-lg p-3",
      "border border-border/50",
      "transition-all duration-300",
      "hover-lift",
      isActive && "border-primary/50 shadow-glow",
      className
    )}>
      <div className="flex items-center gap-2 mb-2">
        <div className={cn(
          "relative p-1.5 rounded-lg transition-all duration-300",
          isActive ? "bg-primary/20" : "bg-muted"
        )}>
          <Brain className={cn(
            "w-5 h-5 transition-all duration-300",
            isActive ? "text-primary animate-bounce-subtle" : "text-muted-foreground"
          )} />
          {isActive && (
            <>
              <div className="absolute inset-0 rounded-lg bg-primary/30 animate-ai-thinking" />
              <div className="absolute inset-0 rounded-lg border border-primary animate-pulse-ring" />
            </>
          )}
        </div>
        <div className="flex-1">
          <span className={cn(
            "text-xs font-display block transition-colors duration-200",
            isActive ? "text-primary" : "text-muted-foreground"
          )}>AIPE</span>
          <span className="text-[10px] text-muted-foreground">Adaptive AI Pitch Engine</span>
        </div>
        {isActive && (
          <Zap className="w-4 h-4 text-primary animate-pulse" />
        )}
      </div>

      {/* Confidence bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">Confidence</span>
          <span className={cn(
            "font-display tabular-nums transition-all duration-200",
            isActive ? "text-primary" : "text-muted-foreground",
            confidence > 90 && "animate-pulse font-bold"
          )}>
            {confidence}%
          </span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500 ease-out",
              isActive
                ? "bg-primary shadow-[0_0_8px_hsl(var(--primary))]"
                : "bg-muted-foreground"
            )}
            style={{ width: `${confidence}%` }}
          />
        </div>
      </div>

      {/* Status indicators */}
      <div className="flex gap-2 mt-2">
        {["Analyzing", "Learning", "Correcting"].map((status, i) => (
          <div
            key={status}
            className={cn(
              "flex-1 text-center py-1 rounded text-[9px] font-medium uppercase",
              "transition-all duration-300",
              isActive && i <= Math.floor(confidence / 35)
                ? "bg-primary/20 text-primary scale-105"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
            style={{ transitionDelay: `${i * 100}ms` }}
          >
            {status}
          </div>
        ))}
      </div>
    </div>
  );
};
