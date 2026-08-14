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
  const navigate = useNavigate();

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
    leaveChannel, // 👈 new action
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

  const [availableRoles, setAvailableRoles] = useState([]);
  const fetchedRef = useRef(null);

  // ---- Fetch channel details & roles when modal opens ----
  useEffect(() => {
    if (open && chatId) {
      if (fetchedRef.current !== chatId) {
        const load = async () => {
          setLoading(true);
          setError('');
          try {
            const data = await fetchChannelDetails(chatId);
            setChannel(data);
            setEditName(data.name);
            setEditDescription(data.description || '');
            setEditRules(data.rules || '');
            setEditIsPublic(data.is_public);

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
        const current = chats.find((c) => c.id === chatId);
        if (current) setChannel(current);
      }
    } else {
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
  const isCreator = channel?.created_by_id === userId;

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

  // ---- Delete channel (creator only) ----
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

  // ---- Leave channel (all members) ----
  const handleLeaveChannel = async () => {
    if (!window.confirm('Are you sure you want to leave this channel?')) return;
    setActionLoading(true);
    try {
      await leaveChannel(chatId);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to leave channel');
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
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, width: '100%' }}>
          <Avatar
            src={getFullImageUrl(channel.profile_photo_url)}
            sx={{ width: 94, height: 94, mr: 2, alignSelf: 'start' }}
          >
            {channel.name?.[0]?.toUpperCase() || 'C'}
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
              <Box
                sx={{
                  display: 'flex',
                  width: '100%',
                  flexDirection: { xs: 'column', md: 'row' },
                  gap: 2,
                  justifyContent: 'space-between',
                }}
              >
                <Box flex={1}>
                  <Typography variant="h6">{channel.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {channel.description || 'No description'}
                  </Typography>
                  {channel.rules && (
                    <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                      <b>Rules:</b> {channel.rules}
                    </Typography>
                  )}<br/>
                  <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                    {channel.is_public ? 'Public' : 'Private'} •{' '}
                    {channel.members?.length || 0} members
                  </Typography>
                </Box>
                {canManageChannel && (
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Button variant="contained" startIcon={<EditIcon />} onClick={() => setEditing(true)} size="small">
                      Edit
                    </Button>
                    <Button variant="contained" color="error" onClick={handleDeleteChannel} size="small">
                      Delete
                    </Button>
                  </Box>
                )}
              </Box>
            )}
          </Box>
        </Box>

        {/* ---- Members list ---- */}
        <Typography variant="subtitle1" fontWeight="bold" mt={2}>
          Members
        </Typography>
        <List dense>
          {channel.members?.map((member) => {
            const isCreatorMember = member.user.id === channel.created_by_id;
            const canManageThisMember = canManageMembers && !isCreatorMember;

            return (
              <ListItem key={member.user.id}>
                <ListItemAvatar>
                  <IconButton
                    onClick={() => navigate(`/profile/${member.user.username}`)}
                    sx={{ p: 0, mr: 1 }}
                  >
                    <Avatar src={getFullImageUrl(member.user.profile_photo_url)}>
                      {member.user.name?.[0]?.toUpperCase() || 'U'}
                    </Avatar>
                  </IconButton>
                </ListItemAvatar>
                <ListItemText
                  primary={member.user.name}
                  secondary={`@${member.user.username} • ${member.role?.name || 'No role'}`}
                />
                {canManageThisMember && member.user.id !== userId && (
                  <>
                    <FormControl size="small" sx={{ width: {xs: 120, md: 150}, mr: 1 }}>
                      <InputLabel id={`role-label-${member.user.id}`}>Role</InputLabel>
                      <Select
                        labelId={`role-label-${member.user.id}`}
                        value={member.role?.name || ''}
                        onChange={(e) => handleRoleChange(member.user.id, e.target.value)}
                        disabled={actionLoading || isCreatorMember}
                      >
                        {availableRoles.map((role) => (
                          <MenuItem key={role.id} value={role.name}>
                            {role.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    {!isCreatorMember && (
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
            );
          })}
        </List>

        {/* ---- Add members (admin only) ---- */}
        {canManageMembers && (
          <>
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
          </>
        )}

        {/* ---- Create role (admin only) ---- */}
        {canManageChannel && (
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setRoleDialogOpen(true)}
            sx={{ mt: 3 }}
            disabled={actionLoading}
          >
            Create New Role
          </Button>
        )}
      </DialogContent>

      <DialogActions>
        {/* ---- Leave Channel (all members) ---- */}

        {!canManageChannel && (<Button variant="outlined" color="error" onClick={handleLeaveChannel} disabled={actionLoading}>
          Leave Channel
        </Button>)}

        {/* ---- Delete Channel (creator only) ---- */}
        {isCreator && canManageChannel && (
          <Button variant="contained" color="error" onClick={handleDeleteChannel} disabled={actionLoading}>
            Delete Channel
          </Button>
        )}

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