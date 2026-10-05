import {
  LayoutDashboard,
  CheckSquare,
  BookOpen,
  ClipboardList,
  Users,
  Bell,
  Settings,
  LogOut,
  X,
} from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';

export type Page =
  | 'dashboard'
  | 'tasks'
  | 'resources'
  | 'tests'
  | 'connections'
  | 'notifications'
  | 'settings';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: Page) => void;
  unreadCount: number;
  sidebarOpen?: boolean;
  onSidebarToggle?: () => void;
}

interface NavItem {
  id: Page;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: CheckSquare,
  },
  {
    id: 'resources',
    label: 'Resources',
    icon: BookOpen,
  },
  {
    id: 'tests',
    label: 'Tests',
    icon: ClipboardList,
  },
  {
    id: 'connections',
    label: 'Connections',
    icon: Users,
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: Bell,
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
  },
];

export default function Sidebar({
  currentPage,
  onNavigate,
  unreadCount,
  sidebarOpen = true,
  onSidebarToggle,
}: SidebarProps) {
  const { profile, signOut } = useAuth();

  const handleNavigation = (page: Page) => {
    onNavigate(page);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onSidebarToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed
          top-0
          left-0
          z-50
          h-screen
          bg-white
          dark:bg-slate-950
          border-r
          border-gray-200
          dark:border-slate-800
          transition-all
          duration-300
          ease-in-out
          flex
          flex-col
          ${
            sidebarOpen
              ? 'w-64 translate-x-0'
              : 'w-20 translate-x-0'
          }
          lg:translate-x-0
        `}
      >
        {/* Header */}
        <div
          className={`
            h-20
            flex
            items-center
            px-4
            ${
              sidebarOpen
                ? 'justify-between'
                : 'justify-center'
            }
          `}
        >
          {/* Logo */}
          <button
            type="button"
            onClick={() => {
              if (!sidebarOpen) {
                onSidebarToggle?.();
              } else {
                handleNavigation('dashboard');
              }
            }}
            className="flex items-center justify-center"
            aria-label="LearnPath"
          >
            {sidebarOpen ? (
              <img
                src="/learnpath-logo.png"
                alt="LearnPath"
                className="h-10 w-auto object-contain"
              />
            ) : (
              <img
                src="/learnpath-small-logo.png"
                alt="LearnPath"
                className="h-10 w-10 object-contain"
              />
            )}
          </button>

          {/* Close button */}
          {sidebarOpen && (
            <button
              type="button"
              onClick={onSidebarToggle}
              className="
                hidden
                lg:flex
                items-center
                justify-center
                w-9
                h-9
                rounded-xl
                text-gray-500
                hover:text-gray-900
                hover:bg-gray-100
                dark:text-slate-400
                dark:hover:text-white
                dark:hover:bg-slate-800
                transition-colors
              "
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          {/* Mobile close */}
          {sidebarOpen && (
            <button
              type="button"
              onClick={onSidebarToggle}
              className="
                flex
                lg:hidden
                items-center
                justify-center
                w-9
                h-9
                rounded-xl
                text-gray-500
                hover:text-gray-900
                hover:bg-gray-100
                dark:text-slate-400
                dark:hover:text-white
                dark:hover:bg-slate-800
                transition-colors
              "
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <div className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    handleNavigation(item.id);

                    if (
                      typeof window !== 'undefined' &&
                      window.innerWidth < 1024
                    ) {
                      onSidebarToggle?.();
                    }
                  }}
                  className={`
                    group
                    w-full
                    flex
                    items-center
                    ${
                      sidebarOpen
                        ? 'gap-3 px-3'
                        : 'justify-center px-2'
                    }
                    py-3
                    rounded-xl
                    text-sm
                    font-medium
                    transition-all
                    duration-200
                    ${
                      isActive
                        ? `
                          bg-sky-50
                          text-sky-600
                          dark:bg-sky-500/10
                          dark:text-sky-400
                        `
                        : `
                          text-gray-600
                          hover:bg-gray-100
                          hover:text-gray-900
                          dark:text-slate-400
                          dark:hover:bg-slate-800
                          dark:hover:text-white
                        `
                    }
                  `}
                  title={!sidebarOpen ? item.label : undefined}
                >
                  <Icon
                    className={`
                      w-5
                      h-5
                      flex-shrink-0
                      ${
                        isActive
                          ? 'text-sky-500 dark:text-sky-400'
                          : ''
                      }
                    `}
                  />

                  {sidebarOpen && (
                    <span className="flex-1 text-left">
                      {item.label}
                    </span>
                  )}

                  {/* Notification badge */}
                  {item.id === 'notifications' &&
                    unreadCount > 0 && (
                      <span
                        className={`
                          flex
                          items-center
                          justify-center
                          min-w-5
                          h-5
                          px-1.5
                          rounded-full
                          bg-red-500
                          text-white
                          text-[10px]
                          font-bold
                          ${
                            sidebarOpen
                              ? ''
                              : 'absolute ml-7 -mt-5'
                          }
                        `}
                      >
                        {unreadCount > 99
                          ? '99+'
                          : unreadCount}
                      </span>
                    )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* User Profile / Sign Out */}
        <div className="p-3">
          {sidebarOpen ? (
            <div className="relative group">
              {/* Profile / Email */}
              <button
                type="button"
                className="
                  w-full
                  flex
                  items-center
                  gap-3
                  px-2
                  py-2
                  rounded-xl
                  hover:bg-gray-100
                  dark:hover:bg-slate-800
                  transition-colors
                  text-left
                "
              >
                <div
                  className="
                    w-9
                    h-9
                    rounded-full
                    bg-sky-100
                    dark:bg-sky-500/10
                    flex
                    items-center
                    justify-center
                    flex-shrink-0
                  "
                >
                  <span
                    className="
                      text-sm
                      font-semibold
                      text-sky-600
                      dark:text-sky-400
                    "
                  >
                    {profile?.full_name
                      ?.charAt(0)
                      ?.toUpperCase() || 'U'}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className="
                      text-sm
                      font-medium
                      text-gray-900
                      dark:text-white
                      truncate
                    "
                  >
                    {profile?.full_name || 'User'}
                  </p>

                  <p
                    className="
                      text-xs
                      text-gray-500
                      dark:text-slate-500
                      truncate
                    "
                  >
                    {profile?.email || ''}
                  </p>
                </div>
              </button>

              {/* Sign Out */}
              <button
                type="button"
                onClick={handleSignOut}
                className="
                  w-full
                  flex
                  items-center
                  gap-3
                  px-3
                  py-3
                  mt-1
                  rounded-xl
                  text-sm
                  font-medium
                  text-red-500
                  hover:bg-red-50
                  dark:text-red-400
                  dark:hover:bg-red-500/10
                  transition-colors
                "
              >
                <LogOut className="w-5 h-5 flex-shrink-0" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="relative group">
              <button
                type="button"
                className="
                  w-full
                  flex
                  items-center
                  justify-center
                  p-3
                  rounded-xl
                  hover:bg-gray-100
                  dark:hover:bg-slate-800
                  transition-colors
                "
                title={profile?.email || 'Profile'}
              >
                <div
                  className="
                    w-9
                    h-9
                    rounded-full
                    bg-sky-100
                    dark:bg-sky-500/10
                    flex
                    items-center
                    justify-center
                  "
                >
                  <span
                    className="
                      text-sm
                      font-semibold
                      text-sky-600
                      dark:text-sky-400
                    "
                  >
                    {profile?.full_name
                      ?.charAt(0)
                      ?.toUpperCase() || 'U'}
                  </span>
                </div>
              </button>

              {/* Sign Out */}
              <button
                type="button"
                onClick={handleSignOut}
                className="
                  absolute
                  left-full
                  bottom-0
                  ml-2
                  hidden
                  group-hover:flex
                  items-center
                  gap-2
                  px-4
                  py-2.5
                  rounded-xl
                  bg-white
                  dark:bg-slate-900
                  border
                  border-gray-200
                  dark:border-slate-700
                  shadow-lg
                  text-sm
                  font-medium
                  text-red-500
                  dark:text-red-400
                  whitespace-nowrap
                  z-50
                "
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}