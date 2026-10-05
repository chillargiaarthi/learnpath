import { useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  X,
  Loader2,
  Edit3,
  Eye,
  EyeOff,
  Users,
  Calendar,
  Clock,
  FileText,
  Link as LinkIcon,
} from 'lucide-react';

import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Task, Profile } from '../../lib/types';
import GuideExtensionRequests from "./GuideExtensionRequests";

type Priority = 'low' | 'medium' | 'high';

type SubmissionType =
  | 'none'
  | 'pdf'
  | 'image'
  | 'document'
  | 'link';

type Period = 'AM' | 'PM';

type PublishFilter = 'all' | 'published' | 'draft';

type TaskTab = 'create' | 'extensions';

interface DateTimeParts {
  date: string;
  hour: number;
  minute: number;
  period: Period;
}



/* =========================================================
   HELPERS
========================================================= */

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function getDateString(date: Date) {
  return `${date.getFullYear()}-${pad2(
    date.getMonth() + 1
  )}-${pad2(date.getDate())}`;
}

function get12HourParts(date: Date): DateTimeParts {
  let hour = date.getHours();

  const period: Period = hour >= 12 ? 'PM' : 'AM';

  hour = hour % 12;

  if (hour === 0) {
    hour = 12;
  }

  return {
    date: getDateString(date),
    hour,
    minute: date.getMinutes(),
    period,
  };
}

function getDefaultSchedule() {
  const now = new Date();

  now.setSeconds(0, 0);

  const remainder = now.getMinutes() % 5;

  if (remainder !== 0) {
    now.setMinutes(now.getMinutes() + (5 - remainder));
  }

  const start = new Date(now);

  const end = new Date(start);
  end.setHours(end.getHours() + 1);

  return {
    start: get12HourParts(start),
    end: get12HourParts(end),
  };
}

