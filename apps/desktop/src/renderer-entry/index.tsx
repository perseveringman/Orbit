import { createRoot } from 'react-dom/client';
import { injectTheme, getCurrentTheme } from '@orbit/ui-dom';
import { App } from './App';
import { createDesktopShellDescriptor } from '../shared/contracts';
import './styles.css';

// Initialize design system
const savedTheme = getCurrentTheme();
document.documentElement.dataset.theme = savedTheme;
injectTheme(savedTheme);

// Initialize style variant
const savedStyle = localStorage.getItem('orbit-style');
if (savedStyle) {
  document.documentElement.dataset.style = savedStyle;
}

const shellDescriptor = createDesktopShellDescriptor();
const container = document.getElementById(shellDescriptor.rendererMountId);

if (!container) {
  throw new Error(`桌面宿主缺少 #${shellDescriptor.rendererMountId} 挂载点。`);
}

createRoot(container).render(<App />);
