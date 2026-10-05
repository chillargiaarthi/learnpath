import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, AlertTriangle, Flame, Star, BarChart2, Target, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Task, TestAttempt, StudyStreak } from '../../lib/types';

interface Stats {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  completionPct: number;
  avgScore: number;
  totalTests: number;
  streak: StudyStreak | null;
  recentAttempts: TestAttempt[];
  upcomingTasks: Task[];
}

function ProgressRing({ pct, size = 88 }: { pct: number; size?: number }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
  cx={size / 2}
  cy={size / 2}
  r={r}
  fill="none"
  stroke="currentColor"
  strokeWidth={8}
  className="student-progress-track"
/>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#3b82f6" strokeWidth={8}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" className="transition-all duration-700" />
    </svg>
  );
}

export default function StudentDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    async function load() {
      const [tasksRes, attemptsRes, streakRes] = await Promise.all([
        supabase.from('tasks').select('*, task_completions(*)').eq('student_id', profile!.id),
        supabase.from('test_attempts').select('*, test:tests(title)').eq('student_id', profile!.id).order('started_at', { ascending: false }).limit(5),
        supabase.from('study_streaks').select('*').eq('student_id', profile!.id).maybeSingle(),
      ]);
      const tasks: Task[] = tasksRes.data || [];
      const completed = tasks.filter(t => t.status === 'completed').length;
      const attempts: TestAttempt[] = attemptsRes.data || [];
      const scores = attempts.filter(a => a.is_evaluated && a.max_score > 0).map(a => (a.total_score / a.max_score) * 100);
      const now = new Date();
      const upcoming = tasks.filter(t => t.status === 'pending' && new Date(t.deadline) > now)
        .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()).slice(0, 4);
      setStats({
        totalTasks: tasks.length,
        completedTasks: completed,
        pendingTasks: tasks.filter(t => t.status === 'pending').length,
        overdueTasks: tasks.filter(t => t.status === 'overdue').length,
        completionPct: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
        avgScore: scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0,
        totalTests: attempts.length,
        streak: streakRes.data,
        recentAttempts: attempts,
        upcomingTasks: upcoming,
      });
      setLoading(false);
    }
    load();
  }, [profile]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  const s = stats!;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  return (
    <div className="student-dashboard p-6 lg:p-8 ">
      <div className="mb-8">
        <h1 className="text-2xl font-bold student-heading">Good {greeting}, {profile?.full_name.split(' ')[0]}!</h1>
        <p className="text-slate-400 mt-1">Here's your learning progress at a glance.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Tasks Completed', value: `${s.completedTasks}/${s.totalTasks}`, sub: `${s.completionPct}% rate`, icon: CheckCircle2, color: 'bg-emerald-500/10 text-emerald-400' },
          { label: 'Pending Tasks', value: s.pendingTasks, sub: 'to complete', icon: Clock, color: 'bg-amber-500/10 text-amber-400' },
          { label: 'Overdue', value: s.overdueTasks, sub: 'need attention', icon: AlertTriangle, color: 'bg-red-500/10 text-red-400' },
          { label: 'Avg. Test Score', value: s.totalTests ? `${s.avgScore}%` : 'N/A', sub: `${s.totalTests} tests`, icon: Star, color: 'bg-blue-500/10 text-blue-400' },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="student-surface border rounded-2xl p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} mb-3`}><Icon className="w-5 h-5" /></div>
            <p className="text-2xl font-bold student-heading">{value}</p>
            <p className="student-muted text-sm mt-0.5">{label}</p>
            <p className="student-subtle text-xs mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="student-surface border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="student-heading font-semibold">Overall Progress</h3>
            <Target className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-center gap-5">
            <div className="relative flex-shrink-0">
              <ProgressRing pct={s.completionPct} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="student-heading font-bold text-lg">{s.completionPct}%</span>
              </div>
            </div>
            <div className="space-y-2.5">
              {[
                { label: 'Completed', value: s.completedTasks, color: 'bg-emerald-400' },
                { label: 'Pending', value: s.pendingTasks, color: 'bg-amber-400' },
                { label: 'Overdue', value: s.overdueTasks, color: 'bg-red-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center gap-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${color}`} />
                  <span className="student-muted">{label}</span>
                  <span className="student-heading font-medium ml-auto">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="student-surface border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="student-heading font-semibold">Study Streak</h3>
            <Flame className="w-4 h-4 text-orange-400" />
          </div>
          <div className="text-center py-2">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Flame className="w-8 h-8 text-orange-400" />
              <span className="student-heading text-5xl font-bold">
  {s.streak?.current_streak ?? 0}
</span>
            </div>
            <p className="student-muted text-sm">day{(s.streak?.current_streak ?? 0) !== 1 ? 's' : ''} in a row</p>
            <div className="flex justify-between mt-4 text-sm">
              <div className="text-center">
                <p className="student-heading font-semibold">
  {s.streak?.longest_streak ?? 0}
</p>
                <p className="student-subtle text-xs">Best streak</p>
              </div>
              <div className="w-px student-progress-track h-8" />
              <div className="text-center">
                <p className="student-heading font-semibold">
  {s.streak?.total_days_active ?? 0}
</p>
                <p className="student-subtle text-xs">Total active days</p>
              </div>
            </div>
          </div>
        </div>

        
      </div>

      
    </div>
  );
}
