import { useEffect, useState } from 'react';
import { FileText, Image, FileCode, Link2, Youtube, Search, ExternalLink, Play } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Resource, ResourceType } from '../../lib/types';
import { useAuth } from '../../contexts/AuthContext';

const typeConfig: Record<ResourceType, { icon: React.ElementType; label: string; color: string; bg: string }> = {
  pdf: { icon: FileText, label: 'PDF', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-500/10' },
  image: { icon: Image, label: 'Image', color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
  document: { icon: FileCode, label: 'Document', color: 'text-sky-500', bg: 'bg-sky-50 dark:bg-sky-500/10' },
  link: { icon: Link2, label: 'Link', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10' },
  youtube: { icon: Youtube, label: 'YouTube', color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-500/10' },
};

function getYouTubeId(url: string) {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&\n?#]+)/);
  return m ? m[1] : null;
}

function ResourceCard({ resource }: { resource: Resource }) {
  const cfg = typeConfig[resource.type];
  const Icon = cfg.icon;
  const ytId = resource.type === 'youtube' ? getYouTubeId(resource.url) : null;

  return (
    <div className="card overflow-hidden hover:shadow-md transition-all group">
      {ytId && (
        <div className="aspect-video bg-gray-100 dark:bg-slate-900 relative overflow-hidden">
          <img src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`} alt={resource.title}
            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 bg-red-600/90 rounded-full flex items-center justify-center shadow-lg">
              <Play className="w-5 h-5 text-white ml-0.5" />
            </div>
          </div>
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-4 h-4 ${cfg.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-slate-900 dark:text-white font-medium text-sm leading-tight">{resource.title}</h4>
              <a href={resource.url} target="_blank" rel="noopener noreferrer"
                className="text-gray-400 dark:text-slate-400 hover:text-sky-500 transition-colors flex-shrink-0">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <span className={`inline-block text-xs px-2 py-0.5 rounded-md mt-1 ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
            {resource.description && <p className="text-gray-500 dark:text-slate-400 text-xs mt-2 line-clamp-2">{resource.description}</p>}
            {resource.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {resource.tags.map(tag => <span key={tag} className="text-xs bg-gray-100 dark:bg-slate-700/50 text-gray-500 dark:text-slate-400 px-2 py-0.5 rounded-md">{tag}</span>)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StudentResources() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ResourceType | 'all'>('all');

  const { profile } = useAuth();

useEffect(() => {
  async function loadResources() {
    if (!profile) return;

    setLoading(true);

    // Get resources assigned specifically to this student
    const { data: assignments, error: assignmentError } = await supabase
      .from('resource_assignments')
      .select('resource_id')
      .eq('student_id', profile.id);

    if (assignmentError) {
      console.error('Failed to load resource assignments:', assignmentError);
      setResources([]);
      setLoading(false);
      return;
    }

    const assignedResourceIds =
      (assignments || []).map(a => a.resource_id);

    // Get resources that are available to all students
    const { data: allResources, error: resourceError } = await supabase
      .from('resources')
      .select('*')
      .eq('is_assigned_to_all', true)
      .order('created_at', { ascending: false });

    if (resourceError) {
      console.error('Failed to load resources:', resourceError);
      setResources([]);
      setLoading(false);
      return;
    }

    // Get specifically assigned resources
    let assignedResources: Resource[] = [];

    if (assignedResourceIds.length > 0) {
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .in('id', assignedResourceIds)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load assigned resources:', error);
      } else {
        assignedResources = data || [];
      }
    }

    // Combine both lists without duplicates
    const combined = [
      ...(allResources || []),
      ...assignedResources,
    ];

    const uniqueResources = Array.from(
      new Map(combined.map(resource => [resource.id, resource])).values()
    );

    setResources(uniqueResources);
    setLoading(false);
  }

  loadResources();
}, [profile]);

  const filtered = resources.filter(r => {
    const matchType = typeFilter === 'all' || r.type === typeFilter;
    const q = search.toLowerCase();
    const matchSearch = !search || r.title.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q) || r.tags.some(t => t.toLowerCase().includes(q));
    return matchType && matchSearch;
  });

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="w-full p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Learning Resources</h1>
        <p className="text-gray-500 dark:text-slate-400 text-sm mt-0.5">{resources.length} resources available</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search resources..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700/50 text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', ...Object.keys(typeConfig)] as (ResourceType | 'all')[]).map(type => {
            const count = type === 'all' ? resources.length : resources.filter(r => r.type === type).length;
            const cfg = type !== 'all' ? typeConfig[type as ResourceType] : null;
            if (count === 0 && type !== 'all') return null;
            return (
              <button key={type} onClick={() => setTypeFilter(type as ResourceType | 'all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 capitalize transition-all ${typeFilter === type ? 'bg-sky-500 text-white' : 'bg-white dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700/50 text-gray-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
                {cfg && <cfg.icon className="w-3 h-3" />}
                {type} ({count})
              </button>
            );
          })}
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Search className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-900 dark:text-white font-medium">No resources found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(r => <ResourceCard key={r.id} resource={r} />)}
        </div>
      )}
    </div>
  );
}
