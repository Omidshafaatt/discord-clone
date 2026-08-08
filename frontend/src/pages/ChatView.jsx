import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Box,
    Container,
    Paper,
    Typography,
    List,
    ListItem,
    Avatar,
    TextField,
    IconButton,
    CircularProgress,
    Alert,
    Button,
} from '@mui/material';
import {
    Send as SendIcon,
    AttachFile as AttachFileIcon,
    ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { Info as InfoIcon } from '@mui/icons-material';
import { Group as GroupIcon } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import useChatStore from '../store/useChatStore';
import { getFullImageUrl } from '../lib/utils';
import GroupDetailModal from '../components/GroupDetailModal';

export default function ChatView() {
    const { chatId } = useParams();
    const navigate = useNavigate();
    const { user, userId } = useAuth();

    console.log(chatId);
    

    const {
        messages,
        fetchMessages,
        sendMessage,
        addMessage,
        updateMessage,
        getChat,
        fetchChats,
    } = useChatStore();

    const chat = getChat(chatId);
    const chatType = chat?.chat_type || 'dm';
    const otherUser = chatType === 'dm' ? chat?.other_user : null;
    const groupName = chatType === 'group' ? chat?.name : null;
    const groupAvatar = chatType === 'group' ? chat?.profile_photo_url : null;

    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [detailModalOpen, setDetailModalOpen] = useState(false);

    const wsRef = useRef(null);
    const messagesEndRef = useRef(null);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    // Load messages and ensure chat list is fetched
    const loadMessages = useCallback(async () => {
        setLoading(true);
        const existingChat = getChat(chatId);
        if (!existingChat) {
            await fetchChats();
        }
        await fetchMessages(chatId);
        setLoading(false);
    }, [chatId, getChat, fetchChats, fetchMessages]);

    // Load messages on mount / chatId change
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadMessages();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chatId]);

    // WebSocket connection
    useEffect(() => {
        const token = localStorage.getItem('access_token');
        if (!token) return;

        const ws = new WebSocket(`ws://localhost:8000/ws?token=${token}`);
        let isMounted = true;

        ws.onopen = () => {
            if (!isMounted) {
                ws.close();
                return;
            }
            console.log('WebSocket connected');
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.chat_id !== parseInt(chatId)) return;

                switch (data.event) {
                    case 'new_message': {
                        const msg = {
                            id: data.message_id || Date.now(),
                            chat_id: data.chat_id,
                            sender_id: data.sender_id,
                            sender_name: data.sender_name,
                            content: data.content,
                            message_type: 'text',
                            created_at: data.created_at,
                            is_deleted: false,
                            media_url: null,
                            scheduled_at: null,
                            is_sent: true,
                        };
                        addMessage(msg);
                        break;
                    }
                    case 'message_edited':
                        updateMessage(parseInt(chatId), data.message_id, {
                            content: data.new_content,
                            updated_at: data.updated_at,
                        });
                        break;
                    case 'message_deleted':
                        updateMessage(parseInt(chatId), data.message_id, {
                            is_deleted: true,
                            content: 'This message was deleted',
                        });
                        break;
                    default:
                        break;
                }
            } catch (e) {
                console.error('WebSocket message error:', e);
            }
        };

        ws.onclose = () => console.log('WebSocket disconnected');
        ws.onerror = (error) => console.error('WebSocket error', error);

        wsRef.current = ws;

        return () => {
            isMounted = false;
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [chatId, addMessage, updateMessage]);

    useEffect(() => {
        scrollToBottom();
    }, [messages, chatId, scrollToBottom]);

    const handleSendMessage = async () => {
        if (!newMessage.trim()) return;
        setSending(true);
        setError('');
        try {
            await sendMessage(chatId, newMessage.trim());
            setNewMessage('');
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to send message');
        } finally {
            setSending(false);
        }
    };

    const goToProfile = () => {
        if (otherUser?.username) {
            navigate(`/profile/${otherUser.username}`);
        }
    };

    // Render a single message – key is handled by the parent ListItem
    const renderMessage = (msg) => {
        const isOwn = Number(msg.sender_id) === Number(userId);  // <-- use userId
        const isDeleted = msg.is_deleted;

        const senderDisplayName = isOwn
            ? user.name
            : chatType === 'group'
                ? msg.sender_name || 'Unknown'
                : otherUser?.name || msg.sender_name || 'Unknown';
        const avatarLetter = senderDisplayName[0]?.toUpperCase() || 'U';
        const avatarSrc = !isOwn && otherUser?.profile_photo_url
            ? getFullImageUrl(otherUser.profile_photo_url)
            : null;

        return (
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: isOwn ? 'flex-end' : 'flex-start',
                    mb: 2,
                }}
            >
                {!isOwn && (
                    <Avatar
                        src={avatarSrc}
                        sx={{ width: 32, height: 32, mr: 1, bgcolor: 'secondary.main' }}
                    >
                        {avatarLetter}
                    </Avatar>
                )}
                <Paper
                    elevation={1}
                    sx={{
                        p: 2,
                        maxWidth: '70%',
                        backgroundColor: isOwn ? 'primary.main' : 'background.paper',
                        color: isOwn ? 'white' : 'text.primary',
                        borderRadius: 2,
                        wordBreak: 'break-word',
                    }}
                >
                    {!isOwn && (
                        <Typography variant="caption" display="block" color="text.secondary">
                            {senderDisplayName}
                        </Typography>
                    )}
                    <Typography variant="body1">
                        {isDeleted ? (
                            <em style={{ opacity: 0.6 }}>This message was deleted</em>
                        ) : (
                            msg.content
                        )}
                    </Typography>
                    <Typography variant="caption" display="block" sx={{ opacity: 0.6, textAlign: 'right' }}>
                        {new Date(msg.created_at).toLocaleTimeString()}
                    </Typography>
                </Paper>
            </Box>
        );
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Container maxWidth="md" sx={{ mt: 4 }}>
                <Alert severity="error">{error}</Alert>
                <Button onClick={() => navigate('/')} sx={{ mt: 2 }}>Go Back</Button>
            </Container>
        );
    }

    const chatMessages = messages[chatId] || [];

    return (
        <Container maxWidth="md" sx={{ mt: 2, mb: 2, height: 'calc(100vh - 100px)' }}>
            <Paper elevation={2} sx={{ p: 2, display: 'flex', alignItems: 'center', mb: 2 }}>
                <IconButton onClick={() => navigate('/')} sx={{ mr: 1 }}>
                    <ArrowBackIcon />
                </IconButton>
                <IconButton onClick={() => setDetailModalOpen(true)} sx={{ ml: 'auto' }}>
                    <InfoIcon />
                </IconButton>
                <Avatar
                    src={chatType === 'group' ? getFullImageUrl(groupAvatar) : (otherUser?.profile_photo_url ? getFullImageUrl(otherUser.profile_photo_url) : null)}
                    sx={{ width: 40, height: 40, cursor: 'pointer' }}
                    onClick={chatType === 'dm' ? goToProfile : () => { }}
                >
                    {chatType === 'group' ? <GroupIcon /> : (otherUser?.name?.[0]?.toUpperCase() || 'C')}
                </Avatar>
                <Typography variant="h6" sx={{ ml: 2 }}>
                    {chatType === 'group' ? groupName : otherUser?.name || 'Chat'}
                </Typography>
            </Paper>

            <Paper
                elevation={1}
                sx={{
                    p: 2,
                    height: 'calc(100% - 140px)',
                    overflowY: 'auto',
                    backgroundColor: 'background.default',
                }}
            >
                <List>
                    {chatMessages.map((msg, index) => (
                        <ListItem key={msg.id || `msg-${index}`} sx={{ p: 0 }}>
                            {renderMessage(msg)}
                        </ListItem>
                    ))}
                </List>
                <div ref={messagesEndRef} />
            </Paper>

            <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                <IconButton component="label" sx={{ mr: 1 }}>
                    <AttachFileIcon />
                    <input type="file" hidden />
                </IconButton>
                <TextField
                    fullWidth
                    variant="outlined"
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                        }
                    }}
                    disabled={sending}
                />
                <IconButton
                    color="primary"
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sending}
                    sx={{ ml: 1 }}
                >
                    {sending ? <CircularProgress size={24} /> : <SendIcon />}
                </IconButton>
            </Box>

            <GroupDetailModal
                open={detailModalOpen}
                onClose={() => setDetailModalOpen(false)}
                chatId={chatId}
            />
        </Container>
    );
}