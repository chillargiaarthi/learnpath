import { useEffect, useState } from 'react';
import { UserCheck, UserX, Clock, Link2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ConnectionRequest } from '../../lib/types';

export default function ConnectionRequests() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<ConnectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  async function load() {
    if (!profile) return;
    const { data } = await supabase
      .from('connection_requests')
      .select('*, guide:profiles!connection_requests_guide_id_fkey(*)')
      .eq('student_id', profile.id)
      .order('created_at', { ascending: false });
    setRequests(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [profile]);

  async function respond(req: ConnectionRequest, status: 'accepted' | 'rejected') {
    setProcessing(req.id);
    await supabase.from('connection_requests').update({ status }).eq('id', req.id);
    await supabase.from('notifications').insert({
      user_id: req.guide_id,
      title: status === 'accepted' ? 'Connection Accepted' : 'Connection Rejected',
      message: status === 'accepted'
        ? `${profile!.full_name} accepted your connection request.`
        : `${profile!.full_name} declined your connection request.`,
      type: 'general',
    });
    setProcessing(null);
    load();
  }

  const pending = requests.filter(r => r.status === 'pending');
  const others = requests.filter(r => r.status !== 'pending');

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="w-full p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Connections</h1>
        <p className="text-gray-500 dark:text-slate-400 text-sm mt-0.5">
          {pending.length > 0 ? `${pending.length} pending request${pending.length > 1 ? 's' : ''}` : 'Manage your guide connections'}
        </p>
      </div>

      {requests.length === 0 ? (
        <div className="card p-12 text-center">
          <Link2 className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-900 dark:text-white font-medium mb-1">No connection requests</p>
          <p className="text-gray-500 dark:text-slate-400 text-sm">When a guide sends you a connection request, it will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-3">Pending Requests</h2>
              <div className="space-y-3">
                {pending.map(req => {
                  const guide = req.guide as any;
                  return (
                    <div key={req.id} className="card border border-amber-200 dark:border-amber-500/20 p-5">
                      <div className="flex items-start gap-4">
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-sky-400 to-emerald-400 flex items-center justify-center text-white font-bold flex-shrink-0">
                          {guide?.full_name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-white">{guide?.full_name}</p>
                          <p className="text-sm text-gray-500 dark:text-slate-400">{guide?.role_title || 'Guide'}</p>
                          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{guide?.email}</p>
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Requested {new Date(req.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button onClick={() => respond(req, 'rejected')} disabled={processing === req.id}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 text-sm font-medium border border-red-200 dark:border-red-500/20 transition-colors disabled:opacity-50">
                            <UserX className="w-4 h-4" /> Decline
                          </button>
                          <button onClick={() => respond(req, 'accepted')} disabled={processing === req.id}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium transition-colors disabled:opacity-50">
                            <UserCheck className="w-4 h-4" /> Accept
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {others.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-3">Guide Requests</h2>
              <div className="space-y-3">
                {others.map(req => {
                  const guide = req.guide as any;
                  const isAccepted = req.status === 'accepted';
                  return (
                    <div key={req.id} className={`card border p-4 ${isAccepted ? 'border-emerald-200 dark:border-emerald-500/20' : 'border-gray-200 dark:border-slate-700/50 opacity-70'}`}>
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-emerald-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {guide?.full_name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 dark:text-white">{guide?.full_name}</p>
                          <p className="text-xs text-gray-400 dark:text-slate-500">{guide?.role_title || 'Guide'} · {guide?.email}</p>
                        </div>
                        <span className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border ${isAccepted ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' : 'bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700'}`}>
                          {isAccepted ? <><CheckCircle2 className="w-3 h-3" /> Connected</> : <><UserX className="w-3 h-3" /> Declined</>}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
