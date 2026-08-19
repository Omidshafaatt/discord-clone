import { Box, Paper, Typography, Avatar, IconButton, LinearProgress } from '@mui/material';
import { MoreVert as MoreVertIcon, Schedule as ScheduleIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { getFullImageUrl } from '../lib/utils';
import MediaDisplay from './MediaDisplay';

export default function MessageItem({
    msg,
    index,
    isOwn,
    senderDisplayName,
    avatarSrc,
    avatarLetter,
    showMenu,
    onMenuOpen,
    isScheduled,
}) {
    const navigate = useNavigate();
    const isDeleted = msg.is_deleted;
    const isMedia = msg.message_type === 'media';

    return (
        <Box
            key={msg.id || `msg-${index}`}
            sx={{
                display: 'flex',
                justifyContent: isOwn ? 'flex-end' : 'flex-start',
                mb: 2,
            }}
        >
            {!isOwn && msg.sender_username && (
                <IconButton
                    onClick={() => navigate(`/profile/${msg.sender_username}`)}
                    sx={{ p: 0, mr: 1 }}
                >
                    <Avatar src={avatarSrc} sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
                        {avatarLetter}
                    </Avatar>
                </IconButton>
            )}
            {!isOwn && !msg.sender_username && (
                <Avatar src={avatarSrc} sx={{ width: 32, height: 32, mr: 1, bgcolor: 'secondary.main' }}>
                    {avatarLetter}
                </Avatar>
            )}
            <Box sx={{ position: 'relative', maxWidth: '80%', minWidth: 100 }}>
                <Paper
                    elevation={1}
                    sx={{
                        p: 2,
                        backgroundColor: isOwn ? 'secondary.main' : 'background.paper',
                        color: isOwn ? 'white' : 'text.primary',
                        borderRadius: 2,
                        wordBreak: 'break-word',
                        ml: 'auto'
                    }}
                >
                    {!isOwn && (
                        <Typography variant="caption" display="block" color="text.secondary">
                            {senderDisplayName}
                        </Typography>
                    )}

                    {/* ---- Media content ---- */}
                    {/* {isMedia && (
                        <>
                            {msg.uploading ? (
                                <Box sx={{ width: '100%', mt: 1 }}>
                                    <LinearProgress variant="determinate" value={msg.progress || 0} />
                                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                        Uploading... {msg.progress || 0}%
                                    </Typography>
                                </Box>
                            ) : msg.media_url ? (
                                <MediaDisplay
                                    mediaUrl={getFullImageUrl(msg.media_url)}
                                    content={msg.content}
                                />
                            ) : null}
                        </>
                    )} */}

                    {/* ---- Text content ---- */}
                    {/* {!isMedia && (
                        <Typography variant="body1">
                            {isDeleted ? (
                                <em style={{ opacity: 0.6 }}>This message was deleted</em>
                            ) : (
                                msg.content
                            )}
                        </Typography>
                    )} */}
                    {/* ---- اگر پیام حذف شده باشد، فقط همین را نشان بده ---- */}
                    {isDeleted ? (
                        <Typography variant="body1">
                            <em style={{ opacity: 0.6 }}>This message was deleted</em>
                        </Typography>
                    ) : (
                        <>
                            {/* ---- محتوای رسانه (فقط اگر حذف نشده باشد) ---- */}
                            {isMedia && (
                                <>
                                    {msg.uploading ? (
                                        <Box sx={{ width: '100%', mt: 1 }}>
                                            <LinearProgress variant="determinate" value={msg.progress || 0} />
                                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                                Uploading... {msg.progress || 0}%
                                            </Typography>
                                        </Box>
                                    ) : msg.media_url ? (
                                        <MediaDisplay
                                            mediaUrl={getFullImageUrl(msg.media_url)}
                                            content={msg.content}
                                        />
                                    ) : null}
                                </>
                            )}

                            {/* ---- محتوای متنی (فقط اگر حذف نشده باشد) ---- */}
                            {!isMedia && (
                                <Typography variant="body1">
                                    {msg.content}
                                </Typography>
                            )}
                        </>
                    )}

                    {/* ---- Scheduled indicator ---- */}
                    {isScheduled && (
                        <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                            <ScheduleIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
                            Scheduled for {new Date(msg.scheduled_at).toLocaleString()}
                        </Typography>
                    )}

                    {/* ---- Timestamp ---- */}
                    <Typography variant="caption" display="block" sx={{ opacity: 0.6, textAlign: 'right' }}>
                        {!isScheduled &&
                            new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                </Paper>

                {showMenu && (
                    <IconButton
                        size="small"
                        onClick={(e) => onMenuOpen(e, msg)}
                        sx={{ position: 'absolute', top: 4, right: 4 }}
                    >
                        <MoreVertIcon fontSize="small" />
                    </IconButton>
                )}
            </Box>
        </Box>
    );
}