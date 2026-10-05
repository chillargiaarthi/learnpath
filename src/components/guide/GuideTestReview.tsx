
import { useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  Star,
  Clock,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Student {
  id: string;
  full_name: string;
  email: string;
}

interface ReviewAttempt {
  id: string;
  test_id: string;
  student_id: string;
  status: 'submitted' | 'terminated' | string;
  submitted_at: string | null;
  duration_seconds: number | null;
  violation_count: number;
  total_score: number;
  max_score: number;
  is_evaluated: boolean;
}

interface TestInfo {
  id: string;
  title: string;
  total_marks: number;
  mentor_id: string;
}

interface GroupedTest {
  test: TestInfo;
  student: Student;
  attempts: ReviewAttempt[];
}

export default function GuideTestReview({
  selectedStudentId,
}: {
  selectedStudentId?: string | null;
}) {
  const { profile } = useAuth();
const draftKey = profile
  ? `learnpath_guide_test_draft_${profile.id}`
  : TEST_DRAFT_KEY;
  const [attempts, setAttempts] = useState<ReviewAttempt[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [tests, setTests] = useState<TestInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedStudent, setSelectedStudent] =
    useState<string>(selectedStudentId || 'all');

  // --------------------------------------------------
  // LOAD DATA
  // --------------------------------------------------
  async function load() {
    if (!profile) return;

    setLoading(true);

    const { data: testData, error: testError } =
      await supabase
        .from('tests')
        .select('id, title, total_marks, mentor_id')
        .eq('mentor_id', profile.id);

    if (testError) {
      console.error('Failed to load tests:', testError);

      setTests([]);
      setAttempts([]);
      setStudents([]);
      setLoading(false);
      return;
    }

    const guideTests = (testData || []) as TestInfo[];
    setTests(guideTests);

    const testIds = guideTests.map(test => test.id);

    if (testIds.length === 0) {
      setAttempts([]);
      setStudents([]);
      setLoading(false);
      return;
    }

    const {
      data: attemptData,
      error: attemptError,
    } = await supabase
      .from('test_attempts')
      .select(
        'id, test_id, student_id, status, submitted_at, duration_seconds, violation_count, total_score, max_score, is_evaluated'
      )
      .in('test_id', testIds)
      .in('status', ['submitted', 'terminated'])
      .order('submitted_at', { ascending: false });

    if (attemptError) {
      console.error('Failed to load attempts:', attemptError);

      setAttempts([]);
      setStudents([]);
      setLoading(false);
      return;
    }

    const loadedAttempts = (attemptData || []) as ReviewAttempt[];
    setAttempts(loadedAttempts);

    const studentIds = [
      ...new Set(loadedAttempts.map(attempt => attempt.student_id)),
    ];

    if (studentIds.length === 0) {
      setStudents([]);
      setLoading(false);
      return;
    }

    const {
      data: studentData,
      error: studentError,
    } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', studentIds)
      .order('full_name', { ascending: true });

    if (studentError) {
      console.error('Failed to load students:', studentError);
      setStudents([]);
    } else {
      setStudents((studentData || []) as Student[]);
    }

    setLoading(false);
  }

  // --------------------------------------------------
  // INITIAL LOAD
  // --------------------------------------------------
  useEffect(() => {
    if (profile) {
      load();
    }
  }, [profile]);

  // --------------------------------------------------
  // SYNC EXTERNAL STUDENT SELECTION
  // --------------------------------------------------
  useEffect(() => {
    if (selectedStudentId) {
      setSelectedStudent(selectedStudentId);
    }
  }, [selectedStudentId]);

  // --------------------------------------------------
  // GROUP STUDENT + TEST ATTEMPTS
  // --------------------------------------------------
  const groupedTests = useMemo(() => {
    const groups = new Map<string, GroupedTest>();

    const filteredAttempts =
      selectedStudent === 'all'
        ? attempts
        : attempts.filter(
            attempt => attempt.student_id === selectedStudent
          );

    for (const attempt of filteredAttempts) {
      const test = tests.find(test => test.id === attempt.test_id);

      const student = students.find(
        student => student.id === attempt.student_id
      );

      if (!test || !student) continue;

      const key = `${student.id}_${test.id}`;

      if (!groups.has(key)) {
        groups.set(key, {
          test,
          student,
          attempts: [],
        });
      }

      groups.get(key)!.attempts.push(attempt);
    }

    // Oldest attempt first.
    for (const group of groups.values()) {
      group.attempts.sort((a, b) => {
        const dateA = a.submitted_at
          ? new Date(a.submitted_at).getTime()
          : 0;

        const dateB = b.submitted_at
          ? new Date(b.submitted_at).getTime()
          : 0;

        return dateA - dateB;
      });
    }

    // Tests with the latest submission appear first.
    return Array.from(groups.values()).sort((a, b) => {
      const latestA =
        a.attempts[a.attempts.length - 1]?.submitted_at;

      const latestB =
        b.attempts[b.attempts.length - 1]?.submitted_at;

      const timeA = latestA ? new Date(latestA).getTime() : 0;
      const timeB = latestB ? new Date(latestB).getTime() : 0;

      return timeB - timeA;
    });
  }, [attempts, tests, students, selectedStudent]);

  // --------------------------------------------------
  // FORMAT DURATION
  // --------------------------------------------------
  function formatDuration(
    seconds: number | null | undefined
  ) {
    if (seconds === null || seconds === undefined) {
      return 'N/A';
    }

    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;

    return `${mins}m ${secs}s`;
  }

  // --------------------------------------------------
  // FORMAT DATE
  // --------------------------------------------------
  function formatDate(
    value: string | null | undefined
  ) {
    if (!value) return 'N/A';

    return new Date(value).toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------
  if (loading) {
    return (
      <div className="w-full p-6 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
        </div>
      </div>
    );
  }

  // --------------------------------------------------
  // PAGE
  // --------------------------------------------------
  return (
    <div className="w-full p-6 lg:p-8">
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Review Submissions
        </h1>

        <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">
          Review student test submissions and previous attempts.
        </p>
      </div>

      {/* STUDENT FILTER */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Select Student
        </label>

        <select
          value={selectedStudent}
          onChange={event => setSelectedStudent(event.target.value)}
          className="w-full sm:max-w-md px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
        >
          <option value="all">All Students</option>

          {students.map(student => (
            <option key={student.id} value={student.id}>
              {student.full_name}
              
            </option>
          ))}
        </select>
      </div>

      {/* NO SUBMISSIONS */}
      {groupedTests.length === 0 ? (
        <div className="card p-12 text-center">
          <Star className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />

          <p className="text-slate-900 dark:text-white font-medium">
            No submissions found
          </p>

          <p className="text-gray-400 dark:text-slate-500 text-sm mt-1">
            Select another student or wait for test submissions.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedTests.map(group => {
            const {
              test,
              student,
              attempts: testAttempts,
            } = group;

            const latestAttempt =
              testAttempts[testAttempts.length - 1];

            const latestPercentage =
              latestAttempt && latestAttempt.max_score > 0
                ? (Number(latestAttempt.total_score) /
                    Number(latestAttempt.max_score)) *
                  100
                : 0;

            return (
              <div
                key={`${student.id}_${test.id}`}
                className="card overflow-hidden"
              >
                {/* TEST HEADER */}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* STUDENT */}
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sky-400 to-emerald-400 flex items-center justify-center text-white text-xs font-bold">
                          {student.full_name?.charAt(0).toUpperCase()}
                        </div>

                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                          {student.full_name}
                        </span>
                      </div>

                      {/* TEST */}
                      <h2 className="text-base font-semibold text-sky-500">
                        {test.title}
                      </h2>

                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                        {testAttempts.length}{' '}
                        {testAttempts.length === 1 ? 'attempt' : 'attempts'}
                      </p>
                    </div>

                    {/* LATEST SCORE */}
                    {latestAttempt && (
                      <div className="text-right flex-shrink-0">
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {latestPercentage.toFixed(1)}%
                        </p>

                        <p className="text-xs text-gray-400 dark:text-slate-500">
                          Latest
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* ALL ATTEMPTS — STATIC ROWS */}
                <div className="border-t border-gray-100 dark:border-slate-700/50">
                  {testAttempts.map((attempt, attemptIndex) => {
                    const percentage =
                      attempt.max_score > 0
                        ? (Number(attempt.total_score) /
                            Number(attempt.max_score)) *
                          100
                        : 0;

                    const attemptLabel =
                      attemptIndex === 0
                        ? 'Attempt 1'
                        : `Attempt ${attemptIndex + 1}`;

                    return (
                      <div
                        key={attempt.id}
                        className="border-b last:border-b-0 border-gray-100 dark:border-slate-700/50"
                      >
                        {/* NORMAL, NON-CLICKABLE ROW */}
                        <div className="w-full p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-lg bg-sky-500/10 text-sky-500 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                {attemptIndex + 1}
                              </div>

                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-900 dark:text-white">
                                  {attemptLabel}
                                </p>

                                <div className="flex items-center gap-3 mt-1 flex-wrap">
                                  {/* DURATION */}
                                  <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-slate-500">
                                    <Clock className="w-3 h-3" />
                                    {formatDuration(attempt.duration_seconds)}
                                  </span>

                                  {/* DATE */}
                                  <span className="text-xs text-gray-400 dark:text-slate-500">
                                    {formatDate(attempt.submitted_at)}
                                  </span>

                                  {/* SUBMISSION STATUS */}
                                  <span
                                    className={`text-xs ${
                                      attempt.status === 'terminated'
                                        ? 'text-red-500'
                                        : 'text-slate-500 dark:text-slate-400'
                                    }`}
                                  >
                                    {attempt.status === 'terminated'
                                      ? 'Terminated'
                                      : 'Submitted'}
                                  </span>

                                  {/* EVALUATION STATUS */}
                                  <span
                                    className={`text-xs ${
                                      attempt.is_evaluated
                                        ? 'text-emerald-500'
                                        : 'text-amber-500'
                                    }`}
                                  >
                                    {attempt.is_evaluated
                                      ? 'Evaluated'
                                      : 'Not evaluated'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* SCORE */}
                            <div className="flex-shrink-0 text-right">
                              <p
                                className={`text-base font-bold ${
                                  percentage >= 70
                                    ? 'text-emerald-500'
                                    : percentage >= 40
                                      ? 'text-amber-500'
                                      : 'text-red-500'
                                }`}
                              >
                                {percentage.toFixed(1)}%
                              </p>

                              <p className="text-xs text-gray-400 dark:text-slate-500">
                                {attempt.total_score}/{attempt.max_score}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}