import { ViteReactSSG } from 'vite-react-ssg';
import { routes } from './routes.js';
import 'virtual:cassida-global.css';

// `basename` must match the Vite `base` in `vite.config.ts`. Setting
// it on the router lets every `<Link to="/en/...">` render with the
// `/cassida/` prefix automatically, and `useLocation().pathname`
// returns the basename-stripped form — so locale-swapping regexes
// and route declarations stay free of deployment-URL coupling.
export const createRoot = ViteReactSSG({
  routes,
  basename: '/cassida',
});
