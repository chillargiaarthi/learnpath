import { useEffect, useState } from 'react';
import {
  Bell,
  CheckCheck,
  Trash2,
  Clock,
  CheckSquare,
  FlaskConical,
  Calendar,
  Link2,
  Info,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Notification, NotificationType } from '../../lib/types';

const typeConfig: Record<
  NotificationType,
  {
    icon: React.ElementType;
    color: string;
    bg: string;
  }
> = {
  task: {
    icon: CheckSquare,
    color: 'text-sky-500',
    bg: 'bg-sky-50 dark:bg-sky-500/10',
  },
  test: {
    icon: FlaskConical,
    color: 'text-purple-500',
    bg: 'bg-purple-50 dark:bg-purple-500/10',
  },
  extension: {
    icon: Calendar,
    color: 'text-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-500/10',
  },
  resource: {
    icon: Link2,
    color: 'text-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
  },
  general: {
    icon: Info,
    color: 'text-gray-400 dark:text-slate-400',
    bg: 'bg-gray-50 dark:bg-slate-700/50',
  },
};

interface NotificationsPanelProps {
  onUnreadChange?: (count: number) => void;
}

export default function NotificationsPanel({
  onUnreadChange,
}: NotificationsPanelProps) {
  const { profile } = useAuth();

  const [notifications, setNotifications] =
    useState<Notification[]>([]);

  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile!.id)
      .order('created_at', {
        ascending: false,
      });

    setNotifications(data || []);

    onUnreadChange?.(
      (data || []).filter(n => !n.is_read).length
    );

    setLoading(false);
  }

  useEffect(() => {
    if (profile) load();
  }, [profile]);

  async function markAllRead() {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', profile!.id)
      .eq('is_read', false);

    setNotifications(prev =>
      prev.map(n => ({
        ...n,
        is_read: true,
      }))
    );

    onUnreadChange?.(0);
  }

  async function markRead(id: string) {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    const updated = notifications.map(n =>
      n.id === id
        ? { ...n, is_read: true }
        : n
    );

    setNotifications(updated);

    onUnreadChange?.(
      updated.filter(n => !n.is_read).length
    );
  }

  async function del(id: string) {
    await supabase
      .from('notifications')
      .delete()
      .eq('id', id);

    const updated = notifications.filter(
      n => n.id !== id
    );

    setNotifications(updated);

    onUnreadChange?.(
      updated.filter(n => !n.is_read).length
    );
  }

  const unread = notifications.filter(
    n => !n.is_read
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full p-6 lg:p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Notifications
          </h1>

          <p className="text-gray-500 dark:text-slate-400 text-sm mt-0.5">
            {unread} unread
          </p>
        </div>

        {unread > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 rounded-xl transition-all"
          >
            <CheckCheck className="w-4 h-4" />
            Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="card p-12 text-center">
          <Bell className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />

          <p className="text-slate-900 dark:text-white font-medium">
            No notifications
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => {
            const cfg = typeConfig[n.type];
            const Icon = cfg.icon;

            return (
              <div
                key={n.id}
                onClick={() =>
                  !n.is_read && markRead(n.id)
                }
                className={`flex items-start gap-3 p-4 rounded-2xl border transition-all cursor-pointer group ${
                  n.is_read
                    ? 'bg-gray-50/50 dark:bg-slate-800/30 border-gray-100 dark:border-slate-700/30 opacity-70'
                    : 'card hover:shadow-sm'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0`}
                >
                  <Icon
                    className={`w-4 h-4 ${cfg.color}`}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium ${
                          n.is_read
                            ? 'text-gray-500 dark:text-slate-400'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {n.title}
                      </p>

                      <p className="text-gray-500 dark:text-slate-400 text-sm mt-0.5 break-words">
                        {n.message}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {!n.is_read && (
                        <div className="w-2 h-2 rounded-full bg-sky-500 flex-shrink-0" />
                      )}

                      <button
                        onClick={e => {
                          e.stopPropagation();
                          del(n.id);
                        }}
                        className="text-gray-400 dark:text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-gray-400 dark:text-slate-500 text-xs mt-1.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" />

                    {new Date(
                      n.created_at
                    ).toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}