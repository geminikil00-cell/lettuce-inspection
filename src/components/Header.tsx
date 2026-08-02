import { Link, useLocation } from 'react-router-dom';

export function Header() {
  const location = useLocation();

  return (
    <header className="bg-green-700 text-white px-4 py-3 shadow-md">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <Link to="/" className="text-xl font-bold tracking-tight">
          🥬 Lettuce Inspection
        </Link>
        <nav className="flex gap-4 text-sm font-medium">
          <Link
            to="/"
            className={`px-3 py-1 rounded transition-colors ${
              location.pathname === '/'
                ? 'bg-green-600'
                : 'hover:bg-green-600/60'
            }`}
          >
            Home
          </Link>
          <Link
            to="/parameters"
            className={`px-3 py-1 rounded transition-colors ${
              location.pathname === '/parameters'
                ? 'bg-green-600'
                : 'hover:bg-green-600/60'
            }`}
          >
            Parameters
          </Link>
        </nav>
      </div>
    </header>
  );
}
