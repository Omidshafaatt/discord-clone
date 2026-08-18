// src/context/NotificationContext.jsx
import { createContext, useState, useContext, useRef, useCallback } from 'react';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [notification, setNotification] = useState({
    senderName: '',
    preview: '',
    chatId: null,
    count: 1,
  });

  const timeoutRef = useRef(null);

  // Show notification – aggregates if called within 2 seconds
  const showNotification = useCallback(({ senderName, preview, chatId }) => {
    // If already open, update the current notification (count)
    if (open) {
      setNotification((prev) => ({
        ...prev,
        count: prev.count + 1,
        // Optionally keep the latest sender? We'll keep the first sender name
      }));
      // Reset the hide timer
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => hideNotification(), 5000);
      return;
    }

    // New notification
    setNotification({
      senderName,
      preview: preview || 'New message',
      chatId,
      count: 1,
    });
    setOpen(true);

    // Auto‑hide after 5 seconds
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => hideNotification(), 5000);
  }, [open]);

  const hideNotification = useCallback(() => {
    setOpen(false);
    setNotification({
      senderName: '',
      preview: '',
      chatId: null,
      count: 1,
    });
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const value = {
    open,
    notification,
    showNotification,
    hideNotification,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};