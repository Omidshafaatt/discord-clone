import { Box, Button, Typography } from '@mui/material';

export default function MediaDisplay({ mediaUrl, content }) {
    if (!mediaUrl) return null;

    const url = mediaUrl;
    const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(url);
    const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(url);
    const isAudio = /\.(mp3|wav|ogg|flac)$/i.test(url);
    const fileName = url.split('/').pop();

    return (
        <Box sx={{ mt: 1 }}>
            {isImage && (
                <Box
                    component="img"
                    src={url}
                    sx={{
                        maxWidth: '100%',
                        maxHeight: 300,
                        borderRadius: 1,
                    }}
                    alt="Image"
                />
            )}
            {isVideo && (
                <Box
                    component="video"
                    src={url}
                    controls
                    sx={{
                        maxWidth: '100%',
                        maxHeight: 300,
                        borderRadius: 1,
                    }}
                />
            )}
            {isAudio && (
                <Box component="audio" src={url} controls sx={{ width: '100%' }} />
            )}
            {!isImage && !isVideo && !isAudio && (
                <Button
                    href={url}
                    target="_blank"
                    variant="contained"
                    size="small"
                    startIcon={<span>📎</span>}
                >
                    {fileName}
                </Button>
            )}
            {content && (
                <Typography variant="body1" sx={{ mt: 1 }}>
                    {content}
                </Typography>
            )}
        </Box>
    );
}