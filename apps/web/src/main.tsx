import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const rootElement = document.getElementById('orbit-root');

if (!rootElement) {
  throw new Error('Orbit Web 宿主缺少 #orbit-root 挂载节点。');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
