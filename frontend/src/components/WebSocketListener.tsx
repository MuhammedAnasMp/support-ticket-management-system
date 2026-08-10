import React, { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';

declare global {
  interface Window {
    updateWebSocket?: WebSocket;
  }
}

export const WebSocketListener: React.FC = () => {
  const token = useSelector((state: RootState) => state.auth.token);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);

  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
        window.updateWebSocket = undefined;
      }
      return;
    }

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const apiHost = import.meta.env.VITE_API_URL
        ? import.meta.env.VITE_API_URL.replace(/^https?:\/\//, '').replace(/\/api$/, '')
        : 'localhost:8000';
      const wsUrl = `${protocol}//${apiHost}/ws/updates/?token=${token}`;

      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;
      window.updateWebSocket = socket;

      socket.onopen = () => {
        console.log('[WebSocket] Connected successfully');
        reconnectAttemptsRef.current = 0;
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'ticket_updated') {
            window.dispatchEvent(new CustomEvent('ticket-updated', { detail: data.ticket }));
          } else if (data.type === 'chat_message') {
            window.dispatchEvent(new CustomEvent('chat-message', { detail: data.message }));
          } else if (data.type === 'notification') {
            window.dispatchEvent(new CustomEvent('notification-received', { detail: data.notification }));
          }
        } catch (err) {
          console.error('[WebSocket] Failed to parse message data:', err);
        }
      };

      socket.onclose = () => {
        console.log('[WebSocket] Connection closed');
        window.updateWebSocket = undefined;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        reconnectAttemptsRef.current += 1;
        reconnectTimeoutRef.current = window.setTimeout(connect, delay);
      };

      socket.onerror = (err) => {
        console.error('[WebSocket] Error occurred:', err);
      };
    };

    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
        window.updateWebSocket = undefined;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [token]);

  return null;
};
