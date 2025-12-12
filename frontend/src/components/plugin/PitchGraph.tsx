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
  const centerFreqRef = useRef(300); // Dynamic center frequency

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

    // Convert frequency to centered Y position
    // This centers the current pitch in the middle of the graph
    const freqToY = (freq: number, centerFreq: number, height: number, range: number = 2): number => {
      if (freq <= 0 || centerFreq <= 0) return height / 2;
      
      // Calculate semitones from center
      const semitones = 12 * Math.log2(freq / centerFreq);
      
      // Map semitones to Y position (center = middle, +/- range octaves visible)
      const semitonesRange = range * 12; // Total semitones visible
      const normalizedPosition = semitones / semitonesRange;
      
      // Clamp and invert (higher pitch = lower Y)
      return Math.max(0, Math.min(height, height / 2 - normalizedPosition * height / 2));
    };

    // Get note lines relative to center frequency
    const getNoteLines = (centerFreq: number, range: number = 2): { note: string; freq: number; semitones: number }[] => {
      const lines: { note: string; freq: number; semitones: number }[] = [];
      const semitonesRange = range * 12;
      
      // Find the nearest note to center
      let centerSemitone = Math.round(12 * Math.log2(centerFreq / NOTE_FREQUENCIES["A"]) + 9); // A4 reference
      
      // Generate note lines within visible range
      for (let s = -semitonesRange; s <= semitonesRange; s++) {
        const totalSemitone = centerSemitone + s;
        const noteIndex = ((totalSemitone % 12) + 12) % 12;
        const octave = Math.floor((totalSemitone + 9) / 12) + 4; // Adjust for A4 reference
        const noteName = NOTES[noteIndex];
        const freq = NOTE_FREQUENCIES[noteName] * Math.pow(2, octave - 4);
        
        // Only show certain notes (C, E, G, A for cleaner grid)
        if (["C", "E", "G", "A"].includes(noteName)) {
          lines.push({ 
            note: `${noteName}${octave}`, 
            freq,
            semitones: s
          });
        }
      }
      
      return lines;
    };

    const draw = () => {
      const width = canvas.width / 2;
      const height = canvas.height / 2;
      const now = Date.now();

      // Clear with gradient background
      const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
      bgGradient.addColorStop(0, "hsl(220, 20%, 8%)");
      bgGradient.addColorStop(0.5, "hsl(220, 20%, 6%)");
      bgGradient.addColorStop(1, "hsl(220, 20%, 8%)");
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);

      // Calculate dynamic center frequency from recent pitch data
      const timeWindow = 5000;
      const recentHistory = pitchHistory.filter(p => now - p.time < timeWindow && p.corrected > 0);
      
      if (recentHistory.length > 0 && isActive) {
        // Smooth center frequency tracking
        const avgFreq = recentHistory.reduce((sum, p) => sum + p.corrected, 0) / recentHistory.length;
        centerFreqRef.current += (avgFreq - centerFreqRef.current) * 0.05; // Smooth transition
      }

      const centerFreq = centerFreqRef.current;
      const noteLines = getNoteLines(centerFreq, 1.5);

      // Draw horizontal note grid lines
      ctx.strokeStyle = "hsl(110, 50%, 25%, 0.15)";
      ctx.lineWidth = 1;

      noteLines.forEach(({ note, freq, semitones }) => {
        const y = freqToY(freq, centerFreq, height, 1.5);
        
        // Draw line
        ctx.beginPath();
        ctx.moveTo(40, y);
        ctx.lineTo(width, y);
        ctx.stroke();

        // Note label
        ctx.fillStyle = semitones === 0 ? "hsl(110, 100%, 55%)" : "hsl(0, 0%, 40%)";
        ctx.font = semitones === 0 ? "bold 11px Rajdhani" : "10px Rajdhani";
        ctx.textAlign = "left";
        ctx.fillText(note, 5, y + 4);
      });

      // Draw center line (current target note)
      ctx.strokeStyle = "hsl(110, 100%, 55%, 0.3)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(40, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Vertical time grid
      ctx.strokeStyle = "hsl(110, 50%, 25%, 0.1)";
      ctx.lineWidth = 1;
      for (let i = 1; i < 10; i++) {
        const x = 40 + (i / 10) * (width - 40);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Draw pitch curves
      if (recentHistory.length > 1 && isActive) {
        // INPUT PITCH (Orange - raw detected pitch)
        ctx.beginPath();
        ctx.strokeStyle = "hsl(30, 100%, 55%)";
        ctx.lineWidth = 2;
        ctx.shadowColor = "hsl(30, 100%, 55%)";
        ctx.shadowBlur = 6;

        let firstPoint = true;
        recentHistory.forEach((point) => {
          const x = 40 + ((timeWindow - (now - point.time)) / timeWindow) * (width - 40);
          const y = freqToY(point.input, centerFreq, height, 1.5);

          if (firstPoint) {
            ctx.moveTo(x, y);
            firstPoint = false;
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.stroke();
        ctx.shadowBlur = 0;

        // CORRECTED PITCH (Green - pitch-corrected output)
        ctx.beginPath();
        ctx.strokeStyle = "hsl(110, 100%, 55%)";
        ctx.lineWidth = 3;
        ctx.shadowColor = "hsl(110, 100%, 55%)";
        ctx.shadowBlur = 15;

        firstPoint = true;
        recentHistory.forEach((point) => {
          const x = 40 + ((timeWindow - (now - point.time)) / timeWindow) * (width - 40);
          const y = freqToY(point.corrected, centerFreq, height, 1.5);

          if (firstPoint) {
            ctx.moveTo(x, y);
            firstPoint = false;
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Current pitch indicators (right side)
        const lastPoint = recentHistory[recentHistory.length - 1];
        if (lastPoint) {
          // Input indicator (orange dot)
          const inputY = freqToY(lastPoint.input, centerFreq, height, 1.5);
          ctx.beginPath();
          ctx.fillStyle = "hsl(30, 100%, 55%)";
          ctx.arc(width - 20, inputY, 4, 0, Math.PI * 2);
          ctx.fill();

          // Corrected indicator (green dot with glow)
          const correctedY = freqToY(lastPoint.corrected, centerFreq, height, 1.5);
          ctx.beginPath();
          ctx.fillStyle = "hsl(110, 100%, 55%)";
          ctx.shadowColor = "hsl(110, 100%, 55%)";
          ctx.shadowBlur = 15;
          ctx.arc(width - 10, correctedY, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;

          // Current note label
          ctx.fillStyle = "hsl(110, 100%, 55%)";
          ctx.font = "bold 12px Orbitron";
          ctx.textAlign = "right";
          ctx.fillText(getNoteName(lastPoint.corrected), width - 25, correctedY + 4);

          // Draw correction arrow if there's significant pitch error
          const pitchDiff = Math.abs(lastPoint.corrected - lastPoint.input);
          if (pitchDiff > 5) {
            ctx.strokeStyle = "hsl(110, 100%, 55%, 0.5)";
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.moveTo(width - 20, inputY);
            ctx.lineTo(width - 10, correctedY);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      } else {
        // Demo animation when not active
        timeRef.current += 0.015;
        const demoCenter = 350;
        centerFreqRef.current = demoCenter;

        const demoNotes = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25];
        
        // Demo input pitch (orange - with natural wobble)
        ctx.beginPath();
        ctx.strokeStyle = "hsl(30, 100%, 55%)";
        ctx.lineWidth = 2;
        ctx.shadowColor = "hsl(30, 100%, 55%)";
        ctx.shadowBlur = 6;

        for (let x = 40; x < width; x++) {
          const t = ((x - 40) / (width - 40)) * 4 + timeRef.current;
          const noteIndex = Math.floor((Math.sin(t * 0.5) * 0.5 + 0.5) * (demoNotes.length - 1));
          const baseFreq = demoNotes[noteIndex];
          // Add natural vocal wobble (vibrato + pitch drift)
          const wobble = baseFreq * (1 + Math.sin(t * 8) * 0.04 + Math.sin(t * 12) * 0.015);
          const y = freqToY(wobble, demoCenter, height, 1.5);

          if (x === 40) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Demo corrected pitch (green - snapped to notes)
        ctx.beginPath();
        ctx.strokeStyle = "hsl(110, 100%, 55%)";
        ctx.lineWidth = 3;
        ctx.shadowColor = "hsl(110, 100%, 55%)";
        ctx.shadowBlur = 15;

        for (let x = 40; x < width; x++) {
          const t = ((x - 40) / (width - 40)) * 4 + timeRef.current;
          const noteIndex = Math.floor((Math.sin(t * 0.5) * 0.5 + 0.5) * (demoNotes.length - 1));
          const baseFreq = demoNotes[noteIndex];
          // Corrected has minimal vibrato (tight tuning)
          const corrected = baseFreq * (1 + Math.sin(t * 15) * 0.003);
          const y = freqToY(corrected, demoCenter, height, 1.5);

          if (x === 40) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Demo playhead
        const playheadX = 40 + ((timeRef.current * 40) % (width - 40));
        ctx.beginPath();
        ctx.strokeStyle = "hsl(110, 100%, 55%, 0.6)";
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
