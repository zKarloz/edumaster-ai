// Arranque de SPA con estilos globales y notificaciones compartidas.
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { ToastProvider } from './components/shared/Toast';
import { SettingsProvider } from './providers/SettingsProvider';
import './i18n';
import './styles.css';

// El enrutador de datos habilita useBlocker para TODA navegación interna,
// incluidos los botones Atrás/Adelante del navegador. La app mantiene sus
// rutas actuales y la misma única pantalla raíz: no se modifican las URLs.
const router = createBrowserRouter([{ path: '*', element: <App /> }]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><SettingsProvider><ToastProvider><RouterProvider router={router}/></ToastProvider></SettingsProvider></React.StrictMode>
);
