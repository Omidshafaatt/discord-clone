import { useState, useEffect, useRef } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Avatar,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    TextField,
    Alert,
    CircularProgress,
    IconButton,
    Box,
} from '@mui/material';
import { Close as CloseIcon, Add as AddIcon } from '@mui/icons-material';
import useChatStore from '../store/useChatStore';
import { getFullImageUrl } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

export default function GroupDetailModal({ open, onClose, chatId }) {
    const { user } = useAuth();
    const { chats, fetchGroupDetails, addMembers, deleteGroup, leaveGroup } = useChatStore();
    const [newMembers, setNewMembers] = useState('');
    const [error, setError] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [group, setGroup] = useState(null);

    const fetchedRef = useRef(null);

    // When modal opens, fetch once
    useEffect(() => {
        if (open && chatId) {
            if (fetchedRef.current !== chatId) {
                const load = async () => {
                    setLoadingDetails(true);
                    try {
                        const data = await fetchGroupDetails(chatId); // returns data
                        setGroup(data);
                    } catch (e) {
                        setError('Failed to load group details');
                    } finally {
                        setLoadingDetails(false);
                        fetchedRef.current = chatId;
                    }
                };
                load();
            } else {
                const current = chats.find((c) => c.id === chatId);
                if (current) setGroup(current);
            }
        } else {
            fetchedRef.current = null;
            setGroup(null);
        }
    }, [open, chatId, fetchGroupDetails, chats]);

    const handleAddMembers = async () => {
        if (!newMembers.trim()) return;
        const usernames = newMembers.split(',').map((u) => u.trim()).filter(Boolean);
        if (usernames.length === 0) return;
        setActionLoading(true);
        setError('');
        try {
            const updated = await addMembers(chatId, usernames);
            setGroup(updated);
            setNewMembers('');
            await fetchGroupDetails(chatId); // refresh store
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to add members');
        } finally {
            setActionLoading(false);
        }
    };

    const handleLeave = async () => {
        if (window.confirm('Are you sure you want to leave this group?')) {
            setActionLoading(true);
            try {
                await leaveGroup(chatId);
                onClose();
            } catch (err) {
                setError(err.response?.data?.detail || 'Failed to leave group');
            } finally {
                setActionLoading(false);
            }
        }
    };

    const handleDelete = async () => {
        if (window.confirm('Are you sure you want to delete this group? This cannot be undone.')) {
            setActionLoading(true);
            try {
                await deleteGroup(chatId);
                onClose();
            } catch (err) {
                setError(err.response?.data?.detail || 'Failed to delete group');
            } finally {
                setActionLoading(false);
            }
        }
    };

    // ---- Render ----

    if (loadingDetails) {
        return (
            <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
                <DialogContent>
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                        <CircularProgress />
                    </Box>
                </DialogContent>
            </Dialog>
        );
    }

    if (!group) {
        return (
            <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
                <DialogContent>
                    <Alert severity="error">Group not found</Alert>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>Close</Button>
                </DialogActions>
            </Dialog>
        );
    }

    const isCreator = group.created_by_id === user.id;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                Group Details
                <IconButton sx={{ position: 'absolute', right: 8, top: 8 }} onClick={onClose}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar
                        src={getFullImageUrl(group.profile_photo_url)}
                        sx={{ width: 64, height: 64, mr: 2 }}
                    >
                        {group.name?.[0]?.toUpperCase() || 'G'}
                    </Avatar>
                    <Box>
                        <Typography variant="h6">{group.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                            {group.description || 'No description'}
                        </Typography>
                    </Box>
                </Box>

                <Typography variant="subtitle1" fontWeight="bold" mt={2}>
                    Members ({group.members?.length || 0})
                </Typography>
                <List dense>
                    {group.members?.map((member) => (
                        <ListItem key={member.id}>
                            <ListItemAvatar>
                                <Avatar src={getFullImageUrl(member.profile_photo_url)}>
                                    {member.name?.[0]?.toUpperCase() || 'U'}
                                </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                                primary={member.name}
                                secondary={member.username}
                            />
                        </ListItem>
                    ))}
                </List>

                <Typography variant="subtitle1" fontWeight="bold" mt={2}>
                    Add Members
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                        fullWidth
                        size="small"
                        placeholder="usernames separated by commas"
                        value={newMembers}
                        onChange={(e) => setNewMembers(e.target.value)}
                        disabled={actionLoading}
                    />
                    <Button
                        variant="contained"
                        onClick={handleAddMembers}
                        disabled={!newMembers.trim() || actionLoading}
                    >
                        <AddIcon />
                    </Button>
                </Box>
            </DialogContent>
            <DialogActions>
                {isCreator ? (
                    <Button
                        variant="contained"
                        color="error"
                        onClick={handleDelete}
                        disabled={actionLoading}
                    >
                        Delete Group
                    </Button>
                ) : (
                    <Button
                        variant="outlined"
                        color="error"
                        onClick={handleLeave}
                        disabled={actionLoading}
                    >
                        Leave Group
                    </Button>
                )}
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}