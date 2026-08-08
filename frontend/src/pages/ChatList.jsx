import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Container,
    Paper,
    Typography,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Avatar,
    Fab,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    CircularProgress,
    Alert,
    Divider,
} from '@mui/material';
import {
    Add as AddIcon,
    Person as PersonIcon,
} from '@mui/icons-material';
import useChatStore from '../store/useChatStore';
import { getFullImageUrl } from '../lib/utils';

export default function ChatList() {
    const navigate = useNavigate();

    // Use store values
    const { chats, fetchChats, createChat, loading, error } = useChatStore();

    const [dialogOpen, setDialogOpen] = useState(false);
    const [targetUsername, setTargetUsername] = useState('');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState('');

    useEffect(() => {
        fetchChats();
    }, [fetchChats]);

    const handleStartDM = async () => {
        if (!targetUsername.trim()) {
            setCreateError('Please enter a username');
            return;
        }

        setCreating(true);
        setCreateError('');

        try {
            const chat = await createChat(targetUsername.trim());
            setDialogOpen(false);
            setTargetUsername('');
            navigate(`/chat/${chat.id}`);
        } catch (err) {
            setCreateError(err.response?.data?.detail || 'Failed to start chat');
        } finally {
            setCreating(false);
        }
    };

    const getChatName = (chat) => {
        if (chat.chat_type === 'dm' && chat.other_user) {
            return chat.other_user.name || chat.other_user.username;
        }
        return chat.name || 'Unknown';
    };

    const getChatAvatar = (chat) => {
        if (chat.chat_type === 'dm' && chat.other_user) {
            return getFullImageUrl(chat.other_user.profile_photo_url);
        }
        return null;
    };

    if (loading && chats.length === 0) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
            <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
                    <Typography variant="h5" fontWeight="bold">
                        Messages
                    </Typography>
                    <Fab color="primary" size="small" onClick={() => setDialogOpen(true)}>
                        <AddIcon />
                    </Fab>
                </Box>

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                {chats.length === 0 ? (
                    <Box textAlign="center" py={4}>
                        <PersonIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary">
                            No conversations yet
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Start a new chat by clicking the + button
                        </Typography>
                    </Box>
                ) : (
                    <List>
                        {chats.map((chat, index) => (
                            <React.Fragment key={chat.id}>
                                <ListItem
                                    button
                                    onClick={() => navigate(`/chat/${chat.id}`)}
                                    sx={{
                                        borderRadius: 2,
                                        '&:hover': { backgroundColor: 'action.hover' },
                                    }}
                                >
                                    <ListItemAvatar>
                                        <Avatar src={getChatAvatar(chat)}>
                                            {getChatName(chat)[0]?.toUpperCase() || 'U'}
                                        </Avatar>
                                    </ListItemAvatar>
                                    <ListItemText
                                        primary={getChatName(chat)}
                                        secondary={chat.chat_type === 'group' ? 'Group chat' : 'Direct message'}
                                    />
                                    {chat.unread_count > 0 && (
                                        <Box
                                            sx={{
                                                backgroundColor: 'primary.main',
                                                color: 'white',
                                                borderRadius: '50%',
                                                width: 24,
                                                height: 24,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: 12,
                                                fontWeight: 'bold',
                                            }}
                                        >
                                            {chat.unread_count}
                                        </Box>
                                    )}
                                </ListItem>
                                {index < chats.length - 1 && <Divider />}
                            </React.Fragment>
                        ))}
                    </List>
                )}
            </Paper>

            {/* New Chat Dialog */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Start a New Chat</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Enter the username of the person you want to chat with.
                    </Typography>
                    <TextField
                        fullWidth
                        label="Username"
                        value={targetUsername}
                        onChange={(e) => setTargetUsername(e.target.value)}
                        placeholder="e.g. alireza"
                        autoFocus
                        error={!!createError}
                        helperText={createError}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button
                        onClick={handleStartDM}
                        variant="contained"
                        disabled={creating || !targetUsername.trim()}
                    >
                        {creating ? <CircularProgress size={24} /> : 'Start Chat'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
}