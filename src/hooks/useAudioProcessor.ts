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
    pitchHistory: []
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const pitchShifterGainRef = useRef<GainNode | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const correctedPitchRef = useRef<number>(0);
  const isBypassedRef = useRef<boolean>(false);
  const pitchHistoryRef = useRef<{ input: number; corrected: number; time: number }[]>([]);

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
  const selectDevice = useCallback((deviceId: string) => {
    setState(prev => ({ ...prev, selectedDevice: deviceId }));
  }, []);

  // Set bypass
  const setBypass = useCallback((bypassed: boolean) => {
    isBypassedRef.current = bypassed;
    setState(prev => ({ ...prev, isBypassed: bypassed }));
    
    // Mute/unmute the pitch shifted output
    if (pitchShifterGainRef.current && gainNodeRef.current) {
      if (bypassed) {
        pitchShifterGainRef.current.gain.value = 0;
        gainNodeRef.current.gain.value = options.mix / 100;
      } else {
        pitchShifterGainRef.current.gain.value = options.mix / 100;
        gainNodeRef.current.gain.value = 0;
      }
    }
  }, [options.mix]);

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

  // Update pitch shifter oscillator
  const updatePitchShifter = useCallback((targetFreq: number) => {
    if (!audioContextRef.current || !oscillatorRef.current) return;
    
    if (targetFreq > 0 && !isBypassedRef.current) {
      oscillatorRef.current.frequency.setTargetAtTime(
        targetFreq,
        audioContextRef.current.currentTime,
        0.01 // Smooth transition
      );
    }
  }, []);

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
      
      // Update pitch shifter with corrected frequency
      updatePitchShifter(targetPitch);
    }

    correctedPitchRef.current = targetPitch;

    // Update pitch history for graph visualization
    const now = Date.now();
    pitchHistoryRef.current = [
      ...pitchHistoryRef.current.filter(p => now - p.time < 5000),
      { input: detectedPitch, corrected: targetPitch, time: now }
    ].slice(-250); // Keep last 250 samples

    const mixAmount = options.mix / 100;
    const outputLevel = isBypassedRef.current ? inputLevel : inputLevel * (0.8 + mixAmount * 0.2);

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
  }, [detectPitch, findNearestNote, options.retuneSpeed, options.humanize, options.mix, updatePitchShifter]);

  // Start audio processing with selected device
  const start = useCallback(async (deviceId?: string) => {
    try {
      const targetDevice = deviceId || state.selectedDevice;
      
      audioContextRef.current = new AudioContext({ sampleRate: 44100 });

      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: targetDevice ? { exact: targetDevice } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      sourceRef.current = audioContextRef.current.createMediaStreamSource(streamRef.current);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      analyserRef.current.smoothingTimeConstant = 0.8;

      // Create gain node for dry signal (used in bypass mode)
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.gain.value = 0; // Start with wet signal

      // Create oscillator-based pitch shifter
      oscillatorRef.current = audioContextRef.current.createOscillator();
      oscillatorRef.current.type = 'sine';
      oscillatorRef.current.frequency.value = 440;
      
      // Create gain for pitch shifted signal
      pitchShifterGainRef.current = audioContextRef.current.createGain();
      pitchShifterGainRef.current.gain.value = options.mix / 100;

      // Connect: source -> analyser
      sourceRef.current.connect(analyserRef.current);
      
      // Dry path (bypass): analyser -> gain -> destination
      analyserRef.current.connect(gainNodeRef.current);
      gainNodeRef.current.connect(audioContextRef.current.destination);
      
      // Wet path (pitch shifted): oscillator -> pitchShifterGain -> destination
      oscillatorRef.current.connect(pitchShifterGainRef.current);
      pitchShifterGainRef.current.connect(audioContextRef.current.destination);
      
      oscillatorRef.current.start();

      isBypassedRef.current = false;
      pitchHistoryRef.current = [];
      
      setState(prev => ({ 
        ...prev, 
        isActive: true, 
        isBypassed: false,
        selectedDevice: targetDevice || prev.selectedDevice,
        pitchHistory: []
      }));
      
      processAudio();

    } catch (error) {
      console.error("Failed to start audio processing:", error);
      throw error;
    }
  }, [options.mix, processAudio, state.selectedDevice]);

  // Stop audio processing
  const stop = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    if (oscillatorRef.current) {
      oscillatorRef.current.stop();
      oscillatorRef.current.disconnect();
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
    }

    if (analyserRef.current) {
      analyserRef.current.disconnect();
    }

    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect();
    }

    if (pitchShifterGainRef.current) {
      pitchShifterGainRef.current.disconnect();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    pitchHistoryRef.current = [];

    setState(prev => ({
      ...prev,
      isActive: false,
      isBypassed: false,
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

  // Update gains when mix changes
  useEffect(() => {
    if (pitchShifterGainRef.current && !isBypassedRef.current) {
      pitchShifterGainRef.current.gain.value = options.mix / 100;
    }
  }, [options.mix]);

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
    setBypass
  };
};