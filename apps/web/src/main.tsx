// Arranque de SPA con estilos globales y notificaciones compartidas.
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { BrowserRouter } from 'react-router';
import { ToastProvider } from './components/shared/Toast';
import { SettingsProvider } from './providers/SettingsProvider';
import './i18n';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><SettingsProvider><ToastProvider><BrowserRouter><App /></BrowserRouter></ToastProvider></SettingsProvider></React.StrictMode>
);
