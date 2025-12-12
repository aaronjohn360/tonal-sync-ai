import { useState, useRef, useCallback, useEffect } from "react";

// ============================================
// TONAL SYNC PRO - NATURAL RAW VOCAL AUTOTUNE
// Industry Standard Output Levels
// ============================================

const NOTE_FREQUENCIES: { [key: string]: number } = {
  "C": 261.63, "C#": 277.18, "D": 293.66, "D#": 311.13,
  "E": 329.63, "F": 349.23, "F#": 369.99, "G": 392.00,
  "G#": 415.30, "A": 440.00, "A#": 466.16, "B": 493.88
};

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const SCALE_PATTERNS: { [key: string]: number[] } = {
  "Major": [0, 2, 4, 5, 7, 9, 11],
  "Minor": [0, 2, 3, 5, 7, 8, 10],
  "Chromatic": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  "Pentatonic": [0, 2, 4, 7, 9],
  "Blues": [0, 3, 5, 6, 7, 10],
  "Dorian": [0, 2, 3, 5, 7, 9, 10],
  "Mixolydian": [0, 2, 4, 5, 7, 9, 10]
};

export interface AudioDevice {
  deviceId: string;
  label: string;
}

export type CorrectionMode = "modern" | "classic";

interface AudioProcessorState {
  isActive: boolean;
  isBypassed: boolean;
  inputLevel: number;
  outputLevel: number;
  detectedPitch: number;
  detectedNote: string;
  detectedOctave: number;
  correctedPitch: number;
  correctedNote: string;
  pitchError: number;
  availableDevices: AudioDevice[];
  selectedDevice: string | null;
  pitchHistory: { input: number; corrected: number; time: number }[];
  monitorVolume: number;
  isMonitoring: boolean;
  correctionMode: CorrectionMode;
  isProcessing: boolean;
  currentPitchShift: number;
  formantShift: number;
  activeNotes: string[];
}

interface UseAudioProcessorOptions {
  retuneSpeed: number;
  humanize: number;
  formant: number;
  mix: number;
  selectedKey: string;
  selectedScale: string;
  // Vibrato settings
  vibratoDepth?: number;
  vibratoRate?: number;
  vibratoDelay?: number;
  vibratoOnset?: number;
}

