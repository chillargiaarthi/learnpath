import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Upload,
  Link as LinkIcon,
  Calendar,
  AlertCircle,
  Send,
  FileText,
  Image as ImageIcon,
  File,
  X,
  Loader2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type SubmissionType =
  | 'none'
  | 'pdf'
  | 'image'
  | 'document'
  | 'link';

type MainFilter =
  | 'all'
  | 'pending'
  | 'completed'
  | 'overdue';

type PriorityFilter =
  | 'all'
  | 'high'
  | 'medium'
  | 'low';

interface Task {
  id: string;
  title: string;
  description?: string | null;
  deadline: string;
  start_at?: string | null;
  priority?: 'low' | 'medium' | 'high' | null;
  status?:
    | 'pending'
    | 'completed'
    | 'overdue'
    | 'extended'
    | null;
  is_published?: boolean;
  student_id?: string;
  submission_type?: SubmissionType | null;
}

interface Submission {
  id: string;
  task_id: string;
  student_id: string;
  submission_type: SubmissionType;
  file_url?: string | null;
  file_name?: string | null;
  submission_url?: string | null;
  submitted_at?: string | null;
}

interface StudentTasksProps {
  onNavigate?: (page: string) => void;
}

/* =========================================================
   HELPERS
========================================================= */

const formatDateTime = (
  value?: string | null
) => {
  if (!value) return 'Not set';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Not set';
  }

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatCountdown = (
  deadline: string,
  now: Date
) => {
  const end = new Date(deadline).getTime();
  const current = now.getTime();

  const difference = end - current;

  if (difference <= 0) {
    return 'Deadline completed';
  }

  const totalMinutes = Math.floor(
    difference / 60000
  );

  const days = Math.floor(
    totalMinutes / 1440
  );

  const hours = Math.floor(
    (totalMinutes % 1440) / 60
  );

  const minutes = totalMinutes % 60;

  const parts: string[] = [];

  if (days > 0) {
    parts.push(
      `${days} ${days === 1 ? 'day' : 'days'}`
    );
  }

  if (hours > 0) {
    parts.push(
      `${hours} ${
        hours === 1 ? 'hour' : 'hours'
      }`
    );
  }

  if (minutes > 0) {
    parts.push(
      `${minutes} ${
        minutes === 1 ? 'minute' : 'minutes'
      }`
    );
  }

  if (parts.length === 0) {
    return 'Less than 1 minute left';
  }

  return `${parts.join(', ')} left`;
};

const priorityClasses = (
  priority?: string | null
) => {
  switch (priority) {
    case 'high':
      return 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400';

    case 'medium':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400';

    case 'low':
      return 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400';

    default:
      return 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300';
  }
};

const submissionLabel = (
  type?: SubmissionType | null
) => {
  switch (type) {
    case 'pdf':
      return 'PDF Upload';

    case 'image':
      return 'Image Upload';

    case 'document':
      return 'Document Upload';

    case 'link':
      return 'URL Submission';

    default:
      return 'No Submission Required';
  }
};

/* =========================================================
   SUBMISSION BOX
========================================================= */

