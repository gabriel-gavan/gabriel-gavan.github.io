import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './components/App.js';
import html from './components/html.js';

const container = document.getElementById('root');
const root = createRoot(container);
root.render(html`<${App} />`);