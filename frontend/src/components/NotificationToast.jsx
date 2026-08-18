// src/components/NotificationToast.jsx
import { Snackbar, Alert, Slide } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../context/NotificationContext';

function SlideTransition(props) {
  return <Slide {...props} direction="up" />;
}

export default function NotificationToast() {
  const { open, notification, hideNotification } = useNotification();
  const navigate = useNavigate();

  const handleClick = () => {
    if (notification.chatId) {
      navigate(`/chat/${notification.chatId}`);
    }
    hideNotification();
  };

  const message =
    notification.count > 1
      ? `${notification.count} new messages from ${notification.senderName || 'someone'}`
      : `New message from ${notification.senderName || 'someone'}`;

  return (
    <Snackbar
      open={open}
      autoHideDuration={null} // we manage hiding via the context timer
      onClose={hideNotification}
      TransitionComponent={SlideTransition}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
    >
      <Alert
        severity="info"
        variant="filled"
        onClose={hideNotification}
        onClick={handleClick}
        sx={{
          cursor: 'pointer',
          width: '100%',
          '& .MuiAlert-message': {
            fontSize: '0.95rem',
          },
        }}
      >
        {message}
        {notification.preview && (
          <span style={{ display: 'block', fontSize: '0.8rem', opacity: 0.8 }}>
            {notification.preview}
          </span>
        )}
      </Alert>
    </Snackbar>
  );
}