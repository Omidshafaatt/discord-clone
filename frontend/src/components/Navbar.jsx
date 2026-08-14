import { AppBar, Toolbar, Typography, Avatar, Box, IconButton, Menu, MenuItem } from '@mui/material';
import { AccountCircle, Brightness4, Brightness7, Logout } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { getFullImageUrl } from '../lib/utils';
import { useTheme } from '../context/ThemeContext';

export default function Navbar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [anchorEl, setAnchorEl] = useState(null);
    const { mode, toggleTheme } = useTheme();

    const handleMenu = (event) => setAnchorEl(event.currentTarget);
    const handleClose = () => setAnchorEl(null);

    const handleLogout = async () => {
        await logout();
        navigate('/auth');
    };

    const handleProfile = () => {
        navigate('/profile');
        handleClose();
    };

    return (
        <AppBar position="sticky" color="secondary">
            <Toolbar>
                <Typography variant="h6" sx={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
                    ChatFlow
                </Typography>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 5, alignItems: 'center' }}>
                    <IconButton
                        onClick={toggleTheme}
                        sx={{ width: 40, height: 40 }}
                    >
                        {mode === 'light' ? <Brightness4 /> : <Brightness7 />}
                    </IconButton>
                    {user && (
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <IconButton onClick={handleMenu} color="inherit">
                                <Avatar
                                    src={getFullImageUrl(user.profile_photo_url)}
                                    sx={{ width: 32, height: 32 }}
                                >
                                    {!user.profile_photo_url && (user.name?.[0]?.toUpperCase() || 'U')}
                                </Avatar>
                            </IconButton>
                            <Menu
                                anchorEl={anchorEl}
                                open={Boolean(anchorEl)}
                                onClose={handleClose}
                            >
                                <MenuItem onClick={handleProfile}>
                                    <AccountCircle sx={{ mr: 1 }} /> Profile
                                </MenuItem>
                                <MenuItem onClick={handleLogout}>
                                    <Logout sx={{ mr: 1 }} /> Logout
                                </MenuItem>
                            </Menu>
                        </Box>
                    )}
                </div>
            </Toolbar>
        </AppBar>
    );
}