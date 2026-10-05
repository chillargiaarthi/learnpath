import { useEffect, useState } from 'react';
import { Check, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface RetakeRequest {
  id: string;
  test_id: string;
  student_id: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  used_at: string | null;

  test?: {
    title: string;
    start_at: string | null;
    deadline: string | null;
    is_published: boolean;
    total_marks: number | null;
  };

  student?: {
    full_name: string;
    email: string;
  };

  previousAttempts?: number;
  lastAttemptPercentage?: number | null;
}

type FilterType =
  | 'all'
  | 'pending'
  | 'rejected'
  | 'approved';

export default function RetakeRequests() {
  const { profile } = useAuth();

  const [requests, setRequests] = useState<RetakeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] =
    useState<FilterType>('all');

  const [currentTime, setCurrentTime] =
    useState(Date.now());

  // --------------------------------------------------
  // UPDATE CLOCK EVERY 30 SECONDS
  // --------------------------------------------------
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // --------------------------------------------------
  // LOAD REQUESTS
  // --------------------------------------------------
  async function loadRequests() {
    if (!profile) return;

    setLoading(true);

    // --------------------------------------------------
    // 1. LOAD GUIDE'S TESTS
    // --------------------------------------------------
    const { data: tests, error: testsError } =
      await supabase
        .from('tests')
        .select(
          'id, title, start_at, deadline, is_published, total_marks'
        )
        .eq('mentor_id', profile.id);

    if (testsError) {
      console.error(
        'Failed to load guide tests:',
        testsError
      );

      setRequests([]);
      setLoading(false);
      return;
    }

    const testIds = (tests || []).map(
      test => test.id
    );

    if (testIds.length === 0) {
      setRequests([]);
      setLoading(false);
      return;
    }

    // --------------------------------------------------
    // 2. LOAD ALL RETAKE REQUESTS
    // --------------------------------------------------
    const { data: requestData, error: requestError } =
      await supabase
        .from('retake_requests')
        .select('*')
        .in('test_id', testIds)
        .order('requested_at', {
          ascending: false,
        });

    if (requestError) {
      console.error(
        'Failed to load retake requests:',
        requestError
      );

      setRequests([]);
      setLoading(false);
      return;
    }

    if (!requestData || requestData.length === 0) {
      setRequests([]);
      setLoading(false);
      return;
    }

    // --------------------------------------------------
    // 3. GET STUDENT IDS
    // --------------------------------------------------
    const studentIds = [
      ...new Set(
        requestData.map(
          request => request.student_id
        )
      ),
    ];

    // --------------------------------------------------
    // 4. LOAD STUDENTS
    // --------------------------------------------------
    let students: any[] = [];

    if (studentIds.length > 0) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', studentIds);

      if (error) {
        console.error(
          'Failed to load students:',
          error
        );
      }

      students = data || [];
    }

    // --------------------------------------------------
    // 5. LOAD PREVIOUS ATTEMPTS
    // --------------------------------------------------
    let attemptsData: any[] = [];

    if (studentIds.length > 0) {
      const { data, error } = await supabase
        .from('test_attempts')
        .select(
          'id, test_id, student_id, total_score, max_score, status, submitted_at'
        )
        .in('test_id', testIds)
        .in('student_id', studentIds)
        .in('status', [
          'submitted',
          'terminated',
        ]);

      if (error) {
        console.error(
          'Failed to load previous attempts:',
          error
        );
      }

      attemptsData = data || [];
    }

    // --------------------------------------------------
    // IMPORTANT FILTERING LOGIC
    //
    // For each Student + Test + Status:
    // keep only the latest request.
    //
    // This allows:
    //
    // Accepted once + Rejected once
    // -> appears in both filters.
    //
    // Accepted twice
    // -> only latest Accepted.
    //
    // Rejected twice
    // -> only latest Rejected.
    // --------------------------------------------------
    const latestByStudentTestStatus =
      new Map<string, any>();

    for (const request of requestData) {
      const key =
        `${request.student_id}_` +
        `${request.test_id}_` +
        `${request.status}`;

      if (
        !latestByStudentTestStatus.has(key)
      ) {
        latestByStudentTestStatus.set(
          key,
          request
        );
      }
    }

    // --------------------------------------------------
    // 6. FORMAT REQUESTS
    // --------------------------------------------------
    const formattedRequests: RetakeRequest[] =
      Array.from(
        latestByStudentTestStatus.values()
      ).map(request => {
        const test = (tests || []).find(
          test => test.id === request.test_id
        );

        const student = students.find(
          student =>
            student.id === request.student_id
        );

        // All previous completed attempts
        const previousAttempts =
          attemptsData.filter(
            attempt =>
              attempt.test_id ===
                request.test_id &&
              attempt.student_id ===
                request.student_id
          );

        // Sort latest attempt first
        const sortedAttempts = [
          ...previousAttempts,
        ].sort((a, b) => {
          const dateA = a.submitted_at
            ? new Date(
                a.submitted_at
              ).getTime()
            : 0;

          const dateB = b.submitted_at
            ? new Date(
                b.submitted_at
              ).getTime()
            : 0;

          return dateB - dateA;
        });

        // --------------------------------------------------
        // LAST ATTEMPT PERCENTAGE
        // --------------------------------------------------
        const lastAttempt =
          sortedAttempts[0];

        let lastAttemptPercentage:
          | number
          | null = null;

        if (
          lastAttempt &&
          lastAttempt.total_score !==
            null &&
          lastAttempt.total_score !==
            undefined &&
          lastAttempt.max_score !== null &&
          lastAttempt.max_score !==
            undefined &&
          Number(lastAttempt.max_score) > 0
        ) {
          lastAttemptPercentage =
            (Number(
              lastAttempt.total_score
            ) /
              Number(
                lastAttempt.max_score
              )) *
            100;
        }

        return {
          ...request,

          test: test
            ? {
                title: test.title,
                start_at: test.start_at,
                deadline: test.deadline,
                is_published:
                  test.is_published,
                total_marks:
                  test.total_marks,
              }
            : undefined,

          student: student
            ? {
                full_name:
                  student.full_name,
                email: student.email,
              }
            : undefined,

          previousAttempts:
            previousAttempts.length,

          lastAttemptPercentage,
        };
      });

    setRequests(formattedRequests);
    setLoading(false);
  }

  // --------------------------------------------------
  // INITIAL LOAD
  // --------------------------------------------------
  useEffect(() => {
    if (profile) {
      loadRequests();
    }
  }, [profile]);

  // --------------------------------------------------
  // APPROVE / REJECT
  // --------------------------------------------------
  async function updateStatus(
    requestId: string,
    status: 'approved' | 'rejected'
  ) {
    setActionId(requestId);

    const { error } = await supabase
      .from('retake_requests')
      .update({ status })
      .eq('id', requestId)
      .eq('status', 'pending');

    if (error) {
      console.error(
        'Failed to update retake request:',
        error
      );

      alert(
        `Failed to ${
          status === 'approved'
            ? 'approve'
            : 'reject'
        } retake request: ${
          error.message
        }`
      );

      setActionId(null);
      return;
    }

    // Reload so the filtering logic stays correct
    await loadRequests();

    setActionId(null);
  }

  // --------------------------------------------------
  // FORMAT COUNTDOWN
  // --------------------------------------------------
  function formatCountdown(
    milliseconds: number
  ) {
    if (milliseconds <= 0) {
      return '0m';
    }

    const totalMinutes = Math.floor(
      milliseconds / 60000
    );

    const days = Math.floor(
      totalMinutes / 1440
    );

    const hours = Math.floor(
      (totalMinutes % 1440) / 60
    );

    const minutes = totalMinutes % 60;

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    }

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }

    return `${minutes}m`;
  }

  // --------------------------------------------------
  // TEST STATUS + COUNTDOWN
  // --------------------------------------------------
  function getTestStatus(
    test?: RetakeRequest['test']
  ) {
    if (!test) {
      return {
        label: 'Unknown',
        className:
          'bg-gray-500/10 text-gray-500',
      };
    }

    if (!test.is_published) {
      return {
        label: 'Draft',
        className:
          'bg-gray-500/10 text-gray-500',
      };
    }

    const now = currentTime;

    const start = test.start_at
      ? new Date(
          test.start_at
        ).getTime()
      : null;

    const end = test.deadline
      ? new Date(
          test.deadline
        ).getTime()
      : null;

    // --------------------------------------------------
    // SCHEDULED
    // --------------------------------------------------
    if (
      start !== null &&
      now < start
    ) {
      return {
        label: `Scheduled · ${formatCountdown(
          start - now
        )}`,
        className:
          'bg-sky-500/10 text-sky-500',
      };
    }

    // --------------------------------------------------
    // CLOSED
    // --------------------------------------------------
    if (
      end !== null &&
      now > end
    ) {
      return {
        label: 'Closed',
        className:
          'bg-red-500/10 text-red-500',
      };
    }

    // --------------------------------------------------
    // ACTIVE
    // --------------------------------------------------
    if (
      end !== null &&
      now <= end
    ) {
      return {
        label: `Active · ${formatCountdown(
          end - now
        )} left`,
        className:
          'bg-emerald-500/10 text-emerald-500',
      };
    }

    return {
      label: 'Active',
      className:
        'bg-emerald-500/10 text-emerald-500',
    };
  }

  // --------------------------------------------------
  // DATE / TIME FORMAT
  // --------------------------------------------------
  function formatDateTime(
    value:
      | string
      | null
      | undefined
  ) {
    if (!value) {
      return 'Not set';
    }

    return new Date(value).toLocaleString(
      undefined,
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }
    );
  }

  // --------------------------------------------------
  // PENDING COUNT
  // --------------------------------------------------
  const pendingCount =
    requests.filter(
      request =>
        request.status === 'pending'
    ).length;

  // --------------------------------------------------
  // FILTER LOGIC
  //
  // All:
  // One Student + Test only.
  //
  // Specific status:
  // One Student + Test + Status only.
  // --------------------------------------------------
  let filteredRequests: RetakeRequest[] = [];

  if (statusFilter === 'all') {
    const latestAll =
      new Map<string, RetakeRequest>();

    // requests are already latest-first
    for (const request of requests) {
      const key =
        `${request.student_id}_` +
        `${request.test_id}`;

      if (!latestAll.has(key)) {
        latestAll.set(key, request);
      }
    }

    filteredRequests =
      Array.from(latestAll.values());
  } else {
    filteredRequests =
      requests.filter(
        request =>
          request.status ===
          statusFilter
      );
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
          Retake Requests
        </h1>

        <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">
          Review student requests for another test attempt.
        </p>
      </div>

      {/* FILTERS */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {[
          {
            value: 'all' as const,
            label: 'All',
          },
          {
            value: 'pending' as const,
            label: 'Pending Requests',
          },
          {
            value: 'rejected' as const,
            label: 'Rejected Requests',
          },
          {
            value: 'approved' as const,
            label: 'Accepted Requests',
          },
        ].map(filter => (
          <button
            key={filter.value}
            type="button"
            onClick={() =>
              setStatusFilter(
                filter.value
              )
            }
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              statusFilter ===
              filter.value
                ? 'bg-sky-500 text-white'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>


{/* FILTER NOTE */}
{statusFilter !== 'pending' && (
  <div className="mb-5 flex items-start gap-2 rounded-xl bg-sky-500/5 border border-sky-500/10 px-4 py-3">
    <span className="text-sky-500 text-sm">ℹ</span>

    <p className="text-xs text-gray-500 dark:text-slate-400">
      {statusFilter === 'all'
        ? 'The latest request for each test is shown.'
        : statusFilter === 'rejected'
          ? 'The latest rejected request for each test is shown.'
          : 'The latest accepted request for each test is shown.'}
    </p>
  </div>
)}
      {/* PENDING COUNT */}
      {pendingCount > 0 && (
        <div className="mb-5">
          <span className="px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-500 text-sm font-medium">
            {pendingCount} Pending
          </span>
        </div>
      )}

      {/* EMPTY */}
      {filteredRequests.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-500 dark:text-slate-500 text-sm">
            {statusFilter === 'all'
              ? 'No retake requests yet.'
              : 'No requests found for this filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">

          {filteredRequests.map(
            request => {
              const testStatus =
                getTestStatus(
                  request.test
                );

              return (
                <div
                  key={request.id}
                  className="card p-5"
                >

                  {/* STUDENT + TEST + ACTIONS */}
                  <div className="flex items-start justify-between gap-4">

                    <div className="flex-1 min-w-0">

                      <div className="flex items-center gap-3 mb-1 flex-wrap">

                        <h3 className="text-slate-900 dark:text-white font-medium">
                          {request.student
                            ?.full_name ||
                            'Unknown Student'}
                        </h3>

                        {/* REQUEST STATUS */}
                        <span
                          className={`text-xs px-2 py-1 rounded-lg ${
                            request.status ===
                            'pending'
                              ? 'bg-amber-500/10 text-amber-500'
                              : request.status ===
                                'approved'
                                ? 'bg-emerald-500/10 text-emerald-500'
                                : 'bg-red-500/10 text-red-500'
                          }`}
                        >
                          {request.status ===
                          'approved'
                            ? 'Accepted'
                            : request.status
                                .charAt(0)
                                .toUpperCase() +
                              request.status.slice(
                                1
                              )}
                        </span>

                      </div>

                      {/* TEST */}
                      <p className="text-gray-600 dark:text-slate-300 text-sm">
                        {request.test
                          ?.title ||
                          'Unknown Test'}
                      </p>

                      {/* REQUESTED */}
                      <p className="text-gray-400 dark:text-slate-500 text-xs mt-1">
                        Requested{' '}
                        {new Date(
                          request.requested_at
                        ).toLocaleString()}
                      </p>

                    </div>

                    {/* ACTIONS */}
                    {request.status ===
                      'pending' && (
                      <div className="flex items-center gap-2 flex-shrink-0">

                        <button
                          type="button"
                          onClick={() =>
                            updateStatus(
                              request.id,
                              'rejected'
                            )
                          }
                          disabled={
                            actionId ===
                            request.id
                          }
                          className="px-3 py-2 rounded-xl border border-red-200 dark:border-red-500/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 text-sm flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {actionId ===
                          request.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}

                          Reject
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            updateStatus(
                              request.id,
                              'approved'
                            )
                          }
                          disabled={
                            actionId ===
                            request.id
                          }
                          className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {actionId ===
                          request.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}

                          Approve
                        </button>

                      </div>
                    )}

                  </div>

                  {/* TEST DETAILS */}
                  <div className="mt-5 pt-4 border-t border-gray-100 dark:border-slate-700/50">

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

                      {/* START */}
                      <div className="bg-gray-50 dark:bg-slate-900/50 rounded-xl px-4 py-3">

                        <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">
                          Test Start
                        </p>

                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                          {formatDateTime(
                            request.test
                              ?.start_at
                          )}
                        </p>

                      </div>

                      {/* END */}
                      <div className="bg-gray-50 dark:bg-slate-900/50 rounded-xl px-4 py-3">

                        <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">
                          Test End / Deadline
                        </p>

                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                          {formatDateTime(
                            request.test
                              ?.deadline
                          )}
                        </p>

                      </div>

                      {/* STATUS */}
                      <div className="bg-gray-50 dark:bg-slate-900/50 rounded-xl px-4 py-3">

                        <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">
                          Test Status
                        </p>

                        <span
                          className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium ${testStatus.className}`}
                        >
                          {testStatus.label}
                        </span>

                      </div>

                    </div>

                  </div>

                  {/* ATTEMPTS + LAST PERCENTAGE */}
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700/50">

                    <div className="flex items-center gap-8 flex-wrap">

                      {/* PREVIOUS ATTEMPTS */}
                      <div>

                        <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">
                          Previous Attempts
                        </p>

                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {request.previousAttempts ||
                            0}
                        </p>

                      </div>

                      {/* LAST ATTEMPT PERCENTAGE */}
                      <div>

                        <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">
                          Last Attempt
                        </p>

                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {request.lastAttemptPercentage !==
                            null &&
                          request.lastAttemptPercentage !==
                            undefined
                            ? `${request.lastAttemptPercentage.toFixed(
                                1
                              )}%`
                            : 'No previous score'}
                        </p>

                      </div>

                    </div>

                  </div>

                </div>
              );
            }
          )}

        </div>
      )}

    </div>
  );
}