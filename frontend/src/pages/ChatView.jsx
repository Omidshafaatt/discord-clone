import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Box,
    Container,
    Paper,
    List,
    ListItem,
    CircularProgress,
    Alert,
    Button,
    Menu,
    MenuItem,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Typography,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import useChatStore from '../store/useChatStore';
import { getFullImageUrl } from '../lib/utils';
import GroupDetailModal from '../components/GroupDetailModal';
import ChannelDetailModal from '../components/ChannelDetailModal';
import MessageComposer from '../components/MessageComposer';
import SearchModal from '../components/SearchModal';
import MessageItem from '../components/MessageItem';
import ChatHeader from '../components/ChatHeader';
import useChatWebSocket from '../hooks/useChatWebSocket';
import api from '../api/client';
import { useTheme } from '../context/ThemeContext';

export default function ChatView() {
    const { chatId } = useParams();
    const navigate = useNavigate();
    const { user, userId } = useAuth();
    const { theme } = useTheme();

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

    // ---- Local state ----
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [sending, setSending] = useState(false);
    const [groupDetailModalOpen, setGroupDetailModalOpen] = useState(false);
    const [channelDetailModalOpen, setChannelDetailModalOpen] = useState(false);
    const [searchModalOpen, setSearchModalOpen] = useState(false);

    // ---- Message menu state ----
    const [anchorEl, setAnchorEl] = useState(null);
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editContent, setEditContent] = useState('');
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [editLoading, setEditLoading] = useState(false);

    const messagesEndRef = useRef(null);
    const fetchedChannelRef = useRef(false);

    // ---- WebSocket ----
    const handleWebSocketMessage = useCallback((data) => {
        switch (data.event) {
            case 'new_message': {
                if (data.is_scheduled_delivery && data.is_sent) {
                    fetchMessages(chatId);
                    break;
                }
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
                const existingMessages = messages[chatId] || [];
                const existing = existingMessages.find((m) => m.id === msg.id);
                if (existing) {
                    updateMessage(chatId, msg.id, { is_sent: true, created_at: msg.created_at, scheduled_at: null });
                } else {
                    addMessage(msg);
                }
                break;
            }
            case 'message_edited':
                updateMessage(parseInt(chatId, 10), data.message_id, { content: data.new_content, updated_at: data.updated_at });
                break;
            case 'message_deleted':
                updateMessage(parseInt(chatId, 10), data.message_id, { is_deleted: true, content: 'This message was deleted' });
                break;
            default:
                break;
        }
    }, [chatId, messages, addMessage, updateMessage, fetchMessages]);

    useChatWebSocket({ chatId, onMessageReceived: handleWebSocketMessage });

    // ---- Data fetching ----
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

    const [channelDetails, setChannelDetails] = useState(null);
    const effectiveChat = isChannel ? (channelDetails || storeChat) : storeChat;
    const memberCount = (isChannel || isGroup)
        ? (effectiveChat?.members?.length || effectiveChat?.members_count || 0)
        : 0;

    // ---- Permissions ----
    const currentUserRole = useMemo(() => {
        if (!isChannel || !effectiveChat?.members) return null;
        const currentMember = effectiveChat.members.find((m) => Number(m.user.id) === Number(userId));
        return currentMember?.role || null;
    }, [isChannel, effectiveChat, userId]);

    const permissions = currentUserRole?.permissions || [];
    const canSendMessages = permissions.includes('send_messages');
    const canUploadMedia = permissions.includes('upload_media');
    const canEditMessages = permissions.includes('edit_messages');
    const canDeleteMessages = permissions.includes('delete_messages');

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
            } catch (_) { }
        }
        await fetchMessages(chatId);
        setLoading(false);
    }, [chatId, getChat, fetchChats, fetchMessages, fetchChannelDetails, channelDetails]);

    useEffect(() => {
        loadMessages();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chatId]);

    // ---- Scroll to bottom ----
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, chatId]);

    // ---- Edit/Delete handlers ----
    const handleMenuOpen = (event, msg) => {
        setAnchorEl(event.currentTarget);
        setSelectedMessage(msg);
    };
    const handleMenuClose = () => {
        setAnchorEl(null);
        setSelectedMessage(null);
    };

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
        try {
            updateMessage(chatId, editingMessageId, { content: editContent });
            setEditDialogOpen(false);
            await api.patch(`/chat/${chatId}/messages/${editingMessageId}`, { content: editContent });
        } catch (err) {
            setError('Failed to edit. Reverting...');
            await fetchMessages(chatId);
        } finally {
            setEditLoading(false);
            setEditingMessageId(null);
        }
    };

    const handleDeleteMessage = async () => {
        if (!selectedMessage) return;
        if (!window.confirm('Delete this message?')) return;
        try {
            updateMessage(chatId, selectedMessage.id, { is_deleted: true, content: 'This message was deleted' });
            handleMenuClose();
            await api.delete(`/chat/${chatId}/messages/${selectedMessage.id}`);
        } catch (err) {
            setError('Failed to delete. Reverting...');
            await fetchMessages(chatId);
        }
    };

    // ---- Message refs for scrolling ----
    const messageRefs = useRef(new Map());
    useEffect(() => messageRefs.current.clear(), [chatId]);

    const scrollToMessage = (messageId) => {
        const el = messageRefs.current.get(messageId);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.style.transition = 'background-color 0.5s';
            el.style.backgroundColor = 'rgba(255,255,0,0.3)';
            setTimeout(() => { el.style.backgroundColor = ''; }, 2000);
        }
    };

    // ---- Render helpers ----
    const renderMessage = (msg, index) => {
        const isOwn = Number(msg.sender_id) === Number(userId);
        const senderDisplayName = isOwn
            ? user.name
            : otherUser?.name || msg.sender_name || 'Unknown';
        const avatarLetter = senderDisplayName[0]?.toUpperCase() || 'U';
        const avatarSrc = !isOwn && otherUser?.profile_photo_url
            ? getFullImageUrl(otherUser.profile_photo_url)
            : null;
        const isScheduled = msg.scheduled_at && !msg.is_sent;
        const canEdit = isOwn || (isChannel && canEditMessages);
        const canDelete = isOwn || (isChannel && canDeleteMessages);
        const showMenu = (canEdit || canDelete) && !msg.is_deleted;

        return (
            <div key={msg.id || `msg-${index}`} ref={(el) => {
                if (el) messageRefs.current.set(msg.id, el);
                else messageRefs.current.delete(msg.id);
            }}
            style={{ marginLeft: isOwn ? 'auto' : 'inherit' }}>
                <MessageItem
                    msg={msg}
                    index={index}
                    isOwn={isOwn}
                    senderDisplayName={senderDisplayName}
                    avatarSrc={avatarSrc}
                    avatarLetter={avatarLetter}
                    showMenu={showMenu}
                    onMenuOpen={handleMenuOpen}
                    isScheduled={isScheduled}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    userId={userId}
                    isChannel={isChannel}
                />
            </div>
        );
    };

    // ---- Loading & Error ----
    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}><CircularProgress /></Box>;
    if (error) return <Container maxWidth="md" sx={{ mt: 4 }}><Alert severity="error">{error}</Alert><Button onClick={() => navigate('/')} sx={{ mt: 2 }}>Go Back</Button></Container>;

    const chatMessages = messages[chatId] || [];

    // ---- Header ----
    let headerTitle = '';
    let headerAvatarSrc = null;
    let headerIcon = null;
    let headerAvatarClick = null;
    if (isChannel) {
        headerTitle = channelName || 'Channel';
        headerAvatarSrc = getFullImageUrl(channelAvatar);
        headerIcon = '#';
    } else if (isGroup) {
        headerTitle = groupName || 'Group';
        headerAvatarSrc = getFullImageUrl(groupAvatar);
        headerIcon = null; // will be handled inside ChatHeader
    } else {
        headerTitle = otherUser?.name || 'Chat';
        headerAvatarSrc = otherUser?.profile_photo_url ? getFullImageUrl(otherUser.profile_photo_url) : null;
        headerAvatarClick = () => otherUser?.username && navigate(`/profile/${otherUser.username}`);
    }

    return (
        <Container maxWidth="md" sx={{ mt: 1, height: 'calc(100vh - 80px)' }}>
            <ChatHeader
                title={headerTitle}
                avatarSrc={headerAvatarSrc}
                icon={headerIcon}
                onAvatarClick={headerAvatarClick}
                memberCount={memberCount}
                isPublic={isPublic}
                isGroup={isGroup}
                isChannel={isChannel}
                onBackClick={() => navigate('/')}
                onSearchClick={() => setSearchModalOpen(true)}
                onInfoClick={() => {
                    if (isGroup) setGroupDetailModalOpen(true);
                    else if (isChannel) setChannelDetailModalOpen(true);
                }}
            />

            <Paper
                elevation={1}
                sx={{ p: 2, height: 'calc(100% - 180px)', overflowY: 'auto', backgroundColor: 'background.default' }}
            >
                <List>
                    {chatMessages.map((msg, idx) => (
                        <ListItem key={msg.id || `msg-${idx}`} sx={{ p: 0 }}>
                            {renderMessage(msg, idx)}
                        </ListItem>
                    ))}
                </List>
                <div ref={messagesEndRef} />
            </Paper>

            {/* Composer */}
            {isChannel ? (
                !canSendMessages && !canUploadMedia ? (
                    <Alert severity="warning" sx={{ mt: 2 }}>You do not have permission to send messages or upload media in this channel.</Alert>
                ) : (
                    <MessageComposer
                        chatId={chatId}
                        userId={userId}
                        onSend={(data) => {
                            if (data.message_type === 'media' && data.media_url) addMessage(data);
                            else sendMessage(chatId, data);
                        }}
                        onTemporaryAdd={addMessage}
                        onTemporaryUpdate={updateMessage}
                        onTemporaryRemove={removeTemporaryMessage}
                        onError={setError}
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
                        if (data.message_type === 'media' && data.media_url) addMessage(data);
                        else sendMessage(chatId, data);
                    }}
                    onTemporaryAdd={addMessage}
                    onTemporaryUpdate={updateMessage}
                    onTemporaryRemove={removeTemporaryMessage}
                    onError={setError}
                    disabled={sending}
                    canUploadMedia={true}
                    canSendMessages={true}
                />
            )}

            {/* Message Menu */}
            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
                <MenuItem onClick={handleEditMessage} disabled={!((selectedMessage && Number(selectedMessage.sender_id) === Number(userId)) || (isChannel && canEditMessages))}>
                    Edit
                </MenuItem>
                <MenuItem onClick={handleDeleteMessage} disabled={!((selectedMessage && Number(selectedMessage.sender_id) === Number(userId)) || (isChannel && canDeleteMessages))}>
                    Delete
                </MenuItem>
            </Menu>

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle><Typography sx={{ color: theme.palette.text.primary }}>Edit Message</Typography></DialogTitle>
                <DialogContent>
                    <TextField fullWidth multiline rows={2} value={editContent} onChange={(e) => setEditContent(e.target.value)} autoFocus disabled={editLoading} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditDialogOpen(false)} disabled={editLoading}>Cancel</Button>
                    <Button onClick={handleSaveEdit} variant="contained" disabled={editLoading}>
                        {editLoading ? <CircularProgress size={24} /> : 'Save'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Modals */}
            {isGroup && <GroupDetailModal open={groupDetailModalOpen} onClose={() => setGroupDetailModalOpen(false)} chatId={chatId} />}
            {isChannel && <ChannelDetailModal open={channelDetailModalOpen} onClose={() => setChannelDetailModalOpen(false)} chatId={chatId} />}
            <SearchModal open={searchModalOpen} onClose={() => setSearchModalOpen(false)} chatId={chatId} onMessageClick={(msg) => scrollToMessage(msg.id)} />
        </Container>
    );
}