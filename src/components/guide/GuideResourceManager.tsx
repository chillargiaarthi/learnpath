import { useEffect, useRef, useState } from 'react';
import {
  Plus,
  Trash2,
  X,
  Loader2,
  Search,
  ExternalLink,
  FileText,
  Image,
  FileCode,
  Link2,
  Youtube,
} from 'lucide-react';

import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Resource, ResourceType, Profile } from '../../lib/types';

const typeConfig: Record<
  ResourceType,
  { icon: React.ElementType; label: string; color: string }
> = {
  pdf: { icon: FileText, label: 'PDF', color: 'text-red-500' },
  image: { icon: Image, label: 'Image', color: 'text-emerald-500' },
  document: { icon: FileCode, label: 'Document', color: 'text-sky-500' },
  link: { icon: Link2, label: 'Website', color: 'text-amber-500' },
  youtube: { icon: Youtube, label: 'YouTube', color: 'text-rose-500' },
};

/* =========================================================
   DRAFT STORAGE HELPERS
   Swap sessionStorage -> localStorage everywhere below if you
   want the draft to survive closing the browser tab/restarts.
========================================================= */

type Draft = {
  title: string;
  description: string;
  type: ResourceType;
  url: string;
  assignToAll: boolean;
  selectedStudentIds: string[];
};

const MODAL_OPEN_KEY = 'guide-resource-modal-open';

function draftKey(profileId?: string) {
  return `guide-resource-draft:${profileId ?? 'anon'}`;
}

