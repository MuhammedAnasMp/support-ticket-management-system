import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, Square, Play, Pause, Trash2, Check, AlertCircle } from 'lucide-react';

interface VoiceRecorderProps {
    onSave: (file: File) => void;
    onCancel?: () => void;
    onRecordingStateChange?: (isPending: boolean) => void;
    placeholderText?: string;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
    onSave,
    onCancel,
    onRecordingStateChange,
    placeholderText = "Record a voice note"
}) => {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackProgress, setPlaybackProgress] = useState(0); // 0 to 1
    const [duration, setDuration] = useState(0);
    const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const timerRef = useRef<number | null>(null);
    const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

    // Canvas & Web Audio API refs
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const animationRef = useRef<number | null>(null);
    const playbackAnimRef = useRef<number | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);

    // Notify parent component of state changes
    useEffect(() => {
        if (onRecordingStateChange) {
            onRecordingStateChange(isRecording || audioBlob !== null);
        }
    }, [isRecording, audioBlob, onRecordingStateChange]);

    // Cleanup resources on unmount
    useEffect(() => {
        return () => {
            stopStreamAndTimer();
            if (audioUrl) URL.revokeObjectURL(audioUrl);
            if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
                audioCtxRef.current.close();
            }
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            if (playbackAnimRef.current) cancelAnimationFrame(playbackAnimRef.current);
        };
    }, [audioUrl]);

    const stopStreamAndTimer = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    };

    // Helper to read theme CSS tokens for canvas drawing
    const getCssToken = (varName: string, fallback: string): string => {
        if (typeof window === 'undefined') return fallback;
        const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
        return val || fallback;
    };

    /**
     * Robust secure-context / mic-support check.
     *
     * `window.isSecureContext` is the correct signal, but it can read `false`
     * (or be `undefined`, which also fails a naive `!window.isSecureContext`
     * check) in a few situations that are NOT actually insecure:
     *   - Sandboxed iframes that don't inherit the parent's secure context
     *   - Some in-app / webview browsers (e.g. opened from a social app)
     *   - Very old browsers where the property doesn't exist at all
     *
     * We fall back to inspecting location.protocol/hostname directly, and we
     * differentiate the error messages so it's obvious from the UI what's
     * actually wrong (protocol vs. missing API vs. permission).
     */
    const getSecureContextDiagnostics = (): { ok: boolean; reason?: string } => {
        if (typeof window === 'undefined') return { ok: false, reason: 'no-window' };

        const protocol = window.location.protocol; // 'https:' | 'http:' | ...
        const hostname = window.location.hostname;
        const isLocalhost =
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname === '[::1]' ||
            hostname.endsWith('.localhost');

        // Prefer the browser's own verdict when it's available and explicitly false/true.
        if (typeof window.isSecureContext === 'boolean') {
            if (window.isSecureContext) return { ok: true };
            // Browser says insecure — check if that's just a protocol issue we can explain,
            // or something else (e.g. sandboxed iframe, webview quirk).
            if (protocol !== 'https:' && !isLocalhost) {
                return { ok: false, reason: 'http' };
            }
            return { ok: false, reason: 'context' }; // iframe/webview/other restriction
        }

        // window.isSecureContext missing entirely (old browser) — fall back to protocol check.
        if (protocol === 'https:' || isLocalhost) return { ok: true };
        return { ok: false, reason: 'http' };
    };

    const checkMicAvailability = async (): Promise<boolean> => {
        const { ok, reason } = getSecureContextDiagnostics();
        if (!ok) {
            if (reason === 'http') {
                setErrorMsg("Voice recording requires HTTPS. This page is being loaded over an insecure http:// connection — check the URL bar.");
            } else if (reason === 'context') {
                setErrorMsg("Voice recording is blocked in this embedded view (e.g. an in-app browser or iframe). Try opening this page in your default browser.");
            } else {
                setErrorMsg("Voice recording requires a secure connection (HTTPS or localhost). Please check your URL.");
            }
            return false;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setErrorMsg("Recording is not supported in this browser.");
            return false;
        }

        return true;
    };

    // Generate immediate default peak heights for instant rendering
    const generateDefaultPeaks = (): number[] => {
        return Array.from({ length: 55 }, () => 0.2 + Math.random() * 0.65);
    };

    // Asynchronously decode audio blob to extract exact peak amplitudes
    const extractWaveformPeaks = async (blob: Blob) => {
        try {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioCtx) return;

            const tempCtx = new AudioCtx();
            const arrayBuffer = await blob.arrayBuffer();
            const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);

            if (audioBuffer.duration && isFinite(audioBuffer.duration)) {
                setDuration(audioBuffer.duration);
            }

            const channelData = audioBuffer.getChannelData(0);
            const totalBars = 55;
            const blockSize = Math.floor(channelData.length / totalBars);
            const peaks: number[] = [];

            for (let i = 0; i < totalBars; i++) {
                const start = i * blockSize;
                let max = 0;
                for (let j = 0; j < blockSize; j += 4) {
                    const val = Math.abs(channelData[start + j] || 0);
                    if (val > max) max = val;
                }
                peaks.push(max);
            }

            const maxPeak = Math.max(...peaks, 0.01);
            const normalizedPeaks = peaks.map(p => Math.max(0.15, p / maxPeak));
            setWaveformPeaks(normalizedPeaks);

            tempCtx.close();
        } catch (err) {
            console.warn("Waveform decoding fallback activated:", err);
            // Fallback stays active
        }
    };

    const startRecording = async () => {
        setErrorMsg(null);
        setAudioBlob(null);
        setWaveformPeaks([]);
        setPlaybackProgress(0);
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
            setAudioUrl(null);
        }

        const micAvailable = await checkMicAvailability();
        if (!micAvailable) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            let recorder: MediaRecorder;
            try {
                recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            } catch (e) {
                recorder = new MediaRecorder(stream);
            }

            mediaRecorderRef.current = recorder;
            const chunks: BlobPart[] = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            recorder.onstop = async () => {
                const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
                const url = URL.createObjectURL(blob);
                setAudioBlob(blob);
                setAudioUrl(url);

                // Set initial default peaks immediately so graph shows instantly
                const defaultPeaks = generateDefaultPeaks();
                setWaveformPeaks(defaultPeaks);

                // Asynchronously refine with real audio peaks
                await extractWaveformPeaks(blob);
            };

            // Setup Web Audio API Analyser for Live Recording Visualizer
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioCtx) {
                const audioCtx = new AudioCtx();
                audioCtxRef.current = audioCtx;
                if (audioCtx.state === 'suspended') {
                    await audioCtx.resume();
                }

                const analyser = audioCtx.createAnalyser();
                analyser.fftSize = 64;
                analyser.smoothingTimeConstant = 0.75;
                analyserRef.current = analyser;

                const source = audioCtx.createMediaStreamSource(stream);
                source.connect(analyser);
            }

            recorder.start(100);
            setIsRecording(true);
            setRecordingTime(0);

            timerRef.current = window.setInterval(() => {
                setRecordingTime(t => t + 1);
            }, 1000);

        } catch (err: any) {
            console.error("Start recording failed:", err);
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                setErrorMsg("Microphone access denied. Please check permissions.");
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                setErrorMsg("No microphone found on this device.");
            } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
                setErrorMsg("Your microphone is busy or unavailable. Close other apps using it and try again.");
            } else {
                setErrorMsg("Failed to start recording.");
            }
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            stopStreamAndTimer();

            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
            if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
                audioCtxRef.current.close();
                audioCtxRef.current = null;
            }
        }
    };

    // Draw Live Microphone Spectrum Diagram during Recording
    const drawLiveRecordingDiagram = useCallback(() => {
        if (!canvasRef.current || !analyserRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const analyser = analyserRef.current;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const primaryColor = getCssToken('--primary', '#005bbf');
        const primaryContainerColor = getCssToken('--primary-container', '#1a73e8');

        const draw = () => {
            if (!analyserRef.current || !canvasRef.current) return;
            animationRef.current = requestAnimationFrame(draw);

            analyser.getByteFrequencyData(dataArray);
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const barWidth = 3;
            const gap = 2;
            const totalBars = Math.floor(canvas.width / (barWidth + gap));
            const step = Math.max(1, Math.floor(bufferLength / totalBars));

            for (let i = 0; i < totalBars; i++) {
                const dataIndex = Math.min(i * step, bufferLength - 1);
                const value = dataArray[dataIndex] || 0;

                // Boost amplitude gain so normal speaking volume is clearly visible
                const percent = Math.min(1, (value / 255) * 1.8);
                const barHeight = Math.max(3, percent * (canvas.height - 4));

                const x = i * (barWidth + gap);
                const y = (canvas.height - barHeight) / 2;

                ctx.fillStyle = percent > 0.15 ? primaryColor : primaryContainerColor;
                ctx.beginPath();
                ctx.roundRect(x, y, barWidth, barHeight, 1.5);
                ctx.fill();
            }
        };

        draw();
    }, []);

    // Effect: Start live visualizer when canvas mounts
    useEffect(() => {
        if (isRecording) {
            const timer = setTimeout(() => {
                drawLiveRecordingDiagram();
            }, 50);

            return () => {
                clearTimeout(timer);
                if (animationRef.current) {
                    cancelAnimationFrame(animationRef.current);
                    animationRef.current = null;
                }
            };
        }
    }, [isRecording, drawLiveRecordingDiagram]);

    // Draw Playback Waveform Graph Diagram
    const drawPlaybackDiagram = useCallback((progress: number) => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const primaryColor = getCssToken('--primary', '#005bbf');
        const outlineVariantColor = getCssToken('--outline-variant', '#E0E2E6');

        const peaks = waveformPeaks.length > 0 ? waveformPeaks : generateDefaultPeaks();
        const totalBars = peaks.length;
        const barWidth = 3;
        const gap = 2;
        const totalWidth = totalBars * (barWidth + gap);
        const startX = Math.max(0, (canvas.width - totalWidth) / 2);

        peaks.forEach((peak, i) => {
            const barRatio = i / totalBars;
            const isPlayed = barRatio <= progress;

            const barHeight = Math.max(3, peak * (canvas.height - 6));
            const x = startX + i * (barWidth + gap);
            const y = (canvas.height - barHeight) / 2;

            ctx.fillStyle = isPlayed ? primaryColor : outlineVariantColor;
            ctx.beginPath();
            ctx.roundRect(x, y, barWidth, barHeight, 1.5);
            ctx.fill();
        });

        // Playhead cursor indicator
        const cursorX = startX + progress * totalWidth;
        ctx.fillStyle = primaryColor;
        ctx.fillRect(Math.max(0, cursorX - 1), 0, 2, canvas.height);

    }, [waveformPeaks]);

    // Redraw playback graph on state changes
    useEffect(() => {
        if (!isRecording && audioUrl) {
            drawPlaybackDiagram(playbackProgress);
        }
    }, [isRecording, audioUrl, playbackProgress, drawPlaybackDiagram]);

    // Smooth 60 FPS Playback Animation Loop
    useEffect(() => {
        if (isPlaying && audioPlayerRef.current) {
            const updateLoop = () => {
                if (audioPlayerRef.current) {
                    const player = audioPlayerRef.current;
                    const current = player.currentTime;

                    // Fix WebM Infinity/NaN duration browser bug by using recorded time as fallback
                    let total = player.duration;
                    if (!total || !isFinite(total) || isNaN(total)) {
                        total = duration || recordingTime || 1;
                    }

                    const progress = Math.min(1, Math.max(0, current / total));
                    setPlaybackProgress(progress);
                    drawPlaybackDiagram(progress);
                }
                playbackAnimRef.current = requestAnimationFrame(updateLoop);
            };

            playbackAnimRef.current = requestAnimationFrame(updateLoop);

            return () => {
                if (playbackAnimRef.current) {
                    cancelAnimationFrame(playbackAnimRef.current);
                    playbackAnimRef.current = null;
                }
            };
        }
    }, [isPlaying, duration, recordingTime, drawPlaybackDiagram]);

    const togglePlayback = () => {
        if (!audioPlayerRef.current || !audioUrl) return;
        const player = audioPlayerRef.current;

        if (isPlaying) {
            player.pause();
            setIsPlaying(false);
        } else {
            player.play();
            setIsPlaying(true);
        }
    };

    // Click canvas playback graph to seek to time
    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!canvasRef.current || !audioPlayerRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickRatio = Math.max(0, Math.min(1, clickX / rect.width));

        const player = audioPlayerRef.current;
        let total = player.duration;
        if (!total || !isFinite(total) || isNaN(total)) {
            total = duration || recordingTime || 1;
        }

        player.currentTime = clickRatio * total;
        setPlaybackProgress(clickRatio);
        drawPlaybackDiagram(clickRatio);
    };

    const handleDelete = () => {
        stopStreamAndTimer();
        setAudioBlob(null);
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
            setAudioUrl(null);
        }
        setIsRecording(false);
        setRecordingTime(0);
        setIsPlaying(false);
        setPlaybackProgress(0);
        setWaveformPeaks([]);
        setErrorMsg(null);
        if (onCancel) onCancel();
    };

    const handleConfirm = () => {
        if (audioBlob) {
            const extension = audioBlob.type.includes('webm') ? 'webm' : 'mp4';
            const fileName = `voice_note_${Date.now()}.${extension}`;
            const file = new File([audioBlob], fileName, { type: audioBlob.type });
            onSave(file);
            setAudioBlob(null);
            setAudioUrl(null);
            setRecordingTime(0);
            setPlaybackProgress(0);
            setWaveformPeaks([]);
        }
    };

    const formatTime = (secs: number): string => {
        const m = Math.floor(secs / 60).toString().padStart(2, '0');
        const s = Math.floor(secs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    return (
        <div className="bg-surface-container border border-outline-variant rounded p-3 w-full flex flex-col gap-2.5">
            <div className="flex items-center gap-3 w-full min-h-[40px]">

                {/* State 1: Active Recording Visualizer Graph Diagram */}
                {isRecording ? (
                    <div className="flex-1 flex items-center gap-3 min-w-0">
                        <span className="flex h-2.5 w-2.5 relative shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-error"></span>
                        </span>
                        <span className="font-mono text-xs font-semibold text-on-surface w-10 shrink-0 select-none">
                            {formatTime(recordingTime)}
                        </span>

                        {/* Live Recording Audio Spectrum Diagram */}
                        <div className="flex-1 flex items-center h-8 bg-surface border border-outline-variant rounded px-2 overflow-hidden">
                            <canvas
                                ref={canvasRef}
                                width={280}
                                height={28}
                                className="w-full h-7 block"
                            />
                        </div>
                    </div>
                ) : audioUrl ? (

                    /* State 2: Recorded Audio - Animated Playback Waveform Graph Diagram */
                    <div className="flex-1 flex items-center gap-3 min-w-0">
                        <button
                            type="button"
                            onClick={togglePlayback}
                            className="p-2 rounded bg-primary-container text-on-primary-container hover:bg-primary hover:text-on-primary transition-colors flex items-center justify-center shrink-0 cursor-pointer"
                            aria-label={isPlaying ? "Pause playback" : "Start playback"}
                        >
                            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                        </button>

                        {/* Interactive Playback Waveform Graph Diagram (Clickable Seek Bar) */}
                        <div className="flex-1 flex items-center gap-2 bg-surface border border-outline-variant rounded py-1 px-2.5 h-8 min-w-0">
                            <canvas
                                ref={canvasRef}
                                width={280}
                                height={28}
                                onClick={handleCanvasClick}
                                className="w-full h-7 block cursor-pointer"
                                title="Click to seek audio"
                            />
                            <span className="font-mono text-[11px] text-on-surface-variant font-medium shrink-0 select-none">
                                {formatTime(audioPlayerRef.current?.currentTime || recordingTime)}
                            </span>
                        </div>

                        <audio
                            ref={audioPlayerRef}
                            src={audioUrl}
                            className="hidden"
                            onEnded={() => {
                                setIsPlaying(false);
                                setPlaybackProgress(0);
                                drawPlaybackDiagram(0);
                            }}
                            onPause={() => setIsPlaying(false)}
                            onPlay={() => setIsPlaying(true)}
                        />
                    </div>
                ) : (

                    /* State 3: Idle / Placeholder State */
                    <div className="flex-1 flex items-center text-xs text-on-surface-variant font-medium italic">
                        {placeholderText}
                    </div>
                )}

                {/* Primary Action Controls */}
                <div className="flex items-center gap-2 shrink-0">
                    {isRecording ? (
                        <button
                            type="button"
                            onClick={stopRecording}
                            className="bg-error hover:bg-error-container text-on-error hover:text-on-error-container text-xs font-medium px-3 py-2 rounded flex items-center gap-1.5 transition-colors cursor-pointer"
                            title="Stop Recording"
                        >
                            <Square className="w-3.5 h-3.5 fill-current" />
                            <span>Stop</span>
                        </button>
                    ) : audioUrl ? (
                        <>
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="border border-outline bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-medium p-2 rounded transition-colors flex items-center justify-center cursor-pointer"
                                title="Discard recording"
                            >
                                <Trash2 className="w-4 h-4 text-error" />
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirm}
                                className="bg-primary hover:bg-primary-container text-on-primary text-xs font-medium px-3 py-2 rounded flex items-center gap-1.5 transition-colors cursor-pointer"
                                title="Attach Recording"
                            >
                                <Check className="w-4 h-4" />
                                <span>Attach</span>
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={startRecording}
                            className="bg-primary hover:bg-primary-container text-on-primary text-xs font-medium px-3 py-2 rounded flex items-center gap-2 transition-colors cursor-pointer"
                            title="Record Audio"
                        >
                            <Mic className="w-4 h-4" />
                            <span>Record</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Error Notification Banner */}
            {errorMsg && (
                <div className="flex items-center gap-2 text-xs text-on-error-container bg-error-container border border-error/20 px-3 py-1.5 rounded">
                    <AlertCircle className="w-4 h-4 shrink-0 text-error" />
                    <span className="flex-1">{errorMsg}</span>
                    <button
                        type="button"
                        onClick={() => setErrorMsg(null)}
                        className="text-xs font-semibold opacity-70 hover:opacity-100 cursor-pointer"
                    >
                        ✕
                    </button>
                </div>
            )}
        </div>
    );
};