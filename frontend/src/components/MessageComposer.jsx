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
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  Close as CloseIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import dayjs from 'dayjs';
import api from '../api/client';

export default function MessageComposer({
  chatId,
  userId,
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
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledTime, setScheduledTime] = useState(null);

  const fileInputRef = useRef(null);
  const tempIdRef = useRef(null);

  const handleSend = async () => {
    // ---- Text only ----
    if (!selectedFile) {
      if (!message.trim()) return;
      const payload = { content: message.trim() };
      if (scheduleEnabled && scheduledTime) {
        payload.scheduled_at = scheduledTime.toISOString();
      }
      onSend(payload);
      setMessage('');
      setScheduleEnabled(false);
      setScheduledTime(null);
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
      scheduled_at: scheduleEnabled && scheduledTime ? scheduledTime.toISOString() : null,
    };
    onTemporaryAdd(chatId, tempMessage);

    const formData = new FormData();
    formData.append('file', selectedFile);
    if (message.trim()) {
      formData.append('text_content', message.trim());
    }
    if (scheduleEnabled && scheduledTime) {
      formData.append('scheduled_at', scheduledTime.toISOString());
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

      onTemporaryRemove(chatId, tempId);
      onSend(response.data);

      setMessage('');
      setSelectedFile(null);
      setScheduleEnabled(false);
      setScheduledTime(null);
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
    if (file) setSelectedFile(file);
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
      {/* File preview */}
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

      {/* Scheduling toggle + picker */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <FormControlLabel
          control={
            <Switch
              checked={scheduleEnabled}
              onChange={(e) => setScheduleEnabled(e.target.checked)}
              disabled={isSending}
              size="small"
            />
          }
          label={<ScheduleIcon fontSize="small" />}
        />
        {scheduleEnabled && (
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DateTimePicker
              label="Send at"
              value={scheduledTime}
              onChange={(newValue) => setScheduledTime(newValue)}
              disabled={isSending}
              slotProps={{ textField: { size: 'small', sx: { width: 200 } } }}
              minDateTime={dayjs().add(1, 'minute')}
            />
          </LocalizationProvider>
        )}
      </Box>

      {/* Input row */}
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        {canUploadMedia && (
          <IconButton component="label" sx={{ mr: 1 }} disabled={isSending}>
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

      {/* Upload progress */}
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