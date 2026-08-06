import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Box,
    Container,
    Paper,
    Avatar,
    Typography,
    Button,
    TextField,
    Grid,
    IconButton,
    Switch,
    FormControlLabel,
    CircularProgress,
    Alert,
    Divider,
    Chip,
} from '@mui/material';
import {
    Edit as EditIcon,
    Save as SaveIcon,
    Cancel as CancelIcon,
    PhotoCamera as PhotoCameraIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { getFullImageUrl } from '../lib/utils';

export default function ProfilePage() {
    const { username } = useParams(); // If viewing another user
    const { user, setUser } = useAuth();
    const navigate = useNavigate();

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    // Form state for editing
    const [editData, setEditData] = useState({
        name: '',
        username: '',
        bio: '',
        allow_group_invites: true,
    });
    const [profilePhoto, setProfilePhoto] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');

    // Determine if viewing own profile
    const isOwnProfile = !username || (user && user.username === username);

    // Fetch profile data
    useEffect(() => {
        const fetchProfile = async () => {
            try {
                setLoading(true);
                setError('');
                const endpoint = isOwnProfile ? '/profile/me' : `/profile/${username}`;
                const response = await api.get(endpoint);
                setProfile(response.data);
                setEditData({
                    name: response.data.name,
                    username: response.data.username,
                    bio: response.data.bio || '',
                    allow_group_invites: response.data.allow_group_invites ?? true,
                });
                if (response.data.profile_photo_url) {
                    setPhotoPreview(response.data.profile_photo_url);
                }
            } catch (err) {
                setError(err.response?.data?.detail || 'Failed to load profile');
                if (err.response?.status === 404) {
                    setError('User not found');
                }
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, [username, isOwnProfile]);

    // Handle edit form changes
    const handleEditChange = (e) => {
        const { name, value, checked, type } = e.target;
        setEditData({
            ...editData,
            [name]: type === 'checkbox' ? checked : value,
        });
    };

    const handleFileChange = (e) => {
        if (e.target.files[0]) {
            const file = e.target.files[0];
            setProfilePhoto(file);
            setPhotoPreview(URL.createObjectURL(file));
        }
    };

    // Save profile updates
    const handleSave = async () => {
        setSaving(true);
        setSaveError('');

        const formData = new FormData();
        formData.append('name', editData.name);
        formData.append('username', editData.username);
        formData.append('bio', editData.bio);
        formData.append('allow_group_invites', editData.allow_group_invites);
        if (profilePhoto) {
            formData.append('profile_photo', profilePhoto);
        }

        try {
            const response = await api.patch('/profile/me', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setProfile(response.data);
            setEditData({
                name: response.data.name,
                username: response.data.username,
                bio: response.data.bio || '',
                allow_group_invites: response.data.allow_group_invites ?? true,
            });
            if (response.data.profile_photo_url) {
                setPhotoPreview(response.data.profile_photo_url);
            }
            setIsEditing(false);
            // Update the auth context user
            if (isOwnProfile && setUser) {
                setUser(response.data);
            }
            setProfilePhoto(null);
        } catch (err) {
            setSaveError(err.response?.data?.detail || 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        setSaveError('');
        setProfilePhoto(null);
        // Reset form to current profile data
        if (profile) {
            setEditData({
                name: profile.name,
                username: profile.username,
                bio: profile.bio || '',
                allow_group_invites: profile.allow_group_invites ?? true,
            });
            setPhotoPreview(profile.profile_photo_url || null);
        }
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Container maxWidth="sm" sx={{ mt: 4 }}>
                <Alert severity="error">{error}</Alert>
                <Button onClick={() => navigate(-1)} sx={{ mt: 2 }}>
                    Go Back
                </Button>
            </Container>
        );
    }

    if (!profile) {
        return (
            <Container maxWidth="sm" sx={{ mt: 4 }}>
                <Alert severity="warning">Profile not found</Alert>
                <Button onClick={() => navigate('/')} sx={{ mt: 2 }}>
                    Go Home
                </Button>
            </Container>
        );
    }

    return (
        <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
            <Paper elevation={2} sx={{ p: 4, borderRadius: 3 }}>
                {/* Header */}
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
                    <Typography variant="h4" fontWeight="bold">
                        {isOwnProfile ? 'My Profile' : `Profile: ${profile.name}`}
                    </Typography>
                    {isOwnProfile && !isEditing && (
                        <Button
                            variant="outlined"
                            startIcon={<EditIcon />}
                            onClick={() => setIsEditing(true)}
                        >
                            Edit Profile
                        </Button>
                    )}
                    {isOwnProfile && isEditing && (
                        <Box>
                            <Button
                                variant="outlined"
                                color="error"
                                startIcon={<CancelIcon />}
                                onClick={handleCancel}
                                sx={{ mr: 1 }}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="contained"
                                startIcon={<SaveIcon />}
                                onClick={handleSave}
                                disabled={saving}
                            >
                                {saving ? 'Saving...' : 'Save'}
                            </Button>
                        </Box>
                    )}
                </Box>

                {saveError && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {saveError}
                    </Alert>
                )}

                <Grid container spacing={4}>
                    {/* Avatar Section */}
                    <Grid item xs={12} md={4} display="flex" flexDirection="column" alignItems="center">
                        <Box position="relative">
                            <Avatar
                                src={getFullImageUrl(photoPreview || profile?.profile_photo_url)}
                                sx={{ width: 150, height: 150, mb: 2 }}
                            >
                                {profile?.name?.[0]?.toUpperCase() || 'U'}
                            </Avatar>
                            {isEditing && (
                                <IconButton
                                    component="label"
                                    sx={{
                                        position: 'absolute',
                                        bottom: 8,
                                        right: 0,
                                        backgroundColor: 'background.paper',
                                        boxShadow: 1,
                                    }}
                                >
                                    <PhotoCameraIcon />
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                        hidden
                                    />
                                </IconButton>
                            )}
                        </Box>
                        {isEditing && profilePhoto && (
                            <Typography variant="caption" color="text.secondary">
                                {profilePhoto.name}
                            </Typography>
                        )}
                    </Grid>

                    {/* Info Section */}
                    <Grid item xs={12} md={8}>
                        {!isEditing ? (
                            // View Mode
                            <Box>
                                <Box mb={2}>
                                    <Typography variant="caption" color="text.secondary">
                                        Name
                                    </Typography>
                                    <Typography variant="h6">{profile.name}</Typography>
                                </Box>
                                <Box mb={2}>
                                    <Typography variant="caption" color="text.secondary">
                                        Username
                                    </Typography>
                                    <Typography variant="body1">@{profile.username}</Typography>
                                </Box>
                                {profile.bio && (
                                    <Box mb={2}>
                                        <Typography variant="caption" color="text.secondary">
                                            Bio
                                        </Typography>
                                        <Typography variant="body1">{profile.bio}</Typography>
                                    </Box>
                                )}
                                <Box mb={2}>
                                    <Typography variant="caption" color="text.secondary">
                                        Phone Number
                                    </Typography>
                                    <Typography variant="body1">{profile.phone_number}</Typography>
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="text.secondary">
                                        Group Invites
                                    </Typography>
                                    <Typography variant="body1">
                                        {profile.allow_group_invites ? (
                                            <Chip label="Allowed" color="success" size="small" />
                                        ) : (
                                            <Chip label="Not Allowed" color="error" size="small" />
                                        )}
                                    </Typography>
                                </Box>
                            </Box>
                        ) : (
                            // Edit Mode
                            <Box component="form">
                                <TextField
                                    fullWidth
                                    label="Full Name"
                                    name="name"
                                    value={editData.name}
                                    onChange={handleEditChange}
                                    margin="normal"
                                    required
                                />
                                <TextField
                                    fullWidth
                                    label="Username"
                                    name="username"
                                    value={editData.username}
                                    onChange={handleEditChange}
                                    margin="normal"
                                    required
                                    helperText="Unique username for public profile"
                                />
                                <TextField
                                    fullWidth
                                    label="Bio"
                                    name="bio"
                                    value={editData.bio}
                                    onChange={handleEditChange}
                                    margin="normal"
                                    multiline
                                    rows={3}
                                    placeholder="Tell others about yourself"
                                />
                                <FormControlLabel
                                    control={
                                        <Switch
                                            name="allow_group_invites"
                                            checked={editData.allow_group_invites}
                                            onChange={handleEditChange}
                                        />
                                    }
                                    label="Allow others to add you to groups"
                                    sx={{ mt: 2 }}
                                />
                            </Box>
                        )}
                    </Grid>
                </Grid>
            </Paper>
        </Container>
    );
}