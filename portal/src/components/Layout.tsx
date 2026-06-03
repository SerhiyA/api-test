import { NavLink, Outlet } from 'react-router-dom';

const PAGES = [
  { to: '/', label: 'Overview', end: true },
  { to: '/json-serialization', label: 'JSON Serialization' },
  { to: '/cpu-task', label: 'CPU Task' },
  { to: '/db-query', label: 'DB Query' },
  { to: '/caching', label: 'Caching' },
  { to: '/error-handling', label: 'Error Handling' },
];

export function Layout() {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand__mark" />
          Backend Benchmark
        </div>
        <nav className="nav">
          {PAGES.map((p) => (
            <NavLink
              key={p.to}
              to={p.to}
              end={p.end}
              className={({ isActive }) => 'nav__link' + (isActive ? ' nav__link--active' : '')}
            >
              {p.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
