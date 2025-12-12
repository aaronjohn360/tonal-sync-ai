import { useState, useRef, useCallback, useEffect } from "react";

// ============================================
// TONAL SYNC PRO 2026 - PROFESSIONAL AUTOTUNE
// Implements Phase Vocoder with Formant Preservation
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
// PROFESSIONAL PHASE VOCODER PITCH SHIFTER
// With Formant Preservation & PSOLA-style processing
// ============================================
const proPhaseVocoderCode = `
// Professional Phase Vocoder with Formant Correction
class ProPhaseVocoderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    
    // ===== CONFIGURATION =====
    this.fftSize = 2048;
    this.hopSize = 256; // Low latency hop
    this.overlapFactor = this.fftSize / this.hopSize;
    
    // Pitch shifting parameters
    this.pitchRatio = 1.0;
    this.targetPitchRatio = 1.0;
    this.formantShift = 0; // In semitones (-12 to +12)
    this.wetMix = 1.0;
    
    // Correction parameters
    this.retuneSpeed = 0.5; // 0 = instant, 1 = slow
    this.flexTuneThreshold = 0.3; // Allow pitch variation within this range
    this.humanizeAmount = 0.2;
    
    // Processing buffers
    this.inputBuffer = new Float32Array(this.fftSize * 2);
    this.outputBuffer = new Float32Array(this.fftSize * 2);
    this.inputWritePos = 0;
    this.outputWritePos = 0;
    this.outputReadPos = 0;
    
    // Phase vocoder state
    this.lastPhase = new Float32Array(this.fftSize);
    this.sumPhase = new Float32Array(this.fftSize);
    this.outputAccum = new Float32Array(this.fftSize * 2);
    this.anaFreq = new Float32Array(this.fftSize);
    this.anaMagn = new Float32Array(this.fftSize);
    this.synFreq = new Float32Array(this.fftSize);
    this.synMagn = new Float32Array(this.fftSize);
    
    // Formant envelope for preservation
    this.formantEnvelope = new Float32Array(this.fftSize / 2);
    this.spectralEnvelope = new Float32Array(this.fftSize / 2);
    
    // Hann window
    this.window = new Float32Array(this.fftSize);
    for (let i = 0; i < this.fftSize; i++) {
      this.window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / this.fftSize));
    }
    
    // FFT twiddle factors (pre-computed)
    this.cosTable = new Float32Array(this.fftSize);
    this.sinTable = new Float32Array(this.fftSize);
    for (let i = 0; i < this.fftSize; i++) {
      this.cosTable[i] = Math.cos(2 * Math.PI * i / this.fftSize);
      this.sinTable[i] = Math.sin(2 * Math.PI * i / this.fftSize);
    }
    
    // Note onset detection for humanize
    this.prevRMS = 0;
    this.isNoteOnset = false;
    this.noteHoldTime = 0;
    
    // Initialize output buffer
    this.outputAccum.fill(0);
    
    // Message handler
    this.port.onmessage = (event) => {
      if (event.data.pitchRatio !== undefined) {
        this.targetPitchRatio = Math.max(0.5, Math.min(2.0, event.data.pitchRatio));
      }
      if (event.data.wetMix !== undefined) {
        this.wetMix = event.data.wetMix;
      }
      if (event.data.formantShift !== undefined) {
        this.formantShift = event.data.formantShift;
      }
      if (event.data.retuneSpeed !== undefined) {
        this.retuneSpeed = event.data.retuneSpeed;
      }
      if (event.data.flexTune !== undefined) {
        this.flexTuneThreshold = event.data.flexTune;
      }
      if (event.data.humanize !== undefined) {
        this.humanizeAmount = event.data.humanize;
      }
    };
  }

  // Simple DFT (for AudioWorklet - no native FFT available)
  dft(real, imag, inverse = false) {
    const n = real.length;
    const direction = inverse ? 1 : -1;
    const tempReal = new Float32Array(n);
    const tempImag = new Float32Array(n);
    
    for (let k = 0; k < n; k++) {
      let sumReal = 0;
      let sumImag = 0;
      for (let t = 0; t < n; t++) {
        const angle = 2 * Math.PI * t * k / n;
        sumReal += real[t] * Math.cos(angle) + direction * imag[t] * Math.sin(angle);
        sumImag += direction * (-real[t] * Math.sin(angle)) + imag[t] * Math.cos(angle);
      }
      tempReal[k] = sumReal / (inverse ? n : 1);
      tempImag[k] = sumImag / (inverse ? n : 1);
    }
    
    for (let i = 0; i < n; i++) {
      real[i] = tempReal[i];
      imag[i] = tempImag[i];
    }
  }

  // Fast approximation of atan2
  fastAtan2(y, x) {
    if (x === 0) return y > 0 ? Math.PI / 2 : -Math.PI / 2;
    const abs_y = Math.abs(y) + 1e-10;
    let angle;
    if (x >= 0) {
      const r = (x - abs_y) / (x + abs_y);
      angle = 0.1963 * r * r * r - 0.9817 * r + Math.PI / 4;
    } else {
      const r = (x + abs_y) / (abs_y - x);
      angle = 0.1963 * r * r * r - 0.9817 * r + 3 * Math.PI / 4;
    }
    return y < 0 ? -angle : angle;
  }

  // Extract spectral envelope (formant shape)
  extractFormantEnvelope(magnitudes) {
    const halfSize = magnitudes.length;
    const cepstrumOrder = 30; // Liftering order for formant extraction
    
    // Simple moving average as formant envelope approximation
    const smoothingWindow = 20;
    for (let i = 0; i < halfSize; i++) {
      let sum = 0;
      let count = 0;
      for (let j = -smoothingWindow; j <= smoothingWindow; j++) {
        const idx = i + j;
        if (idx >= 0 && idx < halfSize) {
          sum += magnitudes[idx];
          count++;
        }
      }
      this.formantEnvelope[i] = sum / count;
    }
  }

  // Apply formant preservation
  applyFormantCorrection(synMagn, pitchRatio) {
    const halfSize = synMagn.length;
    
    // Calculate formant shift to compensate for pitch shift
    // When pitch goes UP, formants also go up -> shift them back DOWN
    const formantRatio = 1.0 / pitchRatio;
    const formantShiftRatio = Math.pow(2, this.formantShift / 12);
    const totalFormantRatio = formantRatio * formantShiftRatio;
    
    // Create corrected spectrum
    const correctedMagn = new Float32Array(halfSize);
    
    for (let i = 0; i < halfSize; i++) {
      // Map frequency bin through formant correction
      const sourceIdx = Math.floor(i * totalFormantRatio);
      
      if (sourceIdx >= 0 && sourceIdx < halfSize) {
        // Get original formant envelope value
        const originalEnvelope = this.formantEnvelope[sourceIdx] || 0.001;
        // Get current magnitude
        const currentMag = synMagn[i];
        // Get target envelope value at this position
        const targetEnvelope = this.formantEnvelope[i] || 0.001;
        
        // Scale magnitude to preserve formant shape
        correctedMagn[i] = currentMag * (targetEnvelope / originalEnvelope);
      } else {
        correctedMagn[i] = synMagn[i] * 0.1; // Attenuate out-of-range
      }
    }
    
    // Copy back
    for (let i = 0; i < halfSize; i++) {
      synMagn[i] = correctedMagn[i];
    }
  }

  // Phase Vocoder pitch shift with formant preservation
  processFrame(inputFrame) {
    const fftSize = this.fftSize;
    const halfSize = fftSize / 2;
    const hopSize = this.hopSize;
    const freqPerBin = sampleRate / fftSize;
    const expct = 2.0 * Math.PI * hopSize / fftSize;
    
    // Smooth pitch ratio transition (Flex-Tune style)
    const pitchDiff = Math.abs(this.targetPitchRatio - 1.0);
    let effectivePitchRatio;
    
    if (pitchDiff < this.flexTuneThreshold) {
      // Within flex-tune zone - allow natural pitch variation
      effectivePitchRatio = 1.0 + (this.targetPitchRatio - 1.0) * 0.3;
    } else {
      // Outside zone - apply full correction based on retune speed
      const correctionSpeed = 1.0 - this.retuneSpeed;
      effectivePitchRatio = 1.0 + (this.targetPitchRatio - 1.0) * correctionSpeed;
    }
    
    // Humanize: add slight variation on sustained notes
    if (this.noteHoldTime > 0.1 && this.humanizeAmount > 0) {
      const humanizeOffset = (Math.random() - 0.5) * 0.01 * this.humanizeAmount;
      effectivePitchRatio *= (1.0 + humanizeOffset);
    }
    
    // Smooth pitch ratio changes
    this.pitchRatio += (effectivePitchRatio - this.pitchRatio) * 0.3;
    
    // Apply window
    const windowedInput = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      windowedInput[i] = inputFrame[i] * this.window[i];
    }
    
    // DFT
    const real = new Float32Array(windowedInput);
    const imag = new Float32Array(fftSize);
    this.dft(real, imag, false);
    
    // Analysis: convert to magnitude/phase
    for (let k = 0; k <= halfSize; k++) {
      const re = real[k];
      const im = imag[k];
      
      // Magnitude
      this.anaMagn[k] = 2.0 * Math.sqrt(re * re + im * im);
      
      // Phase
      const phase = this.fastAtan2(im, re);
      
      // Phase difference
      let phaseDiff = phase - this.lastPhase[k];
      this.lastPhase[k] = phase;
      
      // Subtract expected phase increment
      phaseDiff -= k * expct;
      
      // Map to -pi to pi
      while (phaseDiff > Math.PI) phaseDiff -= 2 * Math.PI;
      while (phaseDiff < -Math.PI) phaseDiff += 2 * Math.PI;
      
      // Get deviation from bin frequency
      phaseDiff = phaseDiff / (2 * Math.PI);
      
      // Compute true frequency
      this.anaFreq[k] = k * freqPerBin + phaseDiff * freqPerBin * this.overlapFactor;
    }
    
    // Extract formant envelope before pitch shifting
    this.extractFormantEnvelope(this.anaMagn);
    
    // Synthesis: pitch shift
    this.synMagn.fill(0);
    this.synFreq.fill(0);
    
    for (let k = 0; k <= halfSize; k++) {
      const newBin = Math.round(k * this.pitchRatio);
      if (newBin >= 0 && newBin <= halfSize) {
        this.synMagn[newBin] += this.anaMagn[k];
        this.synFreq[newBin] = this.anaFreq[k] * this.pitchRatio;
      }
    }
    
    // Apply formant correction (THE KEY TO GOOD SOUND)
    this.applyFormantCorrection(this.synMagn, this.pitchRatio);
    
    // Convert back to complex
    const outReal = new Float32Array(fftSize);
    const outImag = new Float32Array(fftSize);
    
    for (let k = 0; k <= halfSize; k++) {
      const magn = this.synMagn[k];
      
      // Get phase
      const phaseDiff = this.synFreq[k] - k * freqPerBin;
      const binDeviation = phaseDiff / (freqPerBin * this.overlapFactor);
      
      this.sumPhase[k] += (k + binDeviation) * expct;
      const phase = this.sumPhase[k];
      
      outReal[k] = magn * Math.cos(phase);
      outImag[k] = magn * Math.sin(phase);
      
      // Mirror for negative frequencies
      if (k > 0 && k < halfSize) {
        outReal[fftSize - k] = outReal[k];
        outImag[fftSize - k] = -outImag[k];
      }
    }
    
    // Inverse DFT
    this.dft(outReal, outImag, true);
    
    // Apply window and overlap-add
    const outputFrame = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      outputFrame[i] = outReal[i] * this.window[i] * (2.0 / this.overlapFactor);
    }
    
    return outputFrame;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    
    if (!input || !input[0] || !output || !output[0]) return true;
    
    const inputChannel = input[0];
    const blockSize = inputChannel.length;
    
    // Detect note onset for humanize
    let rms = 0;
    for (let i = 0; i < blockSize; i++) {
      rms += inputChannel[i] * inputChannel[i];
    }
    rms = Math.sqrt(rms / blockSize);
    
    if (rms > this.prevRMS * 1.5 && rms > 0.01) {
      this.isNoteOnset = true;
      this.noteHoldTime = 0;
    } else {
      this.noteHoldTime += blockSize / sampleRate;
    }
    this.prevRMS = rms;
    
    // Fill input buffer
    for (let i = 0; i < blockSize; i++) {
      this.inputBuffer[this.inputWritePos] = inputChannel[i];
      this.inputWritePos = (this.inputWritePos + 1) % (this.fftSize * 2);
    }
    
    // Process when we have enough samples
    const inputFrame = new Float32Array(this.fftSize);
    const readPos = (this.inputWritePos - this.fftSize + this.fftSize * 2) % (this.fftSize * 2);
    
    for (let i = 0; i < this.fftSize; i++) {
      inputFrame[i] = this.inputBuffer[(readPos + i) % (this.fftSize * 2)];
    }
    
    // Process frame through phase vocoder
    const processedFrame = this.processFrame(inputFrame);
    
    // Overlap-add to output accumulator
    for (let i = 0; i < this.fftSize; i++) {
      const outIdx = (this.outputWritePos + i) % (this.fftSize * 2);
      this.outputAccum[outIdx] += processedFrame[i];
    }
    
    // Read from output accumulator
    for (let i = 0; i < blockSize; i++) {
      const readIdx = (this.outputReadPos + i) % (this.fftSize * 2);
      const processed = this.outputAccum[readIdx];
      const dry = inputChannel[i];
      
      // Mix wet/dry
      const mixed = processed * this.wetMix + dry * (1.0 - this.wetMix);
      
      // Output to all channels (stereo)
      for (let ch = 0; ch < output.length; ch++) {
        output[ch][i] = mixed;
      }
      
      // Clear accumulator
      this.outputAccum[readIdx] = 0;
    }
    
    // Advance positions
    this.outputWritePos = (this.outputWritePos + this.hopSize) % (this.fftSize * 2);
    this.outputReadPos = (this.outputReadPos + blockSize) % (this.fftSize * 2);
    
    return true;
  }
}

registerProcessor('pro-phase-vocoder', ProPhaseVocoderProcessor);
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
  const analyserInputRef = useRef<AnalyserNode | null>(null);
  const analyserOutputRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Audio nodes
  const inputGainRef = useRef<GainNode | null>(null);
  const monitorGainRef = useRef<GainNode | null>(null);
  const phaseVocoderRef = useRef<AudioWorkletNode | null>(null);
  
  // EQ chain for "expensive" sound
  const highPassRef = useRef<BiquadFilterNode | null>(null);
  const lowShelfRef = useRef<BiquadFilterNode | null>(null);
  const midBoostRef = useRef<BiquadFilterNode | null>(null);
  const presenceRef = useRef<BiquadFilterNode | null>(null);
  const airRef = useRef<BiquadFilterNode | null>(null);
  const lowPassRef = useRef<BiquadFilterNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  
  const animationFrameRef = useRef<number | null>(null);
  const isBypassedRef = useRef<boolean>(false);
  const isMonitoringRef = useRef<boolean>(true);
  const monitorVolumeRef = useRef<number>(0.75);
  const pitchHistoryRef = useRef<{ input: number; corrected: number; time: number }[]>([]);
  const correctionModeRef = useRef<CorrectionMode>("modern");
  
  // Pitch state
  const currentPitchRatioRef = useRef<number>(1.0);
  const targetPitchRatioRef = useRef<number>(1.0);
  const smoothedPitchRef = useRef<number>(0);

  // Correction mode
  const setCorrectionMode = useCallback((mode: CorrectionMode) => {
    correctionModeRef.current = mode;
    setState(prev => ({ ...prev, correctionMode: mode }));
  }, []);

  // Monitor volume
  const setMonitorVolume = useCallback((volume: number) => {
    const normalized = Math.max(0, Math.min(100, volume)) / 100;
    monitorVolumeRef.current = normalized;
    
    if (monitorGainRef.current && isMonitoringRef.current && !isBypassedRef.current) {
      monitorGainRef.current.gain.setTargetAtTime(normalized, audioContextRef.current?.currentTime || 0, 0.01);
    }
    
    setState(prev => ({ ...prev, monitorVolume: volume }));
  }, []);

  // Toggle monitoring
  const setMonitoring = useCallback((enabled: boolean) => {
    isMonitoringRef.current = enabled;
    
    if (monitorGainRef.current) {
      const vol = enabled && !isBypassedRef.current ? monitorVolumeRef.current : 0;
      monitorGainRef.current.gain.setTargetAtTime(vol, audioContextRef.current?.currentTime || 0, 0.01);
    }
    
    setState(prev => ({ ...prev, isMonitoring: enabled }));
  }, []);

  // Enumerate devices
  const enumerateDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices
        .filter(d => d.kind === 'audioinput')
        .map(d => ({
          deviceId: d.deviceId,
          label: d.label || `Mic ${d.deviceId.slice(0, 8)}`
        }));
      
      setState(prev => ({
        ...prev,
        availableDevices: audioInputs,
        selectedDevice: prev.selectedDevice || (audioInputs[0]?.deviceId ?? null)
      }));
      
      return audioInputs;
    } catch (e) {
      console.error("Device enum failed:", e);
      return [];
    }
  }, []);

  const requestPermissionAndEnumerate = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      return await enumerateDevices();
    } catch (e) {
      console.error("Permission failed:", e);
      throw e;
    }
  }, [enumerateDevices]);

  const selectDevice = useCallback((deviceId: string | null) => {
    setState(prev => ({ ...prev, selectedDevice: deviceId }));
  }, []);

  // Bypass
  const setBypass = useCallback((bypassed: boolean) => {
    isBypassedRef.current = bypassed;
    
    if (phaseVocoderRef.current) {
      phaseVocoderRef.current.port.postMessage({ 
        pitchRatio: bypassed ? 1.0 : currentPitchRatioRef.current,
        wetMix: bypassed ? 0.0 : 1.0
      });
    }
    
    if (monitorGainRef.current) {
      const vol = isMonitoringRef.current ? monitorVolumeRef.current : 0;
      monitorGainRef.current.gain.setTargetAtTime(vol, audioContextRef.current?.currentTime || 0, 0.01);
    }
    
    setState(prev => ({ ...prev, isBypassed: bypassed }));
  }, []);

  // Scale notes
  const getScaleNotes = useCallback(() => {
    const keyIdx = NOTES.indexOf(options.selectedKey);
    const pattern = SCALE_PATTERNS[options.selectedScale] || SCALE_PATTERNS["Chromatic"];
    return pattern.map(s => NOTES[(keyIdx + s) % 12]);
  }, [options.selectedKey, options.selectedScale]);

  // Scale frequencies
  const getScaleFrequencies = useCallback(() => {
    const scaleNotes = getScaleNotes();
    const freqs: { note: string; freq: number; octave: number }[] = [];
    
    for (let oct = 1; oct <= 7; oct++) {
      for (const note of scaleNotes) {
        const baseFreq = NOTE_FREQUENCIES[note];
        const freq = baseFreq * Math.pow(2, oct - 4);
        freqs.push({ note, freq, octave: oct });
      }
    }
    
    return freqs.sort((a, b) => a.freq - b.freq);
  }, [getScaleNotes]);

  // Find nearest note
  const findNearestNote = useCallback((frequency: number): { 
    note: string; freq: number; cents: number; octave: number; pitchRatio: number;
  } => {
    if (frequency <= 0 || frequency < 60 || frequency > 1500) {
      return { note: "-", freq: 0, cents: 0, octave: 0, pitchRatio: 1.0 };
    }

    const scaleFreqs = getScaleFrequencies();
    let nearestNote = "";
    let nearestFreq = 0;
    let minCents = Infinity;
    let nearestOctave = 0;

    for (const { note, freq, octave } of scaleFreqs) {
      const cents = 1200 * Math.log2(frequency / freq);
      if (Math.abs(cents) < Math.abs(minCents)) {
        minCents = cents;
        nearestNote = note;
        nearestFreq = freq;
        nearestOctave = octave;
      }
    }

    return { 
      note: nearestNote, 
      freq: nearestFreq, 
      cents: Math.round(minCents), 
      octave: nearestOctave,
      pitchRatio: nearestFreq / frequency
    };
  }, [getScaleFrequencies]);

  // YIN pitch detection
  const detectPitchYIN = useCallback((buffer: Float32Array, sampleRate: number): number => {
    const bufSize = buffer.length;
    const yinSize = Math.floor(bufSize / 2);
    const yinBuffer = new Float32Array(yinSize);
    
    let sum = 0;
    yinBuffer[0] = 1;

    for (let tau = 1; tau < yinSize; tau++) {
      yinBuffer[tau] = 0;
      for (let j = 0; j < yinSize; j++) {
        const delta = buffer[j] - buffer[j + tau];
        yinBuffer[tau] += delta * delta;
      }
      sum += yinBuffer[tau];
      yinBuffer[tau] = sum === 0 ? 1 : yinBuffer[tau] * tau / sum;
    }

    const threshold = 0.1;
    let tau = 2;
    while (tau < yinSize) {
      if (yinBuffer[tau] < threshold) {
        while (tau + 1 < yinSize && yinBuffer[tau + 1] < yinBuffer[tau]) tau++;
        break;
      }
      tau++;
    }

    if (tau === yinSize || yinBuffer[tau] >= threshold) return 0;

    // Parabolic interpolation
    let betterTau = tau;
    if (tau > 0 && tau < yinSize - 1) {
      const s0 = yinBuffer[tau - 1];
      const s1 = yinBuffer[tau];
      const s2 = yinBuffer[tau + 1];
      betterTau = tau + (s2 - s0) / (2 * (2 * s1 - s2 - s0));
    }

    return sampleRate / betterTau;
  }, []);

  // RMS calculation
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
    const inputLevel = Math.min(100, rms * 400);

    // Pitch detection
    const detectedPitch = detectPitchYIN(buffer, audioContextRef.current.sampleRate);
    const { note, freq: targetFreq, cents, octave, pitchRatio } = findNearestNote(detectedPitch);
    
    let finalPitchRatio = 1.0;
    let correctedPitch = detectedPitch;
    
    if (detectedPitch > 0 && targetFreq > 0 && !isBypassedRef.current) {
      const isClassic = correctionModeRef.current === "classic";
      const retuneNorm = options.retuneSpeed / 100;
      const flexTuneNorm = (100 - options.retuneSpeed) / 100; // Inverse relationship
      
      if (isClassic) {
        // CLASSIC MODE: Hard T-Pain effect
        // At retune speed 0 = instant snap
        const correctionStrength = 1.0 - (retuneNorm * 0.15);
        const shiftAmount = pitchRatio - 1.0;
        
        targetPitchRatioRef.current = 1.0 + (shiftAmount * correctionStrength);
        
        // Very fast smoothing for robotic effect
        const smoothing = 0.15 + (retuneNorm * 0.15);
        currentPitchRatioRef.current += (targetPitchRatioRef.current - currentPitchRatioRef.current) * (1 - smoothing);
        
      } else {
        // MODERN MODE: Natural, transparent
        // Flex-Tune: only correct beyond threshold
        const flexTuneThreshold = 10 + (retuneNorm * 40); // 10-50 cents
        
        if (Math.abs(cents) > flexTuneThreshold) {
          const correctionStrength = 1.0 - (retuneNorm * 0.6);
          const shiftAmount = pitchRatio - 1.0;
          targetPitchRatioRef.current = 1.0 + (shiftAmount * correctionStrength);
        } else {
          // Within flex-tune zone - minimal correction
          targetPitchRatioRef.current = 1.0;
        }
        
        // Slower smoothing for natural movement
        const smoothing = 0.5 + (retuneNorm * 0.3);
        currentPitchRatioRef.current += (targetPitchRatioRef.current - currentPitchRatioRef.current) * (1 - smoothing);
      }
      
      // Humanize: add micro-variations
      const humanize = options.humanize / 100;
      const humanizeOffset = (Math.random() - 0.5) * 0.008 * humanize;
      
      finalPitchRatio = currentPitchRatioRef.current + humanizeOffset;
      correctedPitch = detectedPitch * finalPitchRatio;
      
      // Send to Phase Vocoder
      if (phaseVocoderRef.current) {
        phaseVocoderRef.current.port.postMessage({ 
          pitchRatio: finalPitchRatio,
          wetMix: options.mix / 100,
          formantShift: options.formant, // Formant control
          retuneSpeed: retuneNorm,
          flexTune: flexTuneNorm,
          humanize: humanize
        });
      }
    } else if (phaseVocoderRef.current) {
      phaseVocoderRef.current.port.postMessage({ 
        pitchRatio: 1.0,
        wetMix: isBypassedRef.current ? 0.0 : options.mix / 100
      });
    }

    // Output level
    let outputLevel = inputLevel;
    if (analyserOutputRef.current) {
      const outBuf = new Float32Array(analyserOutputRef.current.fftSize);
      analyserOutputRef.current.getFloatTimeDomainData(outBuf);
      outputLevel = Math.min(100, calcRMS(outBuf) * 400);
    }

    // Pitch history
    const now = Date.now();
    const entry = {
      input: detectedPitch > 0 ? detectedPitch : pitchHistoryRef.current[pitchHistoryRef.current.length - 1]?.input || 0,
      corrected: correctedPitch > 0 ? correctedPitch : pitchHistoryRef.current[pitchHistoryRef.current.length - 1]?.corrected || 0,
      time: now
    };
    
    pitchHistoryRef.current = [
      ...pitchHistoryRef.current.filter(p => now - p.time < 5000),
      entry
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
      currentPitchShift: Math.round(finalPitchRatio * 1000) / 1000,
      formantShift: options.formant
    }));

    animationFrameRef.current = requestAnimationFrame(processAudio);
  }, [detectPitchYIN, findNearestNote, options]);

  // Initialize Phase Vocoder
  const initPhaseVocoder = useCallback(async (ctx: AudioContext): Promise<AudioWorkletNode> => {
    try {
      const blob = new Blob([proPhaseVocoderCode], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      
      await ctx.audioWorklet.addModule(url);
      const node = new AudioWorkletNode(ctx, 'pro-phase-vocoder', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2]
      });
      
      URL.revokeObjectURL(url);
      node.port.postMessage({ pitchRatio: 1.0, wetMix: 1.0 });
      
      return node;
    } catch (e) {
      console.error("Phase vocoder init failed:", e);
      throw e;
    }
  }, []);

  // Start
  const start = useCallback(async (deviceId?: string) => {
    try {
      const device = deviceId || state.selectedDevice;
      if (!device) throw new Error("No device");
      
      audioContextRef.current = new AudioContext({ 
        sampleRate: 48000,
        latencyHint: 'interactive'
      });

      const ctx = audioContextRef.current;

      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: device ? { exact: device } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 48000,
          channelCount: 2
        }
      });

      sourceRef.current = ctx.createMediaStreamSource(streamRef.current);
      
      // Analysers
      analyserInputRef.current = ctx.createAnalyser();
      analyserInputRef.current.fftSize = 4096;
      analyserInputRef.current.smoothingTimeConstant = 0.3;

      analyserOutputRef.current = ctx.createAnalyser();
      analyserOutputRef.current.fftSize = 2048;

      // Input gain
      inputGainRef.current = ctx.createGain();
      inputGainRef.current.gain.value = 1.0;

      // === PREMIUM EQ CHAIN ===
      
      // High-pass (remove rumble)
      highPassRef.current = ctx.createBiquadFilter();
      highPassRef.current.type = "highpass";
      highPassRef.current.frequency.value = 80;
      highPassRef.current.Q.value = 0.7;

      // Low shelf (warmth)
      lowShelfRef.current = ctx.createBiquadFilter();
      lowShelfRef.current.type = "lowshelf";
      lowShelfRef.current.frequency.value = 200;
      lowShelfRef.current.gain.value = 2;

      // Mid boost (body)
      midBoostRef.current = ctx.createBiquadFilter();
      midBoostRef.current.type = "peaking";
      midBoostRef.current.frequency.value = 800;
      midBoostRef.current.Q.value = 1.0;
      midBoostRef.current.gain.value = 1.5;

      // Presence
      presenceRef.current = ctx.createBiquadFilter();
      presenceRef.current.type = "peaking";
      presenceRef.current.frequency.value = 3500;
      presenceRef.current.Q.value = 1.2;
      presenceRef.current.gain.value = 3;

      // Air
      airRef.current = ctx.createBiquadFilter();
      airRef.current.type = "highshelf";
      airRef.current.frequency.value = 10000;
      airRef.current.gain.value = 2;

      // Low-pass (remove harshness)
      lowPassRef.current = ctx.createBiquadFilter();
      lowPassRef.current.type = "lowpass";
      lowPassRef.current.frequency.value = 16000;

      // Compressor
      compressorRef.current = ctx.createDynamicsCompressor();
      compressorRef.current.threshold.value = -18;
      compressorRef.current.knee.value = 6;
      compressorRef.current.ratio.value = 4;
      compressorRef.current.attack.value = 0.003;
      compressorRef.current.release.value = 0.1;

      // Phase Vocoder
      const phaseVocoder = await initPhaseVocoder(ctx);
      phaseVocoderRef.current = phaseVocoder;

      // Monitor gain
      monitorGainRef.current = ctx.createGain();
      monitorGainRef.current.gain.value = monitorVolumeRef.current;

      // === CONNECT GRAPH ===
      // Source -> Input Gain -> Analyser
      //                     -> EQ Chain -> Phase Vocoder -> Compressor -> Output Analyser -> Monitor -> Speakers
      
      sourceRef.current.connect(inputGainRef.current);
      inputGainRef.current.connect(analyserInputRef.current);
      
      inputGainRef.current.connect(highPassRef.current);
      highPassRef.current.connect(lowShelfRef.current);
      lowShelfRef.current.connect(midBoostRef.current);
      midBoostRef.current.connect(presenceRef.current);
      presenceRef.current.connect(airRef.current);
      airRef.current.connect(lowPassRef.current);
      lowPassRef.current.connect(phaseVocoder);
      
      phaseVocoder.connect(compressorRef.current);
      compressorRef.current.connect(analyserOutputRef.current);
      analyserOutputRef.current.connect(monitorGainRef.current);
      monitorGainRef.current.connect(ctx.destination);

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
        selectedDevice: device || prev.selectedDevice,
        pitchHistory: []
      }));
      
      processAudio();

    } catch (e) {
      console.error("Start failed:", e);
      throw e;
    }
  }, [processAudio, state.selectedDevice, initPhaseVocoder]);

  // Stop
  const stop = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const nodes = [
      sourceRef, analyserInputRef, analyserOutputRef, inputGainRef, monitorGainRef,
      highPassRef, lowShelfRef, midBoostRef, presenceRef, airRef, lowPassRef, compressorRef
    ];

    nodes.forEach(ref => {
      if (ref.current) {
        try { ref.current.disconnect(); } catch (e) {}
        ref.current = null;
      }
    });

    if (phaseVocoderRef.current) {
      try { phaseVocoderRef.current.disconnect(); } catch (e) {}
      phaseVocoderRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
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

  // Device change
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
