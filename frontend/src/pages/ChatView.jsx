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
    LinearProgress,
} from '@mui/material';
import {
    Send as SendIcon,
    AttachFile as AttachFileIcon,
    ArrowBack as ArrowBackIcon,
    Info as InfoIcon,
    Group as GroupIcon,
    MoreVert as MoreVertIcon,
    Search as SearchIcon,
    Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import useChatStore from '../store/useChatStore';
import { getFullImageUrl } from '../lib/utils';
import GroupDetailModal from '../components/GroupDetailModal';
import ChannelDetailModal from '../components/ChannelDetailModal';
import MediaDisplay from '../components/MediaDisplay';
import MessageComposer from '../components/MessageComposer';
import SearchModal from '../components/SearchModal';
import api from '../api/client';

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

    // ---- Local state for channel details (bypass store merge) ----
    const [channelDetails, setChannelDetails] = useState(null);

    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [groupDetailModalOpen, setGroupDetailModalOpen] = useState(false);
    const [channelDetailModalOpen, setChannelDetailModalOpen] = useState(false);
    const [searchModalOpen, setSearchModalOpen] = useState(false);

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
    const reconnectTimerRef = useRef(null);

    // ---- Use local channelDetails if available, fallback to storeChat ----
    const effectiveChat = isChannel ? (channelDetails || storeChat) : storeChat;

    // ---- Member count ----
    const memberCount = (isChannel || isGroup)
        ? (effectiveChat?.members?.length || effectiveChat?.members_count || 0)
        : 0;

    // ---- Permissions (based on effectiveChat) ----
    const currentUserRole = useMemo(() => {
        if (!isChannel || !effectiveChat?.members) return null;
        const currentMember = effectiveChat.members.find(
            (m) => Number(m.user.id) === Number(userId)
        );
        return currentMember?.role || null;
    }, [isChannel, effectiveChat, userId]);

    const permissions = currentUserRole?.permissions || [];
    const canSendMessages = permissions.includes('send_messages');
    const canUploadMedia = permissions.includes('upload_media');
    const canManageChannel = permissions.includes('manage_channel');
    const canManageMembers = permissions.includes('manage_members');
    const canEditMessages = permissions.includes('edit_messages');
    const canDeleteMessages = permissions.includes('delete_messages');

    // ---- Scroll ----
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                console.log('👁️ Tab became visible, re‑fetching messages...');
                fetchMessages(chatId);
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [chatId, fetchMessages]);

    // ---- WebSocket connection with reconnection ----
    const connectWebSocket = useCallback(() => {
        const token = localStorage.getItem('access_token');
        if (!token) return;
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

        const ws = new WebSocket(`ws://localhost:8000/ws?token=${token}`);

        ws.onopen = () => {
            console.log('WebSocket connected');
            // Re‑fetch messages to sync any missed updates (e.g., scheduled messages)
            fetchMessages(chatId);
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('📦 Parsed data:', data);
                if (data.chat_id !== parseInt(chatId, 10)) return;

                switch (data.event) {
                    case 'new_message': {
                        // ---- SCHEDULED DELIVERY: re‑fetch to ensure consistency ----
                        if (data.is_scheduled_delivery && data.is_sent) {
                            console.log('📡 Scheduled message delivered, re‑fetching messages...');
                            fetchMessages(chatId);
                            break;
                        }

                        // ---- Normal message handling ----
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

                        console.log('🔍 New message received. Checking for existing message with id:', msg.id);

                        const existingMessages = messages[chatId] || [];
                        const existing = existingMessages.find((m) => m.id === msg.id);
                        console.log('🔍 Existing message found?', existing);

                        if (existing) {
                            console.log('🔄 Updating existing message...');
                            updateMessage(chatId, msg.id, {
                                is_sent: true,
                                created_at: msg.created_at,
                                scheduled_at: null,
                            });
                        } else {
                            console.log('➕ Adding new message');
                            addMessage(msg);
                        }
                        break;
                    }
                    case 'message_edited':
                        updateMessage(parseInt(chatId, 10), data.message_id, {
                            content: data.new_content,
                            updated_at: data.updated_at,
                        });
                        break;
                    case 'message_deleted':
                        updateMessage(parseInt(chatId, 10), data.message_id, {
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

        ws.onclose = (event) => {
            console.log('WebSocket disconnected');
            if (!event.wasClean && !reconnectTimerRef.current) {
                reconnectTimerRef.current = setTimeout(() => {
                    connectWebSocket();
                }, 3000);
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error', error);
            ws.close();
        };

        wsRef.current = ws;
    }, [chatId, addMessage, updateMessage, messages, fetchMessages]);

    // ---- Cleanup on unmount ----
    useEffect(() => {
        return () => {
            if (wsRef.current) wsRef.current.close();
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        };
    }, []);

    // ---- Fetch channel details if needed ----
    useEffect(() => {
        if (isChannel && chatId && !channelDetails && !fetchedChannelRef.current) {
            fetchedChannelRef.current = true;
            fetchChannelDetails(chatId)
                .then((data) => setChannelDetails(data))
                .catch(() => { });
        }
    }, [isChannel, chatId, channelDetails, fetchChannelDetails]);

    // ---- Load messages ----
    const loadMessages = useCallback(async () => {
        setLoading(true);
        let existingChat = getChat(chatId);
        if (!existingChat) {
            await fetchChats();
            existingChat = getChat(chatId);
        }
        if (existingChat?.chat_type === 'channel' && !channelDetails) {
            try {
                const data = await fetchChannelDetails(chatId);
                setChannelDetails(data);
            } catch (e) { }
        }
        await fetchMessages(chatId);
        setLoading(false);
    }, [chatId, getChat, fetchChats, fetchMessages, fetchChannelDetails, channelDetails]);

    // ---- Load on mount ----
    useEffect(() => {
        connectWebSocket();
        loadMessages();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chatId]);

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
        try {
            updateMessage(chatId, editingMessageId, { content: editContent });
            setEditDialogOpen(false);
            setEditingMessageId(null);
            await api.patch(`/chat/${chatId}/messages/${editingMessageId}`, {
                content: editContent,
            });
        } catch (err) {
            setError('Failed to edit message. Reverting...');
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
            updateMessage(chatId, msgId, {
                is_deleted: true,
                content: 'This message was deleted',
            });
            handleMenuClose();
            await api.delete(`/chat/${chatId}/messages/${msgId}`);
        } catch (err) {
            setError('Failed to delete message. Reverting...');
            await fetchMessages(chatId);
        }
    };

    // ---- Scroll to message (search) ----
    const messageRefs = useRef(new Map());

    useEffect(() => {
        messageRefs.current.clear();
    }, [chatId]);

    const scrollToMessage = (messageId) => {
        const element = messageRefs.current.get(messageId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.style.transition = 'background-color 0.5s';
            element.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
            setTimeout(() => {
                element.style.backgroundColor = '';
            }, 2000);
        }
    };

    const handleMessageClick = (msg) => {
        scrollToMessage(msg.id);
    };

    // ---- Render message ----
    const renderMessage = (msg, index) => {
        const isOwn = Number(msg.sender_id) === Number(userId);
        const isDeleted = msg.is_deleted;
        const isMedia = msg.message_type === 'media';

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
        const canEdit = isOwn || (isChannel && canEditMessages);
        const canDelete = isOwn || (isChannel && canDeleteMessages);
        const showMenu = (canEdit || canDelete) && !isDeleted;

        const isScheduled = msg.scheduled_at && !msg.is_sent;

        return (
            <Box
                key={msg.id || `msg-${index}`}
                ref={(el) => {
                    if (el) {
                        messageRefs.current.set(msg.id, el);
                    } else {
                        messageRefs.current.delete(msg.id);
                    }
                }}
                sx={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start', mb: 2, ml: isOwn ? 'auto' : 'inherit' }}
            >
                {!isOwn && msg.sender_username && (
                    <IconButton
                        onClick={() => navigate(`/profile/${msg.sender_username}`)}
                        sx={{ p: 0, mr: 1 }}
                    >
                        <Avatar src={avatarSrc} sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
                            {avatarLetter}
                        </Avatar>
                    </IconButton>
                )}
                {!isOwn && !msg.sender_username && (
                    <Avatar src={avatarSrc} sx={{ width: 32, height: 32, mr: 1, bgcolor: 'secondary.main' }}>
                        {avatarLetter}
                    </Avatar>
                )}
                <Box sx={{ position: 'relative', maxWidth: '80%', minWidth: 100 }}>
                    <Paper
                        elevation={1}
                        sx={{
                            p: 2,
                            backgroundColor: isOwn ? 'secondary.main' : 'background.paper',
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

                        {/* ---- Media content ---- */}
                        {isMedia && (
                            <>
                                {msg.uploading ? (
                                    <Box sx={{ width: '100%', mt: 1 }}>
                                        <LinearProgress variant="determinate" value={msg.progress || 0} />
                                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                            Uploading... {msg.progress || 0}%
                                        </Typography>
                                    </Box>
                                ) : msg.media_url ? (
                                    <MediaDisplay
                                        mediaUrl={getFullImageUrl(msg.media_url)}
                                        content={msg.content}
                                    />
                                ) : null}
                            </>
                        )}

                        {/* ---- Text content (skip for media) ---- */}
                        {!isMedia && (
                            <Typography variant="body1">
                                {isDeleted ? (
                                    <em style={{ opacity: 0.6 }}>This message was deleted</em>
                                ) : (
                                    msg.content
                                )}
                            </Typography>
                        )}

                        {/* ---- Scheduled indicator ---- */}
                        {isScheduled && (
                            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                                <ScheduleIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
                                Scheduled for {new Date(msg.scheduled_at).toLocaleString()}
                            </Typography>
                        )}

                        {/* ---- Timestamp ---- */}
                        <Typography variant="caption" display="block" sx={{ opacity: 0.6, textAlign: 'right' }}>
                            {isScheduled
                                ? `Scheduled: ${new Date(msg.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                : new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            }
                        </Typography>
                    </Paper>

                    {showMenu && (
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

    const showInfoButton = isGroup || isChannel;

    return (
        <Container maxWidth="md" sx={{ mt: 1, height: 'calc(100vh - 80px)' }}>
            {/* Header */}
            <Paper elevation={2} sx={{ p: 2, display: 'flex', alignItems: 'center', mb: 1 }}>
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

                <IconButton onClick={() => setSearchModalOpen(true)} sx={{ ml: 1 }}>
                    <SearchIcon />
                </IconButton>

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
                    height: 'calc(100% - 180px)',
                    overflowY: 'auto',
                    backgroundColor: 'background.default',
                }}
            >
                <List>
                    {chatMessages.map((msg, index) => (
                        <ListItem key={msg.id || `msg-${index}`} sx={{ p: 0 }}>
                            {renderMessage(msg, index)}
                        </ListItem>
                    ))}
                </List>
                <div ref={messagesEndRef} />
            </Paper>

            {/* Composer area */}
            {isChannel ? (
                !canSendMessages && !canUploadMedia ? (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                        You do not have permission to send messages or upload media in this channel.
                    </Alert>
                ) : (
                    <MessageComposer
                        chatId={chatId}
                        userId={userId}
                        onSend={(data) => {
                            if (data.message_type === 'media' && data.media_url) {
                                addMessage(data);
                            } else {
                                sendMessage(chatId, data);
                            }
                        }}
                        onTemporaryAdd={addMessage}
                        onTemporaryUpdate={updateMessage}
                        onTemporaryRemove={removeTemporaryMessage}
                        onError={(err) => setError(err)}
                        disabled={sending}
                        canUploadMedia={canUploadMedia}
                        canSendMessages={canSendMessages}
                    />
                )
            ) : (
                <MessageComposer
                    chatId={chatId}
                    userId={userId}
                    onSend={(data) => {
                        if (data.message_type === 'media' && data.media_url) {
                            addMessage(data);
                        } else {
                            sendMessage(chatId, data);
                        }
                    }}
                    onTemporaryAdd={addMessage}
                    onTemporaryUpdate={updateMessage}
                    onTemporaryRemove={removeTemporaryMessage}
                    onError={(err) => setError(err)}
                    disabled={sending}
                    canUploadMedia={true}
                    canSendMessages={true}
                />
            )}

            {/* Message Menu */}
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
            >
                <MenuItem
                    onClick={handleEditMessage}
                    disabled={!(
                        (selectedMessage && Number(selectedMessage.sender_id) === Number(userId)) ||
                        (isChannel && canEditMessages)
                    )}
                >
                    Edit
                </MenuItem>
                <MenuItem
                    onClick={handleDeleteMessage}
                    disabled={!(
                        (selectedMessage && Number(selectedMessage.sender_id) === Number(userId)) ||
                        (isChannel && canDeleteMessages)
                    )}
                >
                    Delete
                </MenuItem>
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
                    <Button onClick={() => setEditDialogOpen(false)} disabled={editLoading}>Cancel</Button>
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

            <SearchModal
                open={searchModalOpen}
                onClose={() => setSearchModalOpen(false)}
                chatId={chatId}
                onMessageClick={handleMessageClick}
            />
        </Container>
    );
}