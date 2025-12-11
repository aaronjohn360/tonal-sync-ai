import { useState } from "react";
import { cn } from "@/lib/utils";
import { Save, FolderOpen, Trash2, Plus, Download, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export interface PluginPreset {
  name: string;
  createdAt: string;
  settings: {
    retuneSpeed: number;
    humanize: number;
    flexTune: number;
    formant: number;
    vibrato: number;
    vibratoRate: number;
    mix: number;
    selectedKey: string;
    selectedScale: string;
    realTimeMode: boolean;
    aipeEnabled: boolean;
    harmonicRetune: boolean;
    harmonicFocus: number;
    overtoneBias: number;
    adaptiveMode: boolean;
    vibratoIsolation: number;
    slidePreservation: boolean;
    intentSensitivity: number;
  };
}

interface PresetManagerProps {
  currentSettings: PluginPreset["settings"];
  onLoadPreset: (settings: PluginPreset["settings"]) => void;
}

const DEFAULT_PRESETS: PluginPreset[] = [
  {
    name: "Init",
    createdAt: new Date().toISOString(),
    settings: {
      retuneSpeed: 50,
      humanize: 25,
      flexTune: 40,
      formant: 0,
      vibrato: 50,
      vibratoRate: 5,
      mix: 100,
      selectedKey: "C",
      selectedScale: "Major",
      realTimeMode: true,
      aipeEnabled: true,
      harmonicRetune: true,
      harmonicFocus: 75,
      overtoneBias: 0,
      adaptiveMode: true,
      vibratoIsolation: 60,
      slidePreservation: true,
      intentSensitivity: 70
    }
  },
  {
    name: "Natural",
    createdAt: new Date().toISOString(),
    settings: {
      retuneSpeed: 30,
      humanize: 60,
      flexTune: 55,
      formant: 0,
      vibrato: 70,
      vibratoRate: 5,
      mix: 85,
      selectedKey: "C",
      selectedScale: "Major",
      realTimeMode: true,
      aipeEnabled: true,
      harmonicRetune: true,
      harmonicFocus: 80,
      overtoneBias: 0,
      adaptiveMode: true,
      vibratoIsolation: 75,
      slidePreservation: true,
      intentSensitivity: 85
    }
  },
  {
    name: "Robot",
    createdAt: new Date().toISOString(),
    settings: {
      retuneSpeed: 100,
      humanize: 0,
      flexTune: 0,
      formant: 0,
      vibrato: 0,
      vibratoRate: 5,
      mix: 100,
      selectedKey: "C",
      selectedScale: "Chromatic",
      realTimeMode: true,
      aipeEnabled: false,
      harmonicRetune: false,
      harmonicFocus: 50,
      overtoneBias: 0,
      adaptiveMode: false,
      vibratoIsolation: 0,
      slidePreservation: false,
      intentSensitivity: 0
    }
  }
];

export const PresetManager = ({ currentSettings, onLoadPreset }: PresetManagerProps) => {
  const [presets, setPresets] = useState<PluginPreset[]>(DEFAULT_PRESETS);
  const [selectedPreset, setSelectedPreset] = useState<string>("Natural");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");

  const handleSavePreset = () => {
    if (!newPresetName.trim()) {
      toast.error("Please enter a preset name");
      return;
    }

    const existingIndex = presets.findIndex(p => p.name === newPresetName);
    const newPreset: PluginPreset = {
      name: newPresetName,
      createdAt: new Date().toISOString(),
      settings: { ...currentSettings }
    };

    if (existingIndex >= 0) {
      const updatedPresets = [...presets];
      updatedPresets[existingIndex] = newPreset;
      setPresets(updatedPresets);
      toast.success(`Preset "${newPresetName}" updated`);
    } else {
      setPresets([...presets, newPreset]);
      toast.success(`Preset "${newPresetName}" saved`);
    }

    setNewPresetName("");
    setSelectedPreset(newPresetName);
    setIsDialogOpen(false);
  };

  const handleLoadPreset = (preset: PluginPreset) => {
    onLoadPreset(preset.settings);
    setSelectedPreset(preset.name);
    toast.success(`Loaded preset "${preset.name}"`);
  };

  const handleDeletePreset = (presetName: string) => {
    if (DEFAULT_PRESETS.some(p => p.name === presetName)) {
      toast.error("Cannot delete default presets");
      return;
    }

    setPresets(presets.filter(p => p.name !== presetName));
    if (selectedPreset === presetName) {
      setSelectedPreset("Init");
    }
    toast.success(`Deleted preset "${presetName}"`);
  };

  const handleExportPreset = async () => {
    const preset: PluginPreset = {
      name: selectedPreset || "Custom",
      createdAt: new Date().toISOString(),
      settings: currentSettings
    };

    const json = JSON.stringify(preset, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    
    // Check if File System Access API is supported
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: `${preset.name}.tonalsync`,
          types: [{
            description: 'Tonal Sync Preset',
            accept: { 'application/json': ['.tonalsync', '.json'] }
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        toast.success(`Exported preset "${preset.name}"`);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          // Fallback to download
          downloadFallback(blob, `${preset.name}.tonalsync`);
        }
      }
    } else {
      // Fallback for browsers without File System Access API
      downloadFallback(blob, `${preset.name}.tonalsync`);
    }
  };

  const downloadFallback = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded preset file`);
  };

  const handleImportPreset = async () => {
    // Check if File System Access API is supported
    if ('showOpenFilePicker' in window) {
      try {
        const [handle] = await (window as any).showOpenFilePicker({
          types: [{
            description: 'Tonal Sync Preset',
            accept: { 'application/json': ['.tonalsync', '.json'] }
          }]
        });
        const file = await handle.getFile();
        const text = await file.text();
        const preset: PluginPreset = JSON.parse(text);
        
        if (preset.settings && preset.name) {
          setPresets([...presets.filter(p => p.name !== preset.name), preset]);
          handleLoadPreset(preset);
          toast.success(`Imported preset "${preset.name}"`);
        } else {
          toast.error("Invalid preset file");
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          toast.error("Failed to import preset");
        }
      }
    } else {
      // Fallback for browsers without File System Access API
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.tonalsync,.json';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          try {
            const text = await file.text();
            const preset: PluginPreset = JSON.parse(text);
            
            if (preset.settings && preset.name) {
              setPresets([...presets.filter(p => p.name !== preset.name), preset]);
              handleLoadPreset(preset);
              toast.success(`Imported preset "${preset.name}"`);
            } else {
              toast.error("Invalid preset file");
            }
          } catch {
            toast.error("Failed to import preset");
          }
        }
      };
      input.click();
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Preset buttons */}
      <div className="flex gap-2">
        {presets.slice(0, 4).map((preset) => (
          <button
            key={preset.name}
            onClick={() => handleLoadPreset(preset)}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-display uppercase",
              "border border-border bg-muted",
              "hover:border-primary/50 hover:bg-primary/10",
              "transition-all duration-200",
              selectedPreset === preset.name && "border-primary bg-primary/20 text-primary"
            )}
          >
            {preset.name}
          </button>
        ))}
      </div>

      {/* Save/Load Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <button
            className={cn(
              "p-2 rounded-lg border border-border bg-muted",
              "hover:border-primary/50 hover:bg-primary/10",
              "transition-all duration-200"
            )}
          >
            <Plus className="w-4 h-4" />
          </button>
        </DialogTrigger>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display text-primary">Preset Manager</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Save new preset */}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">
                Save Current Settings
              </label>
              <div className="flex gap-2">
                <Input
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  placeholder="Preset name..."
                  className="flex-1 bg-muted border-border"
                />
                <button
                  onClick={handleSavePreset}
                  className={cn(
                    "px-4 py-2 rounded-lg",
                    "bg-primary text-primary-foreground",
                    "hover:bg-primary/90 transition-colors"
                  )}
                >
                  <Save className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Preset list */}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">
                Saved Presets
              </label>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {presets.map((preset) => (
                  <div
                    key={preset.name}
                    className={cn(
                      "flex items-center justify-between p-2 rounded-lg",
                      "bg-muted/50 hover:bg-muted transition-colors",
                      selectedPreset === preset.name && "bg-primary/20 border border-primary/50"
                    )}
                  >
                    <button
                      onClick={() => handleLoadPreset(preset)}
                      className="flex-1 text-left font-display text-sm"
                    >
                      {preset.name}
                    </button>
                    {!DEFAULT_PRESETS.some(p => p.name === preset.name) && (
                      <button
                        onClick={() => handleDeletePreset(preset.name)}
                        className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Import/Export */}
            <div className="flex gap-2 pt-2 border-t border-border">
              <button
                onClick={handleImportPreset}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg",
                  "border border-border bg-muted",
                  "hover:border-primary/50 hover:bg-primary/10",
                  "transition-all duration-200 text-sm"
                )}
              >
                <Upload className="w-4 h-4" />
                Import
              </button>
              <button
                onClick={handleExportPreset}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg",
                  "border border-border bg-muted",
                  "hover:border-primary/50 hover:bg-primary/10",
                  "transition-all duration-200 text-sm"
                )}
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};