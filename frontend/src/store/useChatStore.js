import { create } from 'zustand';
import api from '../api/client';

const useChatStore = create((set, get) => ({
  chats: [],
  messages: {},
  currentChatId: null,
  loading: false,
  error: null,

  // Fetch all chats (DMs)
  fetchChats: async () => {
    set({ loading: true, error: null });
    try {
      const response = await api.get('/chat/');
      set({ chats: response.data, loading: false });
    } catch (err) {
      set({ error: err.response?.data?.detail || 'Failed to load chats', loading: false });
    }
  },

  // Fetch messages for a specific chat
  fetchMessages: async (chatId) => {
    set({ loading: true, error: null });
    try {
      const response = await api.get(`/chat/${chatId}/messages?limit=50`);
      set((state) => ({
        messages: { ...state.messages, [chatId]: response.data },
        currentChatId: chatId,
        loading: false,
      }));
    } catch (err) {
      set({ error: err.response?.data?.detail || 'Failed to load messages', loading: false });
    }
  },

  // Send a message – no optimistic update; WebSocket will add it
  sendMessage: async (chatId, content) => {
    try {
      await api.post(`/chat/${chatId}/messages`, { content });
    } catch (err) {
      set({ error: err.response?.data?.detail || 'Failed to send message' });
    }
  },

  // Add a new message (called by WebSocket handler)
  addMessage: (message) => {
    const chatId = message.chat_id;
    set((state) => {
      const existing = state.messages[chatId] || [];
      // Avoid duplicates (by id or recent content)
      const duplicate = existing.some((m) =>
        m.id === message.id ||
        (m.sender_id === message.sender_id &&
          m.content === message.content &&
          Math.abs(new Date(m.created_at) - new Date(message.created_at)) < 2000)
      );
      if (duplicate) return state;
      return {
        messages: {
          ...state.messages,
          [chatId]: [...existing, message],
        },
      };
    });
  },

  // Update message (edit/delete)
  updateMessage: (chatId, messageId, updates) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: (state.messages[chatId] || []).map((msg) =>
          msg.id === messageId ? { ...msg, ...updates } : msg
        ),
      },
    }));
  },

  // Get a chat by ID
  getChat: (chatId) => {
    return get().chats.find((c) => c.id === parseInt(chatId));
  },

  // Reset store (for logout)
  reset: () => {
    set({ chats: [], messages: {}, currentChatId: null, loading: false, error: null });
  },
}));

export default useChatStore;