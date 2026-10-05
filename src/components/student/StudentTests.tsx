import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  AlertTriangle,
  Clock,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Loader2,
  ShieldAlert,
  CalendarDays,
  Calculator,
  X,
} from 'lucide-react';

import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Test, Question, TestAttempt } from '../../lib/types';

/* =========================================================
   TYPES
========================================================= */

type StudentTest = Test & {
  start_at?: string | null;
  deadline?: string | null;
  is_timed?: boolean;
  has_calculator?: boolean;
};

type AvailabilityState =
  | 'none'
  | 'upcoming'
  | 'active'
  | 'completed';

type TestAvailability = {
  state: AvailabilityState;
  label: string;
};

type StatusFilter =
  | 'all'
  | 'pending'
  | 'completed'
  | 'not_taken';

/* =========================================================
   DATE / TIME
========================================================= */

function formatDateTime(value?: string | null) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  const time = date.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return `${day}-${month}-${year}, ${time}`;
}

function formatCountdown(diffMs: number) {
  if (diffMs <= 0) {
    return 'Deadline completed';
  }

  const totalSeconds = Math.floor(diffMs / 1000);

  const days = Math.floor(totalSeconds / 86400);

  const hours = Math.floor(
    (totalSeconds % 86400) / 3600
  );

  const minutes = Math.floor(
    (totalSeconds % 3600) / 60
  );

  const seconds = totalSeconds % 60;

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

  if (minutes > 0) {
    parts.push(
      `${minutes} minute${minutes !== 1 ? 's' : ''}`
    );
  }

  if (
    days === 0 &&
    hours === 0 &&
    minutes === 0
  ) {
    parts.push(
      `${seconds} second${seconds !== 1 ? 's' : ''}`
    );
  }

  return `${parts.slice(0, 2).join(', ')} left`;
}

function getTestAvailability(
  test: StudentTest,
  nowMs: number
): TestAvailability {
  const startMs = test.start_at
    ? new Date(test.start_at).getTime()
    : null;

  const deadlineMs = test.deadline
    ? new Date(test.deadline).getTime()
    : null;

  if (
    startMs === null &&
    deadlineMs === null
  ) {
    return {
      state: 'none',
      label: 'Schedule not set',
    };
  }

  if (
    startMs !== null &&
    nowMs < startMs
  ) {
    return {
      state: 'upcoming',
      label: `Starts in ${formatCountdown(
        startMs - nowMs
      )}`,
    };
  }

  if (
    deadlineMs !== null &&
    nowMs >= deadlineMs
  ) {
    return {
      state: 'completed',
      label: 'Deadline completed',
    };
  }

  if (deadlineMs !== null) {
    return {
      state: 'active',
      label: formatCountdown(
        deadlineMs - nowMs
      ),
    };
  }

  return {
    state: 'active',
    label: 'Available now',
  };
}

/* =========================================================
   CALCULATOR
========================================================= */

