// src/components/MessageComposer.jsx
import { useState, useRef } from 'react';
import {
  Box,
  TextField,
  IconButton,
  CircularProgress,
  LinearProgress,
  Paper,
  Typography,
} from '@mui/material';
import { Send as SendIcon, AttachFile as AttachFileIcon, Close as CloseIcon } from '@mui/icons-material';
import api from '../api/client';

export default function MessageComposer({
  chatId,
  userId,                // 👈 pass the current user ID from parent
  onSend,
  onTemporaryAdd,
  onTemporaryUpdate,
  onTemporaryRemove,
  onError,
  disabled = false,
  canUploadMedia = true,
}) {
  const [message, setMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);
  const tempIdRef = useRef(null);

  const handleSend = async () => {
    // ---- No file → send text ----
    if (!selectedFile) {
      if (!message.trim()) return;
      onSend({ content: message.trim() });
      setMessage('');
      return;
    }

    // ---- Upload file with caption ----
    setUploading(true);
    setUploadProgress(0);

    const tempId = -Date.now();
    tempIdRef.current = tempId;

    const tempMessage = {
      id: tempId,
      chat_id: parseInt(chatId, 10),
      sender_id: parseInt(userId, 10) || 0,
      sender_name: 'You',
      content: message.trim() || null,
      message_type: 'media',
      media_url: null,
      created_at: new Date().toISOString(),
      is_deleted: false,
      uploading: true,
      progress: 0,
      is_sent: true,
    };
    onTemporaryAdd(chatId, tempMessage);

    const formData = new FormData();
    formData.append('file', selectedFile);
    if (message.trim()) {
      formData.append('text_content', message.trim());
    }

    try {
      const response = await api.post(`/chat/${chatId}/messages/media`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
            onTemporaryUpdate(chatId, tempId, percent);
          }
        },
      });

      // Remove temporary message
      onTemporaryRemove(chatId, tempId);

      // Broadcast final message
      onSend(response.data);

      // Reset form
      setMessage('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      onTemporaryRemove(chatId, tempId);
      if (onError) onError(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      tempIdRef.current = null;
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isSending = uploading || disabled;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {/* File preview area */}
      {selectedFile && (
        <Paper
          elevation={1}
          sx={{
            p: 1,
            mb: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'action.hover',
          }}
        >
          <Typography variant="body2" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            📎 {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
          </Typography>
          <IconButton size="small" onClick={removeFile} disabled={isSending}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Paper>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        {canUploadMedia && (
          <IconButton
            component="label"
            sx={{ mr: 1 }}
            disabled={isSending}
          >
            <AttachFileIcon />
            <input
              type="file"
              hidden
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip"
            />
          </IconButton>
        )}

        <TextField
          fullWidth
          variant="outlined"
          placeholder={selectedFile ? 'Add a caption...' : 'Type a message...'}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSending}
          size="small"
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
        />

        <IconButton
          color="primary"
          onClick={handleSend}
          disabled={(!message.trim() && !selectedFile) || isSending}
          sx={{ ml: 1 }}
        >
          {uploading ? <CircularProgress size={24} /> : <SendIcon />}
        </IconButton>
      </Box>

      {/* Progress bar */}
      {uploading && (
        <LinearProgress
          variant="determinate"
          value={uploadProgress}
          sx={{ mt: 1, height: 4, borderRadius: 2 }}
        />
      )}
    </Box>
  );
}