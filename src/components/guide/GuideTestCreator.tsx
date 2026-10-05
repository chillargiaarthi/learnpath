// GuideTestCreator.tsx

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
  Clock,
  ChevronDown,
  ChevronUp,
  Calculator,
  Timer,
  Calendar,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Test, QuestionType, Profile } from '../../lib/types';

interface DraftQuestion {
  id?: string;
  question_text: string;
  type: QuestionType;
  options: { label: string; value: string }[];
  correct_answer: string;
  expected_answer: string;
  marks: number;
}

type Period = 'AM' | 'PM';

interface DateTimeParts {
  date: string;
  hour: number;
  minute: number;
  period: Period;
}

/* =========================================================
   DRAFT STORAGE
   One fixed key. Does NOT depend on profile/user, so it works
   even when auth is refreshing after a tab switch.
   ========================================================= */

const DRAFT_KEY = 'guide-new-test-draft';

function readDraft(): any | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeDraft(data: any) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

function clearDraftStorage() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

/* =========================================================
   DATE / TIME HELPERS
   ========================================================= */

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function getDateString(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate()
  )}`;
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

  // Default end time = 1 hour after start
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

  const localDate = new Date(year, month - 1, day, hour24, minute, 0, 0);

  if (Number.isNaN(localDate.getTime())) {
    return null;
  }

  return localDate.toISOString();
}

function formatDateTime(iso: string | null | undefined) {
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

  const totalMinutes = Math.max(1, Math.floor(milliseconds / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days} day${days !== 1 ? 's' : ''}`);
  }
  if (hours > 0) {
    parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  }
  if (minutes > 0 || parts.length === 0) {
    parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
  }

  return parts.join(', ');
}

/* =========================================================
   DATE / TIME SELECTOR
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
      {/* DATE */}
      <label className="label">{label} Date *</label>

      <div className="relative mt-1.5">
        <Calendar
          className="absolute left-3 top-1/2 -translate-y-1/2 text-sky-500 pointer-events-none"
          size={17}
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="input pl-10 w-full dark:[color-scheme:dark]"
        />
      </div>

      {/* TIME BELOW DATE */}
      <div className="grid grid-cols-3 gap-2 mt-2">
        <select
          value={hour}
          onChange={(e) => setHour(Number(e.target.value))}
          className="input"
          aria-label={`${label} hour`}
        >
          {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
            <option key={value} value={value}>
              {pad2(value)}
            </option>
          ))}
        </select>

        <select
          value={minute}
          onChange={(e) => setMinute(Number(e.target.value))}
          className="input"
          aria-label={`${label} minute`}
        >
          {Array.from({ length: 60 }, (_, index) => index).map((value) => (
            <option key={value} value={value}>
              {pad2(value)}
            </option>
          ))}
        </select>

        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as Period)}
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
   QUESTION EDITOR
   ========================================================= */