function CalculatorPanel({
  onClose,
}: {
  onClose: () => void;
}) {
  const [display, setDisplay] = useState('0');
  const [expression, setExpression] = useState('');

  const buttons = [
    ['C', '⌫', '%', '÷'],
    ['7', '8', '9', '×'],
    ['4', '5', '6', '−'],
    ['1', '2', '3', '+'],
    ['0', '.', '(', ')'],
    ['='],
  ];

  const handleButton = (value: string) => {
    if (value === 'C') {
      setDisplay('0');
      setExpression('');
      return;
    }

    if (value === '⌫') {
      setDisplay(prev =>
        prev.length > 1
          ? prev.slice(0, -1)
          : '0'
      );
      return;
    }

    if (value === '=') {
      try {
        const exp = display
          .replace(/×/g, '*')
          .replace(/÷/g, '/')
          .replace(/−/g, '-')
          .replace(/%/g, '/100');

        if (
          !/^[0-9+\-*/().\s]+$/.test(exp)
        ) {
          setDisplay('Error');
          return;
        }

        const result = Function(
          `"use strict"; return (${exp})`
        )();

        if (
          typeof result !== 'number' ||
          !Number.isFinite(result)
        ) {
          setDisplay('Error');
          return;
        }

        setExpression(display);

        setDisplay(
          Number.isInteger(result)
            ? String(result)
            : String(
                Number(result.toFixed(10))
              )
        );
      } catch {
        setDisplay('Error');
      }

      return;
    }

    if (display === 'Error') {
      setDisplay(
        ['+', '−', '×', '÷'].includes(value)
          ? `0${value}`
          : value
      );
      return;
    }

    if (
      ['+', '−', '×', '÷'].includes(value)
    ) {
      setDisplay(prev => `${prev}${value}`);
      return;
    }

    if (value === '%') {
      setDisplay(prev => `${prev}%`);
      return;
    }

    if (value === '.') {
      const lastPart = display.split(
        /[+\-×÷()]/
      ).pop();

      if (lastPart?.includes('.')) {
        return;
      }
    }

    if (
      display === '0' &&
      value !== '.'
    ) {
      setDisplay(value);
    } else {
      setDisplay(prev => `${prev}${value}`);
    }
  };

  return (
    <div className="fixed right-6 top-24 z-50 w-80">
      <div className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">

        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-blue-500" />

            <span className="font-semibold text-slate-900 dark:text-white">
              Calculator
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          <div className="rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-4 text-right">

            {expression && (
              <div className="text-xs text-slate-400 mb-1 truncate">
                {expression}
              </div>
            )}

            <div className="text-2xl font-semibold text-slate-900 dark:text-white truncate">
              {display}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 px-4 pb-4">
          {buttons.flat().map(
            (button, index) => (
              <button
                key={`${button}-${index}`}
                type="button"
                onClick={() =>
                  handleButton(button)
                }
                className={`h-12 rounded-xl font-medium transition-colors ${
                  button === '='
                    ? 'col-span-4 bg-blue-600 hover:bg-blue-500 text-white'
                    : [
                        'C',
                        '⌫',
                        '%',
                        '÷',
                        '×',
                        '−',
                        '+',
                      ].includes(button)
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-600'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {button}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   TEST SESSION
========================================================= */

function TestSession({
  test,
  questions,
  attempt,
  onFinish,
}: {
  test: StudentTest;
  questions: Question[];
  attempt: TestAttempt;
  onFinish: () => void;
}) {
  const isTimed = test.is_timed !== false;

  const [answers, setAnswers] =
    useState<Record<string, string>>({});

  const [violations, setViolations] =
    useState(attempt.violation_count || 0);

  const getInitialTime = () => {
    if (!isTimed) {
      return 0;
    }

    const durationSeconds =
      (test.duration_minutes || 0) * 60;

    if (!test.deadline) {
      return durationSeconds;
    }

    const deadlineMs = new Date(
      test.deadline
    ).getTime();

    const remainingMs =
      deadlineMs - Date.now();

    if (remainingMs <= 0) {
      return 0;
    }

    return Math.min(
      durationSeconds,
      Math.floor(remainingMs / 1000)
    );
  };

  const [timeLeft, setTimeLeft] =
    useState(getInitialTime);

  const [showWarning, setShowWarning] =
    useState(false);

  const [warningMsg, setWarningMsg] =
    useState('');

  const [submitting, setSubmitting] =
    useState(false);

  const [terminated, setTerminated] =
    useState(false);

  const [showCalculator, setShowCalculator] =
    useState(false);

  const violationsRef =
    useRef(violations);

  violationsRef.current = violations;

  const timeLeftRef =
    useRef(timeLeft);

  timeLeftRef.current = timeLeft;

  const submitTest = useCallback(
    async (
      reason:
        | 'manual'
        | 'timeout'
        | 'violations'
    ) => {
      if (submitting) return;

      setSubmitting(true);

      const status =
        reason === 'violations'
          ? 'terminated'
          : 'submitted';

      const elapsed = isTimed
        ? test.duration_minutes * 60 -
          timeLeftRef.current
        : 0;

      const rows = questions.map(q => ({
        attempt_id: attempt.id,
        question_id: q.id,
        answer_text:
          answers[q.id] || null,
        selected_option:
          q.type === 'objective'
            ? answers[q.id] ?? null
            : null,
      }));

      if (rows.length) {
        await supabase
          .from('test_answers')
          .upsert(rows, {
            onConflict:
              'attempt_id,question_id',
          });
      }

      let autoScore = 0;

      for (const q of questions) {
        if (q.type === 'objective') {
          const isCorrect =
            answers[q.id] ===
            q.correct_answer;

          await supabase
            .from('test_answers')
            .update({
              marks_awarded: isCorrect
                ? q.marks
                : 0,
              is_evaluated: true,
            })
            .eq(
              'attempt_id',
              attempt.id
            )
            .eq(
              'question_id',
              q.id
            );

          if (isCorrect) {
            autoScore += q.marks;
          }
        }
      }

      const hasSubjective =
        questions.some(
          q => q.type === 'subjective'
        );

      await supabase
        .from('test_attempts')
        .update({
          status,
          submitted_at:
            new Date().toISOString(),
          violation_count:
            violationsRef.current,
          total_score: autoScore,
          max_score:
            questions.reduce(
              (sum, q) =>
                sum + q.marks,
              0
            ),
          is_evaluated:
            !hasSubjective,
          duration_seconds: elapsed,
        })
        .eq('id', attempt.id);

      if (reason === 'violations') {
        setTerminated(true);
      } else {
        onFinish();
      }
    },
    [
      attempt.id,
      answers,
      questions,
      test.duration_minutes,
      isTimed,
      submitting,
      onFinish,
    ]
  );

  useEffect(() => {
    if (!isTimed) {
      return;
    }

    const interval =
      setInterval(() => {
        setTimeLeft(current => {
          if (current <= 1) {
            clearInterval(interval);

            void submitTest(
              'timeout'
            );

            return 0;
          }

          return current - 1;
        });
      }, 1000);

    return () =>
      clearInterval(interval);
  }, [isTimed, submitTest]);

  useEffect(() => {
    if (!test.deadline) {
      return;
    }

    const deadlineMs =
      new Date(
        test.deadline
      ).getTime();

    const interval =
      setInterval(() => {
        if (
          Date.now() >=
          deadlineMs
        ) {
          if (
            !submitting
          ) {
            setTimeLeft(0);

            void submitTest(
              'timeout'
            );
          }
        }
      }, 1000);

    return () =>
      clearInterval(interval);
  }, [
    test.deadline,
    submitting,
    submitTest,
  ]);

  useEffect(() => {
    function onVisibility() {
      if (document.hidden) {
        void handleViolation(
          'Tab switch detected!'
        );
      }
    }

    function onBlur() {
      void handleViolation(
        'App switch detected!'
      );
    }

    document.addEventListener(
      'visibilitychange',
      onVisibility
    );

    window.addEventListener(
      'blur',
      onBlur
    );

    return () => {
      document.removeEventListener(
        'visibilitychange',
        onVisibility
      );

      window.removeEventListener(
        'blur',
        onBlur
      );
    };
  }, []);

  async function handleViolation(
    msg: string
  ) {
    const newV =
      violationsRef.current + 1;

    setViolations(newV);

    setWarningMsg(
      `${msg} Warning ${newV}/${test.max_violations}.`
    );

    setShowWarning(true);

    await supabase
      .from('test_attempts')
      .update({
        violation_count: newV,
      })
      .eq(
        'id',
        attempt.id
      );

    if (
      newV >=
      test.max_violations
    ) {
      setTimeout(() => {
        void submitTest(
          'violations'
        );
      }, 1500);
    }
  }

  const mins = String(
    Math.floor(timeLeft / 60)
  ).padStart(2, '0');

  const secs = String(
    timeLeft % 60
  ).padStart(2, '0');

  const isUrgent =
    isTimed &&
    timeLeft < 300;

  if (terminated) {
    return (
      <div className="test-terminated fixed inset-0 flex items-center justify-center">
        <div className="text-center px-8">

          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />

          <h2 className="test-heading text-2xl font-bold mb-2">
            Test Terminated
          </h2>

          <p className="test-muted mb-6">
            Your test was terminated due
            to exceeding the maximum
            violations.
          </p>

          <button
            onClick={onFinish}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-500"
          >
            Back to Tests
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="test-page min-h-screen flex flex-col">

      {showWarning && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-900/90 border border-red-500 rounded-xl px-6 py-3 flex items-center gap-3 shadow-2xl backdrop-blur">

          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />

          <p className="text-white text-sm font-medium">
            {warningMsg}
          </p>

          <button
            onClick={() =>
              setShowWarning(false)
            }
            className="text-red-300 hover:text-white text-xs ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {showCalculator &&
        test.has_calculator && (
          <CalculatorPanel
            onClose={() =>
              setShowCalculator(false)
            }
          />
        )}

      <div className="test-header px-6 py-4 flex items-center justify-between sticky top-0 z-40">

        <div>
          <h2 className="test-heading font-bold">
            {test.title}
          </h2>

          <p className="test-muted text-xs">
            {questions.length}{' '}
            questions ·{' '}
            {test.total_marks} marks
          </p>
        </div>

        <div className="flex items-center gap-4">

          {violations > 0 && (
            <div className="flex items-center gap-1.5 text-red-400 text-sm">
              <ShieldAlert className="w-4 h-4" />

              <span>
                {violations}/
                {test.max_violations}{' '}
                violations
              </span>
            </div>
          )}

          {test.has_calculator && (
            <button
              type="button"
              onClick={() =>
                setShowCalculator(
                  prev => !prev
                )
              }
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
                showCalculator
                  ? 'bg-blue-500/10 border-blue-500/40 text-blue-500'
                  : 'test-option'
              }`}
            >
              <Calculator className="w-4 h-4" />
              Calculator
            </button>
          )}

          {isTimed && (
            <div
              className={`flex items-center gap-2 font-mono text-lg font-bold ${
                isUrgent
                  ? 'text-red-500 animate-pulse'
                  : 'test-heading'
              }`}
            >
              <Clock className="w-5 h-5" />

              {mins}:{secs}
            </div>
          )}

          <button
            onClick={() =>
              void submitTest(
                'manual'
              )
            }
            disabled={submitting}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl flex items-center gap-2 disabled:opacity-50"
          >
            {submitting && (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}

            Submit Test
          </button>
        </div>
      </div>

      <div className="flex-1 px-6 py-8 max-w-3xl mx-auto w-full">

        <div className="space-y-8">

          {questions.map(
            (q, idx) => (
              <div
                key={q.id}
                className="test-surface border rounded-2xl p-6"
              >

                <div className="flex items-start gap-3 mb-4">

                  <span className="text-xs font-bold bg-blue-500/20 text-blue-400 px-2.5 py-1 rounded-lg flex-shrink-0">
                    Q{idx + 1}
                  </span>

                  <div className="flex-1">

                    <p className="test-heading font-medium">
                      {q.question_text}
                    </p>

                    <div className="flex gap-3 mt-1 text-xs test-subtle">

                      <span className="capitalize">
                        {q.type}
                      </span>

                      <span>
                        {q.marks}{' '}
                        mark
                        {q.marks !== 1
                          ? 's'
                          : ''}
                      </span>

                    </div>
                  </div>
                </div>

                {q.type ===
                  'objective' &&
                  q.options ? (
                  <div className="space-y-2 pl-9">

                    {(
                      q.options as {
                        label: string;
                        value: string;
                      }[]
                    ).map(
                      (
                        opt,
                        i
                      ) => {
                        const selected =
                          answers[
                            q.id
                          ] ===
                          opt.value;

                        return (
                          <label
                            key={i}
                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                              selected
                                ? 'bg-blue-500/10 border-blue-500/50'
                                : 'test-option'
                            }`}
                          >

                            <input
                              type="radio"
                              name={`question-${q.id}`}
                              value={
                                opt.value
                              }
                              checked={
                                selected
                              }
                              onChange={() =>
                                setAnswers(
                                  prev => ({
                                    ...prev,
                                    [q.id]:
                                      opt.value,
                                  })
                                )
                              }
                              className="sr-only"
                            />

                            <div
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                selected
                                  ? 'border-blue-500'
                                  : 'test-radio'
                              }`}
                            >
                              {selected && (
                                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                              )}
                            </div>

                            <span
                              className={`text-sm ${
                                selected
                                  ? 'text-blue-600 dark:text-blue-400'
                                  : 'test-option-text'
                              }`}
                            >
                              {String.fromCharCode(
                                65 + i
                              )}
                              .{' '}
                              {
                                opt.label
                              }
                            </span>

                          </label>
                        );
                      }
                    )}

                  </div>
                ) : (
                  <div className="pl-9">

                    <textarea
                      value={
                        answers[
                          q.id
                        ] || ''
                      }
                      onChange={e =>
                        setAnswers(
                          prev => ({
                            ...prev,
                            [q.id]:
                              e.target
                                .value,
                          })
                        )
                      }
                      placeholder="Type your answer here..."
                      rows={4}
                      className="test-input w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
                    />

                  </div>
                )}

              </div>
            )
          )}

        </div>

        <div className="mt-8 flex justify-end">

          <button
            onClick={() =>
              void submitTest(
                'manual'
              )
            }
            disabled={submitting}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl flex items-center gap-2 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-5 h-5" />
            )}

            Submit Test
          </button>

        </div>
      </div>
    </div>
  );
}

/* =========================================================
   STUDENT TEST PORTAL
========================================================= */

export default function StudentTests() {
  const { profile } = useAuth();

  const [tests, setTests] =
    useState<StudentTest[]>([]);

  const [attempts, setAttempts] =
    useState<TestAttempt[]>([]);

  const [
    retakeRequests,
    setRetakeRequests,
  ] = useState<any[]>([]);

  const [
    activeTest,
    setActiveTest,
  ] = useState<{
    test: StudentTest;
    questions: Question[];
    attempt: TestAttempt;
  } | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [starting, setStarting] =
    useState<string | null>(null);

  const [now, setNow] =
    useState(Date.now());

  /* =======================================================
     FILTERS
  ======================================================= */

  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>('all');

  /* =======================================================
     LIVE CLOCK
  ======================================================= */

  useEffect(() => {
    const interval =
      setInterval(() => {
        setNow(Date.now());
      }, 1000);

    return () =>
      clearInterval(interval);
  }, []);

  /* =======================================================
     LOAD
  ======================================================= */

  async function load() {
    if (!profile) return;

    setLoading(true);

    const [
      testsRes,
      attemptsRes,
      retakeRes,
    ] = await Promise.all([
      supabase
        .from('tests')
        .select(
          '*, questions(*)'
        )
        .eq(
          'is_published',
          true
        ),

      supabase
        .from('test_attempts')
        .select('*')
        .eq(
          'student_id',
          profile.id
        ),

      supabase
        .from('retake_requests')
        .select('*')
        .eq(
          'student_id',
          profile.id
        )
        .order(
          'requested_at',
          {
            ascending: false,
          }
        ),
    ]);

    if (testsRes.error) {
      console.error(
        'Unable to load tests:',
        testsRes.error
      );
    }

    if (attemptsRes.error) {
      console.error(
        'Unable to load attempts:',
        attemptsRes.error
      );
    }

    if (retakeRes.error) {
      console.error(
        'Unable to load retake requests:',
        retakeRes.error
      );
    }

    setTests(
      (testsRes.data ||
        []) as StudentTest[]
    );

    setAttempts(
      attemptsRes.data || []
    );

    setRetakeRequests(
      retakeRes.data || []
    );

    setLoading(false);
  }

  useEffect(() => {
    if (profile) {
      void load();
    }
  }, [profile]);

  /* =======================================================
     RESTORE IN-PROGRESS TEST
  ======================================================= */

  useEffect(() => {
    if (
      !tests.length ||
      !attempts.length
    ) {
      return;
    }

    const inProgress =
      attempts.find(
        a =>
          a.status ===
          'in_progress'
      );

    if (!inProgress) {
      return;
    }

    const test =
      tests.find(
        t =>
          t.id ===
          inProgress.test_id
      );

    if (!test) {
      return;
    }

    const availability =
      getTestAvailability(
        test,
        Date.now()
      );

    if (
      availability.state ===
      'completed'
    ) {
      return;
    }

    const qs = (
      test.questions || []
    )
      .filter(
        q =>
          q.type ===
          'objective' ||
          q.type ===
          'subjective'
      )
      .sort(
        (a, b) =>
          a.order_index -
          b.order_index
      );

    setActiveTest({
      test,
      questions: qs,
      attempt: inProgress,
    });
  }, [tests, attempts]);

  /* =======================================================
     REQUEST RETAKE
  ======================================================= */

  async function requestRetake(
    testId: string
  ) {
    if (!profile) {
      return;
    }

    const existing =
      retakeRequests.find(
        r =>
          r.test_id ===
            testId &&
          r.status ===
            'pending' &&
          r.used_at === null
      );

    if (existing) {
      return;
    }

    const {
      data,
      error,
    } = await supabase
      .from(
        'retake_requests'
      )
      .insert({
        test_id: testId,
        student_id:
          profile.id,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error(
        'RETAKE REQUEST ERROR:',
        error
      );

      alert(
        `Retake request failed: ${error.message}`
      );

      return;
    }

    console.log(
      'Retake request created:',
      data
    );

    await load();
  }

  /* =======================================================
     START TEST
  ======================================================= */

  async function startTest(
    test: StudentTest
  ) {
    if (!profile) {
      return;
    }

    const availability =
      getTestAvailability(
        test,
        Date.now()
      );

    if (
      availability.state ===
      'upcoming'
    ) {
      alert(
        `This test has not started yet.\n\n${availability.label}`
      );

      return;
    }

    if (
      availability.state ===
      'completed'
    ) {
      alert(
        'The submission deadline for this test has passed.'
      );

      return;
    }

    setStarting(test.id);

    try {
      const testAttempts =
        attempts.filter(
          a =>
            a.test_id ===
            test.id
        );

      const hasCompletedAttempt =
        testAttempts.some(
          a =>
            a.status ===
              'submitted' ||
            a.status ===
              'terminated'
        );

      const approvedRequest =
        retakeRequests.find(
          r =>
            r.test_id ===
              test.id &&
            r.status ===
              'approved' &&
            r.used_at === null
        );

      if (
        hasCompletedAttempt &&
        !approvedRequest
      ) {
        return;
      }

      const qs = (
        test.questions || []
      )
        .filter(
          q =>
            q.type ===
              'objective' ||
            q.type ===
              'subjective'
        )
        .sort(
          (a, b) =>
            a.order_index -
            b.order_index
        );

      if (!qs.length) {
        alert(
          'This test has no questions.'
        );

        return;
      }

      const {
        data: attempt,
        error,
      } = await supabase
        .from('test_attempts')
        .insert({
          test_id: test.id,
          student_id:
            profile.id,
          max_score:
            qs.reduce(
              (sum, q) =>
                sum + q.marks,
              0
            ),
        })
        .select()
        .single();

      if (error) {
        console.error(
          'Unable to start test:',
          error
        );

        alert(
          `Unable to start test: ${error.message}`
        );

        return;
      }

      if (
        approvedRequest
      ) {
        const {
          data: consumed,
          error:
            consumeError,
        } =
          await supabase.rpc(
            'consume_retake_request',
            {
              p_request_id:
                approvedRequest.id,
            }
          );

        if (
          consumeError ||
          !consumed
        ) {
          console.error(
            'Unable to consume retake approval:',
            consumeError
          );

          return;
        }
      }

      if (attempt) {
        setActiveTest({
          test,
          questions: qs,
          attempt,
        });
      }
    } finally {
      setStarting(null);
    }
  }

  /* =======================================================
     FILTERED TESTS
  ======================================================= */

  const filteredTests =
    useMemo(() => {
      return tests.filter(
        test => {
          const testAttempts =
            attempts.filter(
              a =>
                a.test_id ===
                test.id
            );

          const hasCompletedAttempt =
            testAttempts.some(
              a =>
                a.status ===
                  'submitted' ||
                a.status ===
                  'terminated'
            );

          const retakeRequest =
            retakeRequests.find(
              r =>
                r.test_id ===
                  test.id &&
                r.used_at ===
                  null
            );

          const hasApprovedRetake =
            retakeRequest?.status ===
            'approved';

          const availability =
            getTestAvailability(
              test,
              now
            );

          /*
           * ALL
           * Show every test.
           */
          if (
            statusFilter ===
            'all'
          ) {
            return true;
          }

          /*
           * PENDING
           *
           * 1. Tests not yet taken
           *    and deadline has not completed.
           *
           * 2. Tests currently in progress.
           *
           * 3. Tests with an approved retake.
           */
          if (
            statusFilter ===
            'pending'
          ) {
            if (
              hasApprovedRetake
            ) {
              return true;
            }

            if (
              hasCompletedAttempt
            ) {
              return false;
            }

            return (
              availability.state !==
              'completed'
            );
          }

          /*
           * COMPLETED
           *
           * Student has already taken
           * the test.
           *
           * Approved retake moves it
           * back into Pending.
           */
          if (
            statusFilter ===
            'completed'
          ) {
            if (
              hasApprovedRetake
            ) {
              return false;
            }

            return hasCompletedAttempt;
          }

          /*
           * NOT TAKEN
           *
           * Student never completed/took
           * the test AND the deadline
           * has already passed.
           */
          if (
            statusFilter ===
            'not_taken'
          ) {
            return (
              !hasCompletedAttempt &&
              !hasApprovedRetake &&
              availability.state ===
                'completed'
            );
          }

          return true;
        }
      );
    }, [
      tests,
      attempts,
      retakeRequests,
      statusFilter,
      now,
    ]);

  /* =======================================================
     ACTIVE TEST
  ======================================================= */

  if (activeTest) {
    return (
      <TestSession
        test={activeTest.test}
        questions={
          activeTest.questions
        }
        attempt={
          activeTest.attempt
        }
        onFinish={() => {
          setActiveTest(null);
          void load();
        }}
      />
    );
  }

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  /* =======================================================
     PORTAL
  ======================================================= */

  return (
    <div className="test-page p-6 lg:p-8 w-full">

      {/* HEADER */}
      <div className="mb-5">

        <h1 className="text-2xl font-bold test-heading">
          Test Portal
        </h1>

        <p className="test-muted mt-1">
          {tests.length} tests available
        </p>

      </div>

      {/* ===================================================
          FILTERS
      =================================================== */}

      <div className="mb-6 flex flex-wrap items-center gap-2">

        {[
          {
            value:
              'all' as StatusFilter,
            label: 'All',
          },
          {
            value:
              'pending' as StatusFilter,
            label: 'Pending',
          },
          {
            value:
              'completed' as StatusFilter,
            label: 'Completed',
          },
          {
            value:
              'not_taken' as StatusFilter,
            label: 'Not Taken',
          },
        ].map(filter => (
          <button
            key={
              filter.value
            }
            onClick={() =>
              setStatusFilter(
                filter.value
              )
            }
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              statusFilter ===
              filter.value
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'test-option hover:border-blue-400'
            }`}
          >
            {filter.label}
          </button>
        ))}

      </div>

      {/* ===================================================
          NO TESTS
      =================================================== */}

      {tests.length === 0 ? (
        <div className="test-muted text-center py-16">

          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />

          <p>
            No tests available yet
          </p>

        </div>
      ) : filteredTests.length === 0 ? (
        <div className="test-surface border rounded-2xl p-10 text-center">

          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30 test-muted" />

          <p className="test-heading font-medium">
            No tests in this category
          </p>

          <p className="test-muted text-sm mt-1">
            Try selecting another filter.
          </p>

          <button
            onClick={() =>
              setStatusFilter('all')
            }
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-xl"
          >
            Show All Tests
          </button>

        </div>
      ) : (

        /* =================================================
           TEST LIST
        ================================================= */

        <div className="space-y-4 w-full">

          {filteredTests.map(test => {

            const testAttempts =
              attempts
                .filter(
                  a =>
                    a.test_id ===
                    test.id
                )
                .sort(
                  (a, b) =>
                    new Date(
                      b.started_at
                    ).getTime() -
                    new Date(
                      a.started_at
                    ).getTime()
                );

            const latest =
              testAttempts[0];

            const isInProgress =
              latest?.status ===
              'in_progress';

            const hasCompletedAttempt =
              testAttempts.some(
                a =>
                  a.status ===
                    'submitted' ||
                  a.status ===
                    'terminated'
              );

            const retakeRequest =
              retakeRequests.find(
                r =>
                  r.test_id ===
                    test.id &&
                  r.used_at ===
                    null
              );

            const hasPendingRetake =
              retakeRequest?.status ===
              'pending';

            const hasApprovedRetake =
              retakeRequest?.status ===
              'approved';

            const pct =
              latest?.is_evaluated &&
              latest.max_score > 0
                ? Math.round(
                    (latest.total_score /
                      latest.max_score) *
                      100
                  )
                : null;

            const availability =
              getTestAvailability(
                test,
                now
              );

            const hasSchedule =
              Boolean(
                test.start_at ||
                  test.deadline
              );

            return (
              <div
                key={test.id}
                className="test-surface border rounded-2xl p-6 hover:border-slate-400 dark:hover:border-slate-600 transition-all w-full"
              >

                <div className="flex items-start justify-between gap-6">

                  {/* LEFT */}
                  <div className="flex-1 min-w-0">

                    <h3 className="test-heading font-semibold text-lg">
                      {test.title}
                    </h3>

                    {test.description && (
                      <p className="test-muted text-sm mt-1">
                        {test.description}
                      </p>
                    )}

                    {/* INFO */}
                    <div className="flex flex-wrap gap-4 mt-3 text-xs test-muted">

                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />

                        {test.is_timed === false
                          ? 'Untimed'
                          : `${test.duration_minutes} min`}
                      </span>

                      <span>
                        {
                          (
                            test.questions ||
                            []
                          ).length
                        }{' '}
                        questions
                      </span>

                      <span>
                        {test.total_marks}{' '}
                        marks
                      </span>

                      <span className="text-red-400">
                        Max{' '}
                        {test.max_violations}{' '}
                        violations
                      </span>

                    </div>

                    {/* SCHEDULE */}
                    {hasSchedule ? (
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">

                        {test.start_at && (
                          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border test-option">

                            <CalendarDays className="w-4 h-4 text-blue-500 flex-shrink-0" />

                            <div>
                              <p className="text-xs test-muted">
                                Start
                              </p>

                              <p className="text-sm test-heading font-medium">
                                {formatDateTime(
                                  test.start_at
                                )}
                              </p>
                            </div>

                          </div>
                        )}

                        {test.deadline && (
                          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border test-option">

                            <CalendarDays className="w-4 h-4 text-red-500 flex-shrink-0" />

                            <div>
                              <p className="text-xs test-muted">
                                End
                              </p>

                              <p className="text-sm test-heading font-medium">
                                {formatDateTime(
                                  test.deadline
                                )}
                              </p>
                            </div>

                          </div>
                        )}

                      </div>
                    ) : (
                      <div className="mt-4 flex items-center gap-2 text-sm test-muted">

                        <CalendarDays className="w-4 h-4" />

                        Schedule not set

                      </div>
                    )}

                    {/* ATTEMPTS */}
                    {testAttempts.length >
                      0 && (
                      <div className="flex flex-wrap gap-2 mt-4">

                        {testAttempts.map(
                          (a, i) => (
                            <span
                              key={a.id}
                              className={`text-xs px-2.5 py-1 rounded-lg border ${
                                a.status ===
                                'terminated'
                                  ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                  : a.is_evaluated
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : a.status ===
                                    'submitted'
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                  : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              }`}
                            >
                              Attempt{' '}
                              {i + 1}:{' '}
                              {a.status ===
                              'terminated'
                                ? 'Terminated'
                                : a.is_evaluated
                                ? `${Math.round(
                                    (a.total_score /
                                      a.max_score) *
                                      100
                                  )}%`
                                : a.status ===
                                  'submitted'
                                ? 'Pending eval'
                                : 'In Progress'}
                            </span>
                          )
                        )}

                      </div>
                    )}

                  </div>

                  {/* RIGHT */}
                  <div className="flex flex-col items-end gap-3 flex-shrink-0">

                    {/* SCORE */}
                    {pct !== null && (
                      <div
                        className={`text-2xl font-bold ${
                          pct >= 70
                            ? 'text-emerald-400'
                            : pct >= 40
                            ? 'text-amber-400'
                            : 'text-red-400'
                        }`}
                      >
                        {pct}%
                      </div>
                    )}

                    {/* COUNTDOWN */}
                    <div className="text-right min-w-[170px]">

                      <p className="text-xs test-muted mb-1">
                        {availability.state ===
                        'completed'
                          ? 'Status'
                          : 'Time remaining'}
                      </p>

                      <p
                        className={`text-sm font-semibold ${
                          availability.state ===
                          'completed'
                            ? 'test-muted'
                            : availability.state ===
                              'active'
                            ? 'text-emerald-500'
                            : 'text-amber-500'
                        }`}
                      >
                        {availability.label}
                      </p>

                    </div>

                    {/* BUTTON */}
                    {isInProgress ? (
                      <button
                        onClick={() => {
                          const qs = (
                            test.questions ||
                            []
                          )
                            .filter(
                              q =>
                                q.type ===
                                  'objective' ||
                                q.type ===
                                  'subjective'
                            )
                            .sort(
                              (a, b) =>
                                a.order_index -
                                b.order_index
                            );

                          setActiveTest({
                            test,
                            questions: qs,
                            attempt:
                              latest,
                          });
                        }}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-xl flex items-center gap-2"
                      >
                        <ChevronRight className="w-4 h-4" />

                        Resume
                      </button>
                    ) : !hasCompletedAttempt ? (
                      <button
                        onClick={() =>
                          void startTest(
                            test
                          )
                        }
                        disabled={
                          starting ===
                            test.id ||
                          availability.state ===
                            'upcoming' ||
                          availability.state ===
                            'completed'
                        }
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl flex items-center gap-2"
                      >
                        {starting ===
                        test.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}

                        {availability.state ===
                        'upcoming'
                          ? 'Not Started'
                          : availability.state ===
                            'completed'
                          ? 'Deadline Passed'
                          : 'Start Test'}
                      </button>
                    ) : hasApprovedRetake ? (
                      <button
                        onClick={() =>
                          void startTest(
                            test
                          )
                        }
                        disabled={
                          starting ===
                            test.id ||
                          availability.state !==
                            'active'
                        }
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl flex items-center gap-2"
                      >
                        {starting ===
                        test.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}

                        Retake Test
                      </button>
                    ) : hasPendingRetake ? (
                      <button
                        disabled
                        className="px-4 py-2 bg-slate-400 text-white text-sm font-medium rounded-xl opacity-70 cursor-not-allowed"
                      >
                        Retake Requested
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          void requestRetake(
                            test.id
                          )
                        }
                        disabled={
                          availability.state ===
                          'completed'
                        }
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl"
                      >
                        Request Retake
                      </button>
                    )}

                  </div>
                </div>
              </div>
            );
          })}

        </div>
      )}

    </div>
  );
}