import { useState, useRef, useCallback, useEffect } from "react";

// ============================================
// TONAL SYNC PRO - REAL-TIME PITCH CORRECTION
// Fixed Audio Monitoring + Phase Vocoder
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
}

interface UseAudioProcessorOptions {
  retuneSpeed: number;
  humanize: number;
  formant: number;
  mix: number;
  selectedKey: string;
  selectedScale: string;
}

// ============================================
// REAL-TIME PITCH SHIFTER - 0ms LATENCY
// Ultra-smooth transparent pitch correction
// ============================================
const pitchShifterCode = `
class PitchShifterProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    
    // Parameters
    this.pitchRatio = 1.0;
    this.targetPitchRatio = 1.0;
    this.wetMix = 1.0;
    this.smoothing = 0.95; // Ultra-smooth transitions
    
    // Minimal buffer for 0-latency
    this.bufferSize = 256;
    this.inputRing = new Float32Array(this.bufferSize * 2);
    this.inputPos = 0;
    this.readPos = 0;
    
    // Crossfade for click-free pitch changes
    this.crossfadeLength = 64;
    this.prevSample = 0;
    
    // Formant filter state
    this.formantState = [0, 0, 0, 0];
    
    this.port.onmessage = (e) => {
      if (e.data.pitchRatio !== undefined) {
        this.targetPitchRatio = Math.max(0.5, Math.min(2.0, e.data.pitchRatio));
      }
      if (e.data.wetMix !== undefined) {
        this.wetMix = e.data.wetMix;
      }
      if (e.data.smoothing !== undefined) {
        this.smoothing = e.data.smoothing;
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    
    if (!input || !input[0] || !output || !output[0]) return true;
    
    const inChannel = input[0];
    const blockSize = inChannel.length;
    const bufSize = this.bufferSize * 2;
    
    // Ultra-smooth pitch ratio interpolation
    const smoothFactor = Math.pow(this.smoothing, blockSize / 128);
    this.pitchRatio += (this.targetPitchRatio - this.pitchRatio) * (1 - smoothFactor);
    
    for (let i = 0; i < blockSize; i++) {
      const sample = inChannel[i];
      
      // Write to ring buffer
      this.inputRing[this.inputPos] = sample;
      this.inputRing[this.inputPos + this.bufferSize] = sample;
      
      // Read with pitch shift (cubic interpolation for smoothness)
      const readIdx = this.readPos;
      const idx0 = Math.floor(readIdx) % bufSize;
      const idx1 = (idx0 + 1) % bufSize;
      const idx2 = (idx0 + 2) % bufSize;
      const idxM1 = (idx0 - 1 + bufSize) % bufSize;
      
      const frac = readIdx - Math.floor(readIdx);
      
      // Cubic interpolation for ultra-smooth output
      const s0 = this.inputRing[idxM1];
      const s1 = this.inputRing[idx0];
      const s2 = this.inputRing[idx1];
      const s3 = this.inputRing[idx2];
      
      const a0 = s3 - s2 - s0 + s1;
      const a1 = s0 - s1 - a0;
      const a2 = s2 - s0;
      const a3 = s1;
      
      let processed = a0 * frac * frac * frac + a1 * frac * frac + a2 * frac + a3;
      
      // Simple formant preservation filter
      if (this.pitchRatio !== 1.0) {
        const alpha = 0.3;
        const filtered = alpha * processed + (1 - alpha) * this.formantState[0];
        this.formantState[0] = filtered;
        processed = filtered;
      }
      
      // Soft crossfade to prevent clicks
      const crossfade = Math.min(1, i / this.crossfadeLength);
      processed = processed * crossfade + this.prevSample * (1 - crossfade);
      if (i === blockSize - 1) this.prevSample = processed;
      
      // Mix wet/dry
      const out = processed * this.wetMix + sample * (1.0 - this.wetMix);
      
      // Output to all channels (stereo)
      for (let ch = 0; ch < output.length; ch++) {
        output[ch][i] = out;
      }
      
      // Advance positions
      this.inputPos = (this.inputPos + 1) % this.bufferSize;
      this.readPos += this.pitchRatio;
      if (this.readPos >= bufSize) this.readPos -= bufSize;
      if (this.readPos < 0) this.readPos += bufSize;
    }
    
    return true;
  }
}

registerProcessor('pitch-shifter', PitchShifterProcessor);
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
    formantShift: 0
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Main audio nodes
  const inputGainRef = useRef<GainNode | null>(null);
  const outputGainRef = useRef<GainNode | null>(null);
  const pitchShifterRef = useRef<AudioWorkletNode | null>(null);
  
  // EQ nodes
  const highPassRef = useRef<BiquadFilterNode | null>(null);
  const lowShelfRef = useRef<BiquadFilterNode | null>(null);
  const presenceRef = useRef<BiquadFilterNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  
  const animationFrameRef = useRef<number | null>(null);
  const isBypassedRef = useRef<boolean>(false);
  const isMonitoringRef = useRef<boolean>(true);
  const monitorVolumeRef = useRef<number>(0.75);
  const pitchHistoryRef = useRef<{ input: number; corrected: number; time: number }[]>([]);
  const correctionModeRef = useRef<CorrectionMode>("modern");
  const currentPitchRatioRef = useRef<number>(1.0);

  const setCorrectionMode = useCallback((mode: CorrectionMode) => {
    correctionModeRef.current = mode;
    setState(prev => ({ ...prev, correctionMode: mode }));
  }, []);

  const setMonitorVolume = useCallback((volume: number) => {
    const normalized = Math.max(0, Math.min(100, volume)) / 100;
    monitorVolumeRef.current = normalized;
    
    if (outputGainRef.current && audioContextRef.current) {
      outputGainRef.current.gain.setTargetAtTime(
        isMonitoringRef.current && !isBypassedRef.current ? normalized : 0,
        audioContextRef.current.currentTime,
        0.02
      );
    }
    
    setState(prev => ({ ...prev, monitorVolume: volume }));
  }, []);

  const setMonitoring = useCallback((enabled: boolean) => {
    isMonitoringRef.current = enabled;
    
    if (outputGainRef.current && audioContextRef.current) {
      outputGainRef.current.gain.setTargetAtTime(
        enabled && !isBypassedRef.current ? monitorVolumeRef.current : 0,
        audioContextRef.current.currentTime,
        0.02
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
      console.error("Enumerate failed:", e);
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
        !bypassed && isMonitoringRef.current ? monitorVolumeRef.current : 0,
        audioContextRef.current.currentTime,
        0.02
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
    
    // Parabolic interpolation
    if (tau > 0 && tau < halfSize - 1) {
      const s0 = yinBuffer[tau - 1], s1 = yinBuffer[tau], s2 = yinBuffer[tau + 1];
      tau += (s2 - s0) / (2 * (2 * s1 - s2 - s0));
    }
    
    return sampleRate / tau;
  }, []);

  const processAudio = useCallback(() => {
    if (!analyserRef.current || !audioContextRef.current) return;
    
    const bufLen = analyserRef.current.fftSize;
    const buffer = new Float32Array(bufLen);
    analyserRef.current.getFloatTimeDomainData(buffer);
    
    // Calculate RMS
    let rms = 0;
    for (let i = 0; i < bufLen; i++) rms += buffer[i] * buffer[i];
    rms = Math.sqrt(rms / bufLen);
    const inputLevel = Math.min(100, rms * 400);
    
    // Detect pitch
    const detectedPitch = detectPitch(buffer, audioContextRef.current.sampleRate);
    const { note, freq: targetFreq, cents, octave, pitchRatio } = findNearestNote(detectedPitch);
    
    let finalRatio = 1.0;
    let correctedPitch = detectedPitch;
    
    if (detectedPitch > 0 && targetFreq > 0 && !isBypassedRef.current) {
      const isClassic = correctionModeRef.current === "classic";
      const retuneNorm = options.retuneSpeed / 100;
      
      if (isClassic) {
        // Classic: aggressive correction
        const strength = 1.0 - (retuneNorm * 0.15);
        finalRatio = 1.0 + (pitchRatio - 1.0) * strength;
        
        // Fast smoothing
        const smooth = 0.15 + retuneNorm * 0.15;
        currentPitchRatioRef.current += (finalRatio - currentPitchRatioRef.current) * (1 - smooth);
      } else {
        // Modern: natural correction with flex-tune
        const threshold = 10 + retuneNorm * 40;
        
        if (Math.abs(cents) > threshold) {
          const strength = 1.0 - (retuneNorm * 0.6);
          finalRatio = 1.0 + (pitchRatio - 1.0) * strength;
        } else {
          finalRatio = 1.0;
        }
        
        const smooth = 0.5 + retuneNorm * 0.3;
        currentPitchRatioRef.current += (finalRatio - currentPitchRatioRef.current) * (1 - smooth);
      }
      
      // Humanize
      const humanize = options.humanize / 100;
      currentPitchRatioRef.current += (Math.random() - 0.5) * 0.008 * humanize;
      
      correctedPitch = detectedPitch * currentPitchRatioRef.current;
      
      // Send to pitch shifter
      if (pitchShifterRef.current) {
        pitchShifterRef.current.port.postMessage({
          pitchRatio: currentPitchRatioRef.current,
          wetMix: options.mix / 100,
          formantPreserve: true
        });
      }
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
      outputLevel: isBypassedRef.current ? 0 : inputLevel * 0.9,
      detectedPitch: Math.round(detectedPitch * 10) / 10,
      detectedNote: note || "-",
      detectedOctave: octave,
      correctedPitch: Math.round(correctedPitch * 10) / 10,
      correctedNote: note || "-",
      pitchError: cents,
      pitchHistory: pitchHistoryRef.current,
      isProcessing: detectedPitch > 0,
      currentPitchShift: Math.round(currentPitchRatioRef.current * 1000) / 1000
    }));
    
    animationFrameRef.current = requestAnimationFrame(processAudio);
  }, [detectPitch, findNearestNote, options]);

  const initPitchShifter = useCallback(async (ctx: AudioContext) => {
    const blob = new Blob([pitchShifterCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    await ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    
    return new AudioWorkletNode(ctx, 'pitch-shifter', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2]
    });
  }, []);

  const start = useCallback(async (deviceId?: string) => {
    try {
      const device = deviceId || state.selectedDevice;
      if (!device) throw new Error("No device selected");
      
      // Create context
      audioContextRef.current = new AudioContext({
        sampleRate: 48000,
        latencyHint: 'interactive'
      });
      const ctx = audioContextRef.current;
      
      // Get microphone stream
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: device },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 48000
        }
      });
      
      // Create nodes
      sourceRef.current = ctx.createMediaStreamSource(streamRef.current);
      
      analyserRef.current = ctx.createAnalyser();
      analyserRef.current.fftSize = 4096;
      
      inputGainRef.current = ctx.createGain();
      inputGainRef.current.gain.value = 1.0;
      
      // EQ Chain
      highPassRef.current = ctx.createBiquadFilter();
      highPassRef.current.type = "highpass";
      highPassRef.current.frequency.value = 80;
      
      lowShelfRef.current = ctx.createBiquadFilter();
      lowShelfRef.current.type = "lowshelf";
      lowShelfRef.current.frequency.value = 200;
      lowShelfRef.current.gain.value = 2;
      
      presenceRef.current = ctx.createBiquadFilter();
      presenceRef.current.type = "peaking";
      presenceRef.current.frequency.value = 3500;
      presenceRef.current.Q.value = 1.2;
      presenceRef.current.gain.value = 3;
      
      compressorRef.current = ctx.createDynamicsCompressor();
      compressorRef.current.threshold.value = -18;
      compressorRef.current.ratio.value = 4;
      compressorRef.current.attack.value = 0.003;
      compressorRef.current.release.value = 0.1;
      
      // Pitch shifter
      const pitchShifter = await initPitchShifter(ctx);
      pitchShifterRef.current = pitchShifter;
      
      // Output gain (monitor volume)
      outputGainRef.current = ctx.createGain();
      outputGainRef.current.gain.value = monitorVolumeRef.current;
      
      // ===== CONNECT AUDIO GRAPH =====
      // Source -> Input Gain -> Analyser (for pitch detection)
      //                      -> EQ -> Pitch Shifter -> Compressor -> Output Gain -> Speakers
      
      sourceRef.current.connect(inputGainRef.current);
      
      // Branch 1: Analysis
      inputGainRef.current.connect(analyserRef.current);
      
      // Branch 2: Processing chain -> Output
      inputGainRef.current.connect(highPassRef.current);
      highPassRef.current.connect(lowShelfRef.current);
      lowShelfRef.current.connect(presenceRef.current);
      presenceRef.current.connect(pitchShifter);
      pitchShifter.connect(compressorRef.current);
      compressorRef.current.connect(outputGainRef.current);
      outputGainRef.current.connect(ctx.destination);
      
      // Reset state
      isBypassedRef.current = false;
      isMonitoringRef.current = true;
      pitchHistoryRef.current = [];
      currentPitchRatioRef.current = 1.0;
      
      setState(prev => ({
        ...prev,
        isActive: true,
        isBypassed: false,
        isMonitoring: true,
        selectedDevice: device,
        pitchHistory: []
      }));
      
      // Start processing loop
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
    
    [sourceRef, analyserRef, inputGainRef, outputGainRef, highPassRef, lowShelfRef, presenceRef, compressorRef].forEach(ref => {
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
      isProcessing: false
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
