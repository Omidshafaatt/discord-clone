import { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Alert,
    CircularProgress,
    Typography,
} from '@mui/material';
import useChatStore from '../store/useChatStore';
import { useTheme } from '../context/ThemeContext';

export default function GroupCreateModal({ open, onClose }) {
    const { createGroup, loading } = useChatStore();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [initialMembers, setInitialMembers] = useState('');
    const [photo, setPhoto] = useState(null);
    const [error, setError] = useState('');

    const { theme } = useTheme();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            setError('Group name is required');
            return;
        }
        setError('');
        const formData = new FormData();
        formData.append('name', name.trim());
        formData.append('description', description.trim());
        if (initialMembers.trim()) {
            const usernames = initialMembers.split(',').map((u) => u.trim()).filter(Boolean);
            usernames.forEach((u) => formData.append('initial_members', u));
        }
        if (photo) formData.append('profile_photo', photo);

        try {
            await createGroup(formData);
            onClose();
            // Reset form
            setName('');
            setDescription('');
            setInitialMembers('');
            setPhoto(null);
            setError('');
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to create group');
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                <Typography sx={{ color: theme.palette.text.primary }}>
                    Create New Group
                </Typography>
            </DialogTitle>
            <form onSubmit={handleSubmit}>
                <DialogContent>
                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                    <TextField
                        fullWidth
                        label="Group Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        margin="normal"
                        required
                    />
                    <TextField
                        fullWidth
                        label="Description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        margin="normal"
                        multiline
                        rows={2}
                    />
                    <TextField
                        fullWidth
                        label="Initial Members (comma-separated usernames)"
                        value={initialMembers}
                        onChange={(e) => setInitialMembers(e.target.value)}
                        margin="normal"
                        placeholder="alireza, sara, mohammad"
                    />
                    <Button
                        variant="outlined"
                        component="label"
                        fullWidth
                        sx={{ mt: 2 }}
                    >
                        {photo ? photo.name : 'Upload Group Avatar'}
                        <input
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={(e) => {
                                if (e.target.files[0]) setPhoto(e.target.files[0]);
                            }}
                        />
                    </Button>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button type="submit" variant="contained" disabled={loading}>
                        {loading ? <CircularProgress size={24} /> : 'Create'}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
}