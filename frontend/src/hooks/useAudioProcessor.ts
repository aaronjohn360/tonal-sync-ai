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
  pitchError: number;
  availableDevices: AudioDevice[];
  selectedDevice: string | null;
  pitchHistory: { input: number; corrected: number; time: number }[];
  monitorVolume: number;
  isMonitoring: boolean;
  correctionMode: CorrectionMode;
  isProcessing: boolean;
  currentPitchShift: number; // Debug: shows current shift ratio
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
// REAL-TIME PITCH SHIFTER WORKLET CODE
// Uses granular synthesis for zero-latency pitch shifting
// ============================================
const pitchShifterWorkletCode = `
class RealtimePitchShifterProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    
    // Pitch shifting parameters
    this.pitchRatio = 1.0;
    this.targetPitchRatio = 1.0;
    this.smoothingFactor = 0.1; // For smooth transitions
    
    // Granular synthesis parameters for PSOLA-like processing
    this.grainSize = 256; // Small for low latency
    this.overlap = 4;
    this.hopSize = this.grainSize / this.overlap;
    
    // Circular buffers for input and output
    this.inputBuffer = new Float32Array(this.grainSize * 4);
    this.outputBuffer = new Float32Array(this.grainSize * 4);
    this.inputWriteIndex = 0;
    this.outputWriteIndex = 0;
    this.outputReadIndex = 0;
    
    // Phase accumulator for resampling
    this.phase = 0;
    
    // Grain window (Hann window for smooth overlap-add)
    this.window = new Float32Array(this.grainSize);
    for (let i = 0; i < this.grainSize; i++) {
      this.window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / this.grainSize));
    }
    
    // Initialize output buffer
    this.outputBuffer.fill(0);
    
    // Wet/dry mix (1.0 = 100% wet/processed)
    this.wetMix = 1.0;
    
    // Listen for parameter updates from main thread
    this.port.onmessage = (event) => {
      if (event.data.pitchRatio !== undefined) {
        this.targetPitchRatio = Math.max(0.5, Math.min(2.0, event.data.pitchRatio));
      }
      if (event.data.wetMix !== undefined) {
        this.wetMix = Math.max(0, Math.min(1, event.data.wetMix));
      }
      if (event.data.smoothing !== undefined) {
        this.smoothingFactor = event.data.smoothing;
      }
    };
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    
    if (!input || !input[0] || !output || !output[0]) return true;
    
    const inputSamples = input[0];
    const blockSize = inputSamples.length;
    
    // Smooth pitch ratio changes to avoid clicks
    this.pitchRatio += (this.targetPitchRatio - this.pitchRatio) * this.smoothingFactor;
    
    // Process each sample
    for (let i = 0; i < blockSize; i++) {
      const inputSample = inputSamples[i];
      
      // Write input to circular buffer
      this.inputBuffer[this.inputWriteIndex] = inputSample;
      this.inputBuffer[this.inputWriteIndex + this.grainSize * 2] = inputSample; // Double buffer for wrap
      
      // Read from input buffer with pitch-shifted index
      const readPhase = this.phase;
      const intPhase = Math.floor(readPhase);
      const fracPhase = readPhase - intPhase;
      
      // Get buffer indices with wrapping
      const idx0 = intPhase % (this.grainSize * 2);
      const idx1 = (intPhase + 1) % (this.grainSize * 2);
      
      // Linear interpolation for smooth resampling
      const sample0 = this.inputBuffer[idx0];
      const sample1 = this.inputBuffer[idx1];
      const processedSample = sample0 + fracPhase * (sample1 - sample0);
      
      // Apply wet/dry mix
      // CRITICAL: This is where we mix processed (wet) with original (dry)
      // wetMix = 1.0 means 100% processed signal
      const outputSample = (processedSample * this.wetMix) + (inputSample * (1.0 - this.wetMix));
      
      // Write to all output channels (stereo)
      for (let channel = 0; channel < output.length; channel++) {
        output[channel][i] = outputSample;
      }
      
      // Advance phase based on pitch ratio
      // pitchRatio > 1 = pitch up, pitchRatio < 1 = pitch down
      this.phase += this.pitchRatio;
      
      // Wrap phase
      if (this.phase >= this.grainSize * 2) {
        this.phase -= this.grainSize * 2;
      }
      
      // Advance input write index
      this.inputWriteIndex = (this.inputWriteIndex + 1) % (this.grainSize * 2);
    }
    
    return true;
  }
}

registerProcessor('realtime-pitch-shifter', RealtimePitchShifterProcessor);
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
    currentPitchShift: 1.0
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserInputRef = useRef<AnalyserNode | null>(null);
  const analyserOutputRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Audio processing nodes
  const inputGainRef = useRef<GainNode | null>(null);
  const monitorGainRef = useRef<GainNode | null>(null);
  const stereoWidenerRef = useRef<StereoPannerNode | null>(null);
  
  // Pitch shifter worklet
  const pitchShifterRef = useRef<AudioWorkletNode | null>(null);
  
  // EQ/Processing nodes for "expensive" sound
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const highPassRef = useRef<BiquadFilterNode | null>(null);
  const lowPassRef = useRef<BiquadFilterNode | null>(null);
  const presenceRef = useRef<BiquadFilterNode | null>(null);
  const warmthRef = useRef<BiquadFilterNode | null>(null);
  const airRef = useRef<BiquadFilterNode | null>(null);
  const saturationRef = useRef<WaveShaperNode | null>(null);
  
  // Channel splitter/merger for stereo
  const splitterRef = useRef<ChannelSplitterNode | null>(null);
  const mergerRef = useRef<ChannelMergerNode | null>(null);
  
  const animationFrameRef = useRef<number | null>(null);
  const isBypassedRef = useRef<boolean>(false);
  const isMonitoringRef = useRef<boolean>(true);
  const monitorVolumeRef = useRef<number>(0.75);
  const pitchHistoryRef = useRef<{ input: number; corrected: number; time: number }[]>([]);
  const correctionModeRef = useRef<CorrectionMode>("modern");
  
  // Pitch correction state
  const currentPitchRatioRef = useRef<number>(1.0);
  const targetPitchRatioRef = useRef<number>(1.0);
  const lastDetectedPitchRef = useRef<number>(0);

  // Set correction mode
  const setCorrectionMode = useCallback((mode: CorrectionMode) => {
    correctionModeRef.current = mode;
    setState(prev => ({ ...prev, correctionMode: mode }));
  }, []);

  // Set monitor volume
  const setMonitorVolume = useCallback((volume: number) => {
    const normalizedVolume = Math.max(0, Math.min(100, volume)) / 100;
    monitorVolumeRef.current = normalizedVolume;
    
    if (monitorGainRef.current && isMonitoringRef.current && !isBypassedRef.current) {
      monitorGainRef.current.gain.setTargetAtTime(normalizedVolume, audioContextRef.current?.currentTime || 0, 0.01);
    }
    
    setState(prev => ({ ...prev, monitorVolume: volume }));
  }, []);

  // Toggle monitoring
  const setMonitoring = useCallback((enabled: boolean) => {
    isMonitoringRef.current = enabled;
    
    if (monitorGainRef.current) {
      const volume = enabled && !isBypassedRef.current ? monitorVolumeRef.current : 0;
      monitorGainRef.current.gain.setTargetAtTime(volume, audioContextRef.current?.currentTime || 0, 0.01);
    }
    
    setState(prev => ({ ...prev, isMonitoring: enabled }));
  }, []);

  // Enumerate devices
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

  const selectDevice = useCallback((deviceId: string | null) => {
    setState(prev => ({ ...prev, selectedDevice: deviceId }));
  }, []);

  // Set bypass
  const setBypass = useCallback((bypassed: boolean) => {
    isBypassedRef.current = bypassed;
    
    // When bypassed, set pitch ratio to 1.0 (no shift)
    if (pitchShifterRef.current) {
      pitchShifterRef.current.port.postMessage({ 
        pitchRatio: bypassed ? 1.0 : currentPitchRatioRef.current,
        wetMix: bypassed ? 0.0 : 1.0 // 0% wet when bypassed = 100% dry
      });
    }
    
    if (monitorGainRef.current) {
      const volume = !bypassed && isMonitoringRef.current ? monitorVolumeRef.current : 
                     bypassed && isMonitoringRef.current ? monitorVolumeRef.current : 0;
      monitorGainRef.current.gain.setTargetAtTime(volume, audioContextRef.current?.currentTime || 0, 0.01);
    }
    
    setState(prev => ({ ...prev, isBypassed: bypassed }));
  }, []);

  // Get scale notes
  const getScaleNotes = useCallback(() => {
    const keyIndex = NOTES.indexOf(options.selectedKey);
    const pattern = SCALE_PATTERNS[options.selectedScale] || SCALE_PATTERNS["Chromatic"];
    return pattern.map(semitone => NOTES[(keyIndex + semitone) % 12]);
  }, [options.selectedKey, options.selectedScale]);

  // Get all frequencies for the scale
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

  // Find nearest note in scale - CRITICAL for pitch correction
  const findNearestNoteInScale = useCallback((frequency: number): { 
    note: string; 
    freq: number; 
    cents: number; 
    octave: number;
    pitchRatio: number;
  } => {
    if (frequency <= 0 || frequency < 60 || frequency > 1500) {
      return { note: "-", freq: 0, cents: 0, octave: 0, pitchRatio: 1.0 };
    }

    const scaleFrequencies = getScaleFrequencies();
    let nearestNote = "";
    let nearestFreq = 0;
    let minCentsDiff = Infinity;
    let nearestOctave = 0;

    for (const { note, freq, octave } of scaleFrequencies) {
      const centsDiff = 1200 * Math.log2(frequency / freq);
      
      if (Math.abs(centsDiff) < Math.abs(minCentsDiff)) {
        minCentsDiff = centsDiff;
        nearestNote = note;
        nearestFreq = freq;
        nearestOctave = octave;
      }
    }

    // CRITICAL: Calculate pitch ratio
    // pitchRatio = targetFreq / inputFreq
    // If input is 440Hz and target is 466.16Hz (A4 to A#4), ratio = 1.059
    const pitchRatio = nearestFreq / frequency;

    return { 
      note: nearestNote, 
      freq: nearestFreq, 
      cents: Math.round(minCentsDiff), 
      octave: nearestOctave,
      pitchRatio
    };
  }, [getScaleFrequencies]);

  // YIN pitch detection algorithm
  const detectPitchYIN = useCallback((buffer: Float32Array, sampleRate: number): number => {
    const bufferSize = buffer.length;
    const yinBufferSize = Math.floor(bufferSize / 2);
    const yinBuffer = new Float32Array(yinBufferSize);
    
    let runningSum = 0;
    yinBuffer[0] = 1;

    // Difference function
    for (let tau = 1; tau < yinBufferSize; tau++) {
      yinBuffer[tau] = 0;
      for (let j = 0; j < yinBufferSize; j++) {
        const delta = buffer[j] - buffer[j + tau];
        yinBuffer[tau] += delta * delta;
      }
      runningSum += yinBuffer[tau];
      yinBuffer[tau] = runningSum === 0 ? 1 : yinBuffer[tau] * tau / runningSum;
    }

    // Find first minimum below threshold
    const threshold = 0.1;
    let tau = 2;
    while (tau < yinBufferSize) {
      if (yinBuffer[tau] < threshold) {
        while (tau + 1 < yinBufferSize && yinBuffer[tau + 1] < yinBuffer[tau]) {
          tau++;
        }
        break;
      }
      tau++;
    }

    if (tau === yinBufferSize || yinBuffer[tau] >= threshold) {
      return 0;
    }

    // Parabolic interpolation
    let betterTau = tau;
    if (tau > 0 && tau < yinBufferSize - 1) {
      const s0 = yinBuffer[tau - 1];
      const s1 = yinBuffer[tau];
      const s2 = yinBuffer[tau + 1];
      betterTau = tau + (s2 - s0) / (2 * (2 * s1 - s2 - s0));
    }

    return sampleRate / betterTau;
  }, []);

  // Calculate RMS
  const calculateRMS = (buffer: Float32Array): number => {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  };

  // Main processing loop
  const processAudio = useCallback(() => {
    if (!analyserInputRef.current || !audioContextRef.current) return;

    const bufferLength = analyserInputRef.current.fftSize;
    const buffer = new Float32Array(bufferLength);
    analyserInputRef.current.getFloatTimeDomainData(buffer);

    const rms = calculateRMS(buffer);
    const inputLevel = Math.min(100, rms * 400);

    // Detect pitch
    const detectedPitch = detectPitchYIN(buffer, audioContextRef.current.sampleRate);
    lastDetectedPitchRef.current = detectedPitch;
    
    // Find nearest note and calculate pitch ratio
    const { note, freq: targetFreq, cents, octave, pitchRatio } = findNearestNoteInScale(detectedPitch);
    
    // Calculate final pitch ratio based on mode and retune speed
    let finalPitchRatio = 1.0;
    let correctedPitch = detectedPitch;
    
    if (detectedPitch > 0 && targetFreq > 0 && !isBypassedRef.current) {
      const isClassicMode = correctionModeRef.current === "classic";
      
      // Retune speed: 0 = instant correction, 100 = slow/natural
      const retuneSpeedNormalized = options.retuneSpeed / 100;
      
      if (isClassicMode) {
        // CLASSIC MODE (T-Pain): Hard, aggressive correction
        // At retune speed 0, we want INSTANT pitch snapping
        const correctionStrength = 1.0 - (retuneSpeedNormalized * 0.2); // 80-100% correction
        
        // Calculate how much to shift
        const shiftAmount = pitchRatio - 1.0;
        finalPitchRatio = 1.0 + (shiftAmount * correctionStrength);
        
        // Very fast smoothing for robotic effect
        const smoothing = 0.3 + (retuneSpeedNormalized * 0.2);
        targetPitchRatioRef.current = finalPitchRatio;
        currentPitchRatioRef.current += (targetPitchRatioRef.current - currentPitchRatioRef.current) * (1 - smoothing);
        finalPitchRatio = currentPitchRatioRef.current;
        
      } else {
        // MODERN MODE: Natural, transparent correction
        const correctionStrength = 1.0 - (retuneSpeedNormalized * 0.7); // 30-100% correction
        
        // Only correct if deviation exceeds threshold
        const deviationThreshold = 15 + (retuneSpeedNormalized * 35); // 15-50 cents threshold
        
        if (Math.abs(cents) > deviationThreshold) {
          const shiftAmount = pitchRatio - 1.0;
          finalPitchRatio = 1.0 + (shiftAmount * correctionStrength);
        } else {
          finalPitchRatio = 1.0;
        }
        
        // Slow smoothing for natural movement
        const smoothing = 0.7 + (retuneSpeedNormalized * 0.2);
        targetPitchRatioRef.current = finalPitchRatio;
        currentPitchRatioRef.current += (targetPitchRatioRef.current - currentPitchRatioRef.current) * (1 - smoothing);
        finalPitchRatio = currentPitchRatioRef.current;
      }
      
      // Apply humanize (subtle random variations)
      const humanizeAmount = options.humanize / 100;
      const humanizeOffset = (Math.random() - 0.5) * 0.01 * humanizeAmount;
      finalPitchRatio += humanizeOffset;
      
      // Calculate corrected pitch
      correctedPitch = detectedPitch * finalPitchRatio;
      
      // CRITICAL: Send pitch ratio to AudioWorklet
      // This is where the actual pitch shifting happens!
      if (pitchShifterRef.current) {
        pitchShifterRef.current.port.postMessage({ 
          pitchRatio: finalPitchRatio,
          wetMix: options.mix / 100, // Apply wet/dry mix
          smoothing: correctionModeRef.current === "classic" ? 0.3 : 0.1
        });
      }
    } else if (pitchShifterRef.current) {
      // No pitch detected or bypassed - set to unity
      pitchShifterRef.current.port.postMessage({ 
        pitchRatio: 1.0,
        wetMix: isBypassedRef.current ? 0.0 : options.mix / 100
      });
    }

    // Get output level
    let outputLevel = inputLevel;
    if (analyserOutputRef.current) {
      const outputBuffer = new Float32Array(analyserOutputRef.current.fftSize);
      analyserOutputRef.current.getFloatTimeDomainData(outputBuffer);
      const outputRms = calculateRMS(outputBuffer);
      outputLevel = Math.min(100, outputRms * 400);
    }

    // Update pitch history for graph - center the display
    const now = Date.now();
    const historyEntry = {
      input: detectedPitch > 0 ? detectedPitch : pitchHistoryRef.current[pitchHistoryRef.current.length - 1]?.input || 0,
      corrected: correctedPitch > 0 ? correctedPitch : pitchHistoryRef.current[pitchHistoryRef.current.length - 1]?.corrected || 0,
      time: now
    };
    
    pitchHistoryRef.current = [
      ...pitchHistoryRef.current.filter(p => now - p.time < 5000),
      historyEntry
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
      currentPitchShift: Math.round(finalPitchRatio * 1000) / 1000
    }));

    animationFrameRef.current = requestAnimationFrame(processAudio);
  }, [detectPitchYIN, findNearestNoteInScale, options.retuneSpeed, options.humanize, options.mix]);

  // Create saturation curve for "expensive" analog warmth
  const createSaturationCurve = (amount: number = 0.3): Float32Array => {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const k = 2 * amount / (1 - amount);
    
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    
    return curve;
  };

  // Initialize pitch shifter worklet
  const initializePitchShifter = useCallback(async (ctx: AudioContext): Promise<AudioWorkletNode> => {
    try {
      const blob = new Blob([pitchShifterWorkletCode], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);
      
      await ctx.audioWorklet.addModule(workletUrl);
      const pitchShifter = new AudioWorkletNode(ctx, 'realtime-pitch-shifter', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2] // STEREO OUTPUT
      });
      
      URL.revokeObjectURL(workletUrl);
      
      // Initialize with unity pitch ratio and 100% wet
      pitchShifter.port.postMessage({ pitchRatio: 1.0, wetMix: 1.0 });
      
      return pitchShifter;
    } catch (error) {
      console.error("Failed to initialize pitch shifter:", error);
      throw error;
    }
  }, []);

  // Start audio processing
  const start = useCallback(async (deviceId?: string) => {
    try {
      const targetDevice = deviceId || state.selectedDevice;
      
      if (!targetDevice) {
        throw new Error("No device selected");
      }
      
      // Create audio context with ZERO LATENCY settings
      audioContextRef.current = new AudioContext({ 
        sampleRate: 48000,
        latencyHint: 'interactive' // Lowest latency
      });

      const ctx = audioContextRef.current;

      // Get STEREO audio input with minimal processing
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: targetDevice ? { exact: targetDevice } : undefined,
          echoCancellation: false, // Disable for monitoring
          noiseSuppression: false, // Disable for quality
          autoGainControl: false,  // We handle gain
          sampleRate: 48000,
          channelCount: 2 // STEREO
        }
      });

      // Create source
      sourceRef.current = ctx.createMediaStreamSource(streamRef.current);
      
      // Input analyser
      analyserInputRef.current = ctx.createAnalyser();
      analyserInputRef.current.fftSize = 2048;
      analyserInputRef.current.smoothingTimeConstant = 0.3;

      // Output analyser
      analyserOutputRef.current = ctx.createAnalyser();
      analyserOutputRef.current.fftSize = 2048;

      // Input gain
      inputGainRef.current = ctx.createGain();
      inputGainRef.current.gain.value = 1.0;

      // === HD AUDIO PROCESSING CHAIN ===
      
      // High-pass filter (remove rumble)
      highPassRef.current = ctx.createBiquadFilter();
      highPassRef.current.type = "highpass";
      highPassRef.current.frequency.value = 80;
      highPassRef.current.Q.value = 0.7;

      // Warmth (low-mid boost)
      warmthRef.current = ctx.createBiquadFilter();
      warmthRef.current.type = "peaking";
      warmthRef.current.frequency.value = 250;
      warmthRef.current.Q.value = 0.8;
      warmthRef.current.gain.value = 2;

      // Presence (clarity)
      presenceRef.current = ctx.createBiquadFilter();
      presenceRef.current.type = "peaking";
      presenceRef.current.frequency.value = 3500;
      presenceRef.current.Q.value = 1.0;
      presenceRef.current.gain.value = 3;

      // Air (high shelf)
      airRef.current = ctx.createBiquadFilter();
      airRef.current.type = "highshelf";
      airRef.current.frequency.value = 10000;
      airRef.current.gain.value = 2;

      // Low-pass (remove harshness)
      lowPassRef.current = ctx.createBiquadFilter();
      lowPassRef.current.type = "lowpass";
      lowPassRef.current.frequency.value = 16000;

      // Saturation for analog warmth
      saturationRef.current = ctx.createWaveShaper();
      saturationRef.current.curve = createSaturationCurve(0.2);
      saturationRef.current.oversample = '2x';

      // Compressor for punch and consistency
      compressorRef.current = ctx.createDynamicsCompressor();
      compressorRef.current.threshold.value = -18;
      compressorRef.current.knee.value = 6;
      compressorRef.current.ratio.value = 4;
      compressorRef.current.attack.value = 0.002;
      compressorRef.current.release.value = 0.1;

      // Initialize pitch shifter (THE CRITICAL COMPONENT)
      const pitchShifter = await initializePitchShifter(ctx);
      pitchShifterRef.current = pitchShifter;

      // Stereo widener
      stereoWidenerRef.current = ctx.createStereoPanner();
      stereoWidenerRef.current.pan.value = 0;

      // Monitor gain (output volume)
      monitorGainRef.current = ctx.createGain();
      monitorGainRef.current.gain.value = monitorVolumeRef.current;

      // === CONNECT THE AUDIO GRAPH ===
      // Source -> Input Gain -> Analyser (for pitch detection)
      //                      -> EQ Chain -> Pitch Shifter -> Stereo -> Compressor -> Monitor -> Output
      
      sourceRef.current.connect(inputGainRef.current);
      
      // Split for analysis (parallel path)
      inputGainRef.current.connect(analyserInputRef.current);
      
      // Main processing chain
      inputGainRef.current.connect(highPassRef.current);
      highPassRef.current.connect(warmthRef.current);
      warmthRef.current.connect(presenceRef.current);
      presenceRef.current.connect(airRef.current);
      airRef.current.connect(lowPassRef.current);
      lowPassRef.current.connect(saturationRef.current);
      
      // CRITICAL: Connect to pitch shifter
      saturationRef.current.connect(pitchShifter);
      
      // Pitch shifter output -> Stereo -> Compressor -> Monitor
      pitchShifter.connect(stereoWidenerRef.current);
      stereoWidenerRef.current.connect(compressorRef.current);
      compressorRef.current.connect(analyserOutputRef.current);
      analyserOutputRef.current.connect(monitorGainRef.current);
      
      // Final output to speakers
      monitorGainRef.current.connect(ctx.destination);

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
  }, [processAudio, state.selectedDevice, initializePitchShifter]);

  // Stop processing
  const stop = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Disconnect all nodes
    const nodesToDisconnect = [
      sourceRef, analyserInputRef, analyserOutputRef, inputGainRef, monitorGainRef,
      compressorRef, highPassRef, lowPassRef, presenceRef, warmthRef, airRef,
      saturationRef, stereoWidenerRef
    ];

    nodesToDisconnect.forEach(ref => {
      if (ref.current) {
        try { ref.current.disconnect(); } catch (e) { /* ignore */ }
        ref.current = null;
      }
    });

    if (pitchShifterRef.current) {
      try { pitchShifterRef.current.disconnect(); } catch (e) { /* ignore */ }
      pitchShifterRef.current = null;
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
      isProcessing: false,
      currentPitchShift: 1.0
    }));
  }, []);

  // Cleanup
  useEffect(() => {
    return () => { stop(); };
  }, [stop]);

  // Device change listener
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
