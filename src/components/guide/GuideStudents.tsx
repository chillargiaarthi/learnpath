import { useEffect, useState } from 'react';
import {
  Users,
  Search,
  UserPlus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  BarChart2,
  Flame,
  ChevronDown,
  ChevronUp,
  Send,
  Loader2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Profile, Task, TestAttempt } from '../../lib/types';

interface StudentDetail {
  profile: Profile;
  tasks: Task[];
  attempts: TestAttempt[];
  streak: number;
  connectionStatus: 'none' | 'pending' | 'accepted';
}

export default function GuideStudents() {
  const { profile } = useAuth();

  const [allStudents, setAllStudents] = useState<StudentDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);

  async function load() {
    const [
      studentsRes,
      tasksRes,
      attemptsRes,
      streaksRes,
      connectionsRes,
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student'),

      supabase
        .from('tasks')
        .select('*')
        .eq('mentor_id', profile!.id),

      supabase
        .from('test_attempts')
        .select('*, test:tests(title)')
        .in('status', ['submitted', 'terminated']),

      supabase
        .from('study_streaks')
        .select('*'),

      supabase
        .from('connection_requests')
        .select('*')
        .eq('guide_id', profile!.id),
    ]);

    const connections = connectionsRes.data || [];

    setAllStudents(
      (studentsRes.data || []).map(p => ({
        profile: p,
        tasks: (tasksRes.data || []).filter(
          t => t.student_id === p.id
        ),
        attempts: (attemptsRes.data || []).filter(
          a => a.student_id === p.id
        ),
        streak:
          (streaksRes.data || []).find(
            s => s.student_id === p.id
          )?.current_streak ?? 0,
        connectionStatus:
          connections.find(
            c => c.student_id === p.id
          )?.status ?? 'none',
      }))
    );

    setLoading(false);
  }

  useEffect(() => {
    if (profile) load();
  }, [profile]);

  async function sendRequest(studentId: string) {
    setSending(studentId);

    await supabase
      .from('connection_requests')
      .insert({
        guide_id: profile!.id,
        student_id: studentId,
        status: 'pending',
      });

    await supabase.from('notifications').insert({
      user_id: studentId,
      title: 'Connection Request',
      message: `${profile!.full_name} (${profile!.role_title || 'Guide'}) wants to connect with you.`,
      type: 'general',
    });

    setSending(null);

    load();
  }

  const filtered = allStudents.filter(
    s =>
      !search ||
      s.profile.full_name
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      s.profile.email
        .toLowerCase()
        .includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Connections
        </h1>

        <p className="text-gray-500 dark:text-slate-400 mt-0.5 text-sm">
          Connect to Students ·{' '}
          {
            allStudents.filter(
              s => s.connectionStatus === 'accepted'
            ).length
          }{' '}
          connected · {allStudents.length} total
        </p>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-400" />

        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search students..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700/50 text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Users className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />

          <p className="text-slate-900 dark:text-white font-medium mb-1">
            {search
              ? 'No students found'
              : 'No students yet'}
          </p>

          <p className="text-gray-500 dark:text-slate-400 text-sm">
            Students will appear here once they register.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(
            ({
              profile: p,
              tasks,
              attempts,
              streak,
              connectionStatus,
            }) => {
              const completed = tasks.filter(
                t => t.status === 'completed'
              ).length;

              const pct = tasks.length
                ? Math.round(
                    (completed / tasks.length) * 100
                  )
                : 0;

              const scores = attempts
                .filter(
                  a =>
                    a.is_evaluated &&
                    a.max_score > 0
                )
                .map(
                  a =>
                    (a.total_score /
                      a.max_score) *
                    100
                );

              const avg = scores.length
                ? Math.round(
                    scores.reduce(
                      (s, v) => s + v,
                      0
                    ) / scores.length
                  )
                : null;

              const isOpen = expanded === p.id;

              return (
                <div
                  key={p.id}
                  className="card overflow-hidden"
                >
                  <div className="p-5 flex items-center justify-between gap-4">
                    <div
                      className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                      onClick={() =>
                        setExpanded(
                          isOpen ? null : p.id
                        )
                      }
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-emerald-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {p.full_name
                          .charAt(0)
                          .toUpperCase()}
                      </div>

                      <div className="min-w-0">
                        <p className="text-slate-900 dark:text-white font-semibold text-sm truncate">
                          {p.full_name}
                        </p>

                        <p className="text-gray-400 dark:text-slate-500 text-xs truncate">
                          {p.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="hidden sm:flex items-center gap-4 text-sm">
                        <div className="text-center">
                          <p
                            className={`font-bold text-sm ${
                              pct >= 70
                                ? 'text-emerald-500'
                                : pct >= 40
                                ? 'text-amber-500'
                                : 'text-red-500'
                            }`}
                          >
                            {pct}%
                          </p>

                          <p className="text-gray-400 dark:text-slate-500 text-xs">
                            Tasks
                          </p>
                        </div>

                        {avg !== null && (
                          <div className="text-center">
                            <p
                              className={`font-bold text-sm ${
                                avg >= 70
                                  ? 'text-emerald-500'
                                  : avg >= 40
                                  ? 'text-amber-500'
                                  : 'text-red-500'
                              }`}
                            >
                              {avg}%
                            </p>

                            <p className="text-gray-400 dark:text-slate-500 text-xs">
                              Avg
                            </p>
                          </div>
                        )}

                        <div className="text-center flex flex-col items-center">
                          <p className="font-bold text-sm text-orange-500 flex items-center gap-0.5">
                            <Flame className="w-3 h-3" />
                            {streak}
                          </p>

                          <p className="text-gray-400 dark:text-slate-500 text-xs">
                            Streak
                          </p>
                        </div>
                      </div>

                      {connectionStatus === 'accepted' ? (
                        <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-3 py-1.5 rounded-xl font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Connected
                        </span>
                      ) : connectionStatus ===
                        'pending' ? (
                        <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-3 py-1.5 rounded-xl font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          Pending
                        </span>
                      ) : (
                        <button
                          onClick={() =>
                            sendRequest(p.id)
                          }
                          disabled={
                            sending === p.id
                          }
                          className="flex items-center gap-1.5 text-xs text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/20 px-3 py-1.5 rounded-xl font-medium hover:bg-sky-100 dark:hover:bg-sky-500/20 transition-colors disabled:opacity-50"
                        >
                          {sending === p.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <UserPlus className="w-3.5 h-3.5" />
                          )}

                          {sending === p.id
                            ? 'Sending...'
                            : 'Connect'}
                        </button>
                      )}

                      <button
                        onClick={() =>
                          setExpanded(
                            isOpen ? null : p.id
                          )
                        }
                        className="text-gray-400 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      >
                        
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t border-gray-100 dark:border-slate-700/50 p-5 space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          {
                            label: 'Completed',
                            value: completed,
                            icon: CheckCircle2,
                            color: 'text-emerald-500',
                            bg: 'bg-emerald-50 dark:bg-emerald-500/10',
                          },
                          {
                            label: 'Pending',
                            value: tasks.filter(
                              t =>
                                t.status ===
                                'pending'
                            ).length,
                            icon: Clock,
                            color: 'text-amber-500',
                            bg: 'bg-amber-50 dark:bg-amber-500/10',
                          },
                          {
                            label: 'Overdue',
                            value: tasks.filter(
                              t =>
                                t.status ===
                                'overdue'
                            ).length,
                            icon: AlertTriangle,
                            color: 'text-red-500',
                            bg: 'bg-red-50 dark:bg-red-500/10',
                          },
                          {
                            label: 'Tests',
                            value: attempts.length,
                            icon: BarChart2,
                            color: 'text-sky-500',
                            bg: 'bg-sky-50 dark:bg-sky-500/10',
                          },
                        ].map(
                          ({
                            label,
                            value,
                            icon: Icon,
                            color,
                            bg,
                          }) => (
                            <div
                              key={label}
                              className={`${bg} rounded-xl p-3 text-center`}
                            >
                              <Icon
                                className={`w-4 h-4 mx-auto mb-1 ${color}`}
                              />

                              <p className="text-slate-900 dark:text-white font-bold">
                                {value}
                              </p>

                              <p className="text-gray-400 dark:text-slate-500 text-xs">
                                {label}
                              </p>
                            </div>
                          )
                        )}
                      </div>

                      {tasks.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-400 dark:text-slate-400 mb-2 font-medium">
                            Recent Tasks
                          </p>

                          <div className="space-y-2">
                            {tasks
                              .slice(0, 5)
                              .map(t => (
                                <div
                                  key={t.id}
                                  className="flex items-center justify-between text-sm"
                                >
                                  <span
                                    className={`text-slate-700 dark:text-slate-300 truncate max-w-xs ${
                                      t.status ===
                                      'completed'
                                        ? 'line-through text-gray-400 dark:text-slate-500'
                                        : ''
                                    }`}
                                  >
                                    {t.title}
                                  </span>

                                  <span
                                    className={`text-xs px-2 py-0.5 rounded-lg capitalize ml-2 flex-shrink-0 ${
                                      t.status ===
                                      'completed'
                                        ? 'bg-emerald-500/10 text-emerald-500'
                                        : t.status ===
                                          'overdue'
                                        ? 'bg-red-500/10 text-red-500'
                                        : 'bg-amber-500/10 text-amber-500'
                                    }`}
                                  >
                                    {t.status}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            }
          )}
        </div>
      )}
    </div>
  );
}