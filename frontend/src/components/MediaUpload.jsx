import { IconButton, CircularProgress, LinearProgress, Box } from '@mui/material';
import { AttachFile as AttachFileIcon } from '@mui/icons-material';
import { useState, useRef } from 'react';
import api from '../api/client';

export default function MediaUpload({ chatId, onUploadSuccess, onError, disabled = false, initialText = '' }) {
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const fileInputRef = useRef(null);

    const handleFileSelect = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setUploading(true);
        setProgress(0);

        const formData = new FormData();
        formData.append('file', file);
        if (initialText) {
            formData.append('text_content', initialText);
        }

        try {
            const response = await api.post(`/chat/${chatId}/messages/media`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent) => {
                    if (progressEvent.total) {
                        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        setProgress(percent);
                    }
                },
            });
            if (onUploadSuccess) onUploadSuccess(response.data);
            // Reset file input
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (err) {
            if (onError) onError(err.response?.data?.detail || 'Upload failed');
        } finally {
            setUploading(false);
            setProgress(0);
        }
    };

    return (
        <>
            <IconButton
                component="label"
                sx={{ mr: 1 }}
                disabled={disabled || uploading}
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
            {uploading && (
                <Box sx={{ width: 100, mr: 1 }}>
                    <LinearProgress variant="determinate" value={progress} />
                </Box>
            )}
        </>
    );
}