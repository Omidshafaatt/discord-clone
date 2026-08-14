import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Button,
} from '@mui/material';
import { Close as CloseIcon, Search as SearchIcon } from '@mui/icons-material';
import api from '../api/client';
import { getFullImageUrl } from '../lib/utils';
import { useTheme } from '../context/ThemeContext';

export default function SearchModal({ open, onClose, chatId, onMessageClick }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { theme } = useTheme();

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/chat/${chatId}/messages/search`, {
        params: { q: query.trim(), limit: 50 },
      });
      setResults(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Typography sx={{ color: theme.palette.text.primary }}>
          Search Messages
        </Typography>
        <IconButton sx={{ position: 'absolute', right: 8, top: 8 }} onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search for messages..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <Button variant="contained" onClick={handleSearch} disabled={!query.trim() || loading}>
            {loading ? <CircularProgress size={24} /> : <SearchIcon />}
          </Button>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {results.length === 0 && query && !loading && (
          <Typography color="text.secondary">No messages found</Typography>
        )}

        <List dense>
          {results.map((msg) => (
            <ListItem
              key={msg.id}
              button
              onClick={() => {
                onMessageClick(msg);
                onClose();
              }}
              sx={{
                borderBottom: '1px solid',
                borderColor: 'divider',
                '&:last-child': { borderBottom: 'none' },
              }}
            >
              <ListItemText
                primary={msg.content || '[Media]'}
                secondary={`${msg.sender_name || 'Unknown'} • ${new Date(msg.created_at).toLocaleString()}`}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}