import { ViteReactSSG } from 'vite-react-ssg';
import { routes } from './routes.js';
import 'virtual:cassida-global.css';

export const createRoot = ViteReactSSG({ routes });
