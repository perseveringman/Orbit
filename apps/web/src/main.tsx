import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { injectTheme, getCurrentTheme } from '@orbit/ui-dom';
import App from './App';
import './styles.css';

// Initialize design system theme
const savedTheme = getCurrentTheme();
document.documentElement.dataset.theme = savedTheme;
injectTheme(savedTheme);

// Initialize style variant
const savedStyle = localStorage.getItem('orbit-style');
if (savedStyle) {
  document.documentElement.dataset.style = savedStyle;
}

const rootElement = document.getElementById('orbit-root');
if (!rootElement) {
  throw new Error('Orbit Web 宿主缺少 #orbit-root 挂载节点。');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
