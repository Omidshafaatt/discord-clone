import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Drawer,
    AppBar,
    Toolbar,
    Typography,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Avatar,
    IconButton,
    TextField,
    InputAdornment,
    Divider,
    Menu,
    MenuItem,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    CircularProgress,
    Alert,
    Badge,
    ListItemIcon,
    useMediaQuery,
} from '@mui/material';
import {
    Search as SearchIcon,
    Person as PersonIcon,
    Logout as LogoutIcon,
    Chat as ChatIcon,
    GroupAdd as GroupAddIcon,
    Add as AddIcon,
    Menu as MenuIcon,
    Campaign as CampaignIcon,
    Sms,
    Brightness4,
    Brightness7,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import useChatStore from '../store/useChatStore';
import { getFullImageUrl } from '../lib/utils';
import GroupCreateModal from '../components/GroupCreateModal';
import ChannelCreateModal from '../components/ChannelCreateModal';
import { useTheme } from '../context/ThemeContext';

export default function ChatList() {
    const navigate = useNavigate();
    const { mode, toggleTheme, theme } = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const { user, logout } = useAuth();
    const { chats, fetchChats, createChat, loading, error } = useChatStore();

    // ---- Local state ----
    const [dialogOpen, setDialogOpen] = useState(false);
    const [targetUsername, setTargetUsername] = useState('');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState('');
    const [groupModalOpen, setGroupModalOpen] = useState(false);
    const [channelModalOpen, setChannelModalOpen] = useState(false);
    const [anchorEl, setAnchorEl] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

    // ---- Sidebar navigation ----
    const navItems = [
        { label: 'All Chats', icon: <ChatIcon />, filter: 'all' },
        { label: 'Groups', icon: <GroupAddIcon />, filter: 'group' },
        { label: 'Channels', icon: <CampaignIcon />, filter: 'channel' },
    ];

    const [activeFilter, setActiveFilter] = useState('all');

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
        if (chat.chat_type === 'group' || chat.chat_type === 'channel') {
            return chat.name || (chat.chat_type === 'channel' ? 'Channel' : 'Group');
        }
        return 'Unknown';
    };

    // ---- Filter chats by type and search ----
    const filteredChats = chats.filter((chat) => {
        // Filter by type
        if (activeFilter === 'group' && chat.chat_type !== 'group') return false;
        if (activeFilter === 'channel' && chat.chat_type !== 'channel') return false;

        // Filter by search query
        const name = chat.name || getChatName(chat);
        return name.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const getChatAvatar = (chat) => {
        if (chat.chat_type === 'dm' && chat.other_user) {
            return getFullImageUrl(chat.other_user.profile_photo_url);
        }
        if (chat.chat_type === 'group' || chat.chat_type === 'channel') {
            return getFullImageUrl(chat.profile_photo_url);
        }
        return null;
    };

    const handleNewChatClick = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleNewChatClose = () => {
        setAnchorEl(null);
    };

    const handleLogout = async () => {
        await logout();
        navigate('/auth');
    };

    // ---- Drawer content (shared between mobile and desktop) ----
    const drawerContent = (
        <Box sx={{ overflow: 'auto', display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Logo */}
            <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Avatar sx={{ m: 1, width: 50, height: 50, border: '1px solid gray', bgcolor: 'secondary.main' }}>
                    <Sms sx={{ width: 32, height: 32 }} />
                </Avatar>
                <Typography variant="h6" fontWeight="bold">
                    ChatFlow
                </Typography>
            </Box>

            {/* New Chat Button */}
            <Box sx={{ px: 2, pb: 2 }}>
                <Button
                    variant="contained"
                    fullWidth
                    startIcon={<AddIcon />}
                    onClick={handleNewChatClick}
                >
                    New Chat
                </Button>
                <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={handleNewChatClose}
                >
                    <MenuItem
                        onClick={() => {
                            setDialogOpen(true);
                            handleNewChatClose();
                        }}
                    >
                        <ChatIcon sx={{ mr: 1 }} /> New DM
                    </MenuItem>
                    <MenuItem
                        onClick={() => {
                            setGroupModalOpen(true);
                            handleNewChatClose();
                        }}
                    >
                        <GroupAddIcon sx={{ mr: 1 }} /> New Group
                    </MenuItem>
                    <MenuItem
                        onClick={() => {
                            setChannelModalOpen(true);
                            handleNewChatClose();
                        }}
                    >
                        <CampaignIcon sx={{ mr: 1 }} /> New Channel
                    </MenuItem>
                </Menu>
            </Box>

            <Divider />

            {/* Navigation */}
            <List>
                {navItems.map((item) => (
                    <ListItem
                        button
                        key={item.label}
                        selected={activeFilter === item.filter}
                        onClick={() => {
                            setActiveFilter(item.filter);
                            if (isMobile) setMobileDrawerOpen(false);
                        }}
                    >
                        <ListItemIcon>{item.icon}</ListItemIcon>
                        <ListItemText primary={item.label} />
                    </ListItem>
                ))}
            </List>

            <Box sx={{ flexGrow: 1 }} />

            {/* User Profile (sidebar bottom) */}
            <Divider />
            <Box sx={{ p: 2, display: 'flex', alignItems: 'center' }}>
                <Avatar
                    src={getFullImageUrl(user?.profile_photo_url)}
                    sx={{ width: 40, height: 40, mr: 1 }}
                >
                    {user?.name?.[0]?.toUpperCase() || 'U'}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight="bold" noWrap sx={{ mx: 1 }}>
                        {user?.name || 'User'}
                    </Typography>
                </Box>
                <IconButton size="small" onClick={handleLogout}>
                    <LogoutIcon fontSize="small" />
                </IconButton>
            </Box>
        </Box>
    );

    if (loading && chats.length === 0) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ display: 'flex', height: '100vh' }}>
            {/* ---- Sidebar (Desktop) ---- */}
            <Drawer
                variant="permanent"
                sx={{
                    display: { xs: 'none', md: 'block' },
                    width: 240,
                    flexShrink: 0,
                    [`& .MuiDrawer-paper`]: { width: 240, boxSizing: 'border-box' },
                }}
            >
                {drawerContent}
            </Drawer>

            {/* ---- Sidebar (Mobile) ---- */}
            <Drawer
                variant="temporary"
                open={mobileDrawerOpen}
                onClose={() => setMobileDrawerOpen(false)}
                sx={{
                    display: { xs: 'block', md: 'none' },
                    width: 240,
                    [`& .MuiDrawer-paper`]: { width: 240, boxSizing: 'border-box' },
                }}
            >
                {drawerContent}
            </Drawer>

            {/* ---- Main Content ---- */}
            <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', width: '100%', backgroundColor: mode === 'light' ? '#f0f2f9' : '#1a1a1a', }}>
                {/* Top Bar */}
                <AppBar position="static" color="default" elevation={1} sx={{ zIndex: 0 }}>
                    <Toolbar>
                        {/* Burger menu (mobile only) */}
                        <IconButton
                            edge="start"
                            sx={{ display: { xs: 'flex', md: 'none' }, mr: 2 }}
                            onClick={() => setMobileDrawerOpen(true)}
                        >
                            <MenuIcon />
                        </IconButton>

                        <Typography variant="h6" sx={{ mr: 4, width: 100 }}>
                            {activeFilter === 'all'
                                ? 'All Chats'
                                : activeFilter === 'group'
                                    ? 'Groups'
                                    : 'Channels'}
                        </Typography>

                        <TextField
                            size="small"
                            placeholder="Search chats..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{ width: { xs: 200, sm: 250, md: 300 } }}
                        />
                        <div style={{ marginLeft: 'auto' }}>
                            <IconButton
                                onClick={toggleTheme}
                                sx={{ width: 40, height: 40, mr: 1 }}
                            >
                                {mode === 'light' ? <Brightness4 /> : <Brightness7 />}
                            </IconButton>
                            <IconButton onClick={() => navigate('/profile')}>
                                <Avatar
                                    src={getFullImageUrl(user?.profile_photo_url)}
                                    sx={{ width: 32, height: 32 }}
                                >
                                    {user?.name?.[0]?.toUpperCase() || 'U'}
                                </Avatar>
                            </IconButton>
                        </div>
                    </Toolbar>
                </AppBar>

                {/* Chat List */}
                <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                    {filteredChats.length === 0 ? (
                        <Box textAlign="center" py={8}>
                            <PersonIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                            <Typography variant="h6" color="text.secondary">
                                {searchQuery
                                    ? 'No matching conversations'
                                    : activeFilter === 'all'
                                        ? 'No conversations yet'
                                        : `No ${activeFilter}s found`}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {!searchQuery && 'Start a new chat using the New Chat button.'}
                            </Typography>
                        </Box>
                    ) : (
                        <List>
                            {filteredChats.map((chat, index) => (
                                <React.Fragment key={chat.id}>
                                    <ListItem
                                        button
                                        onClick={() => navigate(`/chat/${chat.id}`)}
                                        sx={{
                                            borderRadius: 2,
                                            '&:hover': { backgroundColor: 'action.hover' },
                                            color: 'text.primary'
                                        }}
                                    >
                                        <ListItemAvatar>
                                            <Badge
                                                color="primary"
                                                variant="dot"
                                                invisible={chat.unread_count === 0}
                                                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                            >
                                                <Avatar src={getChatAvatar(chat)}>
                                                    {chat.chat_type === 'channel' ? (
                                                        <CampaignIcon />
                                                    ) : chat.chat_type === 'group' ? (
                                                        <GroupAddIcon />
                                                    ) : (
                                                        getChatName(chat)[0]?.toUpperCase() || 'U'
                                                    )}
                                                </Avatar>
                                            </Badge>
                                        </ListItemAvatar>
                                        <ListItemText
                                            primary={getChatName(chat)}
                                            secondaryTypographyProps={{ noWrap: true }}
                                        />
                                        <Box sx={{ textAlign: 'right', minWidth: 60 }}>
                                            <Typography variant="caption" color="text.secondary">
                                                {new Date(chat.created_at).toLocaleDateString()}
                                            </Typography>
                                            {chat.unread_count > 0 && (
                                                <Box
                                                    sx={{
                                                        backgroundColor: 'primary.main',
                                                        color: 'white',
                                                        borderRadius: '50%',
                                                        width: 20,
                                                        height: 20,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: 12,
                                                        fontWeight: 'bold',
                                                        mt: 0.5,
                                                        ml: 'auto',
                                                    }}
                                                >
                                                    {chat.unread_count}
                                                </Box>
                                            )}
                                        </Box>
                                    </ListItem>
                                </React.Fragment>
                            ))}
                        </List>
                    )}
                </Box>
            </Box>

            {/* ---- Dialogs ---- */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Start a New DM</DialogTitle>
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

            <GroupCreateModal open={groupModalOpen} onClose={() => setGroupModalOpen(false)} />
            <ChannelCreateModal open={channelModalOpen} onClose={() => setChannelModalOpen(false)} />
        </Box>
    );
}