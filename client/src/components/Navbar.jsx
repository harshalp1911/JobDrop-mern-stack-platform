import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Briefcase, User } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link to="/dashboard" className="flex items-center gap-2">
            <Briefcase className="h-7 w-7 text-primary-600" />
            <span className="text-xl font-bold text-slate-900">
              Job<span className="text-primary-600">Drop</span>
            </span>
          </Link>

          {user && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="h-8 w-8 rounded-full"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary-600" />
                  </div>
                )}
                <span className="text-sm font-medium text-slate-700 hidden sm:block">
                  {user.name}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 text-sm text-slate-500 hover:text-red-600 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:block">Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