// ============================================
// NATURAL RAW VOCAL PITCH SHIFTER
// Minimal processing for authentic sound
// Industry standard output levels
// ============================================
const naturalPitchShifterCode = `
class NaturalPitchShifterProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    
    // Pitch shifting
    this.pitchRatio = 1.0;
    this.targetRatio = 1.0;
    this.wetMix = 1.0;
    
    // Vibrato LFO
    this.vibratoDepth = 0;      // 0-100 cents
    this.vibratoRate = 5.5;     // Hz
    this.vibratoPhase = 0;
    this.vibratoDelay = 0.3;    // seconds before vibrato starts
    this.vibratoOnset = 0.1;    // seconds to fade in vibrato
    this.noteStartTime = 0;
    this.currentTime = 0;
    
    // WSOLA granular synthesis - larger grains for natural sound
    this.grainSize = 2048;      // Larger for smoother, more natural sound
    this.hopSize = 512;         // 75% overlap
    this.numGrains = 4;
    
    // Buffers
    this.inputBuffer = new Float32Array(this.grainSize * 4);
    this.inputWritePos = 0;
    this.grainReadPos = new Float32Array(this.numGrains);
    this.grainPhase = new Float32Array(this.numGrains);
    
    // Initialize grains
    for (let i = 0; i < this.numGrains; i++) {
      this.grainPhase[i] = i / this.numGrains;
      this.grainReadPos[i] = 0;
    }
    
    // Hanning window
    this.window = new Float32Array(this.grainSize);
    for (let i = 0; i < this.grainSize; i++) {
      this.window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / this.grainSize));
    }
    
    // Output gain for industry standard levels (+6dB boost)
    this.outputGain = 2.0;
    
    // Minimal smoothing to preserve transients
    this.smoothingCoef = 0.98;
    
    this.port.onmessage = (e) => {
      if (e.data.pitchRatio !== undefined) {
        this.targetRatio = Math.max(0.5, Math.min(2.0, e.data.pitchRatio));
      }
      if (e.data.wetMix !== undefined) {
        this.wetMix = Math.max(0, Math.min(1, e.data.wetMix));
      }
      if (e.data.vibratoDepth !== undefined) {
        this.vibratoDepth = e.data.vibratoDepth;
      }
      if (e.data.vibratoRate !== undefined) {
        this.vibratoRate = e.data.vibratoRate;
      }
      if (e.data.vibratoDelay !== undefined) {
        this.vibratoDelay = e.data.vibratoDelay;
      }
      if (e.data.vibratoOnset !== undefined) {
        this.vibratoOnset = e.data.vibratoOnset;
      }
      if (e.data.outputGain !== undefined) {
        this.outputGain = e.data.outputGain;
      }
      if (e.data.noteStart !== undefined) {
        this.noteStartTime = this.currentTime;
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    
    if (!input || !input[0] || !output || !output[0]) return true;
    
    const inChannel = input[0];
    const blockSize = inChannel.length;
    const bufSize = this.inputBuffer.length;
    
    // Smooth pitch ratio (preserve some natural variation)
    this.pitchRatio += (this.targetRatio - this.pitchRatio) * 0.05;
    
    // Update time
    this.currentTime += blockSize / sampleRate;
    
    for (let i = 0; i < blockSize; i++) {
      const inputSample = inChannel[i];
      
      // Write to buffer
      this.inputBuffer[this.inputWritePos] = inputSample;
      this.inputWritePos = (this.inputWritePos + 1) % bufSize;
      
      // Calculate vibrato modulation
      let vibratoMod = 0;
      if (this.vibratoDepth > 0) {
        const timeSinceNote = this.currentTime - this.noteStartTime;
        if (timeSinceNote > this.vibratoDelay) {
          // Fade in vibrato
          const fadeIn = Math.min(1, (timeSinceNote - this.vibratoDelay) / this.vibratoOnset);
          // LFO
          this.vibratoPhase += this.vibratoRate / sampleRate;
          if (this.vibratoPhase > 1) this.vibratoPhase -= 1;
          const lfo = Math.sin(2 * Math.PI * this.vibratoPhase);
          // Convert cents to ratio
          vibratoMod = fadeIn * this.vibratoDepth * lfo * 0.0006; // cents to ratio
        }
      }
      
      const effectiveRatio = this.pitchRatio * (1 + vibratoMod);
      
      // Granular synthesis
      let outputSample = 0;
      let totalWeight = 0;
      
      for (let g = 0; g < this.numGrains; g++) {
        const phase = this.grainPhase[g];
        const grainIndex = Math.floor(phase * this.grainSize);
        const windowVal = this.window[grainIndex];
        
        const readPos = this.grainReadPos[g];
        const readIdx = Math.floor(readPos) % bufSize;
        const readFrac = readPos - Math.floor(readPos);
        
        // Linear interpolation
        const s0 = this.inputBuffer[readIdx];
        const s1 = this.inputBuffer[(readIdx + 1) % bufSize];
        const sample = s0 + readFrac * (s1 - s0);
        
        outputSample += sample * windowVal;
        totalWeight += windowVal;
        
        // Advance grain
        this.grainPhase[g] += 1.0 / this.grainSize;
        if (this.grainPhase[g] >= 1.0) {
          this.grainPhase[g] = 0;
          this.grainReadPos[g] = this.inputWritePos - this.grainSize;
          if (this.grainReadPos[g] < 0) this.grainReadPos[g] += bufSize;
        }
        
        this.grainReadPos[g] += effectiveRatio;
        if (this.grainReadPos[g] >= bufSize) this.grainReadPos[g] -= bufSize;
        if (this.grainReadPos[g] < 0) this.grainReadPos[g] += bufSize;
      }
      
      if (totalWeight > 0) {
        outputSample /= totalWeight;
      }
      
      // Mix wet/dry and apply output gain
      const mixed = (outputSample * this.wetMix + inputSample * (1.0 - this.wetMix)) * this.outputGain;
      
      // Soft clip to prevent harsh distortion
      let finalSample = mixed;
      if (Math.abs(finalSample) > 1.0) {
        finalSample = Math.sign(finalSample) * (1 - Math.exp(-Math.abs(finalSample)));
      }
      
      // Output to all channels
      for (let ch = 0; ch < output.length; ch++) {
        output[ch][i] = finalSample;
      }
    }
    
    return true;
  }
}

registerProcessor('natural-pitch-shifter', NaturalPitchShifterProcessor);
`;

