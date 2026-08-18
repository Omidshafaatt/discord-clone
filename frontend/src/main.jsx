// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { StyledEngineProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider as CustomThemeProvider, useTheme } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import NotificationToast from './components/NotificationToast';
import App from './App';
import './index.css';

function ThemedApp() {
  const { theme } = useTheme();
  return (
    <StyledEngineProvider injectFirst>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        <NotificationProvider>
          <App />
          <NotificationToast />   {/* 👈 added */}
        </NotificationProvider>
      </MuiThemeProvider>
    </StyledEngineProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <CustomThemeProvider>
        <ThemedApp />
      </CustomThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);