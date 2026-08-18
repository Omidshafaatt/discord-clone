// frontend\src\store\useChatStore.js
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
        messages: { ...state.messages, [String(chatId)]: response.data, },
        currentChatId: chatId,
        loading: false,
      }));
    } catch (err) {
      set({ error: err.response?.data?.detail || 'Failed to load messages', loading: false });
    }
  },

  createChat: async (username) => {
    try {
      const response = await api.post('/chat/', { target_username: username });
      // Refresh the chat list to include the new DM
      await get().fetchChats();
      return response.data;
    } catch (err) {
      console.error('Create chat error:', err);
      throw err;
    }
  },

  // Send a message – no optimistic update; WebSocket will add it
  sendMessage: async (chatId, messageData) => {
    try {
      await api.post(`/chat/${chatId}/messages`, messageData);
    } catch (err) {
      set({ error: err.response?.data?.detail || 'Failed to send message' });
    }
  },

  // src/store/useChatStore.js

  addMessage: (message) => {
    set((state) => {
      const chatId = String(message.chat_id);
      const existing = state.messages[chatId] || [];
      // Prevent duplicates
      if (existing.some((m) => m.id === message.id)) return state;
      const updated = [...existing, message];
      console.log('📥 addMessage: chatId:', chatId, 'message:', message);
      return {
        messages: {
          ...state.messages,
          [chatId]: updated,
        },
      };
    });
  },

  updateMessage: (chatId, messageId, updates) => {
    set((state) => {
      const key = String(chatId);
      const messages = state.messages[key] || [];
      const updated = messages.map((m) =>
        m.id === messageId ? { ...m, ...updates } : m
      );
      return {
        messages: {
          ...state.messages,
          [key]: updated,
        },
      };
    });
  },

  removeTemporaryMessage: (chatId, tempId) => {
    set((state) => {
      const key = String(chatId);
      const messages = state.messages[key] || [];
      const filtered = messages.filter((m) => m.id !== tempId);
      return {
        messages: {
          ...state.messages,
          [key]: filtered,
        },
      };
    });
  },

  // Get a chat by ID
  getChat: (chatId) => {
    const state = get();
    return state.chats.find((chat) => Number(chat.id) === Number(chatId));
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

  // Create a new channel
  createChannel: async (channelData) => {
    // channelData is FormData (name, description, is_public, rules, profile_photo, initial_members)
    set({ loading: true, error: null });
    try {
      const response = await api.post('/chat/channel', channelData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // Refetch chat list to include the new channel
      await get().fetchChats();
      return response.data;
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to create channel';
      set({ error: errorMsg });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  // Fetch channel details (full info with members and roles)
  fetchChannelDetails: async (channelId) => {
    console.log('🚀 fetchChannelDetails called for:', channelId);
    try {
      const response = await api.get(`/chat/channels/${channelId}`);
      console.log('✅ Backend response:', response.data);

      // ---- Update the store safely ----
      set((state) => {
        // Remove any existing entry with the same ID (convert both to number)
        const filteredChats = state.chats.filter(
          (chat) => Number(chat.id) !== Number(channelId)
        );
        // Then add the new data
        const updatedChats = [...filteredChats, response.data];
        console.log('📦 Updated chats after merge (deduplicated):', updatedChats);
        return { chats: updatedChats };
      });

      // ---- Verify the store after update ----
      const updatedStore = get();
      const mergedChat = updatedStore.chats.find(
        (c) => Number(c.id) === Number(channelId)
      );
      console.log('🔍 Merged chat from store:', mergedChat);
      console.log('🔍 Has members?', !!mergedChat?.members);

      return response.data;
    } catch (err) {
      console.error('❌ fetchChannelDetails error:', err);
      set({ error: err.response?.data?.detail || 'Failed to fetch channel details' });
      throw err;
    }
  },

  // Update channel info (admin only)
  updateChannel: async (channelId, updateData) => {
    // updateData is FormData
    set({ loading: true, error: null });
    try {
      const response = await api.patch(`/chat/channels/${channelId}`, updateData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // Update chat in list
      set((state) => ({
        chats: state.chats.map((chat) =>
          chat.id === channelId ? { ...chat, ...response.data } : chat
        ),
      }));
      return response.data;
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to update channel';
      set({ error: errorMsg });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  // Delete channel (admin only)
  deleteChannel: async (channelId) => {
    set({ loading: true, error: null });
    try {
      await api.delete(`/chat/channels/${channelId}`);
      set((state) => ({
        chats: state.chats.filter((chat) => chat.id !== channelId),
      }));
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to delete channel';
      set({ error: errorMsg });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  // Add members to channel
  addChannelMembers: async (channelId, usernames) => {
    set({ loading: true, error: null });
    try {
      const response = await api.post(`/chat/channels/${channelId}/members`, { usernames });
      // Update channel in list with new members
      set((state) => ({
        chats: state.chats.map((chat) =>
          chat.id === channelId ? { ...chat, ...response.data } : chat
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

  // Remove member from channel (admin only)
  removeChannelMember: async (channelId, userId) => {
    set({ loading: true, error: null });
    try {
      await api.delete(`/chat/channels/${channelId}/members/${userId}`);
      // Re-fetch channel details to update member list
      await get().fetchChannelDetails(channelId);
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to remove member';
      set({ error: errorMsg });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  // Update member role (admin only)
  updateMemberRole: async (channelId, userId, roleName) => {
    set({ loading: true, error: null });
    try {
      await api.patch(`/chat/channels/${channelId}/members/${userId}/role?role_name=${roleName}`);
      // Re-fetch channel details to reflect role change
      await get().fetchChannelDetails(channelId);
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to update role';
      set({ error: errorMsg });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  // Create custom role (admin only)
  createChannelRole: async (channelId, roleData) => {
    // roleData = { name, permissions: [...] }
    set({ loading: true, error: null });
    try {
      const response = await api.post(`/chat/channels/${channelId}/roles`, roleData);
      // We don't store roles globally; they are part of channel details.
      // We'll re-fetch channel details to get updated roles.
      await get().fetchChannelDetails(channelId);
      return response.data;
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to create role';
      set({ error: errorMsg });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  // Get current user's role and permissions in a channel
  getUserChannelPermissions: (channelId) => {
    const state = get();
    const channel = state.chats.find(c => c.id === channelId);
    if (!channel || channel.chat_type !== 'channel') return null;
    const currentUserId = useUserStore.getState().currentUser?.id;
    if (!currentUserId) return null;
    const member = channel.members?.find(m => m.user.id === currentUserId);
    return member?.role || null; // returns { name, permissions: [...] } or null
  },

  fetchChannelRoles: async (channelId) => {
    try {
      const response = await api.get(`/chat/channels/${channelId}/roles`);
      return response.data; // returns array of roles with id, name, permissions
    } catch (err) {
      console.error('Failed to fetch roles:', err);
      return [];
    }
  },

  // Add a temporary message (for upload progress)
  addTemporaryMessage: (chatId, tempMessage) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: [...(state.messages[chatId] || []), tempMessage],
      },
    }));
  },

  // Update progress of a temporary message
  updateTemporaryProgress: (chatId, tempId, progress) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: (state.messages[chatId] || []).map((m) =>
          m.id === tempId ? { ...m, progress, uploading: true } : m
        ),
      },
    }));
  },

}));

export default useChatStore;