function QuestionEditor({
  q,
  index,
  onChange,
  onRemove,
}: {
  q: DraftQuestion;
  index: number;
  onChange: (u: DraftQuestion) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700/50 rounded-xl overflow-hidden">
      {/* QUESTION HEADER */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs font-bold bg-sky-500/20 text-sky-500 px-2 py-0.5 rounded">
            Q{index + 1}
          </span>

          <span className="text-slate-900 dark:text-white text-sm truncate max-w-xs">
            {q.question_text || 'Untitled question'}
          </span>

          <span
            className={`text-xs px-2 py-0.5 rounded capitalize ${
              q.type === 'objective'
                ? 'bg-amber-500/10 text-amber-500'
                : 'bg-sky-500/10 text-sky-500'
            }`}
          >
            {q.type}
          </span>

          <span className="text-xs text-gray-400 dark:text-slate-400">
            {q.marks}m
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="text-gray-400 dark:text-slate-500 hover:text-red-500"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {open ? (
            <ChevronUp className="w-4 h-4 text-gray-400 dark:text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400 dark:text-slate-400" />
          )}
        </div>
      </div>

      {/* QUESTION BODY */}
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-200 dark:border-slate-700/50 pt-3">
          {/* QUESTION */}
          <div>
            <label className="block text-xs text-gray-400 dark:text-slate-400 mb-1">
              Question *
            </label>
            <textarea
              value={q.question_text}
              onChange={(e) =>
                onChange({ ...q, question_text: e.target.value })
              }
              placeholder="Enter question..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 text-sm resize-none"
            />
          </div>

          {/* TYPE + MARKS */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 dark:text-slate-400 mb-1">
                Type
              </label>
              <select
                value="objective"
                onChange={() =>
                  onChange({ ...q, type: 'objective' as QuestionType })
                }
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
              >
                <option value="objective">Objective (MCQ)</option>
              </select>
            </div>

            <div className="w-24">
              <label className="block text-xs text-gray-400 dark:text-slate-400 mb-1">
                Marks
              </label>
              <input
                type="number"
                min={1}
                value={q.marks}
                onChange={(e) =>
                  onChange({ ...q, marks: parseInt(e.target.value) || 1 })
                }
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500 text-sm"
              />
            </div>
          </div>

          {/* OBJECTIVE */}
          {q.type === 'objective' && (
            <>
              <div>
                <label className="block text-xs text-gray-400 dark:text-slate-400 mb-1">
                  Options
                </label>

                <div className="space-y-2">
                  {q.options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 dark:text-slate-400 w-5 text-center">
                        {String.fromCharCode(65 + i)}.
                      </span>
                      <input
                        type="text"
                        value={opt.label}
                        onChange={(e) => {
                          const opts = [...q.options];
                          opts[i] = { ...opts[i], label: e.target.value };
                          onChange({ ...q, options: opts });
                        }}
                        placeholder={`Option ${String.fromCharCode(65 + i)}`}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 text-sm"
                      />
                    </div>
                  ))}

                  {q.options.length < 6 && (
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          ...q,
                          options: [
                            ...q.options,
                            { label: '', value: String(q.options.length) },
                          ],
                        })
                      }
                      className="text-xs text-sky-500 hover:text-sky-400"
                    >
                      + Add option
                    </button>
                  )}
                </div>
              </div>

              {/* CORRECT ANSWER */}
              <div>
                <label className="block text-xs text-gray-400 dark:text-slate-400 mb-1">
                  Correct Answer
                </label>
                <select
                  value={q.correct_answer}
                  onChange={(e) =>
                    onChange({ ...q, correct_answer: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500 text-sm"
                >
                  <option value="">Select correct answer</option>
                  {q.options.map((opt, i) => (
                    <option key={i} value={String(i)}>
                      {String.fromCharCode(65 + i)}. {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* SUBJECTIVE */}
          {q.type === 'subjective' && (
            <div>
              <label className="block text-xs text-gray-400 dark:text-slate-400 mb-1">
                Expected Answer
              </label>
              <textarea
                value={q.expected_answer}
                onChange={(e) =>
                  onChange({ ...q, expected_answer: e.target.value })
                }
                placeholder="Model answer..."
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 text-sm resize-none"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   TOGGLE SWITCH
   ========================================================= */

function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        aria-label={label}
        aria-pressed={checked}
        className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${
          checked ? 'bg-sky-500' : 'bg-gray-300 dark:bg-slate-600'
        }`}
      >
        <span
          className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-all duration-200 ${
            checked ? 'left-5' : 'left-1'
          }`}
        />
      </button>
      <span className="text-sm text-slate-900 dark:text-white">{label}</span>
    </label>
  );
}

/* =========================================================
   TEST EDITOR
   ========================================================= */

function TestEditor({
  test,
  connectedStudents,
  onClose,
  onSaved,
}: {
  test?: Test;
  connectedStudents: Profile[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { profile } = useAuth();

  const isNew = !test;

  /* Load saved draft ONCE (only for new tests) */
  const [draft] = useState<any>(() => (isNew ? readDraft() : null));

  const defaults = getDefaultSchedule();

  const existingStart = getPartsFromISO(
    (test as any)?.start_at,
    defaults.start
  );

  const existingEnd = getPartsFromISO((test as any)?.deadline, defaults.end);

  const [title, setTitle] = useState<string>(
    draft?.title ?? test?.title ?? ''
  );
  const [description, setDescription] = useState<string>(
    draft?.description ?? test?.description ?? ''
  );
  const [duration, setDuration] = useState<number>(
    draft?.duration ?? test?.duration_minutes ?? 60
  );
  const [maxViol, setMaxViol] = useState<number>(
    draft?.maxViol ?? test?.max_violations ?? 3
  );
  const [isTimed, setIsTimed] = useState<boolean>(
    draft?.isTimed ?? (test as any)?.is_timed !== false
  );
  const [hasCalculator, setHasCalculator] = useState<boolean>(
    draft?.hasCalculator ?? (test as any)?.has_calculator ?? false
  );
  const [instructions, setInstructions] = useState<string>(
    draft?.instructions ?? (test as any)?.instructions ?? ''
  );

  /* START */
  const [startDate, setStartDate] = useState<string>(
    draft?.startDate ?? existingStart.date
  );
  const [startHour, setStartHour] = useState<number>(
    draft?.startHour ?? existingStart.hour
  );
  const [startMinute, setStartMinute] = useState<number>(
    draft?.startMinute ?? existingStart.minute
  );
  const [startPeriod, setStartPeriod] = useState<Period>(
    draft?.startPeriod ?? existingStart.period
  );

  /* END */
  const [endDate, setEndDate] = useState<string>(
    draft?.endDate ?? existingEnd.date
  );
  const [endHour, setEndHour] = useState<number>(
    draft?.endHour ?? existingEnd.hour
  );
  const [endMinute, setEndMinute] = useState<number>(
    draft?.endMinute ?? existingEnd.minute
  );
  const [endPeriod, setEndPeriod] = useState<Period>(
    draft?.endPeriod ?? existingEnd.period
  );

  /* QUESTIONS */
  const [questions, setQuestions] = useState<DraftQuestion[]>(
    draft?.questions ??
      (test?.questions || []).map((q) => ({
        id: q.id,
        question_text: q.question_text,
        type: q.type,
        options: (q.options as { label: string; value: string }[]) || [
          { label: '', value: '0' },
          { label: '', value: '1' },
          { label: '', value: '2' },
          { label: '', value: '3' },
        ],
        correct_answer: q.correct_answer || '',
        expected_answer: q.expected_answer || '',
        marks: q.marks,
      }))
  );

  const [selectedStudents, setSelectedStudents] = useState<string[]>(
    draft?.selectedStudents ?? test?.assigned_to ?? []
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  /* AUTO-SAVE DRAFT on every change (new tests only) */
  useEffect(() => {
    if (!isNew) return;

    writeDraft({
      title,
      description,
      duration,
      maxViol,
      isTimed,
      hasCalculator,
      instructions,
      startDate,
      startHour,
      startMinute,
      startPeriod,
      endDate,
      endHour,
      endMinute,
      endPeriod,
      questions,
      selectedStudents,
    });
  }, [
    isNew,
    title,
    description,
    duration,
    maxViol,
    isTimed,
    hasCalculator,
    instructions,
    startDate,
    startHour,
    startMinute,
    startPeriod,
    endDate,
    endHour,
    endMinute,
    endPeriod,
    questions,
    selectedStudents,
  ]);

  /* CANCEL / X : asks before throwing away typed data */
  function handleDiscard() {
    

    onClose();
  }

  /* =====================================================
     SAVE
     ===================================================== */

  async function save(publish: boolean) {
    setError('');

    if (!title.trim()) {
      setError('Title is required.');
      return;
    }

    const startISO = buildLocalISO(
      startDate,
      startHour,
      startMinute,
      startPeriod
    );

    const endISO = buildLocalISO(endDate, endHour, endMinute, endPeriod);

    if (!startISO || !endISO) {
      setError('Please select a valid start and end date/time.');
      return;
    }

    const startTime = new Date(startISO).getTime();
    const endTime = new Date(endISO).getTime();

    if (endTime <= startTime) {
      setError('End date and time must be after the start date and time.');
      return;
    }

    if (!profile) {
      setError('Guide profile could not be loaded.');
      return;
    }

    setLoading(true);

    const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);

    let testId = test?.id;

    /* INSERT */
    if (!testId) {
      const { data, error: insertError } = await supabase
        .from('tests')
        .insert({
          mentor_id: profile.id,
          title: title.trim(),
          description: description.trim() || null,
          duration_minutes: duration,
          max_violations: maxViol,
          is_published: publish,
          total_marks: totalMarks,
          assigned_to: selectedStudents,
          is_timed: isTimed,
          has_calculator: hasCalculator,
          instructions: instructions.trim() || null,
          start_at: startISO,
          deadline: endISO,
        })
        .select()
        .single();

      if (insertError || !data) {
        setError(insertError?.message || 'Failed to create test.');
        setLoading(false);
        return;
      }

      testId = data.id;
    } else {
      /* UPDATE */
      const { error: updateError } = await supabase
        .from('tests')
        .update({
          title: title.trim(),
          description: description.trim() || null,
          duration_minutes: duration,
          max_violations: maxViol,
          is_published: publish,
          total_marks: totalMarks,
          assigned_to: selectedStudents,
          is_timed: isTimed,
          has_calculator: hasCalculator,
          instructions: instructions.trim() || null,
          start_at: startISO,
          deadline: endISO,
        })
        .eq('id', testId);

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      const { error: deleteError } = await supabase
        .from('questions')
        .delete()
        .eq('test_id', testId);

      if (deleteError) {
        setError(deleteError.message);
        setLoading(false);
        return;
      }
    }

    /* INSERT QUESTIONS */
    if (questions.length > 0) {
      const { error: questionsError } = await supabase.from('questions').insert(
        questions.map((q, index) => ({
          test_id: testId,
          question_text: q.question_text,
          type: q.type,
          options: q.type === 'objective' ? q.options : null,
          correct_answer: q.correct_answer || null,
          expected_answer: q.expected_answer || null,
          marks: q.marks,
          order_index: index,
        }))
      );

      if (questionsError) {
        setError(questionsError.message);
        setLoading(false);
        return;
      }
    }

    /* NOTIFICATION */
    if (publish && selectedStudents.length > 0) {
      const scheduledLater = startTime > Date.now();

      await Promise.all(
        selectedStudents.map((studentId) =>
          supabase.from('notifications').insert({
            user_id: studentId,
            title: scheduledLater ? 'Test Scheduled' : 'New Test Available',
            message: scheduledLater
              ? `"${title.trim()}" has been scheduled.`
              : `"${title.trim()}" is now available.`,
            type: 'test',
            related_id: testId,
          })
        )
      );
    }

    setLoading(false);

    // Saved successfully, so the draft is no longer needed
    clearDraftStorage();

    onSaved();
    onClose();
  }

  /* =====================================================
     EDITOR UI
     ===================================================== */

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-6 w-full max-w-4xl shadow-2xl my-4">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-slate-900 dark:text-white font-semibold text-lg">
              {test ? 'Edit Test' : 'Create Test'}
            </h3>
            <p className="text-gray-400 dark:text-slate-400 text-sm mt-1">
              Set the test schedule, questions, and student access.
            </p>
          </div>

          <button
            type="button"
            onClick={handleDiscard}
            className="text-gray-400 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BASIC DETAILS */}
        <div className="space-y-4 mb-5">
          {/* TITLE */}
          <div>
            <label className="label">Test Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter test title"
              className="input mt-1.5"
            />
          </div>

          {/* DESCRIPTION */}
          <div>
            <label className="label">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="input resize-none mt-1.5"
            />
          </div>

          {/* DURATION + VIOLATIONS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Duration (minutes)</label>
              <input
                type="number"
                min={5}
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
                className="input mt-1.5"
                disabled={!isTimed}
              />
            </div>

            <div>
              <label className="label">Max Violations Before Terminate</label>
              <input
                type="number"
                min={1}
                value={maxViol}
                onChange={(e) => setMaxViol(parseInt(e.target.value) || 3)}
                className="input mt-1.5"
              />
            </div>
          </div>

          {/* TEST SCHEDULE */}
          <div className="border border-gray-200 dark:border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4 text-sky-500" />
              <div>
                <h4 className="text-sm font-medium text-slate-900 dark:text-white">
                  Test Schedule
                </h4>
                <p className="text-xs text-gray-400 dark:text-slate-500">
                  Students can start only after the start time.
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

          {/* TIMED + CALCULATOR */}
          <div className="flex flex-wrap gap-6 pt-1">
            <ToggleSwitch
              checked={isTimed}
              onChange={setIsTimed}
              label="Timed Test"
            />
            <ToggleSwitch
              checked={hasCalculator}
              onChange={setHasCalculator}
              label="Allow Calculator"
            />
          </div>

          {/* INSTRUCTIONS */}
          <div>
            <label className="label">Instructions for Students</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Rules, guidelines, and what to expect..."
              rows={3}
              className="input mt-1.5 resize-none"
            />
          </div>

          {/* STUDENTS */}
          <div>
            <label className="label">Assign to Connected Students</label>

            {connectedStudents.length === 0 ? (
              <p className="text-gray-500 dark:text-slate-500 text-sm mt-1.5">
                No connected students available.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 mt-1.5">
                {connectedStudents.map((student) => (
                  <label
                    key={student.id}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border cursor-pointer text-sm transition-all ${
                      selectedStudents.includes(student.id)
                        ? 'border-sky-500 bg-sky-500/10 text-sky-500'
                        : 'border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={selectedStudents.includes(student.id)}
                      onChange={(e) =>
                        setSelectedStudents((previous) =>
                          e.target.checked
                            ? [...previous, student.id]
                            : previous.filter((id) => id !== student.id)
                        )
                      }
                    />
                    <Users className="w-3.5 h-3.5" />
                    {student.full_name}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* QUESTIONS */}
        <div className="border-t border-gray-100 dark:border-slate-700 pt-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-slate-900 dark:text-white font-medium">
              Questions ({questions.length}) ·{' '}
              {questions.reduce((sum, q) => sum + q.marks, 0)} total marks
            </h4>

            <button
              type="button"
              onClick={() =>
                setQuestions((previous) => [
                  ...previous,
                  {
                    question_text: '',
                    type: 'objective',
                    options: [
                      { label: '', value: '0' },
                      { label: '', value: '1' },
                      { label: '', value: '2' },
                      { label: '', value: '3' },
                    ],
                    correct_answer: '',
                    expected_answer: '',
                    marks: 1,
                  },
                ])
              }
              className="flex items-center gap-1.5 text-sm text-sky-500 hover:text-sky-400"
            >
              <Plus className="w-4 h-4" />
              Add Question
            </button>
          </div>

          {questions.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-xl text-gray-400 dark:text-slate-500 text-sm">
              Click "Add Question" to start
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {questions.map((question, index) => (
                <QuestionEditor
                  key={index}
                  q={question}
                  index={index}
                  onChange={(updated) =>
                    setQuestions((previous) =>
                      previous.map((item, itemIndex) =>
                        itemIndex === index ? updated : item
                      )
                    )
                  }
                  onRemove={() =>
                    setQuestions((previous) =>
                      previous.filter((_, itemIndex) => itemIndex !== index)
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* ERROR */}
        {error && (
          <div className="text-red-500 text-sm mb-3 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {/* BUTTONS */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleDiscard}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => save(false)}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-slate-900 dark:text-white text-sm font-medium disabled:opacity-50 transition-colors"
          >
            Save Draft
          </button>

          <button
            type="button"
            onClick={() => save(true)}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Publish
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   MAIN GUIDE TEST CREATOR
   ========================================================= */

export default function GuideTestCreator() {
  const { profile } = useAuth();

  const [tests, setTests] = useState<Test[]>([]);
  const [connectedStudents, setConnectedStudents] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Test | undefined>();

  /* If an unsaved draft exists, the form opens immediately on mount.
     No waiting for profile, no effects. */
  const [showEditor, setShowEditor] = useState<boolean>(
    () => readDraft() !== null
  );

  /* LIVE COUNTDOWN */
  const [now, setNow] = useState(Date.now());

  const [statusFilter, setStatusFilter] = useState<
    'all' | 'published' | 'draft'
  >('all');

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  /* =====================================================
     LOAD
     ===================================================== */

  async function load(showSpinner = true) {
    if (!profile) {
      return;
    }

    if (showSpinner) {
      setLoading(true);
    }

    const [testsRes, connRes] = await Promise.all([
      supabase
        .from('tests')
        .select('*, questions(*)')
        .eq('mentor_id', profile.id)
        .order('created_at', { ascending: false }),

      supabase
        .from('connection_requests')
        .select('*, student:profiles!connection_requests_student_id_fkey(*)')
        .eq('guide_id', profile.id)
        .eq('status', 'accepted'),
    ]);

    setTests(testsRes.data || []);

    setConnectedStudents(
      (connRes.data || [])
        .map((connection: any) => connection.student)
        .filter(Boolean)
    );

    setLoading(false);
  }

  /* Reload only when the USER changes, not on every profile refresh */
  useEffect(() => {
    if (profile?.id) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const filteredTests = tests.filter((test) => {
    if (statusFilter === 'published') {
      return test.is_published;
    }

    if (statusFilter === 'draft') {
      return !test.is_published;
    }

    return true;
  });

  /* =====================================================
     SCHEDULE STATUS
     ===================================================== */

  function getScheduleStatus(test: Test) {
    const startAt = (test as any).start_at;
    const deadline = (test as any).deadline;

    if (!startAt && !deadline) {
      return { label: 'No schedule', type: 'none' };
    }

    const startTime = startAt ? new Date(startAt).getTime() : null;
    const endTime = deadline ? new Date(deadline).getTime() : null;

    /* BEFORE START */
    if (startTime !== null && now < startTime) {
      return {
        label: `Starts in ${formatCountdown(startTime - now)}`,
        type: 'upcoming',
      };
    }

    /* AFTER END */
    if (endTime !== null && now >= endTime) {
      return { label: 'Deadline completed', type: 'completed' };
    }

    /* ACTIVE */
    if (endTime !== null && now < endTime) {
      return {
        label: `${formatCountdown(endTime - now)} left`,
        type: 'active',
      };
    }

    return { label: 'Available', type: 'active' };
  }

  /* =====================================================
     MAIN UI
     (no early return for loading, so the editor never unmounts)
     ===================================================== */

  return (
    <div className="w-full p-6 lg:p-8">
      {/* HEADER */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Test Creator
          </h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-0.5">
            {tests.length} tests
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditing(undefined);
            setShowEditor(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Test
        </button>
      </div>

      {/* FILTERS */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {[
          { value: 'all' as const, label: 'All' },
          { value: 'published' as const, label: 'Published' },
          { value: 'draft' as const, label: 'Draft' },
        ].map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setStatusFilter(filter.value)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              statusFilter === filter.value
                ? 'bg-sky-500 text-white'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* LIST AREA */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredTests.length === 0 ? (
        <div className="card p-12 text-center w-full">
          <p className="text-gray-400 dark:text-slate-500">No Drafts</p>
        </div>
      ) : (
        <div className="space-y-4 w-full">
          {filteredTests.map((test) => {
            const schedule = getScheduleStatus(test);

            return (
              <div key={test.id} className="card p-5 w-full">
                <div className="flex items-start justify-between gap-5">
                  {/* LEFT */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-slate-900 dark:text-white font-semibold text-base">
                        {test.title}
                      </h3>

                      <span
                        className={`text-xs px-2 py-0.5 rounded-lg ${
                          test.is_published
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
                        }`}
                      >
                        {test.is_published ? 'Published' : 'Draft'}
                      </span>

                      {(test as any).is_timed === false && (
                        <span className="text-xs px-2 py-0.5 rounded-lg bg-sky-500/10 text-sky-500 flex items-center gap-1">
                          <Timer className="w-3 h-3" />
                          Untimed
                        </span>
                      )}

                      {(test as any).has_calculator && (
                        <span className="text-xs px-2 py-0.5 rounded-lg bg-purple-500/10 text-purple-500 flex items-center gap-1">
                          <Calculator className="w-3 h-3" />
                          Calculator
                        </span>
                      )}
                    </div>

                    {/* DESCRIPTION */}
                    {test.description && (
                      <p className="text-gray-400 dark:text-slate-400 text-sm mt-1">
                        {test.description}
                      </p>
                    )}

                    {/* META */}
                    <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3 text-xs text-gray-400 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {(test as any).is_timed !== false
                          ? `${test.duration_minutes} min`
                          : 'Untimed'}
                      </span>

                      <span>{(test.questions || []).length} questions</span>

                      <span>{test.total_marks} marks</span>

                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {(test.assigned_to || []).length} assigned
                      </span>
                    </div>

                    {/* SCHEDULE */}
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 pt-3 border-t border-gray-100 dark:border-slate-700/60">
                      <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
                        <Calendar className="w-3.5 h-3.5 text-sky-500" />
                        Start: {formatDateTime((test as any).start_at)}
                      </span>

                      <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
                        <Calendar className="w-3.5 h-3.5 text-sky-500" />
                        End: {formatDateTime((test as any).deadline)}
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
                  </div>

                  {/* ACTIONS */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* PUBLISH / UNPUBLISH */}
                    <button
                      type="button"
                      onClick={async () => {
                        const newValue = !test.is_published;

                        const { error: updateError } = await supabase
                          .from('tests')
                          .update({ is_published: newValue })
                          .eq('id', test.id);

                        if (updateError) {
                          return;
                        }

                        setTests((previous) =>
                          previous.map((item) =>
                            item.id === test.id
                              ? { ...item, is_published: newValue }
                              : item
                          )
                        );
                      }}
                      className={`p-2 rounded-xl border transition-colors ${
                        test.is_published
                          ? 'border-emerald-200 dark:border-emerald-500/30 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                          : 'border-gray-200 dark:border-slate-600 text-gray-400 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                      title={
                        test.is_published ? 'Unpublish test' : 'Publish test'
                      }
                    >
                      {test.is_published ? (
                        <Eye className="w-4 h-4" />
                      ) : (
                        <EyeOff className="w-4 h-4" />
                      )}
                    </button>

                    {/* EDIT */}
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(test);
                        setShowEditor(true);
                      }}
                      className="p-2 rounded-xl border border-gray-200 dark:border-slate-600 text-gray-400 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                      title="Edit test"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    {/* DELETE */}
                    <button
                      type="button"
                      onClick={async () => {
                        const confirmed = window.confirm(
                          `Delete "${test.title}"?`
                        );

                        if (!confirmed) {
                          return;
                        }

                        const { error: deleteError } = await supabase
                          .from('tests')
                          .delete()
                          .eq('id', test.id);

                        if (deleteError) {
                          return;
                        }

                        setTests((previous) =>
                          previous.filter((item) => item.id !== test.id)
                        );
                      }}
                      className="p-2 rounded-xl border border-red-200 dark:border-red-500/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      title="Delete test"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* EDITOR (rendered outside the loading check) */}
      {showEditor && (
        <TestEditor
          test={editing}
          connectedStudents={connectedStudents}
          onClose={() => setShowEditor(false)}
          onSaved={() => load(false)}
        />
      )}
    </div>
  );
}