// src/pages/ChatView.jsx
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Box, Container, Paper, Typography, List, ListItem, Avatar,
    TextField, IconButton, CircularProgress, Alert, Button,
} from '@mui/material';
import {
    Send as SendIcon, AttachFile as AttachFileIcon,
    ArrowBack as ArrowBackIcon, Info as InfoIcon, Group as GroupIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import useChatStore from '../store/useChatStore';
import { getFullImageUrl } from '../lib/utils';
import GroupDetailModal from '../components/GroupDetailModal';
import ChannelDetailModal from '../components/ChannelDetailModal';

export default function ChatView() {
    const { chatId } = useParams();
    const navigate = useNavigate();
    const { user, userId } = useAuth();

    const {
        messages,
        fetchMessages,
        sendMessage,
        addMessage,
        updateMessage,
        getChat,
        fetchChats,
        fetchChannelDetails,
    } = useChatStore();

    // ---- Store chat – fallback for non‑channels ----
    const storeChat = getChat(chatId);
    const chatType = storeChat?.chat_type || 'dm';
    const otherUser = chatType === 'dm' ? storeChat?.other_user : null;
    const isGroup = chatType === 'group';
    const isChannel = chatType === 'channel';
    const groupName = isGroup ? storeChat?.name : null;
    const groupAvatar = isGroup ? storeChat?.profile_photo_url : null;
    const channelName = isChannel ? storeChat?.name : null;
    const channelAvatar = isChannel ? storeChat?.profile_photo_url : null;
    const isPublic = isChannel ? storeChat?.is_public : null;
    const memberCount = isChannel || isGroup ? storeChat?.members_count || 0 : 0;

    // ---- Local state for channel details (bypass store merge) ----
    const [channelDetails, setChannelDetails] = useState(null);

    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [groupDetailModalOpen, setGroupDetailModalOpen] = useState(false);
    const [channelDetailModalOpen, setChannelDetailModalOpen] = useState(false);

    const wsRef = useRef(null);
    const messagesEndRef = useRef(null);
    const fetchedChannelRef = useRef(false);

    // ---- Fetch channel details if needed ----
    useEffect(() => {
        if (isChannel && chatId && !channelDetails && !fetchedChannelRef.current) {
            fetchedChannelRef.current = true;
            fetchChannelDetails(chatId)
                .then((data) => {
                    console.log('✅ Channel details fetched (local):', data);
                    setChannelDetails(data);
                })
                .catch((err) => {
                    console.error('❌ Failed to fetch channel details:', err);
                });
        }
    }, [isChannel, chatId, channelDetails, fetchChannelDetails]);

    // ---- Use local channelDetails if available, fallback to storeChat ----
    const effectiveChat = isChannel ? (channelDetails || storeChat) : storeChat;

    // ---- Permissions (based on effectiveChat) ----
    const currentUserRole = useMemo(() => {
        if (!isChannel || !effectiveChat?.members) return null;
        const currentMember = effectiveChat.members.find(
            (m) => Number(m.user.id) === Number(userId)
        );
        console.log('👤 Found member:', currentMember);
        return currentMember?.role || null;
    }, [isChannel, effectiveChat, userId]);

    const permissions = currentUserRole?.permissions || [];
    const canSendMessages = permissions.includes('send_messages');
    const canUploadMedia = permissions.includes('upload_media');
    const canManageChannel = permissions.includes('manage_channel');

    // ---- Scroll ----
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    // ---- Load messages ----
    const loadMessages = useCallback(async () => {
        setLoading(true);
        let existingChat = getChat(chatId);
        if (!existingChat) {
            await fetchChats();
            existingChat = getChat(chatId);
        }
        // If it's a channel and we have no details yet, fetch them
        if (existingChat?.chat_type === 'channel' && !channelDetails) {
            console.log('📡 loadMessages: fetching channel details...');
            try {
                const data = await fetchChannelDetails(chatId);
                setChannelDetails(data);
            } catch (e) {
                // ignore
            }
        }
        await fetchMessages(chatId);
        setLoading(false);
    }, [chatId, getChat, fetchChats, fetchMessages, fetchChannelDetails, channelDetails]);

    // ---- Load on mount ----
    useEffect(() => {
        loadMessages();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chatId]);

    // ---- WebSocket (unchanged) ----
    useEffect(() => {
        // ... same as before ...
    }, [chatId, addMessage, updateMessage]);

    // ---- Scroll on new messages ----
    useEffect(() => {
        scrollToBottom();
    }, [messages, chatId, scrollToBottom]);

    // ---- Send message ----
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

    // ---- Navigate to profile ----
    const goToProfile = () => {
        if (otherUser?.username) {
            navigate(`/profile/${otherUser.username}`);
        }
    };

    // ---- Render message (unchanged) ----
    const renderMessage = (msg) => {
        const isOwn = Number(msg.sender_id) === Number(userId);
        const isDeleted = msg.is_deleted;
        let senderDisplayName = isOwn
            ? user.name
            : otherUser?.name || msg.sender_name || 'Unknown';
        if (isGroup || isChannel) {
            senderDisplayName = msg.sender_name || 'Unknown';
        }
        const avatarLetter = senderDisplayName[0]?.toUpperCase() || 'U';
        const avatarSrc = !isOwn && otherUser?.profile_photo_url
            ? getFullImageUrl(otherUser.profile_photo_url)
            : null;

        return (
            <Box
                key={msg.id || `msg-${Date.now()}`}
                sx={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start', mb: 2 }}
            >
                {!isOwn && (
                    <Avatar src={avatarSrc} sx={{ width: 32, height: 32, mr: 1, bgcolor: 'secondary.main' }}>
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

    // ---- Loading / Error states ----
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

    // ---- Header elements ----
    let headerIcon = null;
    let headerTitle = '';
    let headerAvatarSrc = null;
    let headerAvatarClick = null;

    if (isChannel) {
        headerIcon = '#';
        headerTitle = channelName || 'Channel';
        headerAvatarSrc = getFullImageUrl(channelAvatar);
        headerAvatarClick = null;
    } else if (isGroup) {
        headerIcon = <GroupIcon />;
        headerTitle = groupName || 'Group';
        headerAvatarSrc = getFullImageUrl(groupAvatar);
        headerAvatarClick = null;
    } else {
        headerTitle = otherUser?.name || 'Chat';
        headerAvatarSrc = otherUser?.profile_photo_url ? getFullImageUrl(otherUser.profile_photo_url) : null;
        headerAvatarClick = goToProfile;
    }

    const showInfoButton = isGroup || (isChannel && canManageChannel);

    return (
        <Container maxWidth="md" sx={{ mt: 2, mb: 2, height: 'calc(100vh - 100px)' }}>
            {/* Header */}
            <Paper elevation={2} sx={{ p: 2, display: 'flex', alignItems: 'center', mb: 2 }}>
                <IconButton onClick={() => navigate('/')} sx={{ mr: 1 }}>
                    <ArrowBackIcon />
                </IconButton>

                <Avatar
                    src={headerAvatarSrc}
                    sx={{ width: 40, height: 40, cursor: headerAvatarClick ? 'pointer' : 'default' }}
                    onClick={headerAvatarClick || (() => { })}
                >
                    {headerIcon || headerTitle[0]?.toUpperCase() || 'C'}
                </Avatar>

                <Box sx={{ ml: 2, flexGrow: 1 }}>
                    <Typography variant="h6" component="div">
                        {headerTitle}
                    </Typography>
                    {isChannel && (
                        <Typography variant="caption" color="text.secondary">
                            {memberCount} members • {isPublic ? 'Public' : 'Private'}
                        </Typography>
                    )}
                    {isGroup && (
                        <Typography variant="caption" color="text.secondary">
                            {memberCount} members
                        </Typography>
                    )}
                </Box>

                {showInfoButton && (
                    <IconButton
                        onClick={() => {
                            if (isGroup) setGroupDetailModalOpen(true);
                            else if (isChannel) setChannelDetailModalOpen(true);
                        }}
                        sx={{ ml: 'auto' }}
                    >
                        <InfoIcon />
                    </IconButton>
                )}
            </Paper>

            {/* Messages */}
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

            {/* Input area */}
            {isChannel && !canSendMessages ? (
                <Alert severity="warning" sx={{ mt: 2 }}>
                    You do not have permission to send messages in this channel.
                </Alert>
            ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                    {(!isChannel || canUploadMedia) && (
                        <IconButton component="label" sx={{ mr: 1 }}>
                            <AttachFileIcon />
                            <input type="file" hidden />
                        </IconButton>
                    )}
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
            )}

            {/* Modals */}
            {isGroup && (
                <GroupDetailModal
                    open={groupDetailModalOpen}
                    onClose={() => setGroupDetailModalOpen(false)}
                    chatId={chatId}
                />
            )}
            {isChannel && (
                <ChannelDetailModal
                    open={channelDetailModalOpen}
                    onClose={() => setChannelDetailModalOpen(false)}
                    chatId={chatId}
                />
            )}
        </Container>
    );
}