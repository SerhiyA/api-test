import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Landing } from './pages/Landing';
import { JsonPage } from './pages/JsonPage';
import { CpuPage } from './pages/CpuPage';
import { DbPage } from './pages/DbPage';
import { CachePage } from './pages/CachePage';
import { ErrorsPage } from './pages/ErrorsPage';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Landing /> },
      { path: 'json-serialization', element: <JsonPage /> },
      { path: 'cpu-task', element: <CpuPage /> },
      { path: 'db-query', element: <DbPage /> },
      { path: 'caching', element: <CachePage /> },
      { path: 'error-handling', element: <ErrorsPage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