function SubmissionBox({
  task,
  submission,
  studentId,
  onSubmitted,
}: {
  task: Task;
  submission?: Submission;
  studentId: string;
  onSubmitted: (
    submission: Submission
  ) => void;
}) {
  const submissionType =
    task.submission_type || 'none';

  const [file, setFile] =
    useState<File | null>(null);

  const [url, setUrl] = useState(
    submission?.submission_url || ''
  );

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  if (submissionType === 'none') {
    return null;
  }

  const submitUrl = async () => {
    if (!url.trim()) {
      setError('Please enter a URL.');
      return;
    }

    setError('');

    try {
      setLoading(true);

      const { data, error } =
        await supabase
          .from('task_submissions')
          .upsert(
            {
              task_id: task.id,
              student_id: studentId,
              submission_type: 'link',
              submission_url: url.trim(),
              file_url: null,
              file_name: null,
              submitted_at:
                new Date().toISOString(),
            },
            {
              onConflict:
                'task_id,student_id',
            }
          )
          .select()
          .single();

      if (error) throw error;

      onSubmitted(data as Submission);
    } catch (err: any) {
      setError(
        err?.message ||
          'Unable to submit URL.'
      );
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async () => {
    if (!file) {
      setError('Please select a file.');
      return;
    }

    setError('');

    const extension =
      file.name
        .split('.')
        .pop()
        ?.toLowerCase() || '';

    let allowed: string[] = [];

    if (submissionType === 'pdf') {
      allowed = ['pdf'];
    }

    if (submissionType === 'image') {
      allowed = [
        'jpg',
        'jpeg',
        'png',
        'gif',
        'webp',
      ];
    }

    if (submissionType === 'document') {
      allowed = [
        'pdf',
        'doc',
        'docx',
        'txt',
        'ppt',
        'pptx',
        'xls',
        'xlsx',
      ];
    }

    if (!allowed.includes(extension)) {
      setError(
        `Invalid file type. Allowed: ${allowed.join(
          ', '
        )}`
      );
      return;
    }

    try {
      setLoading(true);

      const path =
        `${studentId}/${task.id}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } =
        await supabase.storage
          .from('task-submissions')
          .upload(path, file, {
            upsert: true,
          });

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage
        .from('task-submissions')
        .getPublicUrl(path);

      const { data, error } =
        await supabase
          .from('task_submissions')
          .upsert(
            {
              task_id: task.id,
              student_id: studentId,
              submission_type:
                submissionType,
              file_url: publicUrl,
              file_name: file.name,
              submission_url: null,
              submitted_at:
                new Date().toISOString(),
            },
            {
              onConflict:
                'task_id,student_id',
            }
          )
          .select()
          .single();

      if (error) throw error;

      setFile(null);

      onSubmitted(data as Submission);
    } catch (err: any) {
      setError(
        err?.message ||
          'Unable to upload submission.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 p-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h4 className="text-xs font-semibold text-gray-900 dark:text-white">
            Submission
          </h4>

          <p className="text-[10px] text-gray-500 dark:text-slate-400">
            {submissionLabel(
              submissionType
            )}
          </p>
        </div>

        {submission && (
          <span className="flex items-center gap-1 text-[11px] font-medium text-green-600 dark:text-green-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Submitted
          </span>
        )}
      </div>

      {submissionType === 'link' ? (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <LinkIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />

            <input
              type="url"
              value={url}
              onChange={(e) =>
                setUrl(e.target.value)
              }
              placeholder="https://example.com"
              className="w-full pl-8 pr-3 py-2 rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <button
            onClick={submitUrl}
            disabled={loading}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-md bg-sky-600 text-white text-xs font-medium hover:bg-sky-700 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}

            {submission
              ? 'Update'
              : 'Submit'}
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <label className="flex-1 flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 dark:border-slate-600 rounded-md cursor-pointer hover:border-sky-500">
            {submissionType ===
            'image' ? (
              <ImageIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
            ) : submissionType ===
              'pdf' ? (
              <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
            ) : (
              <File className="w-4 h-4 text-gray-400 flex-shrink-0" />
            )}

            <span className="text-xs text-gray-600 dark:text-slate-300 truncate">
              {file
                ? file.name
                : 'Choose a file'}
            </span>

            <input
              type="file"
              className="hidden"
              accept={
                submissionType ===
                'pdf'
                  ? '.pdf'
                  : submissionType ===
                    'image'
                  ? 'image/*'
                  : '.pdf,.doc,.docx,.txt,.ppt,.pptx,.xls,.xlsx'
              }
              onChange={(e) => {
                setFile(
                  e.target.files?.[0] ||
                    null
                );
                setError('');
              }}
            />
          </label>

          <button
            onClick={uploadFile}
            disabled={
              loading || !file
            }
            className="inline-flex items-center gap-1 px-3 py-2 rounded-md bg-sky-600 text-white text-xs font-medium hover:bg-sky-700 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}

            {submission
              ? 'Replace'
              : 'Upload'}
          </button>
        </div>
      )}

      {error && (
        <div className="mt-2 flex items-start gap-1.5 text-[11px] text-red-600 dark:text-red-400">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   COMPACT TASK CARD
========================================================= */

function TaskCard({
  task,
  submission,
  profileId,
  now,
  onComplete,
  onSubmission,
  onExtensionRequest,
}: {
  task: Task;
  submission?: Submission;
  profileId: string;
  now: Date;
  onComplete: (
    task: Task
  ) => void;
  onSubmission: (
    submission: Submission
  ) => void;
  onExtensionRequest: (
    task: Task
  ) => void;
}) {
  const deadlinePassed =
    new Date(task.deadline).getTime() <=
    now.getTime();

  const countdown =
    formatCountdown(
      task.deadline,
      now
    );

  const submissionType =
    task.submission_type ||
    'none';

  const canComplete =
    !deadlinePassed &&
    (submissionType ===
      'none' ||
      !!submission);

  return (
    <div className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
      <div className="px-4 py-3">
        {/* HEADER */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {task.status ===
            'completed' ? (
              <CheckCircle2 className="w-4.5 h-4.5 text-green-500 flex-shrink-0" />
            ) : (
              <div className="w-4.5 h-4.5 rounded-full border-2 border-sky-500 flex-shrink-0" />
            )}

            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {task.title}
              </h3>

              {task.description && (
                <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate">
                  {task.description}
                </p>
              )}
            </div>
          </div>

          <span
            className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${priorityClasses(
              task.priority
            )}`}
          >
            {task.priority ||
              'Medium'}
          </span>
        </div>

        {/* DATE / TIME ROW */}
        <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-center">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">
              Start
            </p>

            <div className="flex items-center gap-1 text-xs text-gray-700 dark:text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />

              <span>
                {formatDateTime(
                  task.start_at
                )}
              </span>
            </div>
          </div>

          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">
              End / Deadline
            </p>

            <div className="flex items-center gap-1 text-xs text-gray-700 dark:text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />

              <span>
                {formatDateTime(
                  task.deadline
                )}
              </span>
            </div>
          </div>

          <div className="sm:text-right">
            <span
              className={`text-xs font-semibold ${
                deadlinePassed
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-sky-600 dark:text-sky-400'
              }`}
            >
              {countdown}
            </span>
          </div>
        </div>

        {/* SUBMISSION */}
        <SubmissionBox
          task={task}
          submission={submission}
          studentId={profileId}
          onSubmitted={
            onSubmission
          }
        />

        {/* ACTIONS */}
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {task.status !==
            'completed' && (
            <button
              onClick={() =>
                onComplete(task)
              }
              disabled={
                !canComplete
              }
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-green-600 text-white text-[11px] font-medium hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Mark Complete
            </button>
          )}

          {task.status !==
            'completed' && (
            <button
              onClick={() =>
                onExtensionRequest(
                  task
                )
              }
              disabled={
                deadlinePassed
              }
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-orange-300 dark:border-orange-500/40 text-orange-600 dark:text-orange-400 text-[11px] font-medium hover:bg-orange-50 dark:hover:bg-orange-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Clock className="w-3.5 h-3.5" />
              Request Extension
            </button>
          )}

          {task.status ===
            'completed' && (
            <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 text-[11px] font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Task Completed
            </div>
          )}
        </div>

        {/* REQUIRED SUBMISSION MESSAGE */}
        {submissionType !==
          'none' &&
          !submission &&
          !deadlinePassed &&
          task.status !==
            'completed' && (
            <div className="mt-2 flex items-start gap-1.5 text-[10px] text-orange-600 dark:text-orange-400">
              <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />

              <span>
                A{' '}
                {submissionLabel(
                  submissionType
                ).toLowerCase()}{' '}
                is required before completing this task.
              </span>
            </div>
          )}
      </div>
    </div>
  );
}

/* =========================================================
   MAIN PAGE
========================================================= */

export default function StudentTasks({
  onNavigate,
}: StudentTasksProps) {
  const { profile } =
    useAuth();

  const [tasks, setTasks] =
    useState<Task[]>([]);

  const [submissions, setSubmissions] =
    useState<Submission[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [now, setNow] =
    useState(new Date());

  const [mainFilter, setMainFilter] =
    useState<MainFilter>('all');

  const [priorityFilter, setPriorityFilter] =
    useState<PriorityFilter>('all');

  const [extensionTask, setExtensionTask] =
  useState<Task | null>(null);

const [extensionReason, setExtensionReason] =
  useState('');

const [extensionLoading, setExtensionLoading] =
  useState(false);

const [requestedDeadline, setRequestedDeadline] =
  useState('');

const [requestedHour, setRequestedHour] =
  useState('12');

const [requestedMinute, setRequestedMinute] =
  useState('00');

const [requestedPeriod, setRequestedPeriod] =
  useState('AM');

const extensionDraftKey =
  profile?.id
    ? `learnpath_extension_draft_${profile.id}`
    : null;

  /* =======================================================
     LIVE TIME
  ======================================================= */

  useEffect(() => {
    const timer =
      window.setInterval(() => {
        setNow(new Date());
      }, 1000);

    return () =>
      window.clearInterval(timer);
  }, []);

  /* =======================================================
   RESTORE EXTENSION DRAFT
======================================================= */

useEffect(() => {
  if (!extensionDraftKey) return;

  try {
    const savedDraft =
      sessionStorage.getItem(
        extensionDraftKey
      );

    if (!savedDraft) return;

    const draft = JSON.parse(
      savedDraft
    );

    if (draft.task) {
      setExtensionTask(
        draft.task
      );
    }

    setExtensionReason(
      draft.reason || ''
    );

    setRequestedDeadline(
      draft.deadline || ''
    );

    setRequestedHour(
      draft.hour || '12'
    );

    setRequestedMinute(
      draft.minute || '00'
    );

    setRequestedPeriod(
      draft.period || 'AM'
    );
  } catch (error) {
    console.error(
      'Unable to restore extension draft:',
      error
    );
  }
}, [extensionDraftKey]);
/* =======================================================
   SAVE EXTENSION DRAFT
======================================================= */

useEffect(() => {
  if (!extensionDraftKey) return;

  /*
   * Do not create a draft when the extension
   * form has never been opened.
   */
  if (!extensionTask) return;

  const draft = {
    task: extensionTask,
    reason: extensionReason,
    deadline: requestedDeadline,
    hour: requestedHour,
    minute: requestedMinute,
    period: requestedPeriod,
  };

  try {
    sessionStorage.setItem(
      extensionDraftKey,
      JSON.stringify(draft)
    );
  } catch (error) {
    console.error(
      'Unable to save extension draft:',
      error
    );
  }
}, [
  extensionDraftKey,
  extensionTask,
  extensionReason,
  requestedDeadline,
  requestedHour,
  requestedMinute,
  requestedPeriod,
]);

  /* =======================================================
     LOAD TASKS
  ======================================================= */

  const loadTasks = async () => {
    if (!profile?.id) return;

    try {
      setLoading(true);

      const currentTime =
        new Date().toISOString();

      const {
        data: taskData,
        error: taskError,
      } = await supabase
        .from('tasks')
        .select('*')
        .eq(
          'student_id',
          profile.id
        )
        .eq(
          'is_published',
          true
        )
        .or(
          `start_at.is.null,start_at.lte.${currentTime}`
        )
        .order(
          'deadline',
          {
            ascending: true,
          }
        );

      if (taskError) {
        throw taskError;
      }

      const loadedTasks =
        (taskData ||
          []) as Task[];

      setTasks(
        loadedTasks
      );

      const taskIds =
        loadedTasks.map(
          (task) => task.id
        );

      if (taskIds.length > 0) {
        const {
          data: submissionData,
          error: submissionError,
        } = await supabase
          .from(
            'task_submissions'
          )
          .select('*')
          .in(
            'task_id',
            taskIds
          )
          .eq(
            'student_id',
            profile.id
          );

        if (
          submissionError
        ) {
          console.error(
            'Unable to load submissions:',
            submissionError
          );
        } else {
          setSubmissions(
            (submissionData ||
              []) as Submission[]
          );
        }
      } else {
        setSubmissions([]);
      }
    } catch (error) {
      console.error(
        'Error loading tasks:',
        error
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();

    const refresh =
      window.setInterval(
        () => {
          loadTasks();
        },
        30000
      );

    return () =>
      window.clearInterval(
        refresh
      );
  }, [profile?.id]);

  /* =======================================================
     FILTERS
  ======================================================= */

  const visibleTasks =
    useMemo(() => {
      const current =
        now.getTime();

      return tasks.filter(
        (task) => {
          const deadlinePassed =
            new Date(
              task.deadline
            ).getTime() <=
            current;

          /* MAIN FILTER */

          if (
            mainFilter ===
            'completed'
          ) {
            if (
              task.status !==
              'completed'
            ) {
              return false;
            }
          }

          if (
            mainFilter ===
            'pending'
          ) {
            if (
              task.status ===
                'completed' ||
              deadlinePassed
            ) {
              return false;
            }
          }

          if (
            mainFilter ===
            'overdue'
          ) {
            if (
              task.status ===
                'completed' ||
              !deadlinePassed
            ) {
              return false;
            }
          }

          /* PRIORITY FILTER */

          if (
            priorityFilter !==
            'all'
          ) {
            if (
              task.priority !==
              priorityFilter
            ) {
              return false;
            }
          }

          return true;
        }
      );
    }, [
      tasks,
      mainFilter,
      priorityFilter,
      now,
    ]);

  /* =======================================================
     SUBMISSION
  ======================================================= */

  const getSubmission = (
    taskId: string
  ) => {
    return submissions.find(
      (submission) =>
        submission.task_id ===
        taskId
    );
  };

  const handleSubmission = (
    submission: Submission
  ) => {
    setSubmissions(
      (previous) => {
        const index =
          previous.findIndex(
            (item) =>
              item.task_id ===
              submission.task_id
          );

        if (index === -1) {
          return [
            ...previous,
            submission,
          ];
        }

        const updated = [
          ...previous,
        ];

        updated[index] =
          submission;

        return updated;
      }
    );
  };

  /* =======================================================
     COMPLETE TASK
  ======================================================= */

  const markComplete = async (
    task: Task
  ) => {
    if (!profile?.id) return;

    const deadlinePassed =
      new Date(
        task.deadline
      ).getTime() <=
      now.getTime();

    if (deadlinePassed) {
      alert(
        'The submission deadline has passed.'
      );
      return;
    }

    const submissionType =
      task.submission_type ||
      'none';

    const submission =
      getSubmission(
        task.id
      );

    if (
      submissionType !==
        'none' &&
      !submission
    ) {
      alert(
        'Please submit the required work before marking this task complete.'
      );
      return;
    }

    try {
      const { error } =
        await supabase
          .from('tasks')
          .update({
            status:
              'completed',
          })
          .eq(
            'id',
            task.id
          )
          .eq(
            'student_id',
            profile.id
          );

      if (error) {
        throw error;
      }

      setTasks(
        (previous) =>
          previous.map(
            (item) =>
              item.id ===
              task.id
                ? {
                    ...item,
                    status:
                      'completed',
                  }
                : item
          )
      );
    } catch (error: any) {
      console.error(
        error
      );

      alert(
        error?.message ||
          'Unable to mark the task as completed.'
      );
    }
  };

  /* =======================================================
     EXTENSION REQUEST
  ======================================================= */

  const submitExtensionRequest = async () => {
  if (!profile?.id || !extensionTask) {
    return;
  }

  if (!extensionReason.trim()) {
    alert(
      'Please enter a reason for the extension request.'
    );
    return;
  }

  if (!requestedDeadline) {
    alert(
      'Please select your requested deadline.'
    );
    return;
  }

  if (
    !requestedHour ||
    !requestedMinute ||
    !requestedPeriod
  ) {
    alert(
      'Please select the requested time.'
    );
    return;
  }

  /*
   * Convert selected 12-hour time to 24-hour time.
   */
  let hour24 =
    parseInt(requestedHour, 10);

  if (requestedPeriod === 'AM') {
    if (hour24 === 12) {
      hour24 = 0;
    }
  } else {
    if (hour24 !== 12) {
      hour24 += 12;
    }
  }

  /*
   * Create the requested deadline using
   * the selected date and time.
   *
   * This uses the user's local browser time.
   */
  const requestedDate = new Date(
    `${requestedDeadline}T${String(
      hour24
    ).padStart(2, '0')}:${requestedMinute}:00`
  );

  if (
    Number.isNaN(
      requestedDate.getTime()
    )
  ) {
    alert(
      'Please select a valid deadline and time.'
    );
    return;
  }

  /*
   * Current task deadline.
   */
  const currentDeadline =
    new Date(
      extensionTask.deadline
    );

  if (
    Number.isNaN(
      currentDeadline.getTime()
    )
  ) {
    alert(
      'The current task deadline is invalid.'
    );
    return;
  }

  /*
   * Requested deadline must be strictly
   * later than the current task deadline.
   */
  if (
    requestedDate.getTime() <=
    currentDeadline.getTime()
  ) {
    alert(
      'The requested deadline must be later than the current deadline.'
    );
    return;
  }

  try {
    setExtensionLoading(true);

    const {
      error,
    } = await supabase
      .from('extension_requests')
      .insert({
        task_id:
          extensionTask.id,
        student_id:
          profile.id,
        reason:
          extensionReason.trim(),
        requested_deadline:
          requestedDate.toISOString(),
        status:
          'pending',
      });

    if (error) {
      throw error;
    }

    alert(
      'Extension request submitted.'
    );
if (extensionDraftKey) {
  sessionStorage.removeItem(
    extensionDraftKey
  );
}
    /*
     * Close and reset the form.
     */
    setExtensionTask(null);
    setExtensionReason('');
    setRequestedDeadline('');
    setRequestedHour('12');
    setRequestedMinute('00');
    setRequestedPeriod('AM');

    await loadTasks();
  } catch (error: any) {
    console.error(
      'Extension request error:',
      error
    );

    alert(
      error?.message ||
        'Unable to submit extension request.'
    );
  } finally {
    setExtensionLoading(false);
  }
};
          
       
  

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="w-full min-h-[300px] flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading tasks...
        </div>
      </div>
    );
  }

  /* =======================================================
     PAGE
  ======================================================= */

  return (
    <div className="w-full px-4 sm:px-5 lg:px-6 py-4">
      {/* HEADER */}
      <div className="w-full mb-4">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Tasks
            </h1>

            <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
              View and complete your assigned tasks.
            </p>
          </div>

          {/* MAIN FILTERS */}
          <div className="flex flex-wrap gap-1.5">
            {[
              {
                value:
                  'all' as MainFilter,
                label: 'All',
              },
              {
                value:
                  'pending' as MainFilter,
                label: 'Pending',
              },
              {
                value:
                  'completed' as MainFilter,
                label: 'Completed',
              },
              {
                value:
                  'overdue' as MainFilter,
                label: 'Overdue',
              },
            ].map(
              (item) => (
                <button
                  key={
                    item.value
                  }
                  onClick={() =>
                    setMainFilter(
                      item.value
                    )
                  }
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    mainFilter ===
                    item.value
                      ? 'bg-sky-600 text-white'
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {item.label}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* PRIORITY FILTERS */}
      <div className="w-full mb-4 flex items-center gap-1.5">
        <span className="text-xs font-medium text-gray-500 dark:text-slate-400 mr-1">
          Priority:
        </span>

        {[
          {
            value:
              'all' as PriorityFilter,
            label: 'All',
          },
          {
            value:
              'high' as PriorityFilter,
            label: 'High',
          },
          {
            value:
              'medium' as PriorityFilter,
            label: 'Medium',
          },
          {
            value:
              'low' as PriorityFilter,
            label: 'Low',
          },
        ].map(
          (item) => (
            <button
              key={
                item.value
              }
              onClick={() =>
                setPriorityFilter(
                  item.value
                )
              }
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                priorityFilter ===
                item.value
                  ? 'border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400'
                  : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'
              }`}
            >
              {item.label}
            </button>
          )
        )}
      </div>

      {/* TASKS */}
      {visibleTasks.length ===
      0 ? (
        <div className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center">
          <CheckCircle2 className="w-8 h-8 mx-auto text-gray-300 dark:text-slate-600" />

          <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
            No tasks found
          </h3>

          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            No tasks match the selected filters.
          </p>
        </div>
      ) : (
        <div className="w-full space-y-2">
          {visibleTasks.map(
            (task) => (
              <TaskCard
                key={task.id}
                task={task}
                submission={getSubmission(
                  task.id
                )}
                profileId={
                  profile!.id
                }
                now={now}
                onComplete={
                  markComplete
                }
                onSubmission={
                  handleSubmission
                }
                
onExtensionRequest={(selectedTask) => {
  setExtensionTask(selectedTask);

  /*
   * Only initialize empty values when
   * there is no saved draft for this task.
   */
  const savedDraft =
    extensionDraftKey
      ? sessionStorage.getItem(
          extensionDraftKey
        )
      : null;

  if (savedDraft) {
    try {
      const draft =
        JSON.parse(savedDraft);

      if (
        draft.task?.id ===
        selectedTask.id
      ) {
        setExtensionReason(
          draft.reason || ''
        );

        setRequestedDeadline(
          draft.deadline || ''
        );

        setRequestedHour(
          draft.hour || '12'
        );

        setRequestedMinute(
          draft.minute || '00'
        );

        setRequestedPeriod(
          draft.period || 'AM'
        );

        return;
      }
    } catch {
      // Ignore invalid draft
    }
  }

  setExtensionReason('');
  setRequestedDeadline('');
  setRequestedHour('12');
  setRequestedMinute('00');
  setRequestedPeriod('AM');
}}
              />
            )
          )}
        </div>
      )}

      {/* EXTENSION MODAL */}
      {extensionTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white dark:bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  Request Extension
                </h2>

                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  {
                    extensionTask.title
                  }
                </p>
              </div>

              <button
                
onClick={() => {
  setExtensionTask(null);
  setExtensionReason('');
  setRequestedDeadline('');
  setRequestedHour('12');
  setRequestedMinute('00');
  setRequestedPeriod('AM');
}}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4">
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                Reason
              </label>

              <textarea
                value={
                  extensionReason
                }
                onChange={(e) =>
                  setExtensionReason(
                    e.target.value
                  )
                }
                rows={4}
                placeholder="Explain why you need additional time..."
                className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-gray-900 dark:text-white resize-none outline-none focus:ring-1 focus:ring-sky-500"
              />
              

<div className="mt-4">
  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
    Requested New Deadline
  </label>

  <input
    type="date"
    value={requestedDeadline}
    min={(() => {
      const deadline = new Date(extensionTask.deadline);
      const localDate = new Date(
        deadline.getTime() -
          deadline.getTimezoneOffset() * 60000
      );
      return localDate.toISOString().slice(0, 10);
    })()}
    onChange={(e) => setRequestedDeadline(e.target.value)}
    className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-sky-500"
  />

  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mt-3 mb-1.5">
    Requested Time
  </label>

  <div className="grid grid-cols-3 gap-2">
    <select
      value={requestedHour}
      onChange={(e) => setRequestedHour(e.target.value)}
      className="px-3 py-2 rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-gray-900 dark:text-white"
    >
      {Array.from({ length: 12 }, (_, i) => (
        <option key={i + 1} value={String(i + 1).padStart(2, '0')}>
          {i + 1}
        </option>
      ))}
    </select>

    <select
      value={requestedMinute}
      onChange={(e) => setRequestedMinute(e.target.value)}
      className="px-3 py-2 rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-gray-900 dark:text-white"
    >
      {Array.from({ length: 60 }, (_, i) => {
        const minute = String(i).padStart(2, '0');
        return <option key={minute} value={minute}>{minute}</option>;
      })}
    </select>

    <select
      value={requestedPeriod}
      onChange={(e) => setRequestedPeriod(e.target.value)}
      className="px-3 py-2 rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-gray-900 dark:text-white"
    >
      <option value="AM">AM</option>
      <option value="PM">PM</option>
    </select>
  </div>

  <p className="mt-1 text-[11px] text-gray-500 dark:text-slate-400">
    Choose a date and time later than the current task deadline.
  </p>
</div>

              <div className="flex justify-end gap-2 mt-3">
                <button
                  onClick={() => {
                    setExtensionTask(
                      null
                    );
                    setExtensionReason(
                      ''
                    );
                  }}
                  className="px-3 py-2 rounded-md border border-gray-300 dark:border-slate-600 text-xs text-gray-700 dark:text-slate-300 font-medium hover:bg-gray-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>

                <button
                  onClick={
                    submitExtensionRequest
                  }
                  disabled={
                    extensionLoading
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-sky-600 text-white text-xs font-medium hover:bg-sky-700 disabled:opacity-50"
                >
                  {extensionLoading && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}

                  Submit Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}