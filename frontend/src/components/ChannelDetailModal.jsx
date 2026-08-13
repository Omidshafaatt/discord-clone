// src/components/ChannelDetailModal.jsx
import React, { useState, useEffect, useRef } from 'react';
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
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog as NestedDialog,
  DialogContent as NestedContent,
  DialogActions as NestedActions,
  Checkbox,
  FormGroup,
  FormControlLabel as FormCheckbox,
} from '@mui/material';
import {
  Close as CloseIcon,
  Add as AddIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import useChatStore from '../store/useChatStore';
import { getFullImageUrl } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const AVAILABLE_PERMISSIONS = [
  'send_messages',
  'upload_media',
  'edit_messages',
  'delete_messages',
  'manage_members',
  'manage_channel',
];

export default function ChannelDetailModal({ open, onClose, chatId }) {
  const { user, userId } = useAuth();

  // ---- Store actions ----
  const {
    chats,
    fetchChannelDetails,
    fetchChannelRoles,
    addChannelMembers,
    removeChannelMember,
    updateMemberRole,
    updateChannel,
    deleteChannel,
    createChannelRole,
  } = useChatStore();

  // ---- Local state ----
  const [channel, setChannel] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newMembers, setNewMembers] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editRules, setEditRules] = useState('');
  const [editIsPublic, setEditIsPublic] = useState(true);
  const [editPhoto, setEditPhoto] = useState(null);

  // Role creation
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRolePermissions, setNewRolePermissions] = useState([]);

  // Available roles – fetched from backend
  const [availableRoles, setAvailableRoles] = useState([]);

  // Ref to prevent multiple fetches
  const fetchedRef = useRef(null);

  const navigate = useNavigate();

  // ---- Fetch channel details & roles when modal opens ----
  useEffect(() => {
    if (open && chatId) {
      if (fetchedRef.current !== chatId) {
        const load = async () => {
          setLoading(true);
          setError('');
          try {
            // 1. Get channel details (includes members)
            const data = await fetchChannelDetails(chatId);
            setChannel(data);
            setEditName(data.name);
            setEditDescription(data.description || '');
            setEditRules(data.rules || '');
            setEditIsPublic(data.is_public);

            // 2. Get all roles for this channel
            const roles = await fetchChannelRoles(chatId);
            setAvailableRoles(roles || []);
          } catch (e) {
            setError('Failed to load channel details');
          } finally {
            setLoading(false);
            fetchedRef.current = chatId;
          }
        };
        load();
      } else {
        // Already fetched – update from store
        const current = chats.find((c) => c.id === chatId);
        if (current) setChannel(current);
      }
    } else {
      // Reset when modal closes
      fetchedRef.current = null;
      setChannel(null);
      setEditing(false);
      setAvailableRoles([]);
    }
  }, [open, chatId, fetchChannelDetails, fetchChannelRoles, chats]);

  // ---- Permissions ----
  const currentMember = channel?.members?.find((m) => m.user.id === userId);
  const canManageChannel = currentMember?.role?.permissions?.includes('manage_channel');
  const canManageMembers = currentMember?.role?.permissions?.includes('manage_members');

  // ---- Add members ----
  const handleAddMembers = async () => {
    if (!newMembers.trim()) return;
    const usernames = newMembers.split(',').map((u) => u.trim()).filter(Boolean);
    if (!usernames.length) return;
    setActionLoading(true);
    setError('');
    try {
      const updated = await addChannelMembers(chatId, usernames);
      setChannel(updated);
      setNewMembers('');
      // Refresh roles list (in case new members bring new roles – not needed, but safe)
      const roles = await fetchChannelRoles(chatId);
      setAvailableRoles(roles);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add members');
    } finally {
      setActionLoading(false);
    }
  };

  // ---- Remove member ----
  const handleRemoveMember = async (userIdToRemove) => {
    if (!window.confirm('Remove this member?')) return;
    setActionLoading(true);
    try {
      await removeChannelMember(chatId, userIdToRemove);
      const data = await fetchChannelDetails(chatId);
      setChannel(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to remove member');
    } finally {
      setActionLoading(false);
    }
  };

  // ---- Change member role ----
  const handleRoleChange = async (userIdToUpdate, roleName) => {
    setActionLoading(true);
    try {
      await updateMemberRole(chatId, userIdToUpdate, roleName);
      const data = await fetchChannelDetails(chatId);
      setChannel(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update role');
    } finally {
      setActionLoading(false);
    }
  };

  // ---- Update channel info ----
  const handleUpdateChannel = async () => {
    const formData = new FormData();
    formData.append('name', editName);
    formData.append('description', editDescription);
    formData.append('rules', editRules);
    formData.append('is_public', editIsPublic);
    if (editPhoto) formData.append('profile_photo', editPhoto);
    setActionLoading(true);
    try {
      const updated = await updateChannel(chatId, formData);
      setChannel(updated);
      setEditing(false);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update channel');
    } finally {
      setActionLoading(false);
    }
  };

  // ---- Delete channel ----
  const handleDeleteChannel = async () => {
    if (!window.confirm('Delete this channel permanently?')) return;
    setActionLoading(true);
    try {
      await deleteChannel(chatId);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete channel');
    } finally {
      setActionLoading(false);
    }
  };

  // ---- Create custom role ----
  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return;
    if (!newRolePermissions.length) {
      setError('Select at least one permission');
      return;
    }
    setActionLoading(true);
    try {
      await createChannelRole(chatId, {
        name: newRoleName,
        permissions: newRolePermissions,
      });
      // Re‑fetch channel details & roles
      const data = await fetchChannelDetails(chatId);
      setChannel(data);
      const roles = await fetchChannelRoles(chatId);
      setAvailableRoles(roles);
      setRoleDialogOpen(false);
      setNewRoleName('');
      setNewRolePermissions([]);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create role');
    } finally {
      setActionLoading(false);
    }
  };

  // ---- Loading state ----
  if (loading) {
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

  // ---- Channel not found ----
  if (!channel) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogContent>
          <Alert severity="error">Channel not found</Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  }

  // ---- Render ----
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Channel Details
        <IconButton sx={{ position: 'absolute', right: 8, top: 8 }} onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* ---- Channel Info / Edit ---- */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar
            src={getFullImageUrl(channel.profile_photo_url)}
            sx={{ width: 64, height: 64, mr: 2 }}
          >
            {channel.name?.[0]?.toUpperCase() || 'C'}
          </Avatar>
          <Box flex={1}>
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
                  rows={1}
                />
                <TextField
                  fullWidth
                  label="Rules"
                  value={editRules}
                  onChange={(e) => setEditRules(e.target.value)}
                  margin="dense"
                  multiline
                  rows={2}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={editIsPublic}
                      onChange={(e) => setEditIsPublic(e.target.checked)}
                    />
                  }
                  label="Public"
                  sx={{ mt: 1 }}
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
                  <Button variant="contained" onClick={handleUpdateChannel} disabled={actionLoading}>
                    Save
                  </Button>
                  <Button onClick={() => setEditing(false)} sx={{ ml: 1 }}>
                    Cancel
                  </Button>
                </Box>
              </>
            ) : (
              // ---- View mode ----
              <>
                <Typography variant="h6">{channel.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {channel.description || 'No description'}
                </Typography>
                {channel.rules && (
                  <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                    Rules: {channel.rules}
                  </Typography>
                )}
                <Typography variant="caption" display="block" color="text.secondary">
                  {channel.is_public ? 'Public' : 'Private'} •{' '}
                  {channel.members?.length || 0} members
                </Typography>
                {canManageChannel && (
                  <>
                    <Button startIcon={<EditIcon />} onClick={() => setEditing(true)} size="small">
                      Edit
                    </Button>
                    <Button color="error" onClick={handleDeleteChannel} size="small">
                      Delete
                    </Button>
                  </>
                )}
              </>
            )}
          </Box>
        </Box>

        {/* ---- Members list ---- */}
        <Typography variant="subtitle1" fontWeight="bold" mt={2}>
          Members
        </Typography>
        <List dense>
          {channel.members?.map((member) => {
            const isCreator = member.user.id === channel.created_by_id;
            const canManageThisMember = canManageMembers && !isCreator;

            return (
              <ListItem key={member.user.id}>
                <ListItemAvatar>
                  <IconButton
                    onClick={() => navigate(`/profile/${member.user.username}`)}
                    sx={{ p: 0, mr: 1 }}
                  >
                    <Avatar src={getFullImageUrl(member.user.profile_photo_url)}>
                      {member.user.name?.[0]?.toUpperCase() || 'U'}
                    </Avatar></IconButton>
                </ListItemAvatar>
                <ListItemText
                  primary={member.user.name}
                  secondary={`@${member.user.username} • ${member.role?.name || 'No role'}`}
                />
                {canManageThisMember && member.user.id !== userId && (
                  <>
                    <FormControl size="small" sx={{ minWidth: 120, mr: 1 }}>
                      <InputLabel id={`role-label-${member.user.id}`}>Role</InputLabel>
                      <Select
                        labelId={`role-label-${member.user.id}`}
                        value={member.role?.name || ''}
                        onChange={(e) => handleRoleChange(member.user.id, e.target.value)}
                        disabled={actionLoading || isCreator}
                      >
                        {availableRoles.map((role) => (
                          <MenuItem key={role.id} value={role.name}>
                            {role.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    {!isCreator && (
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleRemoveMember(member.user.id)}
                        disabled={actionLoading}
                      >
                        <CloseIcon />
                      </IconButton>
                    )}
                  </>
                )}
              </ListItem>
            )
          })}
        </List>

        {/* ---- Add members (admin only) ---- */}
        {canManageMembers && (
          <>
            <Typography variant="subtitle1" fontWeight="bold" mt={2}>
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
          </>
        )}

        {/* ---- Create role (admin only) ---- */}
        {canManageChannel && (
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setRoleDialogOpen(true)}
            sx={{ mt: 2 }}
            disabled={actionLoading}
          >
            Create New Role
          </Button>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>

      {/* ---- Nested dialog for role creation ---- */}
      <NestedDialog open={roleDialogOpen} onClose={() => setRoleDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Custom Role</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Role Name"
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            margin="normal"
          />
          <Typography variant="subtitle2" mt={1}>Permissions:</Typography>
          <FormGroup>
            {AVAILABLE_PERMISSIONS.map((perm) => (
              <FormCheckbox
                key={perm}
                control={
                  <Checkbox
                    checked={newRolePermissions.includes(perm)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNewRolePermissions([...newRolePermissions, perm]);
                      } else {
                        setNewRolePermissions(newRolePermissions.filter((p) => p !== perm));
                      }
                    }}
                  />
                }
                label={perm}
              />
            ))}
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRoleDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateRole} variant="contained" disabled={actionLoading}>
            Create
          </Button>
        </DialogActions>
      </NestedDialog>
    </Dialog>
  );
}