import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { StyledEngineProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider as CustomThemeProvider, useTheme } from './context/ThemeContext';
import App from './App';
import './index.css';
import { GlobalStyles } from '@mui/material';

function ThemedApp() {
  const { theme } = useTheme();
  return (
    <StyledEngineProvider enableCssLayer injectFirst>
      <MuiThemeProvider theme={theme}>
        <GlobalStyles styles="@layer theme, base, mui, components, utilities;" />
        <App />
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