import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
    Box,
    Paper,
    Tabs,
    Tab,
    Avatar,
    TextField,
    Button,
    Typography,
    Grid,
    IconButton,
    Alert,
} from '@mui/material';
import { LockOutlined, Brightness4, Brightness7, ChatBubbleOutlineRounded, Sms } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// Validation schemas
const loginSchema = yup.object().shape({
    username: yup.string().required('Phone number is required'),
    password: yup.string().required('Password is required'),
});

const registerSchema = yup.object().shape({
    phone_number: yup.string().required('Phone number is required'),
    name: yup.string().required('Full name is required'),
    password: yup.string().min(6, 'Password must be at least 6 characters').required('Password is required'),
    username: yup.string().optional(),
    bio: yup.string().optional(),
});

export default function AuthPage() {
    const { login, register: registerUser } = useAuth();
    const { mode, toggleTheme } = useTheme();
    const navigate = useNavigate();

    // Tab state
    const [tabIndex, setTabIndex] = useState(0);
    const [profilePhoto, setProfilePhoto] = useState(null);
    const [serverError, setServerError] = useState('');
    const [loading, setLoading] = useState(false);

    // Login form
    const {
        control: loginControl,
        handleSubmit: handleLoginSubmit,
        formState: { errors: loginErrors },
        reset: resetLogin,
    } = useForm({
        resolver: yupResolver(loginSchema),
        defaultValues: { username: '', password: '' },
    });

    // Register form
    const {
        control: registerControl,
        handleSubmit: handleRegisterSubmit,
        formState: { errors: registerErrors },
        reset: resetRegister,
    } = useForm({
        resolver: yupResolver(registerSchema),
        defaultValues: { phone_number: '', name: '', password: '', username: '', bio: '' },
    });

    const handleTabChange = (_, newValue) => {
        setTabIndex(newValue);
        setServerError('');
        // Reset both forms to avoid cross‑tab validation errors
        resetLogin();
        resetRegister();
        setProfilePhoto(null);
    };

    const onLogin = async (data) => {
        setServerError('');
        setLoading(true);
        const result = await login(data.username, data.password);
        setLoading(false);
        if (result.success) {
            navigate('/');
        } else {
            setServerError(result.error || 'Login failed');
        }
    };

    const onRegister = async (data) => {
        setServerError('');
        setLoading(true);

        const formData = new FormData();
        formData.append('phone_number', data.phone_number);
        formData.append('name', data.name);
        formData.append('password', data.password);
        if (data.username) formData.append('username', data.username);
        if (data.bio) formData.append('bio', data.bio);
        if (profilePhoto) {
            formData.append('profile_photo', profilePhoto);
            console.log('📸 File appended:', profilePhoto.name, profilePhoto.size); // 👈 Add this
        }

        const result = await registerUser(formData);
        setLoading(false);
        if (result.success) {
            navigate('/');
        } else {
            setServerError(result.error || 'Registration failed');
        }
    };

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'background.default',
                p: 2,
            }}
        >
            <Paper
                elevation={6}
                sx={{
                    width: '100%',
                    maxWidth: 480,
                    p: 4,
                    borderRadius: 3,
                    position: 'relative',
                }}
            >
                <IconButton
                    onClick={toggleTheme}
                    sx={{ position: 'absolute', top: 12, right: 12 }}
                >
                    {mode === 'light' ? <Brightness4 /> : <Brightness7 />}
                </IconButton>

                <Box display="flex" flexDirection="column" alignItems="center" mb={3} sx={{ justifyItems: 'center' }}>
                    <Avatar sx={{ m: 1, width: 90, height: 90, border: '1px solid gray', bgcolor: 'secondary.main' }}>
                        <Sms sx={{ width: 64, height: 64 }} />
                    </Avatar>
                    <Typography variant="h5" sx={{ fontWeight: '600', mb: 0.5 }}>ChatFlow</Typography>
                    <Typography variant="h6" sx={{ color: 'gray', fontSize: 16, fontWeight: '500', mb: 2 }}>Connect. Chat. Share.</Typography>
                </Box>

                <Tabs
                    value={tabIndex}
                    onChange={handleTabChange}
                    variant="fullWidth"
                    sx={{ mb: 3 }}
                >
                    <Tab label="Sign In" />
                    <Tab label="Sign Up" />
                </Tabs>

                {serverError && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {serverError}
                    </Alert>
                )}

                {/* Login Tab */}
                {tabIndex === 0 && (
                    <Box component="form" onSubmit={handleLoginSubmit(onLogin)}>
                        <Controller
                            name="username"
                            control={loginControl}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    margin="normal"
                                    required
                                    fullWidth
                                    label="Phone Number"
                                    autoFocus
                                    error={!!loginErrors.username}
                                    helperText={loginErrors.username?.message}
                                />
                            )}
                        />
                        <Controller
                            name="password"
                            control={loginControl}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    margin="normal"
                                    required
                                    fullWidth
                                    label="Password"
                                    type="password"
                                    error={!!loginErrors.password}
                                    helperText={loginErrors.password?.message}
                                />
                            )}
                        />
                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            className="bg-black"
                            sx={{ mt: 3, mb: 2 }}
                            disabled={loading}
                        >
                            {loading ? 'Signing in...' : 'Sign In'}
                        </Button>
                    </Box>
                )}

                {/* Register Tab */}
                {tabIndex === 1 && (
                    <Box component="form" onSubmit={handleRegisterSubmit(onRegister)}>
                        <Grid container spacing={2}>
                            <Grid item xs={12} sx={{ width: '100%' }}>
                                <Controller
                                    name="phone_number"
                                    control={registerControl}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            required
                                            fullWidth
                                            label="Phone Number"
                                            error={!!registerErrors.phone_number}
                                            helperText={registerErrors.phone_number?.message}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} sx={{ width: '100%' }}>
                                <Controller
                                    name="name"
                                    control={registerControl}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            required
                                            fullWidth
                                            label="Full Name"
                                            error={!!registerErrors.name}
                                            helperText={registerErrors.name?.message}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} sx={{ width: '100%' }}>
                                <Controller
                                    name="password"
                                    control={registerControl}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            required
                                            fullWidth
                                            label="Password"
                                            type="password"
                                            error={!!registerErrors.password}
                                            helperText={registerErrors.password?.message}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} sx={{ width: '100%' }}>
                                <Controller
                                    name="username"
                                    control={registerControl}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            label="Username (Optional)"
                                            error={!!registerErrors.username}
                                            helperText={registerErrors.username?.message}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} sx={{ width: '100%' }}>
                                <Controller
                                    name="bio"
                                    control={registerControl}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            label="Bio (Optional)"
                                            multiline
                                            rows={2}
                                            error={!!registerErrors.bio}
                                            helperText={registerErrors.bio?.message}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} sx={{ width: '100%' }}>
                                <Button
                                    variant="outlined"
                                    component="label"
                                    fullWidth
                                    sx={{ py: 1.5 }}
                                >
                                    {profilePhoto ? profilePhoto.name : 'Upload Profile Photo'}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            if (e.target.files[0]) {
                                                setProfilePhoto(e.target.files[0]);
                                            }
                                        }}
                                        hidden
                                    />
                                </Button>
                            </Grid>
                        </Grid>
                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            sx={{ mt: 3, mb: 2 }}
                            disabled={loading}
                        >
                            {loading ? 'Creating account...' : 'Sign Up'}
                        </Button>
                    </Box>
                )}
            </Paper>
        </Box>
    );
}