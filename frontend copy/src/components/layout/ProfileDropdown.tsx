import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, User as UserIcon } from 'lucide-react';
import { useProfile } from '../../context/ProfileContext';
import { useSession } from '../../context/SessionContext';
import { usePondStore } from '../../stores/pondStore';
import { apiService } from '../../services/api.service';
import {
  getCurrentProjectId,
  setCurrentProfileType,
  setCurrentProjectId,
} from '../../utils/auth';
import type { Project } from '../../types';

/**
 * ProfileDropdown
 * Hidden if the user has 0 or 1 projects (no point in showing a switcher).
 */
export function ProfileDropdown() {
  const { switchProfile } = useProfile();
  const { user, projects } = useSession();
  const setStorePonds = usePondStore((state) => state.setPonds);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentProjectId = getCurrentProjectId();

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  async function handleProjectClick(project: Project) {
    setCurrentProjectId(project.projectId);
    setCurrentProfileType(project.profileType);
    switchProfile(project.profileType);
    setIsOpen(false);

    // Refetch ponds for the new project so the rest of the app reflects it
    // immediately. Without this, the pondStore keeps the previous project's
    // ponds until a full page reload — Overview / Digital Twin / Forecast
    // all render stale data.
    try {
      const response = await apiService.getPonds(project.projectId);
      setStorePonds(response.ponds);
    } catch (err) {
      console.error('Failed to refresh ponds after project switch:', err);
      setStorePonds([]);
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="Switch project"
        aria-expanded={isOpen}
      >
        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
          <UserIcon className="w-4 h-4 text-gray-600" />
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          {/* Header — user identity */}
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-900">
              {user?.username || 'Signed in'}
            </p>
          </div>

          {/* Project list */}
          <div className="py-1 max-h-72 overflow-y-auto">
            <p className="px-4 pt-2 pb-1 text-xs text-gray-400 font-medium uppercase tracking-wide">
              Switch project
            </p>
            {projects.map((project) => {
              const isActive = project.projectId === currentProjectId;
              return (
                <button
                  key={project.projectId}
                  onClick={() => handleProjectClick(project)}
                  className={`w-full flex items-center justify-between px-4 py-2 text-left transition-colors ${
                    isActive ? 'bg-gray-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <p
                    className={`text-sm ${
                      isActive ? 'font-medium text-gray-900' : 'text-gray-700'
                    }`}
                  >
                    {project.name}
                  </p>
                  {isActive && <Check className="w-4 h-4 text-[#0F2B3C]" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
