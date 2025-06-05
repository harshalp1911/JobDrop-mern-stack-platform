// client/src/index.js
import React from 'react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css'; // if you have a global CSS file

// Make sure the HTML has <div id="root"></div>
// This is the element into which React will render.
const container = document.getElementById('root');

// React 18+ way:
const root = createRoot(container);
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
