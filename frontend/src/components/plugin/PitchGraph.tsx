import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface PitchGraphProps {
  className?: string;
  pitchHistory?: { input: number; corrected: number; time: number }[];
  isActive?: boolean;
}

const NOTE_FREQUENCIES: { [key: string]: number } = {
  "C": 261.63, "C#": 277.18, "D": 293.66, "D#": 311.13,
  "E": 329.63, "F": 349.23, "F#": 369.99, "G": 392.00,
  "G#": 415.30, "A": 440.00, "A#": 466.16, "B": 493.88
};

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// Convert frequency to note position (0-1 range within display)
const freqToNotePosition = (freq: number, minFreq: number, maxFreq: number): number => {
  if (freq <= 0) return 0.5;
  const logMin = Math.log2(minFreq);
  const logMax = Math.log2(maxFreq);
  const logFreq = Math.log2(freq);
  return 1 - (logFreq - logMin) / (logMax - logMin);
};

// Get note name from frequency
const getNoteName = (freq: number): string => {
  if (freq <= 0) return "-";
  
  let nearestNote = "";
  let minCents = Infinity;
  let nearestOctave = 4;
  
  for (let octave = 2; octave <= 6; octave++) {
    for (const note of NOTES) {
      const baseFreq = NOTE_FREQUENCIES[note];
      const noteFreq = baseFreq * Math.pow(2, octave - 4);
      const cents = Math.abs(1200 * Math.log2(freq / noteFreq));
      
      if (cents < minCents) {
        minCents = cents;
        nearestNote = note;
        nearestOctave = octave;
      }
    }
  }
  
  return `${nearestNote}${nearestOctave}`;
};

export const PitchGraph = ({ className, pitchHistory = [], isActive = false }: PitchGraphProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

    // Frequency range for display (C3 to C6)
    const minFreq = 130.81; // C3
    const maxFreq = 1046.5; // C6

    // Generate note lines for display
    const noteLines: { note: string; freq: number }[] = [];
    for (let octave = 3; octave <= 5; octave++) {
      for (const note of ["C", "E", "G"]) {
        const baseFreq = NOTE_FREQUENCIES[note];
        const freq = baseFreq * Math.pow(2, octave - 4);
        if (freq >= minFreq && freq <= maxFreq) {
          noteLines.push({ note: `${note}${octave}`, freq });
        }
      }
    }

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
      noteLines.forEach(({ note, freq }) => {
        const y = freqToNotePosition(freq, minFreq, maxFreq) * height;
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

      const now = Date.now();

      // Draw real pitch data if available
      if (pitchHistory.length > 1 && isActive) {
        const timeWindow = 5000; // 5 seconds of history
        const recentHistory = pitchHistory.filter(p => now - p.time < timeWindow && p.input > 0);

        if (recentHistory.length > 1) {
          // Draw input pitch (orange - raw detected pitch)
          ctx.beginPath();
          ctx.strokeStyle = "hsl(30, 100%, 50%)";
          ctx.lineWidth = 2;
          ctx.shadowColor = "hsl(30, 100%, 50%)";
          ctx.shadowBlur = 8;

          let firstPoint = true;
          recentHistory.forEach((point) => {
            const x = ((timeWindow - (now - point.time)) / timeWindow) * width;
            const y = freqToNotePosition(point.input, minFreq, maxFreq) * height;

            if (firstPoint) {
              ctx.moveTo(x, y);
              firstPoint = false;
            } else {
              ctx.lineTo(x, y);
            }
          });
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Draw corrected pitch (green - pitch-corrected output)
          ctx.beginPath();
          ctx.strokeStyle = "hsl(110, 100%, 55%)";
          ctx.lineWidth = 3;
          ctx.shadowColor = "hsl(110, 100%, 55%)";
          ctx.shadowBlur = 12;

          firstPoint = true;
          recentHistory.forEach((point) => {
            const x = ((timeWindow - (now - point.time)) / timeWindow) * width;
            const y = freqToNotePosition(point.corrected, minFreq, maxFreq) * height;

            if (firstPoint) {
              ctx.moveTo(x, y);
              firstPoint = false;
            } else {
              ctx.lineTo(x, y);
            }
          });
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Current pitch indicator
          const lastPoint = recentHistory[recentHistory.length - 1];
          if (lastPoint) {
            const currentY = freqToNotePosition(lastPoint.corrected, minFreq, maxFreq) * height;
            
            // Draw current note label
            ctx.fillStyle = "hsl(110, 100%, 55%)";
            ctx.font = "bold 14px Orbitron";
            ctx.textAlign = "right";
            ctx.fillText(getNoteName(lastPoint.corrected), width - 10, currentY + 5);
            ctx.textAlign = "left";
          }
        }
      } else {
        // Demo animation when not active
        timeRef.current += 0.02;

        const demoNotes = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25];
        
        // Draw demo input pitch (orange)
        ctx.beginPath();
        ctx.strokeStyle = "hsl(30, 100%, 50%)";
        ctx.lineWidth = 2;
        ctx.shadowColor = "hsl(30, 100%, 50%)";
        ctx.shadowBlur = 8;

        for (let x = 0; x < width; x++) {
          const t = (x / width) * 4 + timeRef.current;
          const noteIndex = Math.floor((Math.sin(t * 0.5) * 0.5 + 0.5) * (demoNotes.length - 1));
          const baseFreq = demoNotes[noteIndex];
          const wobble = baseFreq * (1 + Math.sin(t * 8) * 0.03 + Math.sin(t * 12) * 0.01);
          const y = freqToNotePosition(wobble, minFreq, maxFreq) * height;

          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Draw demo corrected pitch (green)
        ctx.beginPath();
        ctx.strokeStyle = "hsl(110, 100%, 55%)";
        ctx.lineWidth = 3;
        ctx.shadowColor = "hsl(110, 100%, 55%)";
        ctx.shadowBlur = 12;

        for (let x = 0; x < width; x++) {
          const t = (x / width) * 4 + timeRef.current;
          const noteIndex = Math.floor((Math.sin(t * 0.5) * 0.5 + 0.5) * (demoNotes.length - 1));
          const baseFreq = demoNotes[noteIndex];
          const vibrato = baseFreq * (1 + Math.sin(t * 15) * 0.005);
          const y = freqToNotePosition(vibrato, minFreq, maxFreq) * height;

          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Demo playhead
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
  }, [pitchHistory, isActive]);

  return (
    <div className={cn("relative rounded-lg overflow-hidden", className)}>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
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
        <span className="text-xs font-display text-primary">
          {isActive ? "LIVE MODE" : "DEMO MODE"}
        </span>
      </div>
    </div>
  );
};