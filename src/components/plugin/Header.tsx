import { cn } from "@/lib/utils";
import { Waves, HelpCircle, Activity } from "lucide-react";
import { SettingsDialog } from "./SettingsDialog";

interface HeaderProps {
  className?: string;
}

export const Header = ({ className }: HeaderProps) => {
  return (
    <div className={cn(
      "relative flex items-center justify-between px-6 py-4",
      "border-b border-primary/30",
      "bg-gradient-to-r from-background via-card to-background",
      "cyber-grid",
      className
    )}>
      {/* Scanline overlay */}
      <div className="absolute inset-0 scanlines pointer-events-none" />
      
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
      
      {/* Logo and branding */}
      <div className="flex items-center gap-4 group relative z-10">
        <div className="relative">
          <div className={cn(
            "w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center",
            "border border-primary/50 corner-accents",
            "transition-all duration-500 group-hover:scale-110 group-hover:border-primary"
          )}>
            <Waves className="w-7 h-7 text-primary" />
          </div>
          <div className="absolute inset-0 rounded-xl bg-primary/20 animate-glow-pulse" />
          {/* Orbiting dot */}
          <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary animate-bounce-subtle" />
        </div>
        <div className="animate-fade-in">
          <h1 className="font-display font-bold text-2xl tracking-widest text-foreground flex items-baseline gap-1">
            TONAL<span className="text-primary animate-neon-pulse">SYNC</span>
            <span className="text-[8px] text-primary/50 font-normal ml-1 align-super">PRO</span>
          </h1>
          <div className="flex items-center gap-2">
            <Activity className="w-3 h-3 text-primary animate-pulse" />
            <span className="text-[10px] text-muted-foreground tracking-[0.3em] uppercase">
              Neural Audio Engine
            </span>
          </div>
        </div>
      </div>

      {/* Center info - Status bar */}
      <div className="flex items-center gap-1 bg-muted/30 rounded-full px-4 py-2 border border-border/50 relative z-10">
        <div className="flex items-center gap-6">
          <div className="text-center group">
            <span className="text-[9px] text-muted-foreground block uppercase tracking-wider">Version</span>
            <span className="text-xs font-display text-foreground font-medium">2025.1.0</span>
          </div>
          <div className="h-4 w-px bg-border/50" />
          <div className="text-center group">
            <span className="text-[9px] text-muted-foreground block uppercase tracking-wider">CPU</span>
            <span className="text-xs font-display text-primary font-medium">2.3%</span>
          </div>
          <div className="h-4 w-px bg-border/50" />
          <div className="text-center group">
            <span className="text-[9px] text-muted-foreground block uppercase tracking-wider">Latency</span>
            <span className="text-xs font-display text-primary font-bold animate-pulse">0ms</span>
          </div>
          <div className="h-4 w-px bg-border/50" />
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_hsl(var(--primary))]" />
            <span className="text-[9px] text-primary uppercase tracking-wider font-medium">Online</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 relative z-10">
        <SettingsDialog />
        <button className={cn(
          "p-2.5 rounded-lg border border-border/50 hover:border-primary/50",
          "bg-muted/30 hover:bg-primary/10",
          "transition-all duration-300 group",
          "hover:scale-110 active:scale-95"
        )}>
          <HelpCircle className={cn(
            "w-5 h-5 text-muted-foreground transition-all duration-300",
            "group-hover:text-primary"
          )} />
        </button>
      </div>
      
      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
    </div>
  );
};