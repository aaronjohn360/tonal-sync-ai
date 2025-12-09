import { cn } from "@/lib/utils";

interface ControlSectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  glowing?: boolean;
}

export const ControlSection = ({
  title,
  children,
  className,
  glowing = false,
}: ControlSectionProps) => {
  return (
    <div
      className={cn(
        "glass-panel rounded-xl p-4",
        glowing && "glow-border",
        className
      )}
    >
      <h3 className="text-xs font-display text-primary uppercase tracking-wider mb-4 text-center">
        {title}
      </h3>
      {children}
    </div>
  );
};
