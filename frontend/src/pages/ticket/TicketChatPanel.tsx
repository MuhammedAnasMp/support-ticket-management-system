import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import {
    Send, Video, Mic, X, AlertCircle, Loader2, Play,
    Square, Volume2, Film, ImageIcon, Paperclip, ChevronDown, History as HistoryIcon, Trash2, Camera, RotateCcw, RotateCw, RefreshCw
} from 'lucide-react';
import type { RootState } from '@/store';
import { API_URL, AvatarCircle, MEDIA_BASE, getMediaUrl, rotateImageFile, RotatableVideoPlayer } from './TicketsTypesAndComponents';
import { LiveCameraModal } from '@/components/LiveCameraModal';

interface ChatMessage {
    message_id: number;
    ticket: number;
    sender: any;
    message_text: string | null;
    image: string | null;
    video: string | null;
    voice: string | null;
    created_date: string;
}

interface TicketChatPanelProps {
    ticketId: number;
    onClose?: () => void;
    onPreviewMedia?: (url: string, name: string) => void;
}

export const TicketChatPanel: React.FC<TicketChatPanelProps> = ({ ticketId, onClose, onPreviewMedia }) => {
    const token = useSelector((state: RootState) => state.auth.token);
    const currentUser = useSelector((state: RootState) => state.auth.user);

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [nextUrl, setNextUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Form inputs
    const [text, setText] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [fileType, setFileType] = useState<'image' | 'video' | 'voice' | null>(null);
    const [filePreview, setFilePreview] = useState<string | null>(null);
    const [draftRotation, setDraftRotation] = useState<number>(0);
    const [sending, setSending] = useState(false);

    // Voice recording states
    const [isRecording, setIsRecording] = useState(false);
    const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
    const [recordingDuration, setRecordingDuration] = useState(0);

    const [isLiveCameraOpen, setIsLiveCameraOpen] = useState(false);
    const [liveCameraMode, setLiveCameraMode] = useState<'photo' | 'video'>('photo');

    const messageContainerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const chatCameraPhotoRef = useRef<HTMLInputElement>(null);
    const chatCameraVideoRef = useRef<HTMLInputElement>(null);
    const recordTimerRef = useRef<any | null>(null);
    const sendImmediatelyRef = useRef(false);
    const discardRecordingRef = useRef(false);

    // Initial fetch of messages and WebSocket chatroom subscription
    useEffect(() => {
        fetchMessages(true);

        const joinChat = () => {
            if (window.updateWebSocket && window.updateWebSocket.readyState === WebSocket.OPEN) {
                window.updateWebSocket.send(JSON.stringify({ action: 'join_chat', ticket_id: ticketId }));
            }
        };

        joinChat();

        // Periodically verify WebSocket subscription is active (handles connection drop/reconnection recoveries)
        const checkInterval = setInterval(() => {
            joinChat();
        }, 5000);

        const handleChatMessage = (e: Event) => {
            const customEvent = e as CustomEvent;
            const msg = customEvent.detail;
            if (msg && Number(msg.ticket) === Number(ticketId)) {
                setMessages(prev => {
                    const exists = prev.some(m => m.message_id === msg.message_id);
                    if (exists) return prev;

                    const container = messageContainerRef.current;
                    const isNearBottom = container
                        ? container.scrollHeight - container.scrollTop - container.clientHeight < 120
                        : false;

                    setTimeout(() => {
                        if (isNearBottom) scrollToBottom();
                    }, 50);

                    return [...prev, msg];
                });
            }
        };

        window.addEventListener('chat-message', handleChatMessage);

        return () => {
            clearInterval(checkInterval);
            window.removeEventListener('chat-message', handleChatMessage);
            if (window.updateWebSocket && window.updateWebSocket.readyState === WebSocket.OPEN) {
                window.updateWebSocket.send(JSON.stringify({ action: 'leave_chat', ticket_id: ticketId }));
            }
            if (recordTimerRef.current) clearInterval(recordTimerRef.current);
        };
    }, [ticketId]);

    // Track scroll height to keep anchor correct when loading history
    const scrollHeightRef = useRef<number>(0);

    const fetchMessages = async (isInitial = false) => {
        if (!token) return;
        if (isInitial) setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_URL}/maintenance/ticketchat/?ticket=${ticketId}`, {
                headers: { Authorization: `Token ${token}` }
            });
            if (!response.ok) throw new Error('Failed to retrieve chat messages.');
            const data = await response.json();

            const results = data.results || data;
            const reversed = [...results].reverse();

            setMessages(reversed);
            setNextUrl(data.next || null);

            if (isInitial) {
                setTimeout(scrollToBottom, 100);
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Error fetching messages.');
        } finally {
            if (isInitial) setLoading(false);
        }
    };

    // Incremental polling check
    const fetchNewMessages = async () => {
        if (!token || loading || loadingHistory || sending) return;
        try {
            const response = await fetch(`${API_URL}/maintenance/ticketchat/?ticket=${ticketId}&page_size=10`, {
                headers: { Authorization: `Token ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                const results = data.results || data;
                const newMessages = [...results].reverse();

                setMessages(prev => {
                    // Filter out duplicates
                    const existingIds = new Set(prev.map(m => m.message_id));
                    const filteredNew = newMessages.filter((m: ChatMessage) => !existingIds.has(m.message_id));
                    if (filteredNew.length === 0) return prev;

                    // Auto scroll if scrolled near bottom
                    const container = messageContainerRef.current;
                    const isNearBottom = container
                        ? container.scrollHeight - container.scrollTop - container.clientHeight < 120
                        : false;

                    setTimeout(() => {
                        if (isNearBottom) scrollToBottom();
                    }, 50);

                    return [...prev, ...filteredNew];
                });
            }
        } catch (err) {
            console.error('Polling error:', err);
        }
    };

    const fetchHistory = async () => {
        if (!token || !nextUrl || loadingHistory) return;
        setLoadingHistory(true);

        const container = messageContainerRef.current;
        if (container) {
            scrollHeightRef.current = container.scrollHeight;
        }

        try {
            const response = await fetch(nextUrl, {
                headers: { Authorization: `Token ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                const results = data.results || data;
                const reversed = [...results].reverse();

                setMessages(prev => [...reversed, ...prev]);
                setNextUrl(data.next || null);

                // Adjust scroll position after loading older messages
                setTimeout(() => {
                    if (container) {
                        const addedHeight = container.scrollHeight - scrollHeightRef.current;
                        container.scrollTop = addedHeight;
                    }
                }, 50);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingHistory(false);
        }
    };

    const scrollToBottom = () => {
        if (messageContainerRef.current) {
            messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
        }
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (e.currentTarget.scrollTop === 0 && nextUrl && !loadingHistory) {
            fetchHistory();
        }
    };

    const attachSelectedFile = (selectedFile: File) => {
        if (!selectedFile) return;

        const mime = selectedFile.type;
        let type: 'image' | 'video' | 'voice' = 'image';

        if (mime.startsWith('image/')) {
            type = 'image';
        } else if (mime.startsWith('video/')) {
            type = 'video';
        } else if (mime.startsWith('audio/')) {
            type = 'voice';
        } else {
            alert('Unsupported file format. Please attach an image, video, or audio file.');
            return;
        }

        setFile(selectedFile);
        setFileType(type);
        setDraftRotation(0);

        // Generate preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setFilePreview(reader.result as string);
        };
        reader.readAsDataURL(selectedFile);
    };

    const [pendingChatQueue, setPendingChatQueue] = useState<{
        id: string;
        file: File;
        type: 'image' | 'video' | 'voice';
        rotation: number;
        previewUrl: string;
    }[] | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []);
        if (selectedFiles.length === 0) return;

        const queueItems = selectedFiles.map((fileItem, idx) => {
            const mime = fileItem.type;
            let type: 'image' | 'video' | 'voice' = 'image';
            if (mime.startsWith('image/')) type = 'image';
            else if (mime.startsWith('video/')) type = 'video';
            else if (mime.startsWith('audio/')) type = 'voice';

            return {
                id: `${fileItem.name}-${Date.now()}-${idx}`,
                file: fileItem,
                type,
                rotation: 0,
                previewUrl: URL.createObjectURL(fileItem)
            };
        });

        setPendingChatQueue(queueItems);
        e.target.value = '';
    };

    const handleConfirmChatQueue = async () => {
        if (!pendingChatQueue || pendingChatQueue.length === 0) return;
        const queueToUpload = [...pendingChatQueue];
        setSending(true);
        try {
            for (const item of queueToUpload) {
                let fileToSend = item.file;
                if (item.rotation % 360 !== 0 && item.file.type.startsWith('image/')) {
                    fileToSend = await rotateImageFile(item.file, item.rotation);
                }
                await uploadDirectly(fileToSend, item.type);
            }
            setPendingChatQueue(null);
            setTimeout(() => {
                queueToUpload.forEach(i => {
                    try { URL.revokeObjectURL(i.previewUrl); } catch (_) {}
                });
            }, 500);
            fetchMessages();
        } catch (err) {
            console.error('Failed to send queue attachments:', err);
        } finally {
            setSending(false);
        }
    };

    const handleCancelChatQueue = () => {
        if (pendingChatQueue) {
            pendingChatQueue.forEach(i => URL.revokeObjectURL(i.previewUrl));
        }
        setPendingChatQueue(null);
    };

    const triggerFileSelect = (type: 'image' | 'video' | 'voice') => {
        if (fileInputRef.current) {
            let accept = 'image/*,video/*,application/pdf';
            if (type === 'video') accept = 'video/*';
            if (type === 'voice') accept = 'audio/*';
            fileInputRef.current.accept = accept;
            fileInputRef.current.click();
        }
    };

    // Voice recording helpers
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            const chunks: Blob[] = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            recorder.onstop = async () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                const recordedFile = new File([blob], `voice_message_${Date.now()}.webm`, { type: 'audio/webm' });

                // Clear media tracks
                stream.getTracks().forEach(t => t.stop());

                if (discardRecordingRef.current) {
                    discardRecordingRef.current = false;
                    return; // Discard
                }

                if (sendImmediatelyRef.current) {
                    sendImmediatelyRef.current = false;
                    await uploadDirectly(recordedFile, 'voice');
                } else {
                    setFile(recordedFile);
                    setFileType('voice');
                    setFilePreview(URL.createObjectURL(blob));
                }
            };

            setRecordingDuration(0);
            recordTimerRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);

            sendImmediatelyRef.current = false;
            discardRecordingRef.current = false;
            recorder.start();
            setMediaRecorder(recorder);
            setIsRecording(true);
        } catch (err) {
            console.error('Audio recording permission denied or failed:', err);
            alert('Failed to access microphone. Please check permissions.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorder && isRecording) {
            mediaRecorder.stop();
            setIsRecording(false);
            if (recordTimerRef.current) {
                clearInterval(recordTimerRef.current);
                recordTimerRef.current = null;
            }
        }
    };

    const stopAndSendRecording = () => {
        if (mediaRecorder && isRecording) {
            sendImmediatelyRef.current = true;
            mediaRecorder.stop();
            setIsRecording(false);
            if (recordTimerRef.current) {
                clearInterval(recordTimerRef.current);
                recordTimerRef.current = null;
            }
        }
    };

    const cancelRecording = () => {
        if (mediaRecorder && isRecording) {
            discardRecordingRef.current = true;
            mediaRecorder.stop();
            setIsRecording(false);
            if (recordTimerRef.current) {
                clearInterval(recordTimerRef.current);
                recordTimerRef.current = null;
            }
        }
    };

    const uploadDirectly = async (recordedFile: File, type: 'voice' | 'image' | 'video') => {
        if (!token || !currentUser) return;
        setSending(true);
        const formData = new FormData();
        formData.append('ticket', String(ticketId));
        formData.append('sender', String(currentUser.user_id));
        formData.append(type, recordedFile);

        try {
            const response = await fetch(`${API_URL}/maintenance/ticketchat/`, {
                method: 'POST',
                headers: { Authorization: `Token ${token}` },
                body: formData
            });

            if (!response.ok) throw new Error('Failed to send file attachment.');
            const newMessage = await response.json();

            setMessages(prev => {
                const exists = prev.some(m => m.message_id === newMessage.message_id);
                if (exists) return prev;
                return [...prev, newMessage];
            });
            setTimeout(scrollToBottom, 50);
        } catch (err: any) {
            alert(err.message || 'Failed to deliver file attachment.');
        } finally {
            setSending(false);
        }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!text.trim() && !file) || sending || !token || !currentUser) return;

        setSending(true);
        const formData = new FormData();
        formData.append('ticket', String(ticketId));
        formData.append('sender', String(currentUser.user_id));
        if (text.trim()) {
            formData.append('message_text', text.trim());
        }

        if (file && fileType) {
            let fileToSend = file;
            if (fileType === 'image' && draftRotation % 360 !== 0) {
                fileToSend = await rotateImageFile(file, draftRotation);
            }
            formData.append(fileType, fileToSend);
        }

        try {
            const response = await fetch(`${API_URL}/maintenance/ticketchat/`, {
                method: 'POST',
                headers: { Authorization: `Token ${token}` },
                body: formData
            });

            if (!response.ok) throw new Error('Failed to send message.');
            const newMessage = await response.json();

            setMessages(prev => {
                const exists = prev.some(m => m.message_id === newMessage.message_id);
                if (exists) return prev;
                return [...prev, newMessage];
            });

            // Reset state
            setText('');
            clearAttachment();
            setTimeout(scrollToBottom, 50);
        } catch (err: any) {
            alert(err.message || 'Failed to deliver message.');
        } finally {
            setSending(false);
        }
    };

    const clearAttachment = () => {
        setFile(null);
        setFileType(null);
        setFilePreview(null);
        setDraftRotation(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const formatDuration = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };



    return (
        <div className="flex flex-col h-full bg-surface dark:bg-dark-surface overflow-hidden">
            {/* Header Toolbar */}
            <div className="p-3 bg-surface-container dark:bg-dark-surface-container border-b border-outline-variant dark:border-dark-outline-variant flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <HistoryIcon className="w-5 h-5 text-primary" />
                    <div>
                        <h3 className="text-xs font-bold text-on-surface">Ticket Chatroom</h3>
                        <p className="text-[9px] text-outline">Group conversation thread</p>
                    </div>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="p-1 rounded hover:bg-surface-container-high text-outline cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Message Area */}
            <div
                ref={messageContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin bg-surface-container-lowest/20"
            >
                {loadingHistory && (
                    <div className="flex items-center justify-center py-2 gap-1.5 text-[10px] text-primary">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Loading older messages...</span>
                    </div>
                )}

                {loading ? (
                    <div className="h-full flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-7 h-7 text-primary animate-spin" />
                        <span className="text-[10px] text-outline">Loading logs...</span>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center p-6 text-center text-outline gap-2">
                        <div className="w-10 h-10 rounded-full bg-outline-variant/20 flex items-center justify-center">
                            <Send className="w-5 h-5 text-outline/60" />
                        </div>
                        <p className="text-[11px] font-bold">No messages yet</p>
                        <p className="text-[9px] max-w-[200px]">Send the first message to workers or managers regarding this ticket.</p>
                    </div>
                ) : (
                    messages.map((record) => {
                        const isMe = record.sender?.user_id === currentUser?.user_id;
                        return (
                            <div
                                key={record.message_id}
                                className={`flex items-start gap-2 ${isMe ? 'flex-row-reverse' : ''}`}
                            >
                                {/* Sender Avatar */}
                                {!isMe && record.sender && (
                                    <AvatarCircle user={record.sender} size="sm" />
                                )}

                                {/* Message bubble container */}
                                <div className={`flex flex-col max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                                    {/* Sender details on other's messages */}
                                    {!isMe && record.sender && (
                                        <span className="text-[9px] text-outline font-bold ml-1 mb-0.5">
                                            {record.sender.full_name} • <span className="text-primary">{record.sender.role?.role_name || 'Staff'}</span>
                                        </span>
                                    )}

                                    {/* Actual Bubble */}
                                    <div className={`p-2.5 rounded-2xl text-xs space-y-1.5 shadow-3xs ${isMe
                                        ? 'bg-primary text-white rounded-tr-none'
                                        : 'bg-surface-container-high dark:bg-dark-surface-container-high text-on-surface rounded-tl-none'
                                        }`}>
                                        {/* Media Attachment Rendering */}
                                        {record.image && (
                                            <div className="rounded-lg overflow-hidden border border-outline-variant/30 max-h-48">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const url = getMediaUrl(record.image!);
                                                        if (onPreviewMedia) {
                                                            onPreviewMedia(url, record.image!.split('/').pop() || 'image.jpg');
                                                        } else {
                                                            window.open(url, '_blank');
                                                        }
                                                    }}
                                                    className="w-full h-full text-left cursor-zoom-in p-0 border-0 focus:outline-none block bg-transparent"
                                                >
                                                    <img
                                                        src={getMediaUrl(record.image)}
                                                        alt="Chat attachment"
                                                        className="w-full h-full object-cover max-h-48"
                                                    />
                                                </button>
                                            </div>
                                        )}

                                        {record.video && (
                                            <div className="rounded-lg overflow-hidden border border-outline-variant/30 bg-black relative group min-h-[120px] flex items-center justify-center">
                                                <video
                                                    src={getMediaUrl(record.video)}
                                                    className="w-full max-h-48 object-contain"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const url = getMediaUrl(record.video!);
                                                        if (onPreviewMedia) {
                                                            onPreviewMedia(url, record.video!.split('/').pop() || 'video.mp4');
                                                        } else {
                                                            window.open(url, '_blank');
                                                        }
                                                    }}
                                                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-zoom-in text-white font-semibold text-xs gap-1.5 focus:outline-none"
                                                    title="Preview Video"
                                                >
                                                    <Play className="w-8 h-8 fill-white text-white" />
                                                </button>
                                            </div>
                                        )}

                                        {record.voice && (
                                            <div className={`flex items-center gap-1.5 p-1 rounded-lg ${isMe ? 'bg-primary-container/20' : 'bg-surface'}`}>
                                                <audio
                                                    src={getMediaUrl(record.voice)}
                                                    controls
                                                    className="w-48 h-8 max-w-full text-xs"
                                                />
                                            </div>
                                        )}

                                        {/* Message Text */}
                                        {record.message_text && (
                                            <p className="break-words leading-relaxed whitespace-pre-wrap">{record.message_text}</p>
                                        )}
                                    </div>

                                    {/* Date Timestamp */}
                                    <span className="text-[8px] text-outline mt-0.5 px-1">
                                        {new Date(record.created_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Preview Banner before sending */}
            {filePreview && (
                <div className="px-3 py-2 bg-surface-container-high dark:bg-dark-surface-container-high border-t border-outline-variant dark:border-dark-outline-variant flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                        {fileType === 'image' && (
                            <img
                                src={filePreview}
                                alt="upload preview"
                                style={{
                                    transform: `rotate(${draftRotation}deg)`,
                                    transition: 'transform 0.2s ease-in-out'
                                }}
                                className="w-10 h-10 object-cover rounded border"
                            />
                        )}
                        {fileType === 'video' && (
                            <div className="w-10 h-10 bg-black rounded flex items-center justify-center text-white relative overflow-hidden border">
                                <video
                                    src={filePreview}
                                    style={{
                                        transform: `rotate(${draftRotation}deg) scale(${draftRotation % 180 !== 0 ? 0.75 : 1})`,
                                        transition: 'transform 0.2s ease-in-out'
                                    }}
                                    className="w-full h-full object-cover"
                                    muted
                                />
                            </div>
                        )}
                        {fileType === 'voice' && (
                            <div className="w-10 h-10 bg-primary/10 rounded flex items-center justify-center text-primary"><Volume2 className="w-4 h-4" /></div>
                        )}
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold text-on-surface truncate">{file?.name}</p>
                            <p className="text-[8px] text-outline capitalize">{fileType} file ready</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {(fileType === 'image' || fileType === 'video') && (
                            <div className="flex items-center gap-1 bg-surface-container border border-outline-variant/60 rounded-lg px-1 py-0.5">
                                <button
                                    type="button"
                                    onClick={() => setDraftRotation(prev => (prev - 90 + 360) % 360)}
                                    className="p-1 text-on-surface-variant hover:text-primary rounded cursor-pointer"
                                    title="Rotate Left 90°"
                                >
                                    <RotateCcw className="w-3 h-3" />
                                </button>
                                <span className="text-[9px] font-mono text-outline">{draftRotation}°</span>
                                <button
                                    type="button"
                                    onClick={() => setDraftRotation(prev => (prev + 90) % 360)}
                                    className="p-1 text-on-surface-variant hover:text-primary rounded cursor-pointer"
                                    title="Rotate Right 90°"
                                >
                                    <RotateCw className="w-3 h-3" />
                                </button>
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={clearAttachment}
                            className="p-1 rounded-full bg-outline-variant/40 hover:bg-outline-variant/60 text-on-surface cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            )}

            {/* Input Action Form */}
            <form
                onSubmit={handleSend}
                className="p-3 bg-surface-container dark:bg-dark-surface-container border-t border-outline-variant dark:border-dark-outline-variant flex flex-col gap-2 shrink-0"
            >
                <div className="flex items-center gap-1.5">
                    {/* Hidden inputs for file browse & native mobile camera */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    <input
                        ref={chatCameraPhotoRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    <input
                        ref={chatCameraVideoRef}
                        type="file"
                        accept="video/*"
                        capture="environment"
                        onChange={handleFileChange}
                        className="hidden"
                    />

                    {/* Media Attach buttons */}
                    <div className="flex items-center gap-0.5 shrink-0">
                        <button
                            type="button"
                            onClick={() => {
                                const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
                                if (isMobile && chatCameraPhotoRef.current) {
                                    chatCameraPhotoRef.current.click();
                                } else {
                                    setLiveCameraMode('photo');
                                    setIsLiveCameraOpen(true);
                                }
                            }}
                            disabled={isRecording || sending}
                            className="p-1.5 rounded-lg text-outline hover:bg-surface-container-high hover:text-emerald-500 transition-colors cursor-pointer disabled:opacity-50"
                            title="Take Live Photo"
                        >
                            <Camera className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
                                if (isMobile && chatCameraVideoRef.current) {
                                    chatCameraVideoRef.current.click();
                                } else {
                                    setLiveCameraMode('video');
                                    setIsLiveCameraOpen(true);
                                }
                            }}
                            disabled={isRecording || sending}
                            className="p-1.5 rounded-lg text-outline hover:bg-surface-container-high hover:text-red-500 transition-colors cursor-pointer disabled:opacity-50"
                            title="Record Live Video"
                        >
                            <Video className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => triggerFileSelect('image')}
                            disabled={isRecording || sending}
                            className="p-1.5 rounded-lg text-outline hover:bg-surface-container-high hover:text-primary transition-colors cursor-pointer disabled:opacity-50"
                            title="Attach File from Gallery"
                        >
                            <Paperclip className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Text input area */}
                    {isRecording ? (
                        <div className="flex-1 px-3 py-1.5 bg-error/5 border border-error/20 rounded-xl flex items-center justify-between text-xs text-error font-medium">
                            <span className="flex items-center gap-1.5 animate-pulse">
                                <span className="w-2.5 h-2.5 rounded-full bg-error animate-ping mr-1"></span>
                                Recording
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={cancelRecording}
                                    className="p-1 rounded-full hover:bg-error/10 text-error cursor-pointer flex items-center justify-center"
                                    title="Cancel Recording"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                                <span>{formatDuration(recordingDuration)}</span>
                            </div>
                        </div>
                    ) : (
                        <input
                            type="text"
                            value={text}
                            onChange={e => setText(e.target.value)}
                            disabled={sending}
                            placeholder="Write message..."
                            className="flex-1 px-3 py-1.5 text-xs bg-surface border border-outline-variant dark:border-dark-outline-variant focus:border-primary focus:outline-none rounded-xl text-on-surface dark:text-dark-on-surface min-w-0"
                        />
                    )}

                    {/* Dynamic Action Button (Send or Mic) */}
                    {isRecording ? (
                        <button
                            type="button"
                            onClick={stopAndSendRecording}
                            disabled={sending}
                            className="p-2 rounded-xl bg-error text-white hover:bg-red-700 transition-colors cursor-pointer shrink-0 active:scale-95 flex items-center justify-center animate-pulse"
                            title="Send Voice Message"
                        >
                            {sending ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Send className="w-3.5 h-3.5" />
                            )}
                        </button>
                    ) : (!text.trim() && !file) ? (
                        <button
                            type="button"
                            onClick={startRecording}
                            disabled={sending}
                            className="p-2 rounded-xl bg-primary text-white hover:bg-primary-hover transition-colors cursor-pointer shrink-0 active:scale-95 flex items-center justify-center"
                            title="Record Voice"
                        >
                            {sending ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Mic className="w-3.5 h-3.5" />
                            )}
                        </button>
                    ) : (
                        <button
                            type="submit"
                            disabled={sending}
                            className="p-2 rounded-xl bg-primary text-white hover:bg-primary-hover transition-colors cursor-pointer shrink-0 active:scale-95 flex items-center justify-center"
                            title="Send Message"
                        >
                            {sending ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Send className="w-3.5 h-3.5" />
                            )}
                        </button>
                    )}
                </div>
            </form>

            {/* Pre-Send Chat Attachments Review & Rotation Overlay */}
            {pendingChatQueue && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
                    <div
                        onClick={handleCancelChatQueue}
                        className="fixed inset-0 bg-black/90 backdrop-blur-xs cursor-pointer"
                    />
                    <div className="relative bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant w-full max-w-lg p-4 sm:p-5 rounded shadow-2xl z-10 max-h-[85vh] flex flex-col">
                        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/60">
                            <div>
                                <h3 className="text-sm font-bold text-on-surface dark:text-dark-on-surface uppercase tracking-wider">Chat Attachments</h3>
                                <p className="text-[11px] text-outline">Adjust orientation before sending ({pendingChatQueue.length} file{pendingChatQueue.length > 1 ? 's' : ''})</p>
                            </div>
                            <button
                                type="button"
                                onClick={handleCancelChatQueue}
                                disabled={sending}
                                className="p-1.5 rounded-full hover:bg-surface-container-high text-on-surface cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="py-4 overflow-y-auto max-h-[55vh] space-y-3 my-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {pendingChatQueue.map((item, idx) => (
                                    <div key={item.id} className="bg-surface dark:bg-dark-surface p-1 rounded border border-outline-variant dark:border-dark-outline-variant flex flex-col gap-2 relative">
                                        <div className="w-full h-36 bg-black/80 rounded-lg overflow-hidden flex items-center justify-center relative p-1">
                                            {item.type === 'image' ? (
                                                <img
                                                    src={item.previewUrl}
                                                    alt={item.file.name}
                                                    style={{
                                                        transform: `rotate(${item.rotation}deg)`,
                                                        transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                                                    }}
                                                    className="max-w-full max-h-full object-contain"
                                                />
                                            ) : item.type === 'video' ? (
                                                <RotatableVideoPlayer
                                                    src={item.previewUrl}
                                                    rotation={item.rotation}
                                                    className="w-full h-full"
                                                />
                                            ) : (
                                                <div className="text-white text-xs font-semibold">{item.file.name}</div>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between pt-1">
                                            <span className="text-[10px] font-medium text-on-surface truncate max-w-[120px]" title={item.file.name}>
                                                {item.file.name}
                                            </span>

                                            {(item.type === 'image' || item.type === 'video') && (
                                                <div className="flex items-center gap-1 bg-surface-container-high px-1.5 py-0.5 rounded-lg border border-outline-variant/60">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setPendingChatQueue(prev => prev ? prev.map((it, i) => i === idx ? { ...it, rotation: (it.rotation - 90 + 360) % 360 } : it) : null);
                                                        }}
                                                        className="p-0.5 text-on-surface hover:text-primary rounded cursor-pointer"
                                                        title="Rotate 90° Left"
                                                    >
                                                        <RotateCcw className="w-3.5 h-3.5" />
                                                    </button>
                                                    <span className="text-[10px] font-mono font-bold text-primary px-0.5">{item.rotation}°</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setPendingChatQueue(prev => prev ? prev.map((it, i) => i === idx ? { ...it, rotation: (it.rotation + 90) % 360 } : it) : null);
                                                        }}
                                                        className="p-0.5 text-on-surface hover:text-primary rounded cursor-pointer"
                                                        title="Rotate 90° Right"
                                                    >
                                                        <RotateCw className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline-variant/60">
                            <button
                                type="button"
                                onClick={handleCancelChatQueue}
                                disabled={sending}
                                className="px-4 py-2 border border-outline-variant rounded text-xs font-semibold text-on-surface hover:bg-surface-container-high cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmChatQueue}
                                disabled={sending}
                                className="px-5 py-2.5 bg-primary text-white text-xs font-semibold rounded hover:bg-primary-hover active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                {sending ? <Loader2 className="w-4 h-4 animate-spin text-current" /> : <Send className="w-3.5 h-3.5" />}
                                Send Attachment{pendingChatQueue.length > 1 ? 's' : ''} ({pendingChatQueue.length})
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <LiveCameraModal
                isOpen={isLiveCameraOpen}
                initialMode={liveCameraMode}
                onClose={() => setIsLiveCameraOpen(false)}
                onCapture={(capturedFile) => {
                    const mime = capturedFile.type;
                    let type: 'image' | 'video' | 'voice' = 'image';
                    if (mime.startsWith('image/')) type = 'image';
                    else if (mime.startsWith('video/')) type = 'video';
                    else if (mime.startsWith('audio/')) type = 'voice';

                    setPendingChatQueue([{
                        id: `${capturedFile.name}-${Date.now()}`,
                        file: capturedFile,
                        type,
                        rotation: 0,
                        previewUrl: URL.createObjectURL(capturedFile)
                    }]);
                }}
            />
        </div>
    );
};
export default TicketChatPanel;
