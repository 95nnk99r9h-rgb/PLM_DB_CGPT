import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { StoreProvider } from './store/store';
import { ToastProvider } from './components/toast';
import { registriereServiceWorker } from './lib/pwa';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <StoreProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </StoreProvider>
    </ErrorBoundary>
  </StrictMode>,
);

registriereServiceWorker();
