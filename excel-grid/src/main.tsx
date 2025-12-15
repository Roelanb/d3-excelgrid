import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { CssBaseline } from '@mui/material'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { useMemo } from 'react'
import './index.css'
import App from './App.tsx'
import { ColorModeProvider, useColorMode } from './hooks/useColorMode.tsx'

export function AppProviders() {
  const { mode } = useColorMode();
  const theme = useMemo(() => createTheme({ palette: { mode } }), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ColorModeProvider>
      <AppProviders />
    </ColorModeProvider>
  </StrictMode>,
)
