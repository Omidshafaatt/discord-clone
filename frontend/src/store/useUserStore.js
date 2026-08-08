import { create } from 'zustand';
import api from '../api/client';

const useUserStore = create((set, get) => ({
    currentUser: null,
    users: {}, // cache: { userId: userData }
    loading: false,
    error: null,

    setCurrentUser: (user) => set({ currentUser: user }),

    // Fetch a user by username (for public profiles)
    fetchUserByUsername: async (username) => {
        // Check cache
        const cached = Object.values(get().users).find((u) => u.username === username);
        if (cached) return cached;

        try {
            const response = await api.get(`/profile/${username}`);
            const user = response.data;
            set((state) => ({
                users: { ...state.users, [user.id]: user },
            }));
            return user;
        } catch (err) {
            set({ error: err.response?.data?.detail || 'User not found' });
            return null;
        }
    },

    // Get user by ID (for messages from groups)
    getUserById: (id) => {
        return get().users[id] || null;
    },

    reset: () => set({ currentUser: null, users: {} }),
}));

export default useUserStore;