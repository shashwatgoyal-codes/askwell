import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/assets/theme.css';
import { followDeviceTheme } from '@/lib/theme';
import { App } from './App';

followDeviceTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
