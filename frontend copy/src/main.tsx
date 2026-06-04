import { createRoot } from 'react-dom/client';
import { ThemeProvider } from './design-system';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
