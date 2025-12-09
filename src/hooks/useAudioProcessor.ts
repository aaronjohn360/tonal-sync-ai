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

interface AudioProcessorState {
  isActive: boolean;
  inputLevel: number;
  outputLevel: number;
  detectedPitch: number;
  detectedNote: string;
  correctedPitch: number;
  correctedNote: string;
  pitchError: number; // cents
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
    inputLevel: 0,
    outputLevel: 0,
    detectedPitch: 0,
    detectedNote: "-",
    correctedPitch: 0,
    correctedNote: "-",
    pitchError: 0
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const pitchShifterRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const correctedPitchRef = useRef<number>(0);

  // Get valid notes for current key/scale
  const getScaleNotes = useCallback(() => {
    const keyIndex = NOTES.indexOf(options.selectedKey);
    const pattern = SCALE_PATTERNS[options.selectedScale] || SCALE_PATTERNS["Chromatic"];
    return pattern.map(semitone => NOTES[(keyIndex + semitone) % 12]);
  }, [options.selectedKey, options.selectedScale]);

  // Find nearest note in scale
  const findNearestNote = useCallback((frequency: number): { note: string; freq: number; cents: number } => {
    if (frequency <= 0) return { note: "-", freq: 0, cents: 0 };

    const scaleNotes = getScaleNotes();
    let nearestNote = "";
    let nearestFreq = 0;
    let minCents = Infinity;

    // Check multiple octaves
    for (let octave = 0; octave <= 8; octave++) {
      for (const note of scaleNotes) {
        const baseFreq = NOTE_FREQUENCIES[note];
        const noteFreq = baseFreq * Math.pow(2, octave - 4);
        const cents = 1200 * Math.log2(frequency / noteFreq);

        if (Math.abs(cents) < Math.abs(minCents)) {
          minCents = cents;
          nearestNote = note;
          nearestFreq = noteFreq;
        }
      }
    }

    return { note: nearestNote, freq: nearestFreq, cents: minCents };
  }, [getScaleNotes]);

  // Autocorrelation pitch detection (simplified YIN algorithm)
  const detectPitch = useCallback((buffer: Float32Array, sampleRate: number): number => {
    const SIZE = buffer.length;
    const MAX_SAMPLES = Math.floor(SIZE / 2);
    const correlations = new Float32Array(MAX_SAMPLES);

    // Calculate autocorrelation
    for (let lag = 0; lag < MAX_SAMPLES; lag++) {
      let sum = 0;
      for (let i = 0; i < MAX_SAMPLES; i++) {
        sum += buffer[i] * buffer[i + lag];
      }
      correlations[lag] = sum;
    }

    // Find the first peak
    let maxCorrelation = 0;
    let bestLag = 0;
    let foundPeak = false;

    for (let lag = Math.floor(sampleRate / 1000); lag < MAX_SAMPLES; lag++) {
      if (correlations[lag] > maxCorrelation) {
        maxCorrelation = correlations[lag];
        bestLag = lag;
        foundPeak = true;
      }
      // Break if we've passed the peak
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

    // Detect pitch
    const detectedPitch = detectPitch(buffer, audioContextRef.current.sampleRate);
    
    // Find nearest note and calculate correction
    const { note, freq, cents } = findNearestNote(detectedPitch);
    
    // Apply retune speed (faster = snappier correction)
    const retuneAmount = options.retuneSpeed / 100;
    const humanizeAmount = options.humanize / 100;
    const randomHumanize = (Math.random() - 0.5) * humanizeAmount * 10;
    
    // Smooth pitch correction
    let targetPitch = freq;
    if (detectedPitch > 0 && freq > 0) {
      const correctionFactor = 1 - (1 - retuneAmount) * 0.9;
      const pitchRatio = freq / detectedPitch;
      const correctedRatio = 1 + (pitchRatio - 1) * correctionFactor;
      targetPitch = detectedPitch * correctedRatio;
      
      // Add humanization
      targetPitch *= 1 + (randomHumanize / 1200);
    }

    correctedPitchRef.current = targetPitch;

    // Calculate output level based on mix
    const mixAmount = options.mix / 100;
    const outputLevel = inputLevel * (0.8 + mixAmount * 0.2);

    setState(prev => ({
      ...prev,
      inputLevel,
      outputLevel,
      detectedPitch: Math.round(detectedPitch * 10) / 10,
      detectedNote: note || "-",
      correctedPitch: Math.round(targetPitch * 10) / 10,
      correctedNote: note || "-",
      pitchError: Math.round(cents)
    }));

    animationFrameRef.current = requestAnimationFrame(processAudio);
  }, [detectPitch, findNearestNote, options.retuneSpeed, options.humanize, options.mix]);

  // Start audio processing
  const start = useCallback(async () => {
    try {
      // Create audio context
      audioContextRef.current = new AudioContext({ sampleRate: 44100 });

      // Request microphone access
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      // Create audio nodes
      sourceRef.current = audioContextRef.current.createMediaStreamSource(streamRef.current);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      analyserRef.current.smoothingTimeConstant = 0.8;

      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.gain.value = options.mix / 100;

      // Connect nodes: source -> analyser -> gain -> destination
      sourceRef.current.connect(analyserRef.current);
      analyserRef.current.connect(gainNodeRef.current);
      gainNodeRef.current.connect(audioContextRef.current.destination);

      setState(prev => ({ ...prev, isActive: true }));
      processAudio();

    } catch (error) {
      console.error("Failed to start audio processing:", error);
      throw error;
    }
  }, [options.mix, processAudio]);

  // Stop audio processing
  const stop = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
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

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    setState({
      isActive: false,
      inputLevel: 0,
      outputLevel: 0,
      detectedPitch: 0,
      detectedNote: "-",
      correctedPitch: 0,
      correctedNote: "-",
      pitchError: 0
    });
  }, []);

  // Update gain when mix changes
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = options.mix / 100;
    }
  }, [options.mix]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    ...state,
    start,
    stop,
    toggle: state.isActive ? stop : start
  };
};
