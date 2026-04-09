import { createRoot } from 'react-dom/client';

import { App } from './App';
import { createDesktopShellDescriptor } from '../shared/contracts';

const shellDescriptor = createDesktopShellDescriptor();
const container = document.getElementById(shellDescriptor.rendererMountId);

if (!container) {
  throw new Error(`桌面宿主缺少 #${shellDescriptor.rendererMountId} 挂载点。`);
}

createRoot(container).render(<App />);
