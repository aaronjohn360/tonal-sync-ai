import { useState, useRef, useCallback, useEffect } from "react";

// Note frequencies for pitch detection (A4 = 440Hz standard)
const NOTE_FREQUENCIES: { [key: string]: number } = {
  "C": 261.63, "C#": 277.18, "D": 293.66, "D#": 311.13,
  "E": 329.63, "F": 349.23, "F#": 369.99, "G": 392.00,
  "G#": 415.30, "A": 440.00, "A#": 466.16, "B": 493.88
};

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// Scale patterns (semitones from root)
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
  pitchError: number; // in cents
  availableDevices: AudioDevice[];
  selectedDevice: string | null;
  pitchHistory: { input: number; corrected: number; time: number }[];
  monitorVolume: number;
  isMonitoring: boolean;
  correctionMode: CorrectionMode;
  isProcessing: boolean;
}

interface UseAudioProcessorOptions {
  retuneSpeed: number; // 0-100: 0 = instant (T-Pain), 100 = slow/natural
  humanize: number;
  formant: number;
  mix: number;
  selectedKey: string;
  selectedScale: string;
}

// AudioWorklet processor code for real-time pitch shifting
const pitchShifterWorkletCode = `
class PitchShifterProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.pitchRatio = 1.0;
    this.grainSize = 512;
    this.overlap = 4;
    this.buffer = new Float32Array(this.grainSize * 2);
    this.bufferIndex = 0;
    this.outputBuffer = new Float32Array(this.grainSize * 2);
    this.outputIndex = 0;
    this.phase = 0;
    
    this.port.onmessage = (event) => {
      if (event.data.pitchRatio !== undefined) {
        this.pitchRatio = event.data.pitchRatio;
      }
    };
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    
    if (!input || !input[0] || !output || !output[0]) return true;
    
    const inputChannel = input[0];
    const outputChannel = output[0];
    
    for (let i = 0; i < inputChannel.length; i++) {
      // Store input in circular buffer
      this.buffer[this.bufferIndex] = inputChannel[i];
      this.buffer[this.bufferIndex + this.grainSize] = inputChannel[i];
      
      // Read from buffer with pitch-shifted index
      const readIndex = this.phase;
      const intIndex = Math.floor(readIndex) % this.grainSize;
      const frac = readIndex - Math.floor(readIndex);
      
      // Linear interpolation
      const sample1 = this.buffer[intIndex];
      const sample2 = this.buffer[(intIndex + 1) % this.grainSize];
      outputChannel[i] = sample1 + frac * (sample2 - sample1);
      
      // Advance phase based on pitch ratio
      this.phase += this.pitchRatio;
      if (this.phase >= this.grainSize) {
        this.phase -= this.grainSize;
      }
      
      this.bufferIndex = (this.bufferIndex + 1) % this.grainSize;
    }
    
    return true;
  }
}

registerProcessor('pitch-shifter-processor', PitchShifterProcessor);
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
    isProcessing: false
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Audio processing chain nodes
  const inputGainRef = useRef<GainNode | null>(null);
  const monitorGainRef = useRef<GainNode | null>(null);
  const outputGainRef = useRef<GainNode | null>(null);
  const dryGainRef = useRef<GainNode | null>(null);
  const wetGainRef = useRef<GainNode | null>(null);
  
  // Pitch shifting nodes
  const pitchShifterNodeRef = useRef<AudioWorkletNode | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  
  // HQ Audio Processing Nodes
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const highPassRef = useRef<BiquadFilterNode | null>(null);
  const lowPassRef = useRef<BiquadFilterNode | null>(null);
  const presenceBoostRef = useRef<BiquadFilterNode | null>(null);
  const airBoostRef = useRef<BiquadFilterNode | null>(null);
  const warmthRef = useRef<BiquadFilterNode | null>(null);
  const clarityBoostRef = useRef<BiquadFilterNode | null>(null);
  const deEsserRef = useRef<BiquadFilterNode | null>(null);
  
  const animationFrameRef = useRef<number | null>(null);
  const isBypassedRef = useRef<boolean>(false);
  const isMonitoringRef = useRef<boolean>(true);
  const monitorVolumeRef = useRef<number>(0.75);
  const pitchHistoryRef = useRef<{ input: number; corrected: number; time: number }[]>([]);
  const correctionModeRef = useRef<CorrectionMode>("modern");
  
  // Pitch correction state
  const currentPitchRatioRef = useRef<number>(1.0);
  const targetPitchRatioRef = useRef<number>(1.0);
  const smoothedPitchRef = useRef<number>(0);

  // Set correction mode
  const setCorrectionMode = useCallback((mode: CorrectionMode) => {
    correctionModeRef.current = mode;
    setState(prev => ({ ...prev, correctionMode: mode }));
  }, []);

  // Set monitor volume (0-100)
  const setMonitorVolume = useCallback((volume: number) => {
    const normalizedVolume = Math.max(0, Math.min(100, volume)) / 100;
    monitorVolumeRef.current = normalizedVolume;
    
    if (monitorGainRef.current && isMonitoringRef.current && !isBypassedRef.current) {
      monitorGainRef.current.gain.setTargetAtTime(normalizedVolume, audioContextRef.current?.currentTime || 0, 0.02);
    }
    
    setState(prev => ({ ...prev, monitorVolume: volume }));
  }, []);

  // Toggle monitoring
  const setMonitoring = useCallback((enabled: boolean) => {
    isMonitoringRef.current = enabled;
    
    if (monitorGainRef.current) {
      const volume = enabled && !isBypassedRef.current ? monitorVolumeRef.current : 0;
      monitorGainRef.current.gain.setTargetAtTime(volume, audioContextRef.current?.currentTime || 0, 0.02);
    }
    
    setState(prev => ({ ...prev, isMonitoring: enabled }));
  }, []);

  // Enumerate audio devices
  const enumerateDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices
        .filter(device => device.kind === 'audioinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`
        }));
      
      setState(prev => ({
        ...prev,
        availableDevices: audioInputs,
        selectedDevice: prev.selectedDevice || (audioInputs[0]?.deviceId ?? null)
      }));
      
      return audioInputs;
    } catch (error) {
      console.error("Failed to enumerate devices:", error);
      return [];
    }
  }, []);

  // Request permission and enumerate devices
  const requestPermissionAndEnumerate = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return await enumerateDevices();
    } catch (error) {
      console.error("Failed to get permission:", error);
      throw error;
    }
  }, [enumerateDevices]);

  // Select device
  const selectDevice = useCallback((deviceId: string | null) => {
    setState(prev => ({ ...prev, selectedDevice: deviceId }));
  }, []);

  // Set bypass
  const setBypass = useCallback((bypassed: boolean) => {
    isBypassedRef.current = bypassed;
    
    if (monitorGainRef.current) {
      const volume = !bypassed && isMonitoringRef.current ? monitorVolumeRef.current : 0;
      monitorGainRef.current.gain.setTargetAtTime(volume, audioContextRef.current?.currentTime || 0, 0.02);
    }
    
    // When bypassed, set dry to 1 and wet to 0
    if (dryGainRef.current && wetGainRef.current) {
      const ctx = audioContextRef.current;
      if (ctx) {
        if (bypassed) {
          dryGainRef.current.gain.setTargetAtTime(1, ctx.currentTime, 0.02);
          wetGainRef.current.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
        } else {
          const mix = options.mix / 100;
          dryGainRef.current.gain.setTargetAtTime(1 - mix, ctx.currentTime, 0.02);
          wetGainRef.current.gain.setTargetAtTime(mix, ctx.currentTime, 0.02);
        }
      }
    }
    
    setState(prev => ({ ...prev, isBypassed: bypassed }));
  }, [options.mix]);

  // Get valid notes for current key/scale
  const getScaleNotes = useCallback(() => {
    const keyIndex = NOTES.indexOf(options.selectedKey);
    const pattern = SCALE_PATTERNS[options.selectedScale] || SCALE_PATTERNS["Chromatic"];
    return pattern.map(semitone => NOTES[(keyIndex + semitone) % 12]);
  }, [options.selectedKey, options.selectedScale]);

  // Get all valid frequencies for the scale across all octaves
  const getScaleFrequencies = useCallback(() => {
    const scaleNotes = getScaleNotes();
    const frequencies: { note: string; freq: number; octave: number }[] = [];
    
    for (let octave = 1; octave <= 7; octave++) {
      for (const note of scaleNotes) {
        const baseFreq = NOTE_FREQUENCIES[note];
        const freq = baseFreq * Math.pow(2, octave - 4);
        frequencies.push({ note, freq, octave });
      }
    }
    
    return frequencies.sort((a, b) => a.freq - b.freq);
  }, [getScaleNotes]);

  // Find nearest note in scale with precise calculation
  const findNearestNoteInScale = useCallback((frequency: number): { 
    note: string; 
    freq: number; 
    cents: number; 
    octave: number;
    pitchRatio: number;
  } => {
    if (frequency <= 0 || frequency < 50 || frequency > 2000) {
      return { note: "-", freq: 0, cents: 0, octave: 0, pitchRatio: 1 };
    }

    const scaleFrequencies = getScaleFrequencies();
    let nearestNote = "";
    let nearestFreq = 0;
    let minCentsDiff = Infinity;
    let nearestOctave = 0;

    for (const { note, freq, octave } of scaleFrequencies) {
      // Calculate cents difference
      const centsDiff = 1200 * Math.log2(frequency / freq);
      
      if (Math.abs(centsDiff) < Math.abs(minCentsDiff)) {
        minCentsDiff = centsDiff;
        nearestNote = note;
        nearestFreq = freq;
        nearestOctave = octave;
      }
    }

    // Calculate pitch ratio needed to correct to target
    const pitchRatio = nearestFreq / frequency;

    return { 
      note: nearestNote, 
      freq: nearestFreq, 
      cents: Math.round(minCentsDiff), 
      octave: nearestOctave,
      pitchRatio
    };
  }, [getScaleFrequencies]);

  // Advanced YIN pitch detection algorithm
  const detectPitchYIN = useCallback((buffer: Float32Array, sampleRate: number): number => {
    const bufferSize = buffer.length;
    const yinBuffer = new Float32Array(Math.floor(bufferSize / 2));
    let probability = 0;
    let tau = -1;

    // Step 1: Squared difference function
    yinBuffer[0] = 1;
    let runningSum = 0;

    for (let t = 1; t < yinBuffer.length; t++) {
      yinBuffer[t] = 0;
      for (let j = 0; j < yinBuffer.length; j++) {
        const delta = buffer[j] - buffer[j + t];
        yinBuffer[t] += delta * delta;
      }
      
      // Step 2: Cumulative mean normalized difference
      runningSum += yinBuffer[t];
      yinBuffer[t] = runningSum === 0 ? 1 : yinBuffer[t] * t / runningSum;
    }

    // Step 3: Absolute threshold
    const threshold = 0.1;
    for (let t = 2; t < yinBuffer.length; t++) {
      if (yinBuffer[t] < threshold) {
        while (t + 1 < yinBuffer.length && yinBuffer[t + 1] < yinBuffer[t]) {
          t++;
        }
        probability = 1 - yinBuffer[t];
        tau = t;
        break;
      }
    }

    if (tau === -1 || probability < 0.7) return 0;

    // Step 4: Parabolic interpolation
    let betterTau = tau;
    if (tau > 0 && tau < yinBuffer.length - 1) {
      const s0 = yinBuffer[tau - 1];
      const s1 = yinBuffer[tau];
      const s2 = yinBuffer[tau + 1];
      betterTau = tau + (s2 - s0) / (2 * (2 * s1 - s2 - s0));
    }

    return sampleRate / betterTau;
  }, []);

  // Calculate RMS level
  const calculateRMS = (buffer: Float32Array): number => {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  };

  // Main audio processing loop with real-time pitch correction
  const processAudio = useCallback(() => {
    if (!analyserRef.current || !audioContextRef.current) return;

    const bufferLength = analyserRef.current.fftSize;
    const buffer = new Float32Array(bufferLength);
    analyserRef.current.getFloatTimeDomainData(buffer);

    const rms = calculateRMS(buffer);
    const inputLevel = Math.min(100, rms * 400);

    // Detect pitch using YIN algorithm
    const detectedPitch = detectPitchYIN(buffer, audioContextRef.current.sampleRate);
    
    // Find nearest note in the selected scale
    const { note, freq: targetFreq, cents, octave, pitchRatio } = findNearestNoteInScale(detectedPitch);
    
    // Calculate correction based on mode and retune speed
    let correctionAmount = 1.0;
    let finalPitchRatio = 1.0;
    
    if (detectedPitch > 0 && targetFreq > 0 && !isBypassedRef.current) {
      const isClassicMode = correctionModeRef.current === "classic";
      
      // Retune speed: 0 = instant (T-Pain), 100 = very slow/natural
      // Invert so lower values = faster correction
      const retuneSpeedNormalized = options.retuneSpeed / 100;
      
      if (isClassicMode) {
        // Classic Mode: Aggressive, instant correction (T-Pain effect)
        // Even at higher retune speeds, correction is more aggressive
        correctionAmount = 1.0 - (retuneSpeedNormalized * 0.3); // 70-100% correction
        
        // Snap to pitch grid more aggressively
        targetPitchRatioRef.current = pitchRatio;
        
        // Fast interpolation for robotic effect
        const smoothingFactor = 0.3 + (retuneSpeedNormalized * 0.2);
        currentPitchRatioRef.current += (targetPitchRatioRef.current - currentPitchRatioRef.current) * (1 - smoothingFactor);
      } else {
        // Modern Mode: Natural, transparent correction
        // Higher retune speeds = more natural/less correction
        correctionAmount = 1.0 - (retuneSpeedNormalized * 0.8); // 20-100% correction
        
        // Gentle correction that preserves natural pitch variations
        const pitchDeviation = Math.abs(cents);
        
        // Only correct if deviation exceeds threshold (natural vibrato preservation)
        if (pitchDeviation > 15) {
          targetPitchRatioRef.current = pitchRatio;
        } else {
          targetPitchRatioRef.current = 1.0; // Don't correct small deviations
        }
        
        // Slow interpolation for natural movement
        const smoothingFactor = 0.7 + (retuneSpeedNormalized * 0.25);
        currentPitchRatioRef.current += (targetPitchRatioRef.current - currentPitchRatioRef.current) * (1 - smoothingFactor);
      }
      
      // Apply humanize - adds subtle random variations
      const humanizeAmount = options.humanize / 100;
      const humanizeOffset = (Math.random() - 0.5) * 0.02 * humanizeAmount;
      
      // Calculate final pitch ratio with correction amount
      finalPitchRatio = 1.0 + ((currentPitchRatioRef.current - 1.0) * correctionAmount) + humanizeOffset;
      
      // Send pitch ratio to AudioWorklet
      if (pitchShifterNodeRef.current) {
        pitchShifterNodeRef.current.port.postMessage({ pitchRatio: finalPitchRatio });
      }
    }

    // Calculate corrected pitch
    const correctedPitch = detectedPitch > 0 ? detectedPitch * finalPitchRatio : 0;

    // Update pitch history for visualization
    const now = Date.now();
    pitchHistoryRef.current = [
      ...pitchHistoryRef.current.filter(p => now - p.time < 5000),
      { input: detectedPitch, corrected: correctedPitch, time: now }
    ].slice(-250);

    // Calculate output level
    const mixAmount = options.mix / 100;
    const outputLevel = isBypassedRef.current ? 0 : inputLevel * (0.8 + mixAmount * 0.2);

    setState(prev => ({
      ...prev,
      inputLevel,
      outputLevel,
      detectedPitch: Math.round(detectedPitch * 10) / 10,
      detectedNote: note || "-",
      detectedOctave: octave,
      correctedPitch: Math.round(correctedPitch * 10) / 10,
      correctedNote: note || "-",
      pitchError: cents,
      pitchHistory: pitchHistoryRef.current,
      isProcessing: detectedPitch > 0
    }));

    animationFrameRef.current = requestAnimationFrame(processAudio);
  }, [detectPitchYIN, findNearestNoteInScale, options.retuneSpeed, options.humanize, options.mix]);

  // Create HD Audio Processing Chain for automatic voice enhancement
  const createHDProcessingChain = useCallback((ctx: AudioContext) => {
    // High-pass filter - Remove rumble (100Hz for HD clarity)
    highPassRef.current = ctx.createBiquadFilter();
    highPassRef.current.type = "highpass";
    highPassRef.current.frequency.value = 100;
    highPassRef.current.Q.value = 0.7;

    // De-esser - Tame harsh sibilance (6-8kHz)
    deEsserRef.current = ctx.createBiquadFilter();
    deEsserRef.current.type = "peaking";
    deEsserRef.current.frequency.value = 6500;
    deEsserRef.current.Q.value = 2.0;
    deEsserRef.current.gain.value = -3; // Subtle de-essing

    // Warmth - Body and fullness (200-350Hz)
    warmthRef.current = ctx.createBiquadFilter();
    warmthRef.current.type = "peaking";
    warmthRef.current.frequency.value = 280;
    warmthRef.current.Q.value = 0.8;
    warmthRef.current.gain.value = 2.5;

    // Clarity - Presence and articulation (2.5-4kHz)
    clarityBoostRef.current = ctx.createBiquadFilter();
    clarityBoostRef.current.type = "peaking";
    clarityBoostRef.current.frequency.value = 3200;
    clarityBoostRef.current.Q.value = 1.0;
    clarityBoostRef.current.gain.value = 3.5;

    // Presence - Forward sound (4-6kHz)
    presenceBoostRef.current = ctx.createBiquadFilter();
    presenceBoostRef.current.type = "peaking";
    presenceBoostRef.current.frequency.value = 5000;
    presenceBoostRef.current.Q.value = 1.2;
    presenceBoostRef.current.gain.value = 2;

    // Air - Sparkle and breathiness (10-12kHz)
    airBoostRef.current = ctx.createBiquadFilter();
    airBoostRef.current.type = "highshelf";
    airBoostRef.current.frequency.value = 10000;
    airBoostRef.current.gain.value = 2.5;

    // Low-pass - Remove ultra-high harshness (18kHz)
    lowPassRef.current = ctx.createBiquadFilter();
    lowPassRef.current.type = "lowpass";
    lowPassRef.current.frequency.value = 18000;
    lowPassRef.current.Q.value = 0.7;

    // HD Compressor - Smooth dynamics with fast attack for vocals
    compressorRef.current = ctx.createDynamicsCompressor();
    compressorRef.current.threshold.value = -20;
    compressorRef.current.knee.value = 8;
    compressorRef.current.ratio.value = 4;
    compressorRef.current.attack.value = 0.002; // 2ms - catch transients
    compressorRef.current.release.value = 0.1; // 100ms - smooth release

    // Chain the filters for optimal HD sound
    highPassRef.current.connect(deEsserRef.current);
    deEsserRef.current.connect(warmthRef.current);
    warmthRef.current.connect(clarityBoostRef.current);
    clarityBoostRef.current.connect(presenceBoostRef.current);
    presenceBoostRef.current.connect(airBoostRef.current);
    airBoostRef.current.connect(compressorRef.current);
    compressorRef.current.connect(lowPassRef.current);

    return {
      input: highPassRef.current,
      output: lowPassRef.current
    };
  }, []);

  // Initialize AudioWorklet for pitch shifting
  const initializePitchShifter = useCallback(async (ctx: AudioContext) => {
    try {
      // Create a Blob URL for the worklet code
      const blob = new Blob([pitchShifterWorkletCode], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);
      
      await ctx.audioWorklet.addModule(workletUrl);
      pitchShifterNodeRef.current = new AudioWorkletNode(ctx, 'pitch-shifter-processor');
      
      URL.revokeObjectURL(workletUrl);
      return pitchShifterNodeRef.current;
    } catch (error) {
      console.error("Failed to initialize pitch shifter worklet:", error);
      // Fallback: return a simple pass-through gain node
      const passThrough = ctx.createGain();
      passThrough.gain.value = 1;
      return passThrough;
    }
  }, []);

  // Start audio processing
  const start = useCallback(async (deviceId?: string) => {
    try {
      const targetDevice = deviceId || state.selectedDevice;
      
      if (!targetDevice) {
        throw new Error("No device selected");
      }
      
      // Create HD audio context
      audioContextRef.current = new AudioContext({ 
        sampleRate: 48000, // HD quality
        latencyHint: 'interactive'
      });

      const ctx = audioContextRef.current;

      // Get HD audio input
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: targetDevice ? { exact: targetDevice } : undefined,
          echoCancellation: false, // Disable for monitoring
          noiseSuppression: true,
          autoGainControl: false, // We handle gain
          sampleRate: 48000,
          channelCount: 1
        }
      });

      // Create source
      sourceRef.current = ctx.createMediaStreamSource(streamRef.current);
      
      // Create analyser for pitch detection
      analyserRef.current = ctx.createAnalyser();
      analyserRef.current.fftSize = 4096; // Higher resolution for better pitch detection
      analyserRef.current.smoothingTimeConstant = 0.5;

      // Create gain nodes
      inputGainRef.current = ctx.createGain();
      inputGainRef.current.gain.value = 1.0;

      dryGainRef.current = ctx.createGain();
      dryGainRef.current.gain.value = 1 - (options.mix / 100);

      wetGainRef.current = ctx.createGain();
      wetGainRef.current.gain.value = options.mix / 100;

      monitorGainRef.current = ctx.createGain();
      monitorGainRef.current.gain.value = monitorVolumeRef.current;

      outputGainRef.current = ctx.createGain();
      outputGainRef.current.gain.value = 1.0;

      // Create HD processing chain
      const hdChain = createHDProcessingChain(ctx);

      // Initialize pitch shifter
      const pitchShifter = await initializePitchShifter(ctx);

      // Connect the audio graph:
      // Source -> Input Gain -> Analyser (for detection)
      //                      -> HD Chain -> Pitch Shifter -> Wet Gain -\
      //                      -> Dry Gain ----------------------------- -> Mix -> Monitor -> Output
      
      sourceRef.current.connect(inputGainRef.current);
      
      // Split for analysis
      inputGainRef.current.connect(analyserRef.current);
      
      // Wet path: HD processing + pitch correction
      inputGainRef.current.connect(hdChain.input);
      hdChain.output.connect(pitchShifter);
      pitchShifter.connect(wetGainRef.current);
      
      // Dry path: Original signal
      inputGainRef.current.connect(dryGainRef.current);
      
      // Mix wet and dry
      wetGainRef.current.connect(monitorGainRef.current);
      dryGainRef.current.connect(monitorGainRef.current);
      
      // Output to speakers
      monitorGainRef.current.connect(outputGainRef.current);
      outputGainRef.current.connect(ctx.destination);

      // Reset state
      isBypassedRef.current = false;
      isMonitoringRef.current = true;
      pitchHistoryRef.current = [];
      currentPitchRatioRef.current = 1.0;
      targetPitchRatioRef.current = 1.0;
      
      setState(prev => ({ 
        ...prev, 
        isActive: true, 
        isBypassed: false,
        isMonitoring: true,
        selectedDevice: targetDevice || prev.selectedDevice,
        pitchHistory: []
      }));
      
      // Start processing loop
      processAudio();

    } catch (error) {
      console.error("Failed to start audio processing:", error);
      throw error;
    }
  }, [processAudio, state.selectedDevice, createHDProcessingChain, initializePitchShifter, options.mix]);

  // Stop audio processing
  const stop = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Disconnect all nodes
    const nodesToDisconnect = [
      sourceRef, analyserRef, inputGainRef, monitorGainRef, outputGainRef,
      dryGainRef, wetGainRef, compressorRef, highPassRef, lowPassRef,
      presenceBoostRef, airBoostRef, warmthRef, clarityBoostRef, deEsserRef
    ];

    nodesToDisconnect.forEach(ref => {
      if (ref.current) {
        try { ref.current.disconnect(); } catch (e) { /* ignore */ }
        ref.current = null;
      }
    });

    if (pitchShifterNodeRef.current) {
      try { pitchShifterNodeRef.current.disconnect(); } catch (e) { /* ignore */ }
      pitchShifterNodeRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    pitchHistoryRef.current = [];

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

  // Cleanup on unmount
  useEffect(() => {
    return () => { stop(); };
  }, [stop]);

  // Listen for device changes
  useEffect(() => {
    const handleDeviceChange = () => { enumerateDevices(); };
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
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
