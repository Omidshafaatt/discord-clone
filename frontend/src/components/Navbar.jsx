import { AppBar, Toolbar, Typography, Avatar, Box, IconButton, Menu, MenuItem } from '@mui/material';
import { AccountCircle, Logout } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { getFullImageUrl } from '../lib/utils';

export default function Navbar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [anchorEl, setAnchorEl] = useState(null);

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
        <AppBar position="sticky">
            <Toolbar>
                <Typography variant="h6" sx={{ flexGrow: 1, cursor: 'pointer' }} onClick={() => navigate('/')}>
                    Discord Clone
                </Typography>
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
            </Toolbar>
        </AppBar>
    );
}