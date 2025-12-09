import { cn } from "@/lib/utils";
import { Waves, Settings, HelpCircle } from "lucide-react";

interface HeaderProps {
  className?: string;
}

export const Header = ({ className }: HeaderProps) => {
  return (
    <div className={cn(
      "flex items-center justify-between px-4 py-3",
      "border-b border-border/50",
      className
    )}>
      {/* Logo and branding */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/50">
            <Waves className="w-6 h-6 text-primary" />
          </div>
          <div className="absolute inset-0 rounded-lg bg-primary/20 animate-glow-pulse" />
        </div>
        <div>
          <h1 className="font-display font-bold text-xl tracking-wider text-foreground">
            TONAL<span className="text-primary">SYNC</span>
          </h1>
          <span className="text-[10px] text-muted-foreground tracking-widest">
            BY SWEAV
          </span>
        </div>
      </div>

      {/* Center info */}
      <div className="flex items-center gap-6">
        <div className="text-center">
          <span className="text-[10px] text-muted-foreground block">VERSION</span>
          <span className="text-xs font-display text-primary">2025.1.0</span>
        </div>
        <div className="h-6 w-px bg-border" />
        <div className="text-center">
          <span className="text-[10px] text-muted-foreground block">CPU</span>
          <span className="text-xs font-display text-primary">2.3%</span>
        </div>
        <div className="h-6 w-px bg-border" />
        <div className="text-center">
          <span className="text-[10px] text-muted-foreground block">LATENCY</span>
          <span className="text-xs font-display text-primary">0ms</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button className="p-2 rounded-lg hover:bg-muted transition-colors group">
          <Settings className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </button>
        <button className="p-2 rounded-lg hover:bg-muted transition-colors group">
          <HelpCircle className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </button>
      </div>
    </div>
  );
};
