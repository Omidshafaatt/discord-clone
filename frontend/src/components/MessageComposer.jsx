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
  CalendarToday as CalendarTodayIcon,
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
  canSendMessages = true,
}) {
  const [message, setMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledTime, setScheduledTime] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const fileInputRef = useRef(null);
  const tempIdRef = useRef(null);

  const canSendText = canSendMessages;
  const canSend = canSendText || selectedFile;

  const handleSend = async () => {
    if (!selectedFile && !canSendText) return;

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
      if (canSend) handleSend();
    }
  };

  const isSending = uploading || disabled;
  const isTextDisabled = !canSendText || isSending;

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
          <Typography variant="body2" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', px: 2 }}>
            📎 {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
          </Typography>
          <IconButton size="small" onClick={removeFile} disabled={isSending}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Paper>
      )}

      {/* Input row – your original layout */}
      <Box sx={{ display: 'flex', alignItems: 'center', pt: 1 }}>
        {/* Scheduling toggle + picker */}
        <Box sx={{ display: 'flex', alignItems: 'center', position: 'relative', right: -7, mr: 1 }}>
          <FormControlLabel
            sx={{ position: 'relative', bottom: -3, mr: 1 }}
            control={
              <Switch
                checked={scheduleEnabled}
                onChange={(e) => setScheduleEnabled(e.target.checked)}
                disabled={isSending}
                size="small"
                sx={{ position: 'relative', bottom: 3 }}
              />
            }
            label={<ScheduleIcon fontSize="small" />}
          />
          {scheduleEnabled && (
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <DateTimePicker
                  open={pickerOpen}
                  onOpen={() => setPickerOpen(true)}
                  onClose={() => setPickerOpen(false)}
                  value={scheduledTime}
                  onChange={(newValue) => setScheduledTime(newValue)}
                  disabled={isSending}
                  slotProps={{
                    textField: {
                      sx: {
                        width: 0,
                        height: 0,
                        opacity: 0,
                        position: 'absolute',
                        pointerEvents: 'none',
                      },
                    },
                  }}
                  minDateTime={dayjs().add(1, 'minute')}
                />
                <IconButton
                  onClick={() => setPickerOpen(true)}
                  disabled={isSending}
                  size="small"
                  sx={{ width: 40, height: 40 }}
                >
                  <CalendarTodayIcon />
                </IconButton>
              </Box>
            </LocalizationProvider>
          )}
        </Box>

        {canUploadMedia && (
          <IconButton component="label" sx={{ mr: 1, width: 40, height: 40 }} disabled={isSending}>
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
          placeholder={
            isTextDisabled
              ? 'You can only upload media'
              : selectedFile
                ? 'Add a caption...'
                : 'Type a message...'
          }
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isTextDisabled}
          size="small"
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
        />

        <IconButton
          color="primary"
          onClick={handleSend}
          disabled={(!message.trim() && !selectedFile) || isSending || !canSend}
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