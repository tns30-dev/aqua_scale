import { Search, Bell, Settings, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { apiService } from '../../services/api.service';
import { getCurrentProjectId } from '../../utils/auth';
import { useSession } from '../../context/SessionContext';
import { usePondStore } from '../../stores/pondStore';
import { ProfileDropdown } from './ProfileDropdown';

interface TopNavActionsProps {
  vertical?: boolean;
  showProfile?: boolean;
  onAction?: () => void;
}

export function TopNavActions({
  vertical = false,
  showProfile = true,
  onAction,
}: TopNavActionsProps) {
  const navigate = useNavigate();
  const { clear: clearSession } = useSession();
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    const projectId = getCurrentProjectId();
    if (projectId) {
      apiService.getAlerts(projectId).then((res) => {
        setAlertCount(res.alerts.length);
      });
    }
  }, []);

  const handleLogout = async () => {
    // Clear the in-memory SessionContext regardless of whether the backend
    // logout call succeeds — otherwise <ProtectedRoute> still sees `user`
    // set and lets a browser-Back navigation back into protected pages.
    try {
      await apiService.logout();
    } finally {
      clearSession();
      usePondStore.getState().disconnectAll();
      onAction?.();
      navigate('/login');
    }
  };

  const containerClass = vertical ? 'flex flex-col gap-2' : 'flex items-center gap-3';

  const buttonClass =
    'w-full p-2 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-2 text-gray-700';

  return (
    <div className={containerClass}>
      <button
        type="button"
        className={buttonClass}
        onClick={() => {
          onAction?.();
        }}
      >
        <Search className="w-5 h-5" />
        {vertical && <span>Search</span>}
      </button>

      <button
        type="button"
        className={`${buttonClass} relative`}
        onClick={() => {
          onAction?.();
        }}
      >
        <Bell className="w-5 h-5" />
        {alertCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />}
        {vertical && <span>Notifications</span>}
      </button>

      <button
        type="button"
        className={buttonClass}
        onClick={() => {
          // TODO: connect to your settings page if you have one
          onAction?.();
        }}
      >
        <Settings className="w-5 h-5" />
        {vertical && <span>Settings</span>}
      </button>

      {/* Divider */}
      {!vertical && <div className="w-px h-6 bg-gray-200"></div>}

      {showProfile && (
        <div className={vertical ? 'pt-1' : ''}>
          <ProfileDropdown />
        </div>
      )}

      {/* Divider */}
      {!vertical && <div className="w-px h-6 bg-gray-200"></div>}

      <button type="button" onClick={handleLogout} className={buttonClass}>
        <LogOut className="w-4 h-4" />
        <span>Logout</span>
      </button>
    </div>
  );
}
