import { createRoot } from 'react-dom/client';
import App from './app';

const appElement = document.getElementById('app');

if (appElement) {
    createRoot(appElement).render(<App />);
}
