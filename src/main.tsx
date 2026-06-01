import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {brand} from './config/brand';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// ── Optional chat widget (injected at runtime, not hardcoded in HTML) ──
if (brand.chatWidgetId) {
  const script = document.createElement('script');
  script.src = 'https://widgets.leadconnectorhq.com/loader.js';
  script.setAttribute('data-resources-url', 'https://widgets.leadconnectorhq.com/chat-widget/loader.js');
  script.setAttribute('data-widget-id', brand.chatWidgetId);
  document.body.appendChild(script);
}
