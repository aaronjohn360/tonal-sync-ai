import { cn } from "@/lib/utils";

interface ControlSectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  glowing?: boolean;
  delay?: number;
}

export const ControlSection = ({
  title,
  children,
  className,
  glowing = false,
  delay = 0,
}: ControlSectionProps) => {
  return (
    <div
      className={cn(
        "relative glass-panel rounded-xl p-4",
        "animate-fade-in-up opacity-0",
        "hover-lift tech-border",
        "transition-all duration-300",
        "cyber-grid",
        glowing && "glow-border",
        className
      )}
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'forwards' }}
    >
      {/* Corner dots */}
      <div className="absolute top-1 left-1 w-1 h-1 rounded-full bg-primary/50" />
      <div className="absolute top-1 right-1 w-1 h-1 rounded-full bg-primary/50" />
      <div className="absolute bottom-1 left-1 w-1 h-1 rounded-full bg-primary/50" />
      <div className="absolute bottom-1 right-1 w-1 h-1 rounded-full bg-primary/50" />
      
      <h3 className="text-xs font-display text-primary uppercase tracking-[0.2em] mb-4 text-center relative">
        <span className="relative z-10">{title}</span>
        <span className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      </h3>
      {children}
    </div>
  );
};
