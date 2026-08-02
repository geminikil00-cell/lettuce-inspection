import { Link, useLocation } from 'react-router-dom';
import { Home, BarChart3, Settings } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';

export function Navigation() {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/charts', label: 'Charts', icon: BarChart3 },
    { path: '/parameters', label: 'Parameters', icon: Settings },
  ];

  return (
    <>
      {/* Desktop Top Navigation */}
      <header className="hidden sm:block sticky top-0 z-40 w-full bg-white/80 backdrop-blur-lg border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-green-700 tracking-tight">
            🥬 <span className="text-gray-900">LettuceInspect</span>
          </Link>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'relative px-4 py-2 rounded-full text-sm font-medium transition-colors',
                    isActive ? 'text-green-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  )}
                >
                  <span className="flex items-center gap-2 relative z-10">
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="desktop-active-nav"
                      className="absolute inset-0 bg-green-100 rounded-full"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-lg border-t border-gray-200 pb-safe">
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'relative flex flex-col items-center justify-center w-full h-full space-y-1',
                  isActive ? 'text-green-700' : 'text-gray-500 hover:text-gray-900'
                )}
              >
                <div className="relative">
                  <Icon className={cn('w-6 h-6 transition-transform duration-200', isActive && 'scale-110')} />
                  {isActive && (
                    <motion.div
                      layoutId="mobile-active-nav-indicator"
                      className="absolute -inset-2 bg-green-100 rounded-full -z-10"
                      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    />
                  )}
                </div>
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
