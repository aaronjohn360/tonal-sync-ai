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
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <button
        onClick={() => onChange(!isOn)}
        className={cn(
          "relative w-14 h-7 rounded-full transition-all duration-300",
          "border border-border",
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
        />
        
        {/* Glow effect when on */}
        {isOn && (
          <div className="absolute inset-0 rounded-full bg-primary/10 animate-glow-pulse" />
        )}
      </button>

      <div className="text-center">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
          {label}
        </span>
        {sublabel && (
          <span className={cn(
            "text-xs font-display",
            isOn ? "text-primary" : "text-muted-foreground"
          )}>
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
};
