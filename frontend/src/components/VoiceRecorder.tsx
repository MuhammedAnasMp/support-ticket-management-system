import React, { useState, useEffect, useRef } from 'react';
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
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Call state change callback whenever recording state or unconfirmed audio exists
    useEffect(() => {
        if (onRecordingStateChange) {
            onRecordingStateChange(isRecording || audioBlob !== null);
        }
    }, [isRecording, audioBlob, onRecordingStateChange]);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const timerRef = useRef<number | null>(null);
    const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

    // Audio context & animation variables for visualizer
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const animationRef = useRef<number | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);

    // Clean up urls & streams on unmount
    useEffect(() => {
        return () => {
            stopStreamAndTimer();
            if (audioUrl) URL.revokeObjectURL(audioUrl);
            if (audioCtxRef.current) audioCtxRef.current.close();
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
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

    const checkMicAvailability = async (): Promise<boolean> => {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
                setErrorMsg("Recording not supported in this browser.");
                return false;
            }
            const devices = await navigator.mediaDevices.enumerateDevices();
            const hasMic = devices.some(device => device.kind === 'audioinput');
            if (!hasMic) {
                setErrorMsg("No mic found.");
                return false;
            }
            return true;
        } catch (err) {
            console.error("Mic check error:", err);
            setErrorMsg("Could not check microphone status.");
            return false;
        }
    };

    const startRecording = async () => {
        setErrorMsg(null);
        setAudioBlob(null);
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
            setAudioUrl(null);
        }

        const micAvailable = await checkMicAvailability();
        if (!micAvailable) return;

        try {
            // Request permission & get stream
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            // Initialize MediaRecorder
            const options = { mimeType: 'audio/webm' };
            let recorder: MediaRecorder;
            try {
                recorder = new MediaRecorder(stream, options);
            } catch (e) {
                // fallback to default if webm not supported (like on Safari/iOS)
                recorder = new MediaRecorder(stream);
            }
            
            mediaRecorderRef.current = recorder;
            const chunks: BlobPart[] = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                const url = URL.createObjectURL(blob);
                setAudioBlob(blob);
                setAudioUrl(url);
            };

            // Setup Visualizer Analyser
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioCtx) {
                const audioCtx = new AudioCtx();
                audioCtxRef.current = audioCtx;
                const analyser = audioCtx.createAnalyser();
                analyser.fftSize = 64;
                analyserRef.current = analyser;

                const source = audioCtx.createMediaStreamSource(stream);
                source.connect(analyser);
                drawWaveform();
            }

            // Start recording
            recorder.start();
            setIsRecording(true);
            setRecordingTime(0);

            timerRef.current = window.setInterval(() => {
                setRecordingTime(t => t + 1);
            }, 1000);

        } catch (err: any) {
            console.error("Start recording failed:", err);
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                setErrorMsg("Microphone permission denied.");
            } else {
                setErrorMsg("Failed to access microphone.");
            }
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            stopStreamAndTimer();
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            if (audioCtxRef.current) {
                audioCtxRef.current.close();
                audioCtxRef.current = null;
            }
        }
    };

    const drawWaveform = () => {
        if (!canvasRef.current || !analyserRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const analyser = analyserRef.current;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            if (!isRecording) return;
            animationRef.current = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'rgba(16, 185, 129, 0.15)'; // faint green background
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw bars representing amplitude
            const barWidth = 4;
            const gap = 3;
            const barCount = Math.min(bufferLength, Math.floor(canvas.width / (barWidth + gap)));
            
            const startX = (canvas.width - (barCount * (barWidth + gap))) / 2;

            for (let i = 0; i < barCount; i++) {
                const percent = dataArray[i] / 255;
                const height = Math.max(4, percent * canvas.height * 0.85);
                const x = startX + i * (barWidth + gap);
                const y = (canvas.height - height) / 2;

                ctx.fillStyle = '#10b981'; // WhatsApp-like green
                // Draw rounded rect
                ctx.beginPath();
                ctx.roundRect(x, y, barWidth, height, 2);
                ctx.fill();
            }
        };

        draw();
    };

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
        setErrorMsg(null);
        if (onCancel) onCancel();
    };

    const handleConfirm = () => {
        if (audioBlob) {
            const fileName = `voice_note_${Date.now()}.webm`;
            const file = new File([audioBlob], fileName, { type: 'audio/webm' });
            onSave(file);
            // Clear locally after saving
            setAudioBlob(null);
            setAudioUrl(null);
            setRecordingTime(0);
        }
    };

    const formatTime = (secs: number): string => {
        const m = Math.floor(secs / 60).toString().padStart(2, '0');
        const s = (secs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    return (
        <div className="bg-surface-container border border-outline-variant rounded-lg p-3 w-full flex flex-col gap-2.5 shadow-sm">
            <div className="flex items-center gap-3 w-full min-h-[44px]">
                {/* Visualizer / Waveform State */}
                {isRecording ? (
                    <div className="flex-1 flex items-center gap-2">
                        <span className="flex h-2.5 w-2.5 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
                        </span>
                        <span className="font-mono text-xs font-semibold text-on-surface w-10">
                            {formatTime(recordingTime)}
                        </span>
                        <canvas 
                            ref={canvasRef} 
                            width={220} 
                            height={32} 
                            className="flex-1 max-w-[280px] h-8 rounded bg-surface border border-outline-variant/30 overflow-hidden" 
                        />
                    </div>
                ) : audioUrl ? (
                    <div className="flex-1 flex items-center gap-3">
                        <button
                            type="button"
                            onClick={togglePlayback}
                            className="p-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                        >
                            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                        </button>
                        
                        <div className="flex-1 flex items-center gap-2 bg-surface-container-low border border-outline-variant/35 rounded-lg py-1 px-2.5 min-h-[32px]">
                            {/* Static visual representation of audio */}
                            <div className="flex-1 flex items-center justify-center gap-[3px] opacity-75">
                                {[12, 18, 8, 22, 14, 28, 6, 16, 20, 10, 24, 18, 12, 8, 14, 18, 24, 10, 6].map((h, i) => (
                                    <div 
                                        key={i} 
                                        style={{ height: `${h}px` }} 
                                        className="w-[3px] bg-primary rounded-full" 
                                    />
                                ))}
                            </div>
                            <span className="font-mono text-[10px] text-on-surface-variant font-medium select-none">
                                Audio Playback
                            </span>
                        </div>

                        <audio
                            ref={audioPlayerRef}
                            src={audioUrl}
                            className="hidden"
                            onEnded={() => setIsPlaying(false)}
                            onPause={() => setIsPlaying(false)}
                            onPlay={() => setIsPlaying(true)}
                        />
                    </div>
                ) : (
                    <div className="flex-1 flex items-center text-xs text-on-surface-variant font-medium italic">
                        {placeholderText}
                    </div>
                )}

                {/* Primary Mic/Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                    {isRecording ? (
                        <button
                            type="button"
                            onClick={stopRecording}
                            className="p-2.5 rounded-full bg-error text-on-error hover:bg-error-container hover:text-on-error-container active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-xs"
                            title="Stop Recording"
                        >
                            <Square className="w-4 h-4 fill-current" />
                        </button>
                    ) : audioUrl ? (
                        <>
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="p-2 rounded-full text-outline hover:text-red-500 hover:bg-error-container/20 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                                title="Discard"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirm}
                                className="p-2 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-xs"
                                title="Attach Recording"
                            >
                                <Check className="w-4 h-4 stroke-[3px]" />
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={startRecording}
                            className="p-2.5 rounded-full bg-primary text-on-primary hover:bg-primary-hover active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-xs"
                            title="Record Audio"
                        >
                            <Mic className="w-4.5 h-4.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
                <div className="flex items-center gap-2 text-[10px] text-error font-medium bg-error-container/10 border border-error/20 p-2 rounded">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errorMsg}</span>
                    <button type="button" onClick={() => setErrorMsg(null)} className="ml-auto text-[8px] font-bold opacity-60 hover:opacity-100">✕</button>
                </div>
            )}
        </div>
    );
};
