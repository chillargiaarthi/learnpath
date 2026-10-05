import {
  useEffect,
  useState,
  createContext,
  useContext,
  ReactNode,
} from 'react';

import { AuthProvider, useAuth } from './contexts/AuthContext';

import AuthPage from './components/auth/AuthPage';
import ResetPasswordPage from './components/auth/ResetPasswordPage';

import Sidebar, { Page } from './components/layout/Sidebar';

import StudentDashboard from './components/student/StudentDashboard';
import StudentTasks from './components/student/StudentTasks';
import StudentResources from './components/student/StudentResources';
import StudentTests from './components/student/StudentTests';
import ConnectionRequests from './components/student/ConnectionRequests';

import GuideDashboard from './components/guide/GuideDashboard';
import GuideStudents from './components/guide/GuideStudents';
import GuideTaskManager from './components/guide/GuideTaskManager';
import GuideResourceManager from './components/guide/GuideResourceManager';
import GuideTestCreator from './components/guide/GuideTestCreator';
import GuideTestReview from './components/guide/GuideTestReview';
import GuideTestRetake from './components/guide/GuideTestRetake';
import GuideExtensionRequests from './components/guide/GuideExtensionRequests';

import NotificationsPanel from './components/shared/NotificationsPanel';
import SettingsPage from './components/settings/SettingsPage';

import { supabase } from './lib/supabase';

/* =========================================================
   THEME
========================================================= */

type Theme = 'light' | 'dark' | 'reading';

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  setTheme: () => {},
});

function ThemeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (
      (localStorage.getItem('sb-theme') as Theme) ||
      'dark'
    );
  });

  useEffect(() => {
    const root = document.documentElement;

    root.classList.remove(
      'dark',
      'reading'
    );

    if (theme === 'dark') {
      root.classList.add('dark');
    }

    if (theme === 'reading') {
      root.classList.add('reading');
    }
  }, [theme]);

  function setTheme(t: Theme) {
    localStorage.setItem('sb-theme', t);
    setThemeState(t);
  }

  return (
    <ThemeContext.Provider
      value={{ theme, setTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

type GuidePage =
  | 'dashboard'
  | 'students'
  | 'tasks'
  | 'resources'
  | 'tests'
  | 'connections'
  | 'test-retakes'
  | 'test-review'
  | 'extensions'
  | 'notifications'
  | 'settings';

/* =========================================================
   TEST TABS
========================================================= */

function GuideTestTabBar({
  page,
  setPage,
}: {
  page: GuidePage;
  setPage: (p: GuidePage) => void;
}) {
  const tabs = [
    {
      page: 'tests' as GuidePage,
      label: 'Create Tests',
    },
    {
      page: 'test-retakes' as GuidePage,
      label: 'Retake Requests',
    },
    {
      page: 'test-review' as GuidePage,
      label: 'Review Submissions',
    },
  ];

  return (
    <div className="w-full mb-6">
      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-slate-800">
        {tabs.map(tab => {
          const active =
            page === tab.page;

          return (
            <button
              key={tab.page}
              type="button"
              onClick={() =>
                setPage(tab.page)
              }
              className={`
                px-4 py-2.5 text-sm font-medium
                border-b-2 transition-colors
                ${
                  active
                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                }
              `}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* =========================================================
   APP INNER
========================================================= */

function AppInner() {
  const {
    profile,
    loading,
  } = useAuth();

  const [page, setPage] =
    useState<Page>('dashboard');

  const [sidebarOpen, setSidebarOpen] =
    useState(true);

  const [unreadCount, setUnreadCount] =
    useState(0);

  /*
   * null = All Students
   * profile id = selected individual student
   */
  const [
    selectedStudentId,
    setSelectedStudentId,
  ] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;

    supabase
      .from('notifications')
      .select('id', {
        count: 'exact',
      })
      .eq('user_id', profile.id)
      .eq('is_read', false)
      .then(({ count }) => {
        setUnreadCount(count ?? 0);
      });

    const channel = supabase
      .channel(`notif-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          setUnreadCount(
            count => count + 1
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />

          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            Loading LearnPath...
          </p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return <AuthPage />;
  }

  const isGuide =
    profile.role !== 'student';

  function handleNavigate(
    newPage: Page
  ) {
    setPage(newPage);
  }

  function handleSidebarToggle() {
    setSidebarOpen(
      previous => !previous
    );
  }

  /*
   * This is now used by GuideDashboard's dropdown.
   */
  function handleStudentSelect(
    studentId: string | null
  ) {
    setSelectedStudentId(studentId);
    setPage('dashboard');
  }

  function renderContent() {
    if (!isGuide) {
      switch (page) {
        case 'dashboard':
          return <StudentDashboard />;

        case 'tasks':
          return <StudentTasks />;

        case 'resources':
          return <StudentResources />;

        case 'tests':
          return <StudentTests />;

        case 'connections':
          return <ConnectionRequests />;

        case 'notifications':
          return (
            <NotificationsPanel
              onUnreadChange={
                setUnreadCount
              }
            />
          );

        case 'settings':
          return <SettingsPage />;

        default:
          return <StudentDashboard />;
      }
    }

    const guidePage =
      page as GuidePage;

    switch (guidePage) {
      case 'dashboard':
        return (
          <GuideDashboard
            selectedStudentId={
              selectedStudentId
            }
            onStudentSelect={
              handleStudentSelect
            }
          />
        );

      /*
       * Guide sidebar "Connections"
       * opens the existing GuideStudents
       * connection management page.
       */
      case 'connections':
        return <GuideStudents />;

      case 'students':
        return <GuideStudents />;

      case 'tasks':
        return (
          <GuideTaskManager
            selectedStudentId={
              selectedStudentId
            }
          />
        );

      case 'resources':
        return (
          <GuideResourceManager />
        );

      case 'tests':
        return (
          <div className="w-full min-h-screen">
            <GuideTestTabBar
              page={guidePage}
              setPage={
                setPage as (
                  p: GuidePage
                ) => void
              }
            />

            <GuideTestCreator />
          </div>
        );

      case 'test-retakes':
        return (
          <div className="w-full min-h-screen">
            <GuideTestTabBar
              page={guidePage}
              setPage={
                setPage as (
                  p: GuidePage
                ) => void
              }
            />

            <GuideTestRetake />
          </div>
        );

      case 'test-review':
        return (
          <div className="w-full min-h-screen">
            <GuideTestTabBar
              page={guidePage}
              setPage={
                setPage as (
                  p: GuidePage
                ) => void
              }
            />

            <GuideTestReview
              selectedStudentId={
                selectedStudentId
              }
            />
          </div>
        );

      case 'extensions':
        return (
          <GuideExtensionRequests
            selectedStudentId={
              selectedStudentId
            }
          />
        );

      case 'notifications':
        return (
          <NotificationsPanel
            onUnreadChange={
              setUnreadCount
            }
          />
        );

      case 'settings':
        return <SettingsPage />;

      default:
        return (
          <GuideDashboard
            selectedStudentId={
              selectedStudentId
            }
            onStudentSelect={
              handleStudentSelect
            }
          />
        );
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <Sidebar
        currentPage={page}
        onNavigate={handleNavigate}
        unreadCount={unreadCount}
        sidebarOpen={sidebarOpen}
        onSidebarToggle={
          handleSidebarToggle
        }
      />

      <main
        className={`
          min-h-screen
          min-w-0
          overflow-y-auto
          overflow-x-hidden
          transition-[margin-left]
          duration-300
          ease-in-out
          ${
            sidebarOpen
              ? 'ml-64'
              : 'ml-20'
          }
        `}
      >
        {renderContent()}
      </main>
    </div>
  );
}

/* =========================================================
   ROOT APP
========================================================= */

export default function App() {
  if (
    window.location.pathname ===
    '/reset-password'
  ) {
    return <ResetPasswordPage />;
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </ThemeProvider>
  );
}