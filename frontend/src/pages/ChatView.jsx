// src/pages/ChatView.jsx
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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
    Menu,
    MenuItem,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
} from '@mui/material';
import {
    Send as SendIcon,
    AttachFile as AttachFileIcon,
    ArrowBack as ArrowBackIcon,
    Info as InfoIcon,
    Group as GroupIcon,
    MoreVert as MoreVertIcon,
    Schedule as ScheduleIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import useChatStore from '../store/useChatStore';
import { getFullImageUrl } from '../lib/utils';
import GroupDetailModal from '../components/GroupDetailModal';
import ChannelDetailModal from '../components/ChannelDetailModal';
import api from '../api/client'; // 👈 ADD THIS IMPORT
import MediaUpload from '../components/MediaUpload';
import MediaDisplay from '../components/MediaDisplay';
import MessageComposer from '../components/MessageComposer';

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
        removeTemporaryMessage,
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

    // ---- Message menu state ----
    const [anchorEl, setAnchorEl] = useState(null);
    const [selectedMessage, setSelectedMessage] = useState(null);

    // ---- Edit dialog state ----
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editContent, setEditContent] = useState('');
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [editLoading, setEditLoading] = useState(false);

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
    const canEditMessages = permissions.includes('edit_messages');
    const canDeleteMessages = permissions.includes('delete_messages');

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

    // ---- WebSocket ----
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
            console.log('📨 WebSocket raw:', event.data);
            try {
                const data = JSON.parse(event.data);
                console.log('📦 Parsed data:', data);

                // Only process messages for this chat
                if (data.chat_id !== parseInt(chatId, 10)) return;

                switch (data.event) {
                    case 'new_message': {
                        const msg = {
                            id: data.message_id,
                            chat_id: data.chat_id,
                            sender_id: data.sender_id,
                            sender_name: data.sender_name || 'Unknown',
                            content: data.content || null,
                            message_type: data.message_type || 'text',
                            media_url: data.media_url || null,
                            created_at: data.created_at || new Date().toISOString(),
                            is_deleted: false,
                            scheduled_at: data.scheduled_at || null,
                            is_sent: data.is_sent !== undefined ? data.is_sent : true,
                        };

                        // Check if message already exists (e.g., scheduled)
                        const existingMessages = messages[chatId] || [];
                        const existing = existingMessages.find((m) => m.id === msg.id);
                        if (existing) {
                            // Update the existing message with the new data (including new timestamp)
                            updateMessage(chatId, msg.id, {
                                is_sent: true,
                                created_at: msg.created_at,   // 👈 update to actual sent time
                                // optionally update content if changed (shouldn't)
                            });
                        } else {
                            addMessage(msg);
                        }
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

    // ---- Message menu handlers ----
    const handleMenuOpen = (event, msg) => {
        setAnchorEl(event.currentTarget);
        setSelectedMessage(msg);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
        setSelectedMessage(null);
    };

    // ---- Edit message ----
    const handleEditMessage = () => {
        if (!selectedMessage) return;
        setEditingMessageId(selectedMessage.id);
        setEditContent(selectedMessage.content);
        setEditDialogOpen(true);
        handleMenuClose();
    };

    const handleSaveEdit = async () => {
        if (!editContent.trim() || !editingMessageId) return;
        setEditLoading(true);
        setError('');
        // Save current state for rollback
        const oldMessages = messages[chatId] || [];
        try {
            // Optimistic update
            updateMessage(chatId, editingMessageId, { content: editContent });
            setEditDialogOpen(false);
            setEditingMessageId(null);
            // API call
            await api.patch(`/chat/${chatId}/messages/${editingMessageId}`, {
                content: editContent,
            });
        } catch (err) {
            setError('Failed to edit message. Reverting...');
            // Rollback: replace messages with old state
            // Since we don't have a backup, we re‑fetch messages from server
            await fetchMessages(chatId);
        } finally {
            setEditLoading(false);
        }
    };

    // ---- Delete message ----
    const handleDeleteMessage = async () => {
        if (!selectedMessage) return;
        if (!window.confirm('Delete this message?')) return;
        setError('');
        const msgId = selectedMessage.id;
        try {
            // Optimistic delete (soft)
            updateMessage(chatId, msgId, {
                is_deleted: true,
                content: 'This message was deleted',
            });
            handleMenuClose();
            await api.delete(`/chat/${chatId}/messages/${msgId}`);
        } catch (err) {
            setError('Failed to delete message. Reverting...');
            // Re‑fetch messages to restore
            await fetchMessages(chatId);
        }
    };

    // ---- Render message ----
    const renderMessage = (msg) => {
        const isOwn = Number(msg.sender_id) === Number(userId);
        const isDeleted = msg.is_deleted;
        const isScheduled = msg.scheduled_at && !msg.is_sent;

        // Determine sender name
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

        // ---- Permission to show menu ----
        let showMenu = false;
        if (isOwn) showMenu = true;
        else if (isChannel && (canEditMessages || canDeleteMessages)) showMenu = true;

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
                <Box sx={{ position: 'relative', maxWidth: '70%' }}>
                    <Paper
                        elevation={1}
                        sx={{
                            p: 2,
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
                        {msg.message_type === 'media' && msg.media_url && (
                            <MediaDisplay
                                mediaUrl={getFullImageUrl(msg.media_url)}
                                content={msg.content}
                            />
                        )}
                        <Typography variant="body1">
                            {isDeleted ? (
                                <em style={{ opacity: 0.6 }}>This message was deleted</em>
                            ) : (
                                msg.content
                            )}
                        </Typography>
                        {isScheduled && (
                            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                                <ScheduleIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
                                Scheduled for {new Date(msg.scheduled_at).toLocaleString()}
                            </Typography>
                        )}
                        <Typography variant="caption" display="block" sx={{ opacity: 0.6, textAlign: 'right' }}>
                            {new Date(msg.created_at).toLocaleTimeString()}
                        </Typography>
                    </Paper>
                    {showMenu && !isDeleted && (
                        <IconButton
                            size="small"
                            onClick={(e) => handleMenuOpen(e, msg)}
                            sx={{ position: 'absolute', top: 4, right: 4 }}
                        >
                            <MoreVertIcon fontSize="small" />
                        </IconButton>
                    )}
                </Box>
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
                <MessageComposer
                    chatId={chatId}
                    userId={userId}   // 👈 add this
                    onSend={(data) => {
                        if (data.message_type === 'media' && data.media_url) {
                            // Media message – already a full message from server
                            addMessage(data);
                        } else {
                            // Text message – send with scheduled_at if present
                            sendMessage(chatId, data);   // data = { content, scheduled_at? }
                        }
                    }}
                    onTemporaryAdd={addMessage}
                    onTemporaryUpdate={updateMessage}
                    onTemporaryRemove={removeTemporaryMessage}
                    onError={(err) => setError(err)}
                    disabled={sending}
                    canUploadMedia={!isChannel || canUploadMedia}
                />
            )}

            {/* Message Menu */}
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
            >
                <MenuItem onClick={handleEditMessage}>Edit</MenuItem>
                <MenuItem onClick={handleDeleteMessage}>Delete</MenuItem>
            </Menu>

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Edit Message</DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        multiline
                        rows={2}
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        autoFocus
                        disabled={editLoading}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditDialogOpen(false)} disabled={editLoading}>
                        Cancel
                    </Button>
                    <Button onClick={handleSaveEdit} variant="contained" disabled={editLoading}>
                        {editLoading ? <CircularProgress size={24} /> : 'Save'}
                    </Button>
                </DialogActions>
            </Dialog>

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