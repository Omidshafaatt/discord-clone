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

  // Create a new group
  createGroup: async (groupData) => {
    // groupData is FormData (name, description, profile_photo, initial_members)
    set({ loading: true, error: null });
    try {
      const response = await api.post('/chat/group', groupData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // Refetch chat list to include the new group
      await get().fetchChats();
      return response.data;
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to create group';
      set({ error: errorMsg });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  // Update group info (name, description, photo)
  updateGroup: async (chatId, updateData) => {
    // updateData is FormData (name, description, profile_photo)
    set({ loading: true, error: null });
    try {
      const response = await api.patch(`/chat/groups/${chatId}`, updateData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // Update the chat in the list
      set((state) => ({
        chats: state.chats.map((chat) =>
          chat.id === chatId ? { ...chat, ...response.data } : chat
        ),
      }));
      return response.data;
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to update group';
      set({ error: errorMsg });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  // Delete group
  deleteGroup: async (chatId) => {
    set({ loading: true, error: null });
    try {
      await api.delete(`/chat/groups/${chatId}`);
      set((state) => ({
        chats: state.chats.filter((chat) => chat.id !== chatId),
      }));
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to delete group';
      set({ error: errorMsg });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  // Leave group
  leaveGroup: async (chatId) => {
    set({ loading: true, error: null });
    try {
      await api.delete(`/chat/groups/${chatId}/leave`);
      set((state) => ({
        chats: state.chats.filter((chat) => chat.id !== chatId),
      }));
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to leave group';
      set({ error: errorMsg });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  // Add members to group
  addMembers: async (chatId, usernames) => {
    set({ loading: true, error: null });
    try {
      const response = await api.post(`/chat/groups/${chatId}/members`, { usernames });
      // Update the chat in the list with new member list
      set((state) => ({
        chats: state.chats.map((chat) =>
          chat.id === chatId ? { ...chat, ...response.data } : chat
        ),
      }));
      return response.data;
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to add members';
      set({ error: errorMsg });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  fetchGroupDetails: async (chatId) => {
    console.log('🔄 fetchGroupDetails called for chatId:', chatId);
    set({ loading: true, error: null });
    try {
      const response = await api.get(`/chat/groups/${chatId}`);
      console.log('✅ Group details response:', response.data);
      set((state) => {
        const updatedChats = state.chats.map((chat) =>
          chat.id === chatId ? { ...chat, ...response.data } : chat
        );
        console.log('📦 Updated chats after merge:', updatedChats);
        return { chats: updatedChats };
      });
      return response.data;
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to fetch group details';
      set({ error: errorMsg });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

}));

export default useChatStore;