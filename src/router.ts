import { createBrowserRouter, redirect } from 'react-router';
import App from './App';

export const router = createBrowserRouter(
  [
    {
      path: '/admin/*',
      loader: () => {
        const isAuthenticated = sessionStorage.getItem('bb_auth') === 'true';
        const isAdmin = sessionStorage.getItem('bb_role') === 'admin';
        return isAuthenticated && isAdmin ? null : redirect('/cliente/inicio');
      },
      Component: App,
    },
    {
      path: '/estilista/*',
      loader: () => {
        const isAuthenticated = sessionStorage.getItem('bb_auth') === 'true';
        const isStylist = sessionStorage.getItem('bb_role') === 'stylist';
        return isAuthenticated && isStylist ? null : redirect('/cliente/inicio');
      },
      Component: App,
    },
    { path: '*', Component: App },
  ],
  { basename: import.meta.env.BASE_URL }
);
