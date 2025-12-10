import { cn } from "@/lib/utils";
import { Waves, HelpCircle } from "lucide-react";
import { SettingsDialog } from "./SettingsDialog";

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
      <div className="flex items-center gap-3 group">
        <div className="relative">
          <div className={cn(
            "w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/50",
            "transition-all duration-500 group-hover:scale-110 group-hover:rotate-12"
          )}>
            <Waves className="w-6 h-6 text-primary animate-pulse" />
          </div>
          <div className="absolute inset-0 rounded-lg bg-primary/20 animate-glow-pulse" />
        </div>
        <div className="animate-fade-in">
          <h1 className="font-display font-bold text-xl tracking-wider text-foreground">
            TONAL<span className="text-primary animate-pulse">SYNC</span>
          </h1>
          <span className="text-[10px] text-muted-foreground tracking-widest">
            BY SWEAV
          </span>
        </div>
      </div>

      {/* Center info */}
      <div className="flex items-center gap-6">
        <div className="text-center group hover:scale-105 transition-transform duration-300">
          <span className="text-[10px] text-muted-foreground block">VERSION</span>
          <span className="text-xs font-display text-primary group-hover:animate-pulse">2025.1.0</span>
        </div>
        <div className="h-6 w-px bg-border animate-pulse" />
        <div className="text-center group hover:scale-105 transition-transform duration-300">
          <span className="text-[10px] text-muted-foreground block">CPU</span>
          <span className="text-xs font-display text-primary">2.3%</span>
        </div>
        <div className="h-6 w-px bg-border animate-pulse" />
        <div className="text-center group hover:scale-105 transition-transform duration-300">
          <span className="text-[10px] text-muted-foreground block">LATENCY</span>
          <span className="text-xs font-display text-primary font-bold">0ms</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <SettingsDialog />
        <button className={cn(
          "p-2 rounded-lg hover:bg-muted transition-all duration-300 group",
          "hover:scale-110 active:scale-95"
        )}>
          <HelpCircle className={cn(
            "w-5 h-5 text-muted-foreground transition-all duration-300",
            "group-hover:text-primary group-hover:rotate-12"
          )} />
        </button>
      </div>
    </div>
  );
};