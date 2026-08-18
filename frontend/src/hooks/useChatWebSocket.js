// frontend\src\hooks\useChatWebSocket.js
import { useEffect, useRef, useCallback } from 'react';

export default function useChatWebSocket({ chatId, onMessageReceived }) {
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);

  const connect = useCallback(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(`ws://localhost:8000/ws?token=${token}`);

    ws.onopen = () => {
      console.log('WebSocket connected');
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // 👇 Remove the filter – pass all messages to the handler
        onMessageReceived(data);
      } catch (e) {
        console.error('WebSocket parse error:', e);
      }
    };

    ws.onclose = (event) => {
      console.log('WebSocket disconnected');
      if (!event.wasClean && !reconnectTimerRef.current) {
        reconnectTimerRef.current = setTimeout(() => {
          connect();
        }, 3000);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error', error);
      ws.close();
    };

    wsRef.current = ws;
  }, [chatId, onMessageReceived]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [connect]);

  const reconnect = useCallback(() => {
    if (wsRef.current) wsRef.current.close();
    connect();
  }, [connect]);

  return { reconnect };
}