import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  TextField,
  Alert,
  CircularProgress,
  IconButton,
  Box,
} from '@mui/material';
import { Close as CloseIcon, Add as AddIcon, Edit as EditIcon } from '@mui/icons-material';
import useChatStore from '../store/useChatStore';
import { getFullImageUrl } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function GroupDetailModal({ open, onClose, chatId }) {
  const { user } = useAuth();
  const { chats, fetchGroupDetails, addMembers, deleteGroup, leaveGroup, updateGroup } = useChatStore();
  const [newMembers, setNewMembers] = useState('');
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [group, setGroup] = useState(null);

  // ---- Edit mode state ----
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPhoto, setEditPhoto] = useState(null);

  const fetchedRef = useRef(null);
  const navigate = useNavigate();

  // ---- Fetch group details on mount ----
  useEffect(() => {
    if (open && chatId) {
      if (fetchedRef.current !== chatId) {
        const load = async () => {
          setLoadingDetails(true);
          try {
            const data = await fetchGroupDetails(chatId);
            setGroup(data);
            setEditName(data.name);
            setEditDescription(data.description || '');
          } catch (e) {
            setError('Failed to load group details');
          } finally {
            setLoadingDetails(false);
            fetchedRef.current = chatId;
          }
        };
        load();
      } else {
        const current = chats.find((c) => c.id === chatId);
        if (current) setGroup(current);
      }
    } else {
      fetchedRef.current = null;
      setGroup(null);
      setEditing(false);
    }
  }, [open, chatId, fetchGroupDetails, chats]);

  // ---- Add members ----
  const handleAddMembers = async () => {
    if (!newMembers.trim()) return;
    const usernames = newMembers.split(',').map((u) => u.trim()).filter(Boolean);
    if (usernames.length === 0) return;
    setActionLoading(true);
    setError('');
    try {
      const updated = await addMembers(chatId, usernames);
      setGroup(updated);
      setNewMembers('');
      await fetchGroupDetails(chatId);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add members');
    } finally {
      setActionLoading(false);
    }
  };

  // ---- Leave group ----
  const handleLeave = async () => {
    if (window.confirm('Are you sure you want to leave this group?')) {
      setActionLoading(true);
      try {
        await leaveGroup(chatId);
        onClose();
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to leave group');
      } finally {
        setActionLoading(false);
      }
    }
  };

  // ---- Delete group ----
  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this group? This cannot be undone.')) {
      setActionLoading(true);
      try {
        await deleteGroup(chatId);
        onClose();
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to delete group');
      } finally {
        setActionLoading(false);
      }
    }
  };

  // ---- Update group ----
  const handleUpdateGroup = async () => {
    const formData = new FormData();
    formData.append('name', editName);
    formData.append('description', editDescription);
    if (editPhoto) formData.append('profile_photo', editPhoto);

    setActionLoading(true);
    setError('');
    try {
      const updated = await updateGroup(chatId, formData);
      setGroup(updated);
      setEditing(false);
      setEditPhoto(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update group');
    } finally {
      setActionLoading(false);
    }
  };

  // ---- Render ----
  if (loadingDetails) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  if (!group) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogContent>
          <Alert severity="error">Group not found</Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Group Details
        <IconButton sx={{ position: 'absolute', right: 8, top: 8 }} onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* ---- Group Info / Edit ---- */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, width: '100%' }}>
          <Avatar
            src={getFullImageUrl(group.profile_photo_url)}
            sx={{ width: 64, height: 64, mr: 2 }}
          >
            {group.name?.[0]?.toUpperCase() || 'G'}
          </Avatar>

          <Box sx={{ flex: 1 }}>
            {editing ? (
              // ---- Edit mode ----
              <>
                <TextField
                  fullWidth
                  label="Name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  margin="dense"
                />
                <TextField
                  fullWidth
                  label="Description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  margin="dense"
                  multiline
                  rows={2}
                />
                <Button variant="outlined" component="label" sx={{ mt: 1 }}>
                  Change Avatar
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      if (e.target.files[0]) setEditPhoto(e.target.files[0]);
                    }}
                  />
                </Button>
                <Box sx={{ mt: 2 }}>
                  <Button variant="contained" onClick={handleUpdateGroup} disabled={actionLoading}>
                    Save
                  </Button>
                  <Button onClick={() => setEditing(false)} sx={{ ml: 1 }}>
                    Cancel
                  </Button>
                </Box>
              </>
            ) : (
              // ---- View mode with Avatar, Info, and Buttons ----
              <Box
                sx={{
                  display: 'flex',
                  width: '100%',
                  flexDirection: { xs: 'column', md: 'row' },
                  gap: 2,
                  justifyContent: 'space-between',
                  alignItems: { xs: 'flex-start', md: 'center' },
                }}
              >
                <Box flex={1}>
                  <Typography variant="h6">{group.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {group.description || 'No description'}
                  </Typography>
                  <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                    {group.members?.length || 0} members
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Button
                    variant="contained"
                    startIcon={<EditIcon />}
                    onClick={() => setEditing(true)}
                    size="small"
                  >
                    Edit
                  </Button>
                  <Button
                    variant="contained"
                    color="error"
                    onClick={handleDelete}
                    size="small"
                  >
                    Delete
                  </Button>
                </Box>
              </Box>
            )}
          </Box>
        </Box>

        {/* ---- Members list ---- */}
        <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 4 }}>
          Members ({group.members?.length || 0})
        </Typography>
        <List dense>
          {group.members?.map((member) => (
            <ListItem key={member.id}>
              <ListItemAvatar>
                <IconButton
                  onClick={() => navigate(`/profile/${member.username}`)}
                  sx={{ p: 0, mr: 1 }}
                >
                  <Avatar src={getFullImageUrl(member.profile_photo_url)}>
                    {member.name?.[0]?.toUpperCase() || 'U'}
                  </Avatar>
                </IconButton>
              </ListItemAvatar>
              <ListItemText primary={member.name} secondary={member.username} />
            </ListItem>
          ))}
        </List>

        {/* ---- Add Members ---- */}
        <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 3, mb: 1 }}>
          Add Members
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="usernames separated by commas"
            value={newMembers}
            onChange={(e) => setNewMembers(e.target.value)}
            disabled={actionLoading}
          />
          <Button
            variant="contained"
            onClick={handleAddMembers}
            disabled={!newMembers.trim() || actionLoading}
          >
            <AddIcon />
          </Button>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button
          variant="outlined"
          color="error"
          onClick={handleLeave}
          disabled={actionLoading}
        >
          Leave Group
        </Button>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}