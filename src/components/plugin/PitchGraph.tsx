import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface PitchGraphProps {
  className?: string;
}

export const PitchGraph = ({ className }: PitchGraphProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const animationRef = useRef<number>();
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * 2;
      canvas.height = rect.height * 2;
      ctx.scale(2, 2);
    };
    resize();
    window.addEventListener("resize", resize);

    const notes = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"];
    const notePositions = notes.map((_, i) => ((notes.length - 1 - i) / (notes.length - 1)) * 0.8 + 0.1);

    const draw = () => {
      const width = canvas.width / 2;
      const height = canvas.height / 2;

      // Clear with gradient background
      const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
      bgGradient.addColorStop(0, "hsl(220, 20%, 8%)");
      bgGradient.addColorStop(1, "hsl(220, 20%, 5%)");
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);

      // Draw grid lines
      ctx.strokeStyle = "hsl(110, 50%, 25%, 0.2)";
      ctx.lineWidth = 1;

      // Horizontal note lines
      notes.forEach((note, i) => {
        const y = notePositions[i] * height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();

        // Note labels
        ctx.fillStyle = "hsl(0, 0%, 50%)";
        ctx.font = "10px Rajdhani";
        ctx.fillText(note, 5, y - 3);
      });

      // Vertical time lines
      for (let i = 0; i < 10; i++) {
        const x = (i / 10) * width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      if (isPlaying) {
        timeRef.current += 0.02;

        // Draw input pitch (red/orange - slightly off pitch)
        ctx.beginPath();
        ctx.strokeStyle = "hsl(30, 100%, 50%)";
        ctx.lineWidth = 2;
        ctx.shadowColor = "hsl(30, 100%, 50%)";
        ctx.shadowBlur = 8;

        for (let x = 0; x < width; x++) {
          const t = (x / width) * 4 + timeRef.current;
          const noteIndex = Math.floor((Math.sin(t * 0.5) * 0.5 + 0.5) * (notes.length - 1));
          const baseY = notePositions[noteIndex] * height;
          const wobble = Math.sin(t * 8) * 8 + Math.sin(t * 12) * 3;
          const y = baseY + wobble;

          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Draw corrected pitch (green - perfectly on pitch)
        ctx.beginPath();
        ctx.strokeStyle = "hsl(110, 100%, 55%)";
        ctx.lineWidth = 3;
        ctx.shadowColor = "hsl(110, 100%, 55%)";
        ctx.shadowBlur = 12;

        for (let x = 0; x < width; x++) {
          const t = (x / width) * 4 + timeRef.current;
          const noteIndex = Math.floor((Math.sin(t * 0.5) * 0.5 + 0.5) * (notes.length - 1));
          const y = notePositions[noteIndex] * height;
          
          // Slight vibrato for natural feel
          const vibrato = Math.sin(t * 15) * 2;

          if (x === 0) ctx.moveTo(x, y + vibrato);
          else ctx.lineTo(x, y + vibrato);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Playhead
        const playheadX = ((timeRef.current * 50) % width);
        ctx.beginPath();
        ctx.strokeStyle = "hsl(110, 100%, 55%, 0.8)";
        ctx.lineWidth = 2;
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, height);
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying]);

  return (
    <div className={cn("relative rounded-lg overflow-hidden", className)}>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        onClick={() => setIsPlaying(!isPlaying)}
      />
      
      {/* Graph legend */}
      <div className="absolute bottom-2 right-2 flex gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-orange-500 rounded" />
          <span className="text-muted-foreground">Input</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-primary rounded shadow-[0_0_4px_hsl(var(--primary))]" />
          <span className="text-muted-foreground">Corrected</span>
        </div>
      </div>

      {/* Graph mode label */}
      <div className="absolute top-2 left-2 px-2 py-1 rounded bg-background/80 backdrop-blur-sm border border-border/50">
        <span className="text-xs font-display text-primary">GRAPH MODE</span>
      </div>
    </div>
  );
};
