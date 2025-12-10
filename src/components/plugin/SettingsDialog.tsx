import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Settings, Check, Palette, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ColorTheme {
  name: string;
  hue: number;
  preview: string;
}

const COLOR_THEMES: ColorTheme[] = [
  { name: "Slime Green", hue: 110, preview: "hsl(110, 100%, 55%)" },
  { name: "Cyber Cyan", hue: 180, preview: "hsl(180, 100%, 55%)" },
  { name: "Electric Blue", hue: 210, preview: "hsl(210, 100%, 55%)" },
  { name: "Neon Purple", hue: 270, preview: "hsl(270, 100%, 60%)" },
  { name: "Hot Pink", hue: 320, preview: "hsl(320, 100%, 55%)" },
  { name: "Solar Orange", hue: 30, preview: "hsl(30, 100%, 55%)" },
  { name: "Golden Yellow", hue: 50, preview: "hsl(50, 100%, 50%)" },
  { name: "Cherry Red", hue: 0, preview: "hsl(0, 100%, 55%)" },
];

interface SettingsDialogProps {
  onThemeChange?: (hue: number) => void;
}

export const SettingsDialog = ({ onThemeChange }: SettingsDialogProps) => {
  const [selectedHue, setSelectedHue] = useState(110);
  const [isOpen, setIsOpen] = useState(false);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);

  useEffect(() => {
    // Load saved theme from localStorage
    const savedHue = localStorage.getItem("tonalsync-theme-hue");
    if (savedHue) {
      const hue = parseInt(savedHue);
      setSelectedHue(hue);
      applyTheme(hue);
    }
    
    const savedAnimations = localStorage.getItem("tonalsync-animations");
    if (savedAnimations !== null) {
      setAnimationsEnabled(savedAnimations === "true");
    }
  }, []);

  const applyTheme = (hue: number) => {
    const root = document.documentElement;
    
    // Primary color
    root.style.setProperty("--primary", `${hue} 100% 55%`);
    root.style.setProperty("--primary-glow", `${hue} 100% 60%`);
    root.style.setProperty("--ring", `${hue} 100% 55%`);
    
    // Secondary
    root.style.setProperty("--secondary", `${hue} 30% 20%`);
    root.style.setProperty("--secondary-foreground", `${hue} 100% 55%`);
    
    // Border
    root.style.setProperty("--border", `${hue} 50% 25%`);
    
    // Glow
    root.style.setProperty("--glow-color", `${hue} 100% 55%`);
    root.style.setProperty("--meter-green", `${hue} 100% 50%`);
    
    // Sidebar
    root.style.setProperty("--sidebar-primary", `${hue} 100% 55%`);
    root.style.setProperty("--sidebar-accent", `${hue} 30% 20%`);
    root.style.setProperty("--sidebar-border", `${hue} 50% 25%`);
    root.style.setProperty("--sidebar-ring", `${hue} 100% 55%`);

    // Update CSS for glow animations
    updateGlowAnimations(hue);
  };

  const updateGlowAnimations = (hue: number) => {
    // Update the glow-border CSS dynamically
    const styleId = "dynamic-theme-styles";
    let styleEl = document.getElementById(styleId) as HTMLStyleElement;
    
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    
    styleEl.textContent = `
      @keyframes glow-pulse {
        0%, 100% {
          box-shadow: 0 0 20px hsl(${hue} 100% 55% / 0.4), 
                      0 0 40px hsl(${hue} 100% 55% / 0.2),
                      0 0 60px hsl(${hue} 100% 55% / 0.1);
        }
        50% {
          box-shadow: 0 0 30px hsl(${hue} 100% 55% / 0.6), 
                      0 0 60px hsl(${hue} 100% 55% / 0.3),
                      0 0 90px hsl(${hue} 100% 55% / 0.15);
        }
      }
      
      .glow-border::before {
        background: linear-gradient(
          135deg,
          hsl(${hue} 100% 55%) 0%,
          hsl(${(hue + 20) % 360} 100% 45%) 25%,
          hsl(${hue} 100% 50%) 50%,
          hsl(${(hue - 20 + 360) % 360} 100% 55%) 75%,
          hsl(${hue} 100% 55%) 100%
        );
        background-size: 200% 200%;
        animation: border-flow 3s ease infinite;
      }
      
      .shadow-glow {
        box-shadow: 0 0 30px hsl(${hue} 100% 55% / 0.4), 0 0 60px hsl(${hue} 100% 55% / 0.2) !important;
      }
      
      ::-webkit-scrollbar-thumb {
        background: hsl(${hue} 100% 55% / 0.5);
      }
      
      ::-webkit-scrollbar-thumb:hover {
        background: hsl(${hue} 100% 55% / 0.7);
      }
    `;
  };

  const handleThemeSelect = (hue: number) => {
    setSelectedHue(hue);
    applyTheme(hue);
    localStorage.setItem("tonalsync-theme-hue", hue.toString());
    onThemeChange?.(hue);
  };

  const handleAnimationsToggle = () => {
    const newValue = !animationsEnabled;
    setAnimationsEnabled(newValue);
    localStorage.setItem("tonalsync-animations", newValue.toString());
    
    if (!newValue) {
      document.documentElement.classList.add("reduce-motion");
    } else {
      document.documentElement.classList.remove("reduce-motion");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button className={cn(
          "p-2 rounded-lg hover:bg-muted transition-all duration-300 group",
          "hover:scale-110 active:scale-95"
        )}>
          <Settings className={cn(
            "w-5 h-5 text-muted-foreground transition-all duration-300",
            "group-hover:text-primary group-hover:rotate-90"
          )} />
        </button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-primary flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Settings
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Color Theme Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-primary" />
              <label className="text-sm font-medium">Interface Color</label>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {COLOR_THEMES.map((theme) => (
                <button
                  key={theme.name}
                  onClick={() => handleThemeSelect(theme.hue)}
                  className={cn(
                    "relative flex flex-col items-center gap-1.5 p-3 rounded-xl",
                    "border-2 transition-all duration-300",
                    "hover:scale-105 active:scale-95",
                    selectedHue === theme.hue
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50 bg-muted/50"
                  )}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full transition-all duration-300",
                      selectedHue === theme.hue && "ring-2 ring-white/50 ring-offset-2 ring-offset-card"
                    )}
                    style={{ 
                      background: theme.preview,
                      boxShadow: `0 0 20px ${theme.preview}`
                    }}
                  />
                  <span className="text-[10px] text-muted-foreground text-center leading-tight">
                    {theme.name}
                  </span>
                  {selectedHue === theme.hue && (
                    <div className="absolute top-1 right-1">
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Hue Slider */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Custom Color</label>
            <div className="space-y-2">
              <input
                type="range"
                min="0"
                max="360"
                value={selectedHue}
                onChange={(e) => handleThemeSelect(parseInt(e.target.value))}
                className="w-full h-3 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, 
                    hsl(0, 100%, 55%), 
                    hsl(60, 100%, 55%), 
                    hsl(120, 100%, 55%), 
                    hsl(180, 100%, 55%), 
                    hsl(240, 100%, 55%), 
                    hsl(300, 100%, 55%), 
                    hsl(360, 100%, 55%)
                  )`
                }}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Hue: {selectedHue}°</span>
                <div 
                  className="w-6 h-6 rounded-full border-2 border-border"
                  style={{ 
                    background: `hsl(${selectedHue}, 100%, 55%)`,
                    boxShadow: `0 0 15px hsl(${selectedHue}, 100%, 55%)`
                  }}
                />
              </div>
            </div>
          </div>

          {/* Animations Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm">Animations</span>
            </div>
            <button
              onClick={handleAnimationsToggle}
              className={cn(
                "relative w-12 h-6 rounded-full transition-all duration-300",
                animationsEnabled 
                  ? "bg-primary" 
                  : "bg-muted-foreground/30"
              )}
            >
              <div className={cn(
                "absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300",
                animationsEnabled ? "left-7" : "left-1"
              )} />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};