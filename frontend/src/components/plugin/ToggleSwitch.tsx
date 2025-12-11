import { cn } from "@/lib/utils";

interface ToggleSwitchProps {
  isOn: boolean;
  onChange: (value: boolean) => void;
  label: string;
  sublabel?: string;
  className?: string;
}

export const ToggleSwitch = ({
  isOn,
  onChange,
  label,
  sublabel,
  className,
}: ToggleSwitchProps) => {
  return (
    <div className={cn("flex flex-col items-center gap-2 group", className)}>
      <button
        onClick={() => onChange(!isOn)}
        className={cn(
          "relative w-14 h-7 rounded-full transition-all duration-300",
          "border border-border",
          "hover:scale-105 active:scale-95",
          "hover:border-primary/50",
          isOn
            ? "bg-primary/20 border-primary shadow-glow"
            : "bg-muted"
        )}
      >
        <div
          className={cn(
            "absolute top-1 w-5 h-5 rounded-full transition-all duration-300",
            isOn
              ? "left-7 bg-primary shadow-[0_0_10px_hsl(var(--primary))]"
              : "left-1 bg-muted-foreground"
          )}
        >
          {/* Inner glow indicator */}
          {isOn && (
            <div className="absolute inset-0 rounded-full bg-white/30 animate-pulse" />
          )}
        </div>
        
        {/* Glow effect when on */}
        {isOn && (
          <div className="absolute inset-0 rounded-full bg-primary/10 animate-glow-pulse" />
        )}
      </button>

      <div className="text-center">
        <span className={cn(
          "text-xs font-medium uppercase tracking-wider block",
          "transition-colors duration-200",
          isOn ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
        )}>
          {label}
        </span>
        {sublabel && (
          <span className={cn(
            "text-xs font-display transition-all duration-200",
            isOn ? "text-primary animate-pulse" : "text-muted-foreground"
          )}>
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
};
