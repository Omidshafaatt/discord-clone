import React, { createContext, useState, useContext, useMemo } from 'react';
import { createTheme } from '@mui/material/styles';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const [mode, setMode] = useState(() => {
        // Persist theme preference in localStorage
        return localStorage.getItem('theme') || 'light';
    });

    const toggleTheme = () => {
        setMode((prev) => {
            const newMode = prev === 'light' ? 'dark' : 'light';
            localStorage.setItem('theme', newMode);
            return newMode;
        });
    };

    const theme = useMemo(
        () =>
            createTheme({
                palette: {
                    mode,
                    background: {
                        default: mode === 'light' ? '#f0f2f5' : '#121212',
                        paper: mode === 'light' ? '#ffffff' : '#1e1e1e',
                    },
                },
                components: {
                    MuiInputBase: {
                        styleOverrides: {
                            input: {
                                '&:-webkit-autofill': {
                                    WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
                                    WebkitTextFillColor: `${mode === 'dark' ? '#fff' : '#000'} !important`,
                                    backgroundColor: 'transparent !important',
                                    backgroundImage: 'none !important',
                                    transition: 'background-color 5000s ease-in-out 0s',
                                },
                            },
                        },
                    },
                },
                modularCssLayers: true,
            }),
        [mode]
    );

    return (
        <ThemeContext.Provider value={{ mode, toggleTheme, theme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);