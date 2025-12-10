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
        "glass-panel rounded-xl p-4",
        "animate-fade-in-up opacity-0",
        "hover-lift",
        "transition-all duration-300",
        glowing && "glow-border",
        className
      )}
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'forwards' }}
    >
      <h3 className="text-xs font-display text-primary uppercase tracking-wider mb-4 text-center animate-pulse">
        {title}
      </h3>
      {children}
    </div>
  );
};