export const useAudioProcessor = (options: UseAudioProcessorOptions) => {
  const [state, setState] = useState<AudioProcessorState>({
    isActive: false,
    isBypassed: false,
    inputLevel: 0,
    outputLevel: 0,
    detectedPitch: 0,
    detectedNote: "-",
    detectedOctave: 4,
    correctedPitch: 0,
    correctedNote: "-",
    pitchError: 0,
    availableDevices: [],
    selectedDevice: null,
    pitchHistory: [],
    monitorVolume: 75,
    isMonitoring: true,
    correctionMode: "modern",
    isProcessing: false,
    currentPitchShift: 1.0,
    formantShift: 0,
    activeNotes: []
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserInputRef = useRef<AnalyserNode | null>(null);
  const analyserOutputRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Audio nodes
  const inputGainRef = useRef<GainNode | null>(null);
  const outputGainRef = useRef<GainNode | null>(null);
  const pitchShifterRef = useRef<AudioWorkletNode | null>(null);
  
  // Minimal EQ - only 15% processing
  const highPassRef = useRef<BiquadFilterNode | null>(null);
  const makeupGainRef = useRef<GainNode | null>(null);
  
  const animationFrameRef = useRef<number | null>(null);
  const isBypassedRef = useRef<boolean>(false);
  const isMonitoringRef = useRef<boolean>(true);
  const monitorVolumeRef = useRef<number>(0.75);
  const pitchHistoryRef = useRef<{ input: number; corrected: number; time: number }[]>([]);
  const correctionModeRef = useRef<CorrectionMode>("modern");
  const currentPitchRatioRef = useRef<number>(1.0);
  const activeNotesRef = useRef<string[]>([]);
  const lastNoteRef = useRef<string>("-");

  const setCorrectionMode = useCallback((mode: CorrectionMode) => {
    correctionModeRef.current = mode;
    setState(prev => ({ ...prev, correctionMode: mode }));
  }, []);

  const setMonitorVolume = useCallback((volume: number) => {
    const normalized = Math.max(0, Math.min(100, volume)) / 100;
    monitorVolumeRef.current = normalized;
    
    if (outputGainRef.current && audioContextRef.current) {
      // Industry standard: full volume monitoring
      outputGainRef.current.gain.setTargetAtTime(
        isMonitoringRef.current && !isBypassedRef.current ? normalized * 1.5 : 0, // Boost monitor
        audioContextRef.current.currentTime,
        0.05
      );
    }
    
    setState(prev => ({ ...prev, monitorVolume: volume }));
  }, []);

  const setMonitoring = useCallback((enabled: boolean) => {
    isMonitoringRef.current = enabled;
    
    if (outputGainRef.current && audioContextRef.current) {
      outputGainRef.current.gain.setTargetAtTime(
        enabled && !isBypassedRef.current ? monitorVolumeRef.current * 1.5 : 0,
        audioContextRef.current.currentTime,
        0.05
      );
    }
    
    setState(prev => ({ ...prev, isMonitoring: enabled }));
  }, []);

  const enumerateDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices
        .filter(d => d.kind === 'audioinput')
        .map(d => ({ deviceId: d.deviceId, label: d.label || `Mic ${d.deviceId.slice(0, 8)}` }));
      
      setState(prev => ({
        ...prev,
        availableDevices: inputs,
        selectedDevice: prev.selectedDevice || inputs[0]?.deviceId || null
      }));
      return inputs;
    } catch (e) {
      return [];
    }
  }, []);

  const requestPermissionAndEnumerate = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      return await enumerateDevices();
    } catch (e) {
      throw e;
    }
  }, [enumerateDevices]);

  const selectDevice = useCallback((deviceId: string | null) => {
    setState(prev => ({ ...prev, selectedDevice: deviceId }));
  }, []);

  const setBypass = useCallback((bypassed: boolean) => {
    isBypassedRef.current = bypassed;
    
    if (pitchShifterRef.current) {
      pitchShifterRef.current.port.postMessage({ 
        pitchRatio: bypassed ? 1.0 : currentPitchRatioRef.current,
        wetMix: bypassed ? 0.0 : options.mix / 100
      });
    }
    
    if (outputGainRef.current && audioContextRef.current) {
      outputGainRef.current.gain.setTargetAtTime(
        isMonitoringRef.current ? monitorVolumeRef.current * 1.5 : 0,
        audioContextRef.current.currentTime,
        0.05
      );
    }
    
    setState(prev => ({ ...prev, isBypassed: bypassed }));
  }, [options.mix]);

  const getScaleNotes = useCallback(() => {
    const keyIdx = NOTES.indexOf(options.selectedKey);
    const pattern = SCALE_PATTERNS[options.selectedScale] || SCALE_PATTERNS["Chromatic"];
    return pattern.map(s => NOTES[(keyIdx + s) % 12]);
  }, [options.selectedKey, options.selectedScale]);

  const getScaleFrequencies = useCallback(() => {
    const notes = getScaleNotes();
    const freqs: { note: string; freq: number; octave: number }[] = [];
    for (let oct = 1; oct <= 7; oct++) {
      for (const note of notes) {
        freqs.push({ note, freq: NOTE_FREQUENCIES[note] * Math.pow(2, oct - 4), octave: oct });
      }
    }
    return freqs.sort((a, b) => a.freq - b.freq);
  }, [getScaleNotes]);

  const findNearestNote = useCallback((freq: number) => {
    if (freq <= 0 || freq < 60 || freq > 1500) {
      return { note: "-", freq: 0, cents: 0, octave: 0, pitchRatio: 1.0 };
    }
    
    const scaleFreqs = getScaleFrequencies();
    let nearest = { note: "", freq: 0, cents: Infinity, octave: 0 };
    
    for (const { note, freq: f, octave } of scaleFreqs) {
      const cents = 1200 * Math.log2(freq / f);
      if (Math.abs(cents) < Math.abs(nearest.cents)) {
        nearest = { note, freq: f, cents: Math.round(cents), octave };
      }
    }
    
    return { ...nearest, pitchRatio: nearest.freq / freq };
  }, [getScaleFrequencies]);

  // YIN pitch detection
  const detectPitch = useCallback((buffer: Float32Array, sampleRate: number): number => {
    const size = buffer.length;
    const halfSize = Math.floor(size / 2);
    const yinBuffer = new Float32Array(halfSize);
    
    let sum = 0;
    yinBuffer[0] = 1;
    
    for (let tau = 1; tau < halfSize; tau++) {
      yinBuffer[tau] = 0;
      for (let j = 0; j < halfSize; j++) {
        const delta = buffer[j] - buffer[j + tau];
        yinBuffer[tau] += delta * delta;
      }
      sum += yinBuffer[tau];
      yinBuffer[tau] = sum === 0 ? 1 : yinBuffer[tau] * tau / sum;
    }
    
    let tau = 2;
    while (tau < halfSize) {
      if (yinBuffer[tau] < 0.1) {
        while (tau + 1 < halfSize && yinBuffer[tau + 1] < yinBuffer[tau]) tau++;
        break;
      }
      tau++;
    }
    
    if (tau === halfSize || yinBuffer[tau] >= 0.1) return 0;
    
    if (tau > 0 && tau < halfSize - 1) {
      const s0 = yinBuffer[tau - 1], s1 = yinBuffer[tau], s2 = yinBuffer[tau + 1];
      tau += (s2 - s0) / (2 * (2 * s1 - s2 - s0));
    }
    
    return sampleRate / tau;
  }, []);

  const calcRMS = (buf: Float32Array): number => {
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length);
  };

  // Main processing loop
  const processAudio = useCallback(() => {
    if (!analyserInputRef.current || !audioContextRef.current) return;
    
    const bufLen = analyserInputRef.current.fftSize;
    const buffer = new Float32Array(bufLen);
    analyserInputRef.current.getFloatTimeDomainData(buffer);
    
    const rms = calcRMS(buffer);
    const inputLevel = Math.min(100, rms * 600); // Boosted meter sensitivity
    
    // Output level
    let outputLevel = 0;
    if (analyserOutputRef.current) {
      const outBuf = new Float32Array(analyserOutputRef.current.fftSize);
      analyserOutputRef.current.getFloatTimeDomainData(outBuf);
      outputLevel = Math.min(100, calcRMS(outBuf) * 600);
    }
    
    // Pitch detection
    const detectedPitch = detectPitch(buffer, audioContextRef.current.sampleRate);
    const { note, freq: targetFreq, cents, octave, pitchRatio } = findNearestNote(detectedPitch);
    
    // Track notes for piano
    if (note !== "-" && note !== activeNotesRef.current[0]) {
      activeNotesRef.current = [note, ...activeNotesRef.current.slice(0, 4)];
      
      // Trigger note start for vibrato
      if (note !== lastNoteRef.current && pitchShifterRef.current) {
        pitchShifterRef.current.port.postMessage({ noteStart: true });
        lastNoteRef.current = note;
      }
    }
    
    let finalRatio = 1.0;
    let correctedPitch = detectedPitch;
    
    if (detectedPitch > 0 && targetFreq > 0 && !isBypassedRef.current) {
      const isClassic = correctionModeRef.current === "classic";
      const retuneNorm = options.retuneSpeed / 100;
      
      if (isClassic) {
        // Classic: hard correction
        const strength = 1.0 - (retuneNorm * 0.1);
        finalRatio = 1.0 + (pitchRatio - 1.0) * strength;
        const smooth = 0.08 + retuneNorm * 0.08;
        currentPitchRatioRef.current += (finalRatio - currentPitchRatioRef.current) * (1 - smooth);
      } else {
        // Modern: natural correction
        const threshold = 8 + retuneNorm * 35;
        if (Math.abs(cents) > threshold) {
          const strength = 1.0 - (retuneNorm * 0.4);
          finalRatio = 1.0 + (pitchRatio - 1.0) * strength;
        } else {
          finalRatio = 1.0;
        }
        const smooth = 0.3 + retuneNorm * 0.3;
        currentPitchRatioRef.current += (finalRatio - currentPitchRatioRef.current) * (1 - smooth);
      }
      
      // Humanize
      const humanize = options.humanize / 100;
      currentPitchRatioRef.current += (Math.random() - 0.5) * 0.004 * humanize;
      
      correctedPitch = detectedPitch * currentPitchRatioRef.current;
      
      // Send to pitch shifter with vibrato settings
      if (pitchShifterRef.current) {
        pitchShifterRef.current.port.postMessage({
          pitchRatio: currentPitchRatioRef.current,
          wetMix: options.mix / 100,
          vibratoDepth: options.vibratoDepth || 0,
          vibratoRate: options.vibratoRate || 5.5,
          vibratoDelay: (options.vibratoDelay || 30) / 100,
          vibratoOnset: (options.vibratoOnset || 10) / 100,
          outputGain: 2.0 // Industry standard boost
        });
      }
    } else if (pitchShifterRef.current) {
      pitchShifterRef.current.port.postMessage({
        pitchRatio: 1.0,
        wetMix: isBypassedRef.current ? 0.0 : options.mix / 100,
        outputGain: 2.0
      });
    }
    
    // Update history
    const now = Date.now();
    pitchHistoryRef.current = [
      ...pitchHistoryRef.current.filter(p => now - p.time < 5000),
      { 
        input: detectedPitch || pitchHistoryRef.current[pitchHistoryRef.current.length - 1]?.input || 0,
        corrected: correctedPitch || pitchHistoryRef.current[pitchHistoryRef.current.length - 1]?.corrected || 0,
        time: now 
      }
    ].slice(-300);
    
    setState(prev => ({
      ...prev,
      inputLevel,
      outputLevel: isBypassedRef.current ? inputLevel : outputLevel,
      detectedPitch: Math.round(detectedPitch * 10) / 10,
      detectedNote: note || "-",
      detectedOctave: octave,
      correctedPitch: Math.round(correctedPitch * 10) / 10,
      correctedNote: note || "-",
      pitchError: cents,
      pitchHistory: pitchHistoryRef.current,
      isProcessing: detectedPitch > 0,
      currentPitchShift: Math.round(currentPitchRatioRef.current * 1000) / 1000,
      activeNotes: [...activeNotesRef.current]
    }));
    
    animationFrameRef.current = requestAnimationFrame(processAudio);
  }, [detectPitch, findNearestNote, options]);

  const initPitchShifter = useCallback(async (ctx: AudioContext) => {
    const blob = new Blob([naturalPitchShifterCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    await ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    
    return new AudioWorkletNode(ctx, 'natural-pitch-shifter', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2]
    });
  }, []);

  const start = useCallback(async (deviceId?: string) => {
    try {
      const device = deviceId || state.selectedDevice;
      if (!device) throw new Error("No device selected");
      
      audioContextRef.current = new AudioContext({
        sampleRate: 48000,
        latencyHint: 'interactive'
      });
      const ctx = audioContextRef.current;
      
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: device },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 48000
        }
      });
      
      sourceRef.current = ctx.createMediaStreamSource(streamRef.current);
      
      // Input analyser
      analyserInputRef.current = ctx.createAnalyser();
      analyserInputRef.current.fftSize = 4096;
      analyserInputRef.current.smoothingTimeConstant = 0.5;
      
      // Output analyser
      analyserOutputRef.current = ctx.createAnalyser();
      analyserOutputRef.current.fftSize = 2048;
      analyserOutputRef.current.smoothingTimeConstant = 0.5;
      
      // Input gain
      inputGainRef.current = ctx.createGain();
      inputGainRef.current.gain.value = 1.0;
      
      // MINIMAL EQ - Only 15% processing (just essential cleanup)
      // Only remove sub-bass rumble, nothing else
      highPassRef.current = ctx.createBiquadFilter();
      highPassRef.current.type = "highpass";
      highPassRef.current.frequency.value = 60; // Lower cutoff for more natural sound
      highPassRef.current.Q.value = 0.5; // Gentle slope
      
      // Pitch shifter
      const pitchShifter = await initPitchShifter(ctx);
      pitchShifterRef.current = pitchShifter;
      
      // Makeup gain for industry standard levels
      makeupGainRef.current = ctx.createGain();
      makeupGainRef.current.gain.value = 1.5; // +3.5dB makeup
      
      // Output gain
      outputGainRef.current = ctx.createGain();
      outputGainRef.current.gain.value = monitorVolumeRef.current * 1.5; // Boosted output
      
      // Connect: Source -> Input Gain -> (Analyser) -> HighPass -> PitchShifter -> MakeupGain -> OutputAnalyser -> OutputGain -> Destination
      // This is 85% pitch correction, 15% EQ (just the high-pass)
      
      sourceRef.current.connect(inputGainRef.current);
      inputGainRef.current.connect(analyserInputRef.current);
      inputGainRef.current.connect(highPassRef.current);
      highPassRef.current.connect(pitchShifter);
      pitchShifter.connect(makeupGainRef.current);
      makeupGainRef.current.connect(analyserOutputRef.current);
      analyserOutputRef.current.connect(outputGainRef.current);
      outputGainRef.current.connect(ctx.destination);
      
      // Reset
      isBypassedRef.current = false;
      isMonitoringRef.current = true;
      pitchHistoryRef.current = [];
      currentPitchRatioRef.current = 1.0;
      activeNotesRef.current = [];
      lastNoteRef.current = "-";
      
      setState(prev => ({
        ...prev,
        isActive: true,
        isBypassed: false,
        isMonitoring: true,
        selectedDevice: device,
        pitchHistory: [],
        activeNotes: []
      }));
      
      processAudio();
      
    } catch (e) {
      console.error("Failed to start:", e);
      throw e;
    }
  }, [state.selectedDevice, initPitchShifter, processAudio]);

  const stop = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    [sourceRef, analyserInputRef, analyserOutputRef, inputGainRef, outputGainRef, highPassRef, makeupGainRef].forEach(ref => {
      if (ref.current) {
        try { ref.current.disconnect(); } catch (e) {}
        ref.current = null;
      }
    });
    
    if (pitchShifterRef.current) {
      try { pitchShifterRef.current.disconnect(); } catch (e) {}
      pitchShifterRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    setState(prev => ({
      ...prev,
      isActive: false,
      isBypassed: false,
      isMonitoring: false,
      inputLevel: 0,
      outputLevel: 0,
      detectedPitch: 0,
      detectedNote: "-",
      correctedPitch: 0,
      correctedNote: "-",
      pitchError: 0,
      pitchHistory: [],
      isProcessing: false,
      activeNotes: []
    }));
  }, []);

  useEffect(() => {
    return () => { stop(); };
  }, [stop]);

  useEffect(() => {
    const handler = () => { enumerateDevices(); };
    navigator.mediaDevices.addEventListener('devicechange', handler);
    return () => navigator.mediaDevices.removeEventListener('devicechange', handler);
  }, [enumerateDevices]);

  return {
    ...state,
    start,
    stop,
    toggle: state.isActive ? stop : start,
    enumerateDevices,
    requestPermissionAndEnumerate,
    selectDevice,
    setBypass,
    setMonitorVolume,
    setMonitoring,
    setCorrectionMode
  };
};