function readDraft(profileId?: string): Partial<Draft> {
  try {
    const raw = sessionStorage.getItem(draftKey(profileId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeDraft(profileId: string | undefined, draft: Draft) {
  try {
    sessionStorage.setItem(draftKey(profileId), JSON.stringify(draft));
  } catch {
    /* ignore storage errors */
  }
}

function clearDraft(profileId?: string) {
  try {
    sessionStorage.removeItem(draftKey(profileId));
  } catch {
    /* ignore */
  }
}

/* =========================================================
   ADD RESOURCE MODAL
========================================================= */

function AddResourceModal({
  onClose,
  onAdded,
  connectedStudents,
}: {
  onClose: () => void;
  onAdded: () => void;
  connectedStudents: Profile[];
}) {
  const { profile } = useAuth();
  const profileId = profile?.id;

  // Restore saved draft (read once on mount)
  const initialDraft = useRef<Partial<Draft>>(readDraft(profileId)).current;

  const [title, setTitle] = useState(initialDraft.title ?? '');
  const [description, setDescription] = useState(initialDraft.description ?? '');
  const [type, setType] = useState<ResourceType>(initialDraft.type ?? 'link');
  const [url, setUrl] = useState(initialDraft.url ?? '');
  const [file, setFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [assignToAll, setAssignToAll] = useState(
    initialDraft.assignToAll ?? true
  );
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(
    initialDraft.selectedStudentIds ?? []
  );

  /* =======================================================
     AUTO-SAVE DRAFT
  ======================================================= */

  useEffect(() => {
    writeDraft(profileId, {
      title,
      description,
      type,
      url,
      assignToAll,
      selectedStudentIds,
    });
  }, [profileId, title, description, type, url, assignToAll, selectedStudentIds]);

  /* =======================================================
     DISCARD (explicitly deletes the draft, then closes)
     The X button does NOT use this; it only closes.
  ======================================================= */

  function handleDiscard() {
    clearDraft(profileId);
    onClose();
  }

  /* =======================================================
     TYPE CHANGE
  ======================================================= */

  function handleTypeChange(newType: ResourceType) {
    setType(newType);
    setUrl('');
    setFile(null);
    setError('');
  }

  /* =======================================================
     ACCEPTED FILE TYPES
  ======================================================= */

  function getAcceptedFiles() {
    switch (type) {
      case 'pdf':
        return '.pdf';
      case 'image':
        return 'image/*';
      case 'document':
        return '.doc,.docx,.txt,.rtf';
      default:
        return undefined;
    }
  }

  /* =======================================================
     FILE VALIDATION
  ======================================================= */

  function validateFile(selectedFile: File) {
    const maxSize = 10 * 1024 * 1024;

    if (selectedFile.size > maxSize) {
      return 'File size must be 10 MB or less.';
    }

    if (type === 'pdf' && selectedFile.type !== 'application/pdf') {
      return 'Please select a PDF file.';
    }

    if (type === 'image' && !selectedFile.type.startsWith('image/')) {
      return 'Please select an image file.';
    }

    if (type === 'document') {
      const allowedTypes = [
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'application/rtf',
      ];

      if (!allowedTypes.includes(selectedFile.type)) {
        return 'Please select a supported document file.';
      }
    }

    return '';
  }

  /* =======================================================
     FILE CHANGE
  ======================================================= */

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] || null;

    setError('');

    if (!selectedFile) {
      setFile(null);
      return;
    }

    const validationError = validateFile(selectedFile);

    if (validationError) {
      setFile(null);
      event.target.value = '';
      setError(validationError);
      return;
    }

    setFile(selectedFile);
  }

  /* =======================================================
     STUDENT SELECTION
  ======================================================= */

  function toggleStudent(studentId: string) {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  }

  /* =======================================================
     SUBMIT
  ======================================================= */

  async function submit() {
    setError('');

    if (!profile) {
      setError('Guide profile not found.');
      return;
    }

    if (!title.trim()) {
      setError('Title is required.');
      return;
    }

    const isFileType =
      type === 'pdf' || type === 'image' || type === 'document';

    if (isFileType && !file) {
      setError('Please select a file to upload.');
      return;
    }

    if (!isFileType && !url.trim()) {
      setError('URL is required.');
      return;
    }

    if (!assignToAll && selectedStudentIds.length === 0) {
      setError('Please select at least one student.');
      return;
    }

    setLoading(true);

    try {
      let resourceUrl = url.trim();

      /* UPLOAD FILE */

      if (isFileType && file) {
        const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `${profile.id}/${Date.now()}-${safeFileName}`;

        const { error: uploadError } = await supabase.storage
          .from('resources')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type,
          });

        if (uploadError) {
          throw new Error(`File upload failed: ${uploadError.message}`);
        }

        const { data: publicUrlData } = supabase.storage
          .from('resources')
          .getPublicUrl(filePath);

        resourceUrl = publicUrlData.publicUrl;
      }

      /* SAVE RESOURCE */

      const { data: resource, error: insertError } = await supabase
        .from('resources')
        .insert({
          mentor_id: profile.id,
          title: title.trim(),
          description: description.trim() || null,
          type,
          url: resourceUrl,
          tags: [],
          is_assigned_to_all: assignToAll,
        })
        .select('id')
        .single();

      if (insertError || !resource) {
        throw new Error(insertError?.message || 'Failed to create resource.');
      }

      /* ASSIGN TO SELECTED STUDENTS */

      if (!assignToAll) {
        const assignments = selectedStudentIds.map((studentId) => ({
          resource_id: resource.id,
          student_id: studentId,
        }));

        const { error: assignmentError } = await supabase
          .from('resource_assignments')
          .insert(assignments);

        if (assignmentError) {
          await supabase.from('resources').delete().eq('id', resource.id);

          throw new Error(
            `Failed to assign resource: ${assignmentError.message}`
          );
        }
      }

      // Success: draft no longer needed
      clearDraft(profileId);

      onAdded();
      onClose();
    } catch (err) {
      console.error('Resource creation error:', err);

      setError(err instanceof Error ? err.message : 'Failed to add resource.');
    } finally {
      setLoading(false);
    }
  }

  const isFileType =
    type === 'pdf' || type === 'image' || type === 'document';

  /* =======================================================
     MODAL UI
  ======================================================= */

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* HEADER */}

        <div className="flex items-center justify-between mb-5">
          <h3 className="text-slate-900 dark:text-white font-semibold">
            Add Resource
          </h3>

          {/* X only closes: the draft is kept */}
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* RESOURCE TYPE */}

          <div>
            <label className="label">Resource Type</label>

            <div className="grid grid-cols-5 gap-2 mt-1.5">
              {(
                Object.entries(typeConfig) as [
                  ResourceType,
                  (typeof typeConfig)[ResourceType]
                ][]
              ).map(([t, cfg]) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTypeChange(t)}
                  className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-xs transition-all ${
                    type === t
                      ? 'border-sky-500 bg-sky-500/10'
                      : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
                  }`}
                >
                  <cfg.icon className={`w-4 h-4 ${cfg.color}`} />

                  <span
                    className={
                      type === t
                        ? 'text-sky-500'
                        : 'text-gray-500 dark:text-slate-400'
                    }
                  >
                    {cfg.label.split(' ')[0]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* TITLE */}

          <div>
            <label className="label">Title *</label>

            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Resource title..."
              className="input"
            />
          </div>

          {/* FILE OR URL */}

          {isFileType ? (
            <div>
              <label className="label">
                Upload{' '}
                {type === 'pdf'
                  ? 'PDF'
                  : type === 'image'
                  ? 'Image'
                  : 'Document'}{' '}
                *
              </label>

              <input
                type="file"
                accept={getAcceptedFiles()}
                onChange={handleFileChange}
                className="block w-full mt-1.5 text-sm text-gray-500 dark:text-slate-400
                  file:mr-4 file:py-2.5 file:px-4
                  file:rounded-xl file:border-0
                  file:bg-sky-500 file:text-white
                  file:font-medium
                  hover:file:bg-sky-400
                  cursor-pointer"
              />

              {file && (
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
                  Selected: {file.name}
                </p>
              )}

              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                Maximum file size: 10 MB
              </p>
            </div>
          ) : (
            <div>
              <label className="label">
                {type === 'youtube' ? 'YouTube URL *' : 'Website URL *'}
              </label>

              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={
                  type === 'youtube' ? 'https://youtube.com/...' : 'https://...'
                }
                className="input"
              />
            </div>
          )}

          {/* DESCRIPTION */}

          <div>
            <label className="label">Description</label>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional..."
              rows={3}
              className="input resize-none"
            />
          </div>

          {/* ASSIGN RESOURCE */}

          <div>
            <label className="label">Assign Resource To</label>

            <div className="space-y-2 mt-1.5">
              <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-slate-700 cursor-pointer hover:border-sky-400 transition-colors">
                <input
                  type="radio"
                  name="resource-assignment"
                  checked={assignToAll}
                  onChange={() => {
                    setAssignToAll(true);
                    setSelectedStudentIds([]);
                  }}
                  className="accent-sky-500"
                />

                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    All Students
                  </p>

                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Share this resource with all connected students
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-slate-700 cursor-pointer hover:border-sky-400 transition-colors">
                <input
                  type="radio"
                  name="resource-assignment"
                  checked={!assignToAll}
                  onChange={() => setAssignToAll(false)}
                  className="accent-sky-500"
                />

                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    Selected Students
                  </p>

                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Choose specific students
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* STUDENT SELECTION */}

          {!assignToAll && (
            <div className="border border-gray-200 dark:border-slate-700 rounded-xl p-3">
              <p className="text-sm font-medium text-slate-900 dark:text-white mb-2">
                Select Students
              </p>

              {connectedStudents.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  No connected students found.
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {connectedStudents.map((student) => (
                    <label
                      key={student.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.includes(student.id)}
                        onChange={() => toggleStudent(student.id)}
                        className="accent-sky-500"
                      />

                      <div>
                        <p className="text-sm text-slate-900 dark:text-white">
                          {student.full_name}
                        </p>

                        <p className="text-xs text-gray-500 dark:text-slate-400">
                          {student.email}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {selectedStudentIds.length > 0 && (
                <p className="text-xs text-sky-500 mt-2">
                  {selectedStudentIds.length} student
                  {selectedStudentIds.length !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>
          )}
        </div>

        {/* ERROR */}

        {error && <p className="text-red-500 text-sm mt-3">{error}</p>}

        {/* BUTTONS */}

        <div className="flex gap-3 mt-5">
          {/* Discard clears the saved draft */}
          <button
            onClick={handleDiscard}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm transition-colors"
          >
            Discard
          </button>

          <button
            onClick={submit}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}

            {loading ? 'Adding...' : 'Add Resource'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   MAIN RESOURCE MANAGER
========================================================= */

export default function GuideResourceManager() {
  const { profile } = useAuth();
  const profileId = profile?.id;

  const [resources, setResources] = useState<Resource[]>([]);
  const [connectedStudents, setConnectedStudents] = useState<Profile[]>([]);

  // Full-page spinner is ONLY for the very first load
  const [initialLoading, setInitialLoading] = useState(true);

  // Remember whether the modal was open
  const [showAdd, setShowAddState] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(MODAL_OPEN_KEY) === '1';
    } catch {
      return false;
    }
  });

  function setShowAdd(value: boolean) {
    setShowAddState(value);
    try {
      if (value) sessionStorage.setItem(MODAL_OPEN_KEY, '1');
      else sessionStorage.removeItem(MODAL_OPEN_KEY);
    } catch {
      /* ignore */
    }
  }

  const [search, setSearch] = useState('');

  /* =======================================================
     LOAD (background refreshes do NOT show the spinner)
  ======================================================= */

  async function load() {
    if (!profileId) return;

    const [resourcesRes, connectionsRes] = await Promise.all([
      supabase
        .from('resources')
        .select('*')
        .eq('mentor_id', profileId)
        .order('created_at', { ascending: false }),

      supabase
        .from('connection_requests')
        .select('*, student:profiles!connection_requests_student_id_fkey(*)')
        .eq('guide_id', profileId)
        .eq('status', 'accepted'),
    ]);

    setResources(resourcesRes.data || []);

    const students = (connectionsRes.data || [])
      .map((connection: any) => connection.student)
      .filter(Boolean);

    setConnectedStudents(students);

    setInitialLoading(false);
  }

  // Depend on the id (a primitive), not the whole profile object,
  // so token refreshes on tab focus don't retrigger loading.
  useEffect(() => {
    if (profileId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  /* =======================================================
     SEARCH
  ======================================================= */

  const filtered = resources.filter(
    (r) =>
      !search ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.description?.toLowerCase().includes(search.toLowerCase())
  );

  /* =======================================================
     INITIAL LOADING ONLY
  ======================================================= */

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  /* =======================================================
     MAIN UI
  ======================================================= */

  return (
    <div className="w-full p-6 lg:p-8">
      {/* HEADER */}

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Resource Manager
          </h1>

          <p className="text-gray-500 dark:text-slate-400 text-sm mt-0.5">
            {resources.length} resources
          </p>
        </div>

        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Resource
        </button>
      </div>

      {/* SEARCH */}

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-400" />

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700/50 text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
        />
      </div>

      {/* RESOURCE LIST */}

      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Search className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />

          <p className="text-slate-900 dark:text-white font-medium">
            {search ? 'No matches' : 'No resources yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const cfg = typeConfig[r.type];
            const Icon = cfg.icon;

            return (
              <div
                key={r.id}
                className="card p-4 flex items-start gap-4 hover:shadow-sm transition-all"
              >
                {/* RESOURCE ICON */}

                <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-slate-700/50 flex items-center justify-center flex-shrink-0">
                  <Icon className={`w-5 h-5 ${cfg.color}`} />
                </div>

                {/* RESOURCE DETAILS */}

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-slate-900 dark:text-white font-medium text-sm">
                        {r.title}
                      </h4>

                      <span className={`text-xs ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </div>

                    {/* ACTIONS */}

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 dark:text-slate-400 hover:text-sky-500 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>

                      <button
                        onClick={async () => {
                          await supabase
                            .from('resources')
                            .delete()
                            .eq('id', r.id);

                          setResources((prev) =>
                            prev.filter((x) => x.id !== r.id)
                          );
                        }}
                        className="text-gray-400 dark:text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {r.description && (
                    <p className="text-gray-500 dark:text-slate-400 text-xs mt-1">
                      {r.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ADD RESOURCE MODAL */}

      {showAdd && (
        <AddResourceModal
          onClose={() => setShowAdd(false)}
          onAdded={() => load()}
          connectedStudents={connectedStudents}
        />
      )}
    </div>
  );
}