function getPartsFromISO(
  iso: string | null | undefined,
  fallback: DateTimeParts
): DateTimeParts {
  if (!iso) {
    return fallback;
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return get12HourParts(date);
}

function buildLocalISO(
  date: string,
  hour: number,
  minute: number,
  period: Period
) {
  if (!date) {
    return null;
  }

  const [year, month, day] = date.split('-').map(Number);

  let hour24 = hour % 12;

  if (period === 'PM') {
    hour24 += 12;
  }

  const localDate = new Date(
    year,
    month - 1,
    day,
    hour24,
    minute,
    0,
    0
  );

  if (Number.isNaN(localDate.getTime())) {
    return null;
  }

  return localDate.toISOString();
}

function formatDateTime(
  iso: string | null | undefined
) {
  if (!iso) {
    return 'Not set';
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return 'Not set';
  }

  return date.toLocaleString([], {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCountdown(milliseconds: number) {
  if (milliseconds <= 0) {
    return '';
  }

  const totalMinutes = Math.max(
    1,
    Math.floor(milliseconds / 60000)
  );

  const days = Math.floor(totalMinutes / 1440);

  const hours = Math.floor(
    (totalMinutes % 1440) / 60
  );

  const minutes = totalMinutes % 60;

  const parts: string[] = [];

  if (days > 0) {
    parts.push(
      `${days} day${days !== 1 ? 's' : ''}`
    );
  }

  if (hours > 0) {
    parts.push(
      `${hours} hour${hours !== 1 ? 's' : ''}`
    );
  }

  if (minutes > 0 || parts.length === 0) {
    parts.push(
      `${minutes} minute${
        minutes !== 1 ? 's' : ''
      }`
    );
  }

  return parts.join(', ');
}

/* =========================================================
   DATE TIME SELECTOR
========================================================= */

function DateTimeSelector({
  label,
  date,
  setDate,
  hour,
  setHour,
  minute,
  setMinute,
  period,
  setPeriod,
}: {
  label: string;
  date: string;
  setDate: (value: string) => void;
  hour: number;
  setHour: (value: number) => void;
  minute: number;
  setMinute: (value: number) => void;
  period: Period;
  setPeriod: (value: Period) => void;
}) {
  return (
    <div className="flex-1 min-w-0">
      <label className="label">
        {label} Date *
      </label>

      <div className="relative mt-1.5">
        <Calendar
          className="absolute left-3 top-1/2 -translate-y-1/2 text-sky-500 pointer-events-none"
          size={17}
        />

        <input
          type="date"
          value={date}
          onChange={(e) =>
            setDate(e.target.value)
          }
          className="input pl-10 w-full dark:[color-scheme:dark]"
        />
      </div>

      <div className="grid grid-cols-3 gap-2 mt-2">
        <select
          value={hour}
          onChange={(e) =>
            setHour(Number(e.target.value))
          }
          className="input"
          aria-label={`${label} hour`}
        >
          {Array.from(
            { length: 12 },
            (_, index) => index + 1
          ).map((value) => (
            <option
              key={value}
              value={value}
            >
              {pad2(value)}
            </option>
          ))}
        </select>

        <select
          value={minute}
          onChange={(e) =>
            setMinute(Number(e.target.value))
          }
          className="input"
          aria-label={`${label} minute`}
        >
          {Array.from(
            { length: 60 },
            (_, index) => index
          ).map((value) => (
            <option
              key={value}
              value={value}
            >
              {pad2(value)}
            </option>
          ))}
        </select>

        <select
          value={period}
          onChange={(e) =>
            setPeriod(
              e.target.value as Period
            )
          }
          className="input"
          aria-label={`${label} AM or PM`}
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
}

/* =========================================================
   TASK EDITOR
========================================================= */

function CreateTaskModal({
  task,
  connectedStudents,
  onClose,
  onSaved,
}: {
  task?: Task;
  connectedStudents: Profile[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { profile } = useAuth();
  type TaskDraft = {
  title: string;
  description: string;
  priority: Priority;

  startDate: string;
  startHour: number;
  startMinute: number;
  startPeriod: Period;

  endDate: string;
  endHour: number;
  endMinute: number;
  endPeriod: Period;

  submissionType: SubmissionType;
  selectedStudents: string[];
};
const taskDraftKey = profile
  ? `learnpath_guide_task_draft_${profile.id}`
  : null;

  const defaults = getDefaultSchedule();
  function getSavedDraft(): TaskDraft | null {
  if (!taskDraftKey || task) {
    return null;
  }

  try {
    const saved = localStorage.getItem(taskDraftKey);

    if (!saved) {
      return null;
    }

    return JSON.parse(saved) as TaskDraft;
  } catch {
    return null;
  }
}

const savedDraft = getSavedDraft();

  const existingStart = getPartsFromISO(
    (task as any)?.start_at,
    defaults.start
  );

  const existingEnd = getPartsFromISO(
    (task as any)?.deadline,
    defaults.end
  );

  const [title, setTitle] =
  useState(
    task?.title ||
      savedDraft?.title ||
      ''
  );

  const [description, setDescription] =
  useState(
    task
      ? (task as any)?.description || ''
      : savedDraft?.description || ''
  );

  const [priority, setPriority] =
  useState<Priority>(
    task
      ? (((task as any)?.priority ||
          'medium') as Priority)
      : savedDraft?.priority || 'medium'
  );

  const [startDate, setStartDate] =
  useState(
    task
      ? existingStart.date
      : savedDraft?.startDate ||
        existingStart.date
  );

  const [startHour, setStartHour] =
  useState(
    task
      ? existingStart.hour
      : savedDraft?.startHour ??
        existingStart.hour
  );

  const [startMinute, setStartMinute] =
  useState(
    task
      ? existingStart.minute
      : savedDraft?.startMinute ??
        existingStart.minute
  );

  const [startPeriod, setStartPeriod] =
  useState<Period>(
    task
      ? existingStart.period
      : savedDraft?.startPeriod ||
        existingStart.period
  );

  const [endDate, setEndDate] =
  useState(
    task
      ? existingEnd.date
      : savedDraft?.endDate ||
        existingEnd.date
  );
  const [endHour, setEndHour] =
  useState(
    task
      ? existingEnd.hour
      : savedDraft?.endHour ??
        existingEnd.hour
  );

  const [endMinute, setEndMinute] =
  useState(
    task
      ? existingEnd.minute
      : savedDraft?.endMinute ??
        existingEnd.minute
  );

  const [endPeriod, setEndPeriod] =
  useState<Period>(
    task
      ? existingEnd.period
      : savedDraft?.endPeriod ||
        existingEnd.period
  );

  const [submissionType, setSubmissionType] =
  useState<SubmissionType>(
    task
      ? (((task as any)?.submission_type ||
          'none') as SubmissionType)
      : savedDraft?.submissionType ||
        'none'
  );

  const [selectedStudents, setSelectedStudents] =
  useState<string[]>(
    task
      ? [(task as any).student_id]
      : savedDraft?.selectedStudents || []
  );

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

    useEffect(() => {
  // Do not save an existing task edit
  if (task || !taskDraftKey) {
    return;
  }

  const draft: TaskDraft = {
    title,
    description,
    priority,

    startDate,
    startHour,
    startMinute,
    startPeriod,

    endDate,
    endHour,
    endMinute,
    endPeriod,

    submissionType,
    selectedStudents,
  };

  localStorage.setItem(
    taskDraftKey,
    JSON.stringify(draft)
  );
}, [
  task,
  taskDraftKey,
  title,
  description,
  priority,
  startDate,
  startHour,
  startMinute,
  startPeriod,
  endDate,
  endHour,
  endMinute,
  endPeriod,
  submissionType,
  selectedStudents,
]);

  async function submit(
    publish: boolean
  ) {
    setError('');

    if (!title.trim()) {
      setError('Title is required.');
      return;
    }

    if (selectedStudents.length === 0) {
      setError(
        'Please select at least one student.'
      );
      return;
    }

    const startISO = buildLocalISO(
      startDate,
      startHour,
      startMinute,
      startPeriod
    );

    const endISO = buildLocalISO(
      endDate,
      endHour,
      endMinute,
      endPeriod
    );

    if (!startISO || !endISO) {
      setError(
        'Please select a valid start and end date/time.'
      );
      return;
    }

    const startTime =
      new Date(startISO).getTime();

    const endTime =
      new Date(endISO).getTime();

    if (endTime <= startTime) {
      setError(
        'End date and time must be after the start date and time.'
      );
      return;
    }

    if (!profile) {
      setError(
        'Guide profile could not be loaded.'
      );
      return;
    }

    setLoading(true);

    /* EDIT EXISTING TASK */

    if (task) {
      const {
        error: updateError,
      } = await supabase
        .from('tasks')
        .update({
          title: title.trim(),
          description:
            description.trim() || null,
          start_at: startISO,
          deadline: endISO,
          priority,
          submission_type:
            submissionType,
          is_published: publish,
          student_id:
            selectedStudents[0],
        })
        .eq('id', task.id);

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      if (publish) {
        const startLater =
          startTime > Date.now();

        await supabase
          .from('notifications')
          .insert({
            user_id:
              selectedStudents[0],
            title:
              startLater
                ? 'Task Scheduled'
                : 'New Task Available',
            message:
              startLater
                ? `"${title.trim()}" has been scheduled.`
                : `"${title.trim()}" is now available.`,
            type: 'task',
            related_id: task.id,
          });
      }

      setLoading(false);

// Clear unfinished New Task draft
if (taskDraftKey) {
  localStorage.removeItem(taskDraftKey);
}

onSaved();
onClose();

      return;
    }

    /* CREATE NEW TASKS */

    const rows =
      selectedStudents.map(
        (studentId) => ({
          mentor_id: profile.id,
          student_id: studentId,
          title: title.trim(),
          description:
            description.trim() || null,
          start_at: startISO,
          deadline: endISO,
          priority,
          is_published: publish,
          submission_type:
            submissionType,
        })
      );

    const {
      data,
      error: insertError,
    } = await supabase
      .from('tasks')
      .insert(rows)
      .select();

    if (insertError || !data) {
      setError(
        insertError?.message ||
          'Failed to create task.'
      );

      setLoading(false);
      return;
    }

    /* NOTIFICATIONS */

    if (publish) {
      const startLater =
        startTime > Date.now();

      await Promise.all(
        selectedStudents.map(
          (studentId) =>
            supabase
              .from('notifications')
              .insert({
                user_id: studentId,
                title:
                  startLater
                    ? 'Task Scheduled'
                    : 'New Task Available',
                message:
                  startLater
                    ? `"${title.trim()}" has been scheduled.`
                    : `"${title.trim()}" is now available.`,
                type: 'task',
                related_id:
                  data[0]?.id,
              })
        )
      );
    }

    setLoading(false);

    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-6 w-full max-w-3xl shadow-2xl my-4">
        {/* HEADER */}

        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-slate-900 dark:text-white font-semibold text-lg">
              {task
                ? 'Edit Task'
                : 'Create Task'}
            </h3>

            <p className="text-gray-400 dark:text-slate-400 text-sm mt-1">
              Set task details, schedule,
              priority, and student access.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BASIC DETAILS */}

        <div className="space-y-4">
          <div>
            <label className="label">
              Task Title *
            </label>

            <input
              type="text"
              value={title}
              onChange={(e) =>
                setTitle(e.target.value)
              }
              placeholder="Enter task title"
              className="input mt-1.5"
            />
          </div>

          <div>
            <label className="label">
              Description
            </label>

            <textarea
              value={description}
              onChange={(e) =>
                setDescription(
                  e.target.value
                )
              }
              placeholder="Describe the task..."
              rows={3}
              className="input resize-none mt-1.5"
            />
          </div>

          {/* SCHEDULE */}

          <div className="border border-gray-200 dark:border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4 text-sky-500" />

              <div>
                <h4 className="text-sm font-medium text-slate-900 dark:text-white">
                  Task Schedule
                </h4>

                <p className="text-xs text-gray-400 dark:text-slate-500">
                  Students can access the task
                  from the start time until the deadline.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <DateTimeSelector
                label="Start"
                date={startDate}
                setDate={setStartDate}
                hour={startHour}
                setHour={setStartHour}
                minute={startMinute}
                setMinute={setStartMinute}
                period={startPeriod}
                setPeriod={setStartPeriod}
              />

              <DateTimeSelector
                label="End"
                date={endDate}
                setDate={setEndDate}
                hour={endHour}
                setHour={setEndHour}
                minute={endMinute}
                setMinute={setEndMinute}
                period={endPeriod}
                setPeriod={setEndPeriod}
              />
            </div>
          </div>

          {/* PRIORITY */}

          <div>
            <label className="label">
              Priority
            </label>

            <select
              value={priority}
              onChange={(e) =>
                setPriority(
                  e.target.value as Priority
                )
              }
              className="input mt-1.5"
            >
              <option value="low">
                Low
              </option>

              <option value="medium">
                Medium
              </option>

              <option value="high">
                High
              </option>
            </select>
          </div>

          {/* SUBMISSION */}

          <div>
            <label className="label">
              Submission Requirement
            </label>

            <select
              value={submissionType}
              onChange={(e) =>
                setSubmissionType(
                  e.target.value as SubmissionType
                )
              }
              className="input mt-1.5"
            >
              <option value="none">
                No Submission Required
              </option>

              <option value="pdf">
                File Upload — PDF
              </option>

              <option value="image">
                File Upload — Image
              </option>

              <option value="document">
                File Upload — Document
              </option>

              <option value="link">
                URL Submission
              </option>
            </select>
          </div>

          {/* STUDENTS */}

          <div>
            <label className="label">
              Assign to Connected Students
            </label>

            {connectedStudents.length === 0 ? (
              <p className="text-gray-500 dark:text-slate-500 text-sm mt-1.5">
                No connected students
                available.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 mt-1.5">
                {connectedStudents.map(
                  (student) => (
                    <label
                      key={student.id}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border cursor-pointer text-sm transition-all ${
                        selectedStudents.includes(
                          student.id
                        )
                          ? 'border-sky-500 bg-sky-500/10 text-sky-500'
                          : 'border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={selectedStudents.includes(
                          student.id
                        )}
                        onChange={(e) =>
                          setSelectedStudents(
                            (previous) =>
                              e.target.checked
                                ? [
                                    ...previous,
                                    student.id,
                                  ]
                                : previous.filter(
                                    (id) =>
                                      id !==
                                      student.id
                                  )
                          )
                        }
                      />

                      <Users className="w-3.5 h-3.5" />

                      {student.full_name}
                    </label>
                  )
                )}
              </div>
            )}
          </div>
        </div>

        {/* ERROR */}

        {error && (
          <div className="text-red-500 text-sm mt-4 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {/* BUTTONS */}

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => submit(false)}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-slate-900 dark:text-white text-sm font-medium disabled:opacity-50 transition-colors"
          >
            Save Draft
          </button>

          <button
            type="button"
            onClick={() => submit(true)}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
          >
            {loading && (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}

            Publish
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   MAIN GUIDE TASK MANAGER
========================================================= */

export default function GuideTaskManager() {
  const { profile } = useAuth();

  /* NEW: TOP-LEVEL TABS
     Create Task is selected by default.
  */

  const [activeTab, setActiveTab] =
    useState<TaskTab>('create');

  const [tasks, setTasks] =
    useState<Task[]>([]);

  const [
    connectedStudents,
    setConnectedStudents,
  ] = useState<Profile[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [editingTask, setEditingTask] =
    useState<Task | undefined>();

  const [showEditor, setShowEditor] =
    useState(false);

  const [now, setNow] =
    useState(Date.now());

  const [priorityFilter, setPriorityFilter] =
    useState<'all' | Priority>('all');

  /* PUBLISHED / DRAFT FILTER */

  const [publishFilter, setPublishFilter] =
    useState<PublishFilter>('all');

  /* =====================================================
     LIVE CLOCK
  ===================================================== */

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () =>
      window.clearInterval(timer);
  }, []);

  /* =====================================================
     LOAD
  ===================================================== */

  async function load() {
    if (!profile) {
      return;
    }

    setLoading(true);

    const [
      tasksRes,
      connRes,
    ] = await Promise.all([
      supabase
        .from('tasks')
        .select(
          '*, task_completions(*), student:profiles!tasks_student_id_fkey(*)'
        )
        .eq(
          'mentor_id',
          profile.id
        )
        .order(
          'deadline',
          {
            ascending: true,
          }
        ),

      supabase
        .from('connection_requests')
        .select(
          '*, student:profiles!connection_requests_student_id_fkey(*)'
        )
        .eq(
          'guide_id',
          profile.id
        )
        .eq(
          'status',
          'accepted'
        ),
    ]);

    setTasks(
      tasksRes.data || []
    );

    setConnectedStudents(
      (connRes.data || [])
        .map(
          (connection: any) =>
            connection.student
        )
        .filter(Boolean)
    );

    setLoading(false);
  }

  useEffect(() => {
    if (profile) {
      load();
    }
  }, [profile]);

  /* =====================================================
     TASK SCHEDULE STATUS
  ===================================================== */

  function getScheduleStatus(task: Task) {
    const startAt =
      (task as any).start_at;

    const deadline =
      (task as any).deadline;

    if (!startAt && !deadline) {
      return {
        label: 'No schedule',
        type: 'none',
      };
    }

    const startTime =
      startAt
        ? new Date(startAt).getTime()
        : null;

    const endTime =
      deadline
        ? new Date(deadline).getTime()
        : null;

    if (
      startTime !== null &&
      now < startTime
    ) {
      return {
        label: `Starts in ${formatCountdown(
          startTime - now
        )}`,
        type: 'upcoming',
      };
    }

    if (
      endTime !== null &&
      now >= endTime
    ) {
      return {
        label: 'Deadline completed',
        type: 'completed',
      };
    }

    if (
      endTime !== null &&
      now < endTime
    ) {
      return {
        label: `${formatCountdown(
          endTime - now
        )} left`,
        type: 'active',
      };
    }

    return {
      label: 'Available',
      type: 'active',
    };
  }

  /* =====================================================
     FILTER TASKS
  ===================================================== */

  const filteredTasks =
    tasks.filter((task) => {
      /* PUBLISHED / DRAFT */

      if (
        publishFilter === 'published' &&
        !task.is_published
      ) {
        return false;
      }

      if (
        publishFilter === 'draft' &&
        task.is_published
      ) {
        return false;
      }

      /* PRIORITY */

      if (
        priorityFilter !== 'all' &&
        (task as any).priority !==
          priorityFilter
      ) {
        return false;
      }

      return true;
    });

  /* =====================================================
     LOADING
  ===================================================== */

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  /* =====================================================
     MAIN UI WITH TOP TABS
  ===================================================== */

  return (
    <div className="w-full">
      {/* TOP TABS */}

      <div className="px-6 lg:px-8 pt-5 border-b border-gray-200 dark:border-slate-700">
        <div
          className="flex items-center gap-6"
          role="tablist"
          aria-label="Guide task management"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'create'}
            onClick={() =>
              setActiveTab('create')
            }
            className={`relative py-3 text-sm font-medium transition-colors ${
              activeTab === 'create'
                ? 'text-sky-500'
                : 'text-gray-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Create Task

            {activeTab === 'create' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-500 rounded-full" />
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'extensions'}
            onClick={() =>
              setActiveTab('extensions')
            }
            className={`relative py-3 text-sm font-medium transition-colors ${
              activeTab === 'extensions'
                ? 'text-sky-500'
                : 'text-gray-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Extension Requests

            {activeTab === 'extensions' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-500 rounded-full" />
            )}
          </button>
        </div>
      </div>

      {/* =================================================
          EXTENSION REQUESTS TAB
      ================================================= */}

      {activeTab === 'extensions' ? (
        <div
          role="tabpanel"
          className="w-full"
        >
          <GuideExtensionRequests />
        </div>
      ) : (
        /* =================================================
           CREATE TASK TAB
        ================================================= */

        <div
          role="tabpanel"
          className="w-full p-6 lg:p-8"
        >
          {/* HEADER */}

          <div className="flex items-center justify-between mb-6 gap-4">
            {/* TITLE */}

            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Task Manager
              </h1>

              <p className="text-gray-500 dark:text-slate-400 text-sm mt-0.5">
                {tasks.length} tasks
              </p>
            </div>

            {/* RIGHT SIDE */}

            <div className="flex items-center gap-3 flex-wrap justify-end">
              {/* PUBLISHED / DRAFT FILTER */}

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setPublishFilter('all')
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    publishFilter === 'all'
                      ? 'bg-sky-500 text-white border-sky-500'
                      : 'border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  All
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setPublishFilter('published')
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    publishFilter === 'published'
                      ? 'bg-emerald-500 text-white border-emerald-500'
                      : 'border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Published
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setPublishFilter('draft')
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    publishFilter === 'draft'
                      ? 'bg-gray-500 text-white border-gray-500'
                      : 'border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Draft
                </button>
              </div>

              {/* NEW TASK */}

              <button
                type="button"
                onClick={() => {
                  setEditingTask(undefined);
                  setShowEditor(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />

                New Task
              </button>
            </div>
          </div>

          {/* PRIORITY FILTER */}

          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 mr-1">
              Priority:
            </span>

            <button
              type="button"
              onClick={() =>
                setPriorityFilter('all')
              }
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                priorityFilter === 'all'
                  ? 'bg-sky-500 text-white border-sky-500'
                  : 'border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All
            </button>

            <button
              type="button"
              onClick={() =>
                setPriorityFilter('high')
              }
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                priorityFilter === 'high'
                  ? 'bg-red-500 text-white border-red-500'
                  : 'border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              High
            </button>

            <button
              type="button"
              onClick={() =>
                setPriorityFilter('medium')
              }
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                priorityFilter === 'medium'
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Medium
            </button>

            <button
              type="button"
              onClick={() =>
                setPriorityFilter('low')
              }
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                priorityFilter === 'low'
                  ? 'bg-emerald-500 text-white border-emerald-500'
                  : 'border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Low
            </button>
          </div>

          {/* ALL TASKS */}

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                {publishFilter === 'published'
                  ? 'Published Tasks'
                  : publishFilter === 'draft'
                  ? 'Draft Tasks'
                  : 'All Tasks'}
              </h2>

              <span className="text-xs text-gray-400 dark:text-slate-500">
                {filteredTasks.length} tasks
              </span>
            </div>

            {filteredTasks.length === 0 ? (
              <div className="card p-12 text-center">
                <p className="text-gray-400 dark:text-slate-500">
                  No tasks found.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredTasks.map(
                  (task) => {
                    const schedule =
                      getScheduleStatus(task);

                    return (
                      <TaskCard
                        key={task.id}
                        task={task}
                        schedule={schedule}
                        onEdit={() => {
                          setEditingTask(task);
                          setShowEditor(true);
                        }}
                        onTogglePublish={async () => {
                          const newValue =
                            !task.is_published;

                          const { error } =
                            await supabase
                              .from('tasks')
                              .update({
                                is_published:
                                  newValue,
                              })
                              .eq(
                                'id',
                                task.id
                              );

                          if (error) {
                            alert(error.message);
                            return;
                          }

                          setTasks(
                            (previous) =>
                              previous.map(
                                (item) =>
                                  item.id === task.id
                                    ? {
                                        ...item,
                                        is_published:
                                          newValue,
                                      }
                                    : item
                              )
                          );
                        }}
                        onDelete={async () => {
                          const confirmed =
                            window.confirm(
                              `Delete "${task.title}"?`
                            );

                          if (!confirmed) {
                            return;
                          }

                          const { error } =
                            await supabase
                              .from('tasks')
                              .delete()
                              .eq(
                                'id',
                                task.id
                              );

                          if (error) {
                            alert(error.message);
                            return;
                          }

                          setTasks(
                            (previous) =>
                              previous.filter(
                                (item) =>
                                  item.id !== task.id
                              )
                          );
                        }}
                      />
                    );
                  }
                )}
              </div>
            )}
          </div>

          {/* EDITOR */}

          {showEditor && (
            <CreateTaskModal
              task={editingTask}
              connectedStudents={connectedStudents}
              onClose={() =>
                setShowEditor(false)
              }
              onSaved={load}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   TASK CARD
========================================================= */

function TaskCard({
  task,
  schedule,
  onEdit,
  onTogglePublish,
  onDelete,
}: {
  task: Task;
  schedule: {
    label: string;
    type: string;
  };
  onEdit: () => void;
  onTogglePublish: () => void;
  onDelete: () => void;
}) {
  const priority =
    (task as any).priority || 'medium';

  const submissionType =
    (task as any).submission_type || 'none';

  const student =
    (task as any).student;

  return (
    <div className="card p-5 w-full">
      <div className="flex items-start justify-between gap-5">
        {/* LEFT */}

        <div className="flex-1 min-w-0">
          {/* TITLE + STATUS */}

          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-slate-900 dark:text-white font-semibold text-base">
              {task.title}
            </h3>

            <span
              className={`text-xs px-2 py-0.5 rounded-lg ${
                task.is_published
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
              }`}
            >
              {task.is_published
                ? 'Published'
                : 'Draft'}
            </span>

            <span
              className={`text-xs px-2 py-0.5 rounded-lg ${
                priority === 'high'
                  ? 'bg-red-500/10 text-red-500'
                  : priority === 'medium'
                  ? 'bg-amber-500/10 text-amber-500'
                  : 'bg-emerald-500/10 text-emerald-500'
              }`}
            >
              {priority.charAt(0).toUpperCase() +
                priority.slice(1)}
            </span>
          </div>

          {/* DESCRIPTION */}

          {(task as any).description && (
            <p className="text-gray-400 dark:text-slate-400 text-sm mt-1">
              {(task as any).description}
            </p>
          )}

          {/* STUDENT */}

          {student && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-slate-400 mt-3">
              <Users className="w-3.5 h-3.5" />

              {student.full_name}
            </div>
          )}

          {/* START + END */}

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4 pt-3 border-t border-gray-100 dark:border-slate-700/60">
            <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
              <Calendar className="w-3.5 h-3.5 text-sky-500" />

              Start:

              {formatDateTime(
                (task as any).start_at
              )}
            </span>

            <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
              <Calendar className="w-3.5 h-3.5 text-sky-500" />

              End:

              {formatDateTime(
                (task as any).deadline
              )}
            </span>
          </div>

          {/* COUNTDOWN */}

          <div className="mt-3">
            <span
              className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg ${
                schedule.type === 'upcoming'
                  ? 'bg-amber-500/10 text-amber-500'
                  : schedule.type === 'active'
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : schedule.type === 'completed'
                  ? 'bg-red-500/10 text-red-500'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
              }`}
            >
              <Clock className="w-3 h-3" />

              {schedule.label}
            </span>
          </div>

          {/* SUBMISSION */}

          {submissionType !== 'none' && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-slate-500 mt-3">
              {submissionType === 'link' ? (
                <LinkIcon className="w-3.5 h-3.5" />
              ) : (
                <FileText className="w-3.5 h-3.5" />
              )}

              Submission:

              {submissionType === 'pdf'
                ? 'PDF'
                : submissionType === 'image'
                ? 'Image'
                : submissionType === 'document'
                ? 'Document'
                : 'URL'}
            </div>
          )}
        </div>

        {/* ACTIONS */}

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* PUBLISH / UNPUBLISH */}

          <button
            type="button"
            onClick={onTogglePublish}
            className={`p-2 rounded-xl border transition-colors ${
              task.is_published
                ? 'border-emerald-200 dark:border-emerald-500/30 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                : 'border-gray-200 dark:border-slate-600 text-gray-400 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
            title={
              task.is_published
                ? 'Unpublish task'
                : 'Publish task'
            }
          >
            {task.is_published ? (
              <Eye className="w-4 h-4" />
            ) : (
              <EyeOff className="w-4 h-4" />
            )}
          </button>

          {/* EDIT */}

          <button
            type="button"
            onClick={onEdit}
            className="p-2 rounded-xl border border-gray-200 dark:border-slate-600 text-gray-400 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            title="Edit task"
          >
            <Edit3 className="w-4 h-4" />
          </button>

          {/* DELETE */}

          <button
            type="button"
            onClick={onDelete}
            className="p-2 rounded-xl border border-red-200 dark:border-red-500/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            title="Delete task"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}