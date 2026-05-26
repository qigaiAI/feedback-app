import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const tabs = [
  { to: '/feedback/new', label: '写反馈', icon: '✏️' },
  { to: '/students', label: '学生', icon: '👥' },
  { to: '/templates', label: '模板', icon: '📋' },
  { to: '/settings', label: '设置', icon: '⚙️' },
];

export default function Navbar() {
  const location = useLocation();
  const { user } = useAuth();

  if (location.pathname === '/login') return null;
  // Don't show nav for unverified users - they only see the verification page
  if (user && !user.email_verified) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 safe-area-bottom">
      <div className="max-w-lg mx-auto flex justify-around">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex flex-col items-center py-2 px-4 text-xs ${
                isActive ? 'text-primary-600' : 'text-gray-500'
              }`}
          >
            <span className="text-xl mb-0.5">{tab.icon}</span>
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
