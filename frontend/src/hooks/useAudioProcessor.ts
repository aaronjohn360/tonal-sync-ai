import { useState, useRef, useCallback, useEffect } from "react";

// Note frequencies for pitch detection
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

interface AudioProcessorState {
  isActive: boolean;
  isBypassed: boolean;
  inputLevel: number;
  outputLevel: number;
  detectedPitch: number;
  detectedNote: string;
  correctedPitch: number;
  correctedNote: string;
  pitchError: number;
  availableDevices: AudioDevice[];
  selectedDevice: string | null;
  pitchHistory: { input: number; corrected: number; time: number }[];
  monitorVolume: number;
  isMonitoring: boolean;
}

interface UseAudioProcessorOptions {
  retuneSpeed: number;
  humanize: number;
  formant: number;
  mix: number;
  selectedKey: string;
  selectedScale: string;
}

export const useAudioProcessor = (options: UseAudioProcessorOptions) => {
  const [state, setState] = useState<AudioProcessorState>({
    isActive: false,
    isBypassed: false,
    inputLevel: 0,
    outputLevel: 0,
    detectedPitch: 0,
    detectedNote: "-",
    correctedPitch: 0,
    correctedNote: "-",
    pitchError: 0,
    availableDevices: [],
    selectedDevice: null,
    pitchHistory: [],
    monitorVolume: 75,
    isMonitoring: true
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Audio processing chain nodes
  const inputGainRef = useRef<GainNode | null>(null);
  const monitorGainRef = useRef<GainNode | null>(null);
  const outputGainRef = useRef<GainNode | null>(null);
  
  // HQ Audio Processing Nodes
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const highPassRef = useRef<BiquadFilterNode | null>(null);
  const lowPassRef = useRef<BiquadFilterNode | null>(null);
  const presenceBoostRef = useRef<BiquadFilterNode | null>(null);
  const airBoostRef = useRef<BiquadFilterNode | null>(null);
  const warmthRef = useRef<BiquadFilterNode | null>(null);
  const clarityBoostRef = useRef<BiquadFilterNode | null>(null);
  
  const animationFrameRef = useRef<number | null>(null);
  const isBypassedRef = useRef<boolean>(false);
  const isMonitoringRef = useRef<boolean>(true);
  const monitorVolumeRef = useRef<number>(0.75);
  const pitchHistoryRef = useRef<{ input: number; corrected: number; time: number }[]>([]);

  // Set monitor volume (0-100)
  const setMonitorVolume = useCallback((volume: number) => {
    const normalizedVolume = Math.max(0, Math.min(100, volume)) / 100;
    monitorVolumeRef.current = normalizedVolume;
    
    if (monitorGainRef.current && isMonitoringRef.current && !isBypassedRef.current) {
      monitorGainRef.current.gain.setTargetAtTime(normalizedVolume, audioContextRef.current?.currentTime || 0, 0.02);
    }
    
    setState(prev => ({ ...prev, monitorVolume: volume }));
  }, []);

  // Toggle monitoring (hearing yourself)
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
      // Request permission first to get device labels
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

  // Set bypass - mutes audio output when bypassed
  const setBypass = useCallback((bypassed: boolean) => {
    isBypassedRef.current = bypassed;
    
    if (monitorGainRef.current) {
      const volume = !bypassed && isMonitoringRef.current ? monitorVolumeRef.current : 0;
      monitorGainRef.current.gain.setTargetAtTime(volume, audioContextRef.current?.currentTime || 0, 0.02);
    }
    
    setState(prev => ({ ...prev, isBypassed: bypassed }));
  }, []);

  // Get valid notes for current key/scale
  const getScaleNotes = useCallback(() => {
    const keyIndex = NOTES.indexOf(options.selectedKey);
    const pattern = SCALE_PATTERNS[options.selectedScale] || SCALE_PATTERNS["Chromatic"];
    return pattern.map(semitone => NOTES[(keyIndex + semitone) % 12]);
  }, [options.selectedKey, options.selectedScale]);

  // Find nearest note in scale
  const findNearestNote = useCallback((frequency: number): { note: string; freq: number; cents: number; octave: number } => {
    if (frequency <= 0) return { note: "-", freq: 0, cents: 0, octave: 0 };

    const scaleNotes = getScaleNotes();
    let nearestNote = "";
    let nearestFreq = 0;
    let minCents = Infinity;
    let nearestOctave = 0;

    for (let octave = 0; octave <= 8; octave++) {
      for (const note of scaleNotes) {
        const baseFreq = NOTE_FREQUENCIES[note];
        const noteFreq = baseFreq * Math.pow(2, octave - 4);
        const cents = 1200 * Math.log2(frequency / noteFreq);

        if (Math.abs(cents) < Math.abs(minCents)) {
          minCents = cents;
          nearestNote = note;
          nearestFreq = noteFreq;
          nearestOctave = octave;
        }
      }
    }

    return { note: nearestNote, freq: nearestFreq, cents: minCents, octave: nearestOctave };
  }, [getScaleNotes]);

  // Autocorrelation pitch detection (simplified YIN algorithm)
  const detectPitch = useCallback((buffer: Float32Array, sampleRate: number): number => {
    const SIZE = buffer.length;
    const MAX_SAMPLES = Math.floor(SIZE / 2);
    const correlations = new Float32Array(MAX_SAMPLES);

    for (let lag = 0; lag < MAX_SAMPLES; lag++) {
      let sum = 0;
      for (let i = 0; i < MAX_SAMPLES; i++) {
        sum += buffer[i] * buffer[i + lag];
      }
      correlations[lag] = sum;
    }

    let maxCorrelation = 0;
    let bestLag = 0;
    let foundPeak = false;

    for (let lag = Math.floor(sampleRate / 1000); lag < MAX_SAMPLES; lag++) {
      if (correlations[lag] > maxCorrelation) {
        maxCorrelation = correlations[lag];
        bestLag = lag;
        foundPeak = true;
      }
      if (foundPeak && correlations[lag] < maxCorrelation * 0.9) {
        break;
      }
    }

    if (bestLag === 0 || maxCorrelation < 0.01) return 0;

    return sampleRate / bestLag;
  }, []);

  // Calculate RMS level
  const calculateRMS = (buffer: Float32Array): number => {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  };

  // Main audio processing loop
  const processAudio = useCallback(() => {
    if (!analyserRef.current || !audioContextRef.current) return;

    const bufferLength = analyserRef.current.fftSize;
    const buffer = new Float32Array(bufferLength);
    analyserRef.current.getFloatTimeDomainData(buffer);

    const rms = calculateRMS(buffer);
    const inputLevel = Math.min(100, rms * 500);

    const detectedPitch = detectPitch(buffer, audioContextRef.current.sampleRate);
    const { note, freq, cents } = findNearestNote(detectedPitch);
    
    const retuneAmount = options.retuneSpeed / 100;
    const humanizeAmount = options.humanize / 100;
    const randomHumanize = (Math.random() - 0.5) * humanizeAmount * 10;
    
    let targetPitch = freq;
    if (detectedPitch > 0 && freq > 0) {
      const correctionFactor = 1 - (1 - retuneAmount) * 0.9;
      const pitchRatio = freq / detectedPitch;
      const correctedRatio = 1 + (pitchRatio - 1) * correctionFactor;
      targetPitch = detectedPitch * correctedRatio;
      targetPitch *= 1 + (randomHumanize / 1200);
    }

    // Update pitch history for graph visualization
    const now = Date.now();
    pitchHistoryRef.current = [
      ...pitchHistoryRef.current.filter(p => now - p.time < 5000),
      { input: detectedPitch, corrected: targetPitch, time: now }
    ].slice(-250);

    const mixAmount = options.mix / 100;
    const outputLevel = isBypassedRef.current ? 0 : inputLevel * (0.8 + mixAmount * 0.2);

    setState(prev => ({
      ...prev,
      inputLevel,
      outputLevel,
      detectedPitch: Math.round(detectedPitch * 10) / 10,
      detectedNote: note || "-",
      correctedPitch: Math.round(targetPitch * 10) / 10,
      correctedNote: note || "-",
      pitchError: Math.round(cents),
      pitchHistory: pitchHistoryRef.current
    }));

    animationFrameRef.current = requestAnimationFrame(processAudio);
  }, [detectPitch, findNearestNote, options.retuneSpeed, options.humanize, options.mix]);

  // Create HQ Audio Processing Chain
  const createHQProcessingChain = useCallback((ctx: AudioContext) => {
    // High-pass filter to remove rumble and muddiness (80Hz)
    highPassRef.current = ctx.createBiquadFilter();
    highPassRef.current.type = "highpass";
    highPassRef.current.frequency.value = 80;
    highPassRef.current.Q.value = 0.7;

    // Low-pass filter to remove harsh frequencies (16kHz)
    lowPassRef.current = ctx.createBiquadFilter();
    lowPassRef.current.type = "lowpass";
    lowPassRef.current.frequency.value = 16000;
    lowPassRef.current.Q.value = 0.7;

    // Warmth boost (200-400Hz range)
    warmthRef.current = ctx.createBiquadFilter();
    warmthRef.current.type = "peaking";
    warmthRef.current.frequency.value = 280;
    warmthRef.current.Q.value = 1.0;
    warmthRef.current.gain.value = 2; // Subtle warmth

    // Clarity boost (2-4kHz presence)
    clarityBoostRef.current = ctx.createBiquadFilter();
    clarityBoostRef.current.type = "peaking";
    clarityBoostRef.current.frequency.value = 3000;
    clarityBoostRef.current.Q.value = 1.2;
    clarityBoostRef.current.gain.value = 3; // Crisp presence

    // Presence boost (4-6kHz)
    presenceBoostRef.current = ctx.createBiquadFilter();
    presenceBoostRef.current.type = "peaking";
    presenceBoostRef.current.frequency.value = 5000;
    presenceBoostRef.current.Q.value = 1.0;
    presenceBoostRef.current.gain.value = 2;

    // Air/brightness boost (10-12kHz)
    airBoostRef.current = ctx.createBiquadFilter();
    airBoostRef.current.type = "highshelf";
    airBoostRef.current.frequency.value = 10000;
    airBoostRef.current.gain.value = 2; // Subtle air

    // Compressor for consistent levels and punch
    compressorRef.current = ctx.createDynamicsCompressor();
    compressorRef.current.threshold.value = -24; // Start compressing at -24dB
    compressorRef.current.knee.value = 6; // Soft knee for natural sound
    compressorRef.current.ratio.value = 4; // 4:1 ratio
    compressorRef.current.attack.value = 0.003; // 3ms attack for fast transients
    compressorRef.current.release.value = 0.15; // 150ms release

    // Chain the filters
    highPassRef.current.connect(warmthRef.current);
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

  // Start audio processing with selected device
  const start = useCallback(async (deviceId?: string) => {
    try {
      const targetDevice = deviceId || state.selectedDevice;
      
      if (!targetDevice) {
        throw new Error("No device selected");
      }
      
      // Create audio context with high quality settings
      audioContextRef.current = new AudioContext({ 
        sampleRate: 48000, // Higher sample rate for better quality
        latencyHint: 'interactive' // Low latency for monitoring
      });

      // Get user media with optimized settings for voice
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: targetDevice ? { exact: targetDevice } : undefined,
          echoCancellation: false, // Disable for monitoring
          noiseSuppression: true,
          autoGainControl: false, // We'll handle gain ourselves
          sampleRate: 48000,
          channelCount: 1
        }
      });

      const ctx = audioContextRef.current;

      // Create source from microphone
      sourceRef.current = ctx.createMediaStreamSource(streamRef.current);
      
      // Create analyser for pitch detection
      analyserRef.current = ctx.createAnalyser();
      analyserRef.current.fftSize = 2048;
      analyserRef.current.smoothingTimeConstant = 0.8;

      // Input gain control
      inputGainRef.current = ctx.createGain();
      inputGainRef.current.gain.value = 1.0;

      // Create HQ processing chain
      const hqChain = createHQProcessingChain(ctx);

      // Monitor gain (for hearing yourself)
      monitorGainRef.current = ctx.createGain();
      monitorGainRef.current.gain.value = monitorVolumeRef.current;

      // Output gain
      outputGainRef.current = ctx.createGain();
      outputGainRef.current.gain.value = 1.0;

      // Connect the audio graph:
      // Source -> Input Gain -> Analyser (for pitch detection)
      //                      -> HQ Chain -> Monitor Gain -> Output -> Speakers
      
      sourceRef.current.connect(inputGainRef.current);
      
      // Split for analysis and processing
      inputGainRef.current.connect(analyserRef.current);
      inputGainRef.current.connect(hqChain.input);
      
      // HQ processing to monitor
      hqChain.output.connect(monitorGainRef.current);
      monitorGainRef.current.connect(outputGainRef.current);
      outputGainRef.current.connect(ctx.destination);

      isBypassedRef.current = false;
      isMonitoringRef.current = true;
      pitchHistoryRef.current = [];
      
      setState(prev => ({ 
        ...prev, 
        isActive: true, 
        isBypassed: false,
        isMonitoring: true,
        selectedDevice: targetDevice || prev.selectedDevice,
        pitchHistory: []
      }));
      
      processAudio();

    } catch (error) {
      console.error("Failed to start audio processing:", error);
      throw error;
    }
  }, [processAudio, state.selectedDevice, createHQProcessingChain]);

  // Stop audio processing
  const stop = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Disconnect all nodes
    const nodesToDisconnect = [
      sourceRef,
      analyserRef,
      inputGainRef,
      monitorGainRef,
      outputGainRef,
      compressorRef,
      highPassRef,
      lowPassRef,
      presenceBoostRef,
      airBoostRef,
      warmthRef,
      clarityBoostRef
    ];

    nodesToDisconnect.forEach(ref => {
      if (ref.current) {
        try {
          ref.current.disconnect();
        } catch (e) {
          // Ignore disconnect errors
        }
        ref.current = null;
      }
    });

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
      pitchHistory: []
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  // Listen for device changes
  useEffect(() => {
    const handleDeviceChange = () => {
      enumerateDevices();
    };

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
    setMonitoring
  };
};
