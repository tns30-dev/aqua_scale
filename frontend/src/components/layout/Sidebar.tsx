import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutGrid,
  Box,
  TrendingUp,
  History,
  Droplets,
  X,
  ChevronDown,
  GitCompare,
  Zap,
  Users,
} from "lucide-react";
import { clsx } from "clsx";
import { useProfile } from "../../context/ProfileContext";
import { useSession } from "../../context/SessionContext";
import { ProfileDropdown } from "./ProfileDropdown";
import { TopNavActions } from "./TopNavActions";

interface NavChild {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  children?: NavChild[];
}

const baseNavItems: NavItem[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid, path: "/overview" },
  {
    id: "pond-comparison",
    label: "Pond Comparison",
    icon: GitCompare,
    path: "/pond-comparison",
  },
  {
    id: "digital-twin",
    label: "Digital Twin",
    icon: Box,
    path: "/digital-twin",
  },
  {
    id: "real-time",
    label: "Real-time & Forecast",
    icon: TrendingUp,
    path: "/real-time",
  },
  {
    id: "historical",
    label: "Historical Data",
    icon: History,
    path: "/historical",
  },
  {
    id: "energy",
    label: "Energy Consumption",
    icon: Zap,
    path: "/energy",
  },
];

const adminNavItems: NavItem[] = [
  {
    id: "user-management",
    label: "User Management",
    icon: Users,
    path: "/user-management/users",
  },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { profileConfig } = useProfile();
  const { isPlatformAdmin } = useSession();
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const navItems = isPlatformAdmin
    ? [...baseNavItems, ...adminNavItems]
    : baseNavItems;

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="h-full w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shadow-md"
            style={{
              background: `linear-gradient(135deg, ${profileConfig.theme.gradient.from} 0%, ${profileConfig.theme.gradient.to} 100%)`,
            }}
          >
            <Droplets className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">AquaShield</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const hasChildren = item.children && item.children.length > 0;
          const isExpanded = expandedId === item.id;
          const isActive = hasChildren
            ? location.pathname.startsWith(item.path)
            : location.pathname === item.path;

          return (
            <div key={item.id}>
              <button
                onClick={() => {
                  if (hasChildren) {
                    toggleExpand(item.id);
                    if (!location.pathname.startsWith(item.path)) {
                      navigate(item.children![0].path);
                      onNavigate?.();
                    }
                  } else {
                    navigate(item.path);
                    onNavigate?.();
                  }
                }}
                className={clsx(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  !isActive && "text-gray-700 hover:bg-gray-50",
                )}
                style={
                  isActive
                    ? {
                        backgroundColor: `${profileConfig.theme.primary}15`,
                        color: profileConfig.theme.primary,
                        boxShadow: `inset 3px 0 0 ${profileConfig.theme.primary}`,
                      }
                    : undefined
                }
              >
                <Icon className="w-5 h-5" />
                <span className="truncate flex-1 text-left">{item.label}</span>
                {hasChildren && (
                  <ChevronDown
                    className={clsx(
                      "w-4 h-4 transition-transform",
                      isExpanded && "rotate-180",
                    )}
                  />
                )}
              </button>

              {/* Sub-items */}
              {hasChildren && isExpanded && (
                <div className="ml-8 mt-1 space-y-0.5">
                  {item.children!.map((child) => {
                    const isChildActive = location.pathname === child.path;
                    const ChildIcon = child.icon;
                    return (
                      <button
                        key={child.id}
                        onClick={() => {
                          navigate(child.path);
                          onNavigate?.();
                        }}
                        className={clsx(
                          "w-full flex items-center gap-2 text-left px-3 py-2 rounded-md text-xs font-medium transition-all",
                          isChildActive
                            ? "text-gray-900 bg-gray-100"
                            : "text-gray-500 hover:text-gray-700 hover:bg-gray-50",
                        )}
                      >
                        <ChildIcon className="w-3.5 h-3.5" />
                        {child.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Mobile-only Bottom Actions */}
      <div className="md:hidden border-t border-gray-200 p-3">
        <TopNavActions vertical showProfile={false} onAction={onNavigate} />
      </div>

      {/* Version */}
      <div className="border-t border-gray-200 p-4">
        <div className="text-xs text-gray-500 text-center">v1.0.0</div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const [open, setOpen] = React.useState(false);
  const location = useLocation();
  const { profileConfig } = useProfile();

  React.useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) =>
      e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  return (
    <>
      {/* Mobile top strip */}
      <div className="md:hidden h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2"
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shadow-sm"
            style={{
              background: `linear-gradient(135deg, ${profileConfig.theme.gradient.from} 0%, ${profileConfig.theme.gradient.to} 100%)`,
            }}
          >
            <Droplets className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-gray-900">AquaShield</span>
        </button>

        <ProfileDropdown />
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:z-40 md:flex">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      <div
        className={clsx(
          "md:hidden fixed inset-0 z-50",
          open ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        <div
          className={clsx(
            "absolute inset-0 bg-black/40 transition-opacity",
            open ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setOpen(false)}
        />

        <div
          className={clsx(
            "absolute inset-y-0 left-0 w-64 bg-white shadow-xl transition-transform",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="h-14 flex items-center justify-between px-4 border-b border-gray-200">
            <span className="font-semibold text-gray-900">Menu</span>
            <button onClick={() => setOpen(false)}>
              <X className="w-5 h-5" />
            </button>
          </div>

          <SidebarContent onNavigate={() => setOpen(false)} />
        </div>
      </div>
    </>
  );
}
