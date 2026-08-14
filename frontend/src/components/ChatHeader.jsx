import { Paper, Typography, Avatar, IconButton, Box } from '@mui/material';
import { ArrowBack as ArrowBackIcon, Search as SearchIcon, Info as InfoIcon } from '@mui/icons-material';

export default function ChatHeader({
    title,
    avatarSrc,
    icon,
    onAvatarClick,
    memberCount,
    isPublic,
    isGroup,
    isChannel,
    onBackClick,
    onSearchClick,
    onInfoClick,
}) {
    return (
        <Paper elevation={2} sx={{ p: 2, display: 'flex', alignItems: 'center', mb: 1 }}>
            <IconButton onClick={onBackClick} sx={{ mr: 1 }}>
                <ArrowBackIcon />
            </IconButton>

            <Avatar
                src={avatarSrc}
                sx={{ width: 40, height: 40, cursor: onAvatarClick ? 'pointer' : 'default' }}
                onClick={onAvatarClick || (() => { })}
            >
                {icon || title[0]?.toUpperCase() || 'C'}
            </Avatar>

            <Box sx={{ ml: 2, flexGrow: 1 }}>
                <Typography variant="h6" component="div">
                    {title}
                </Typography>
                {isChannel && (
                    <Typography variant="caption" color="text.secondary">
                        {memberCount} members • {isPublic ? 'Public' : 'Private'}
                    </Typography>
                )}
                {isGroup && (
                    <Typography variant="caption" color="text.secondary">
                        {memberCount} members
                    </Typography>
                )}
            </Box>

            <IconButton onClick={onSearchClick} sx={{ ml: 1 }}>
                <SearchIcon />
            </IconButton>

            <IconButton onClick={onInfoClick} sx={{ ml: 'auto' }}>
                <InfoIcon />
            </IconButton>
        </Paper>
    );
}