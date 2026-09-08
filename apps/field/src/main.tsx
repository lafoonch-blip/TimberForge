import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import './styles.css';

const el = document.getElementById('root');
if (!el) throw new Error('No #root element.');

createRoot(el).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Registered after render, not before. The app must be usable whether or not
// the service worker installs; treating registration as a prerequisite is how
// a caching bug becomes a blank screen.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Nothing to do and nothing to say. Offline asset caching is unavailable;
      // the data layer, which is what actually matters offline, is unaffected.
    });
  });
}
