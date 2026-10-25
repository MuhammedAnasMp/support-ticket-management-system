import React, { useEffect, useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';

/**
 * GlobalApiProgressBar
 * Renders a sleek, single-line glowing progress bar at the very top of the header.
 * Reacts automatically to global active API requests.
 */
export const GlobalApiProgressBar: React.FC = () => {
  const activeRequests = useSelector((state: RootState) => state.apiProgress?.activeRequests ?? 0);
  const [progress, setProgress] = useState<number>(0);
  const [visible, setVisible] = useState<boolean>(false);
  const [opacity, setOpacity] = useState<number>(0);

  const trickleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const completeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear any pending completion/reset timers when active requests change
    if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    if (trickleTimerRef.current) clearInterval(trickleTimerRef.current);

    if (activeRequests > 0) {
      // API call in flight
      setVisible(true);
      setOpacity(1);

      // Start progress if not already started
      setProgress(prev => (prev === 0 ? 22 : prev));

      // Trickle progress smoothly while request is running
      trickleTimerRef.current = setInterval(() => {
        setProgress(prev => {
          if (prev < 45) {
            return prev + Math.floor(Math.random() * 6 + 3);
          } else if (prev < 70) {
            return prev + Math.floor(Math.random() * 4 + 2);
          } else if (prev < 88) {
            return prev + Math.floor(Math.random() * 2 + 1);
          } else if (prev < 95) {
            return prev + 0.5;
          }
          return prev;
        });
      }, 200);
    } else if (visible) {
      // All API calls completed: snap to 100%
      setProgress(100);

      // Hold at 100% for 200ms, then fade out
      completeTimerRef.current = setTimeout(() => {
        setOpacity(0);

        // After fade-out transition finishes (300ms), hide and reset to 0%
        resetTimerRef.current = setTimeout(() => {
          setVisible(false);
          setProgress(0);
        }, 320);
      }, 200);
    }

    return () => {
      if (trickleTimerRef.current) clearInterval(trickleTimerRef.current);
      if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, [activeRequests]);

  if (!visible && opacity === 0) {
    return null;
  }

  return (
    <div
      className="absolute top-0 left-0 right-0 h-[2.5px] pointer-events-none z-50 overflow-hidden select-none"
      aria-hidden="true"
    >
      <style>{`
        @keyframes api-progress-glow-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(250%); }
        }
        .animate-api-glow-shimmer {
          animation: api-progress-glow-shimmer 1.4s ease-in-out infinite;
        }
      `}</style>

      {/* Background ambient faint glow guide */}
      <div
        className="w-full h-full bg-cyan-500/10 dark:bg-cyan-400/10 transition-opacity duration-300"
        style={{ opacity: activeRequests > 0 ? 0.35 : 0 }}
      />

      {/* Active Glowing Progress Line */}
      <div
        className="absolute top-0 left-0 h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 dark:from-cyan-300 dark:via-blue-400 dark:to-indigo-400"
        style={{
          width: `${progress}%`,
          opacity,
          transition: progress === 100 ? 'width 150ms ease-out, opacity 300ms ease-out' : 'width 250ms ease-out, opacity 300ms ease-out',
          boxShadow: '0 0 10px rgba(56, 189, 248, 0.95), 0 0 18px rgba(59, 130, 246, 0.85), 0 0 4px #ffffff',
        }}
      >
        {/* Leading bright spark at the head of the progress line */}
        <div
          className="absolute right-0 top-1/2 -translate-y-1/2 w-6 h-[5px] bg-white rounded-full opacity-90 blur-[0.8px]"
          style={{
            boxShadow: '0 0 10px #38bdf8, 0 0 14px #60a5fa, 0 0 4px #ffffff',
          }}
        />

        {/* Shimmer sweep animation over the line */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent w-full h-full animate-api-glow-shimmer" />
      </div>
    </div>
  );
};
