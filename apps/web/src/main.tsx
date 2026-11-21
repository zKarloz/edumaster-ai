// Arranque de SPA con estilos globales y notificaciones compartidas.
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ToastProvider } from './components/shared/Toast';
import { SettingsProvider } from './providers/SettingsProvider';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><SettingsProvider><ToastProvider><App /></ToastProvider></SettingsProvider></React.StrictMode>
);
