import { useCallback, useEffect, useState } from 'react';
import {
  Check,
  X,
  Clock,
  Calendar,
  User,
  FileText,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  MessageSquare,
} from 'lucide-react';

import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ExtensionRequest } from '../../lib/types';

type RequestStatus = 'all' | 'pending' | 'approved' | 'rejected';

interface ExtensionRequestItem extends ExtensionRequest {
  task?: {
    id: string;
    title: string;
    deadline: string | null;
    mentor_id: string;
    student_id: string;
  } | null;
  student?: {
    id: string;
    full_name: string | null;
    email?: string | null;
  } | null;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return 'Not set';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Not set';
  }

  return date.toLocaleString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusClasses(status: string) {
  switch (status) {
    case 'approved':
      return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';

    case 'rejected':
      return 'bg-red-500/10 text-red-500 border-red-500/20';

    default:
      return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
  }
}

export default function GuideExtensionRequests({
  selectedStudentId,
}: {
  selectedStudentId?: string | null;
}) {
  const { profile } = useAuth();

  const [requests, setRequests] = useState<ExtensionRequestItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<RequestStatus>('pending');
  const [expandedRequests, setExpandedRequests] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadRequests = useCallback(async () => {
    if (!profile) {
      setRequests([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error: fetchError } = await supabase
        .from('extension_requests')
        .select(`
          *,
          task:tasks!extension_requests_task_id_fkey (
            id,
            title,
            deadline,
            mentor_id,
            student_id
          ),
          student:profiles!extension_requests_student_id_fkey (
            id,
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      const guideRequests = ((data || []) as unknown as ExtensionRequestItem[])
        .filter((request) => request.task?.mentor_id === profile.id)
        .filter((request) => {
          if (!selectedStudentId) {
            return true;
          }

          return (
            request.student_id === selectedStudentId ||
            request.task?.student_id === selectedStudentId
          );
        });

      setRequests(guideRequests);
    } catch (err: any) {
      console.error('Failed to load extension requests:', err);
      setError(err?.message || 'Failed to load extension requests.');
    } finally {
      setLoading(false);
    }
  }, [profile, selectedStudentId]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const toggleExpanded = (requestId: string) => {
    setExpandedRequests((previous) =>
      previous.includes(requestId)
        ? previous.filter((id) => id !== requestId)
        : [...previous, requestId]
    );
  };

  async function handleApprove(request: ExtensionRequestItem) {
    if (!profile || !request.task) {
      setError('Unable to identify the task for this request.');
      return;
    }

    const requestId = request.id;
    const taskId = request.task.id;

    setProcessingId(requestId);
    setError('');
    setSuccessMessage('');

    try {
      const requestedDeadline = (request as any).requested_deadline;
      const requestedExtension = (request as any).requested_extension;
      const extensionDays = Number(requestedExtension);

      let newDeadline: string | null = null;

      if (requestedDeadline) {
        const parsedDeadline = new Date(requestedDeadline);

        if (Number.isNaN(parsedDeadline.getTime())) {
          throw new Error('The requested deadline is invalid.');
        }

        newDeadline = parsedDeadline.toISOString();
      } else if (
        Number.isFinite(extensionDays) &&
        extensionDays > 0 &&
        request.task.deadline
      ) {
        const oldDeadline = new Date(request.task.deadline);

        if (Number.isNaN(oldDeadline.getTime())) {
          throw new Error('The current task deadline is invalid.');
        }

        oldDeadline.setDate(
          oldDeadline.getDate() + extensionDays
        );

        newDeadline = oldDeadline.toISOString();
      }

      if (!newDeadline) {
        throw new Error(
          'No valid requested deadline or extension duration was found.'
        );
      }

      const { error: taskError } = await supabase
        .from('tasks')
        .update({ deadline: newDeadline })
        .eq('id', taskId)
        .eq('mentor_id', profile.id);

      if (taskError) {
        throw taskError;
      }

      const { error: requestError } = await supabase
        .from('extension_requests')
        .update({ status: 'approved' })
        .eq('id', requestId);

      if (requestError) {
        throw requestError;
      }

      const studentId =
        request.student_id || request.task.student_id;

      if (studentId) {
        const { error: notificationError } = await supabase
          .from('notifications')
          .insert({
            user_id: studentId,
            title: 'Extension Request Approved',
            message: `Your extension request for "${request.task.title}" has been approved. The new deadline is ${formatDateTime(newDeadline)}.`,
            type: 'task',
            related_id: taskId,
          });

        if (notificationError) {
          console.error(
            'Could not create approval notification:',
            notificationError
          );
        }
      }

      setSuccessMessage('Extension request approved successfully.');
      await loadRequests();
    } catch (err: any) {
      console.error('Failed to approve extension request:', err);
      setError(err?.message || 'Failed to approve extension request.');
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(request: ExtensionRequestItem) {
    if (!profile) {
      setError('Guide profile could not be loaded.');
      return;
    }

    setProcessingId(request.id);
    setError('');
    setSuccessMessage('');

    try {
      const { error: requestError } = await supabase
        .from('extension_requests')
        .update({ status: 'rejected' })
        .eq('id', request.id);

      if (requestError) {
        throw requestError;
      }

      const studentId =
        request.student_id || request.task?.student_id;

      if (studentId) {
        const { error: notificationError } = await supabase
          .from('notifications')
          .insert({
            user_id: studentId,
            title: 'Extension Request Rejected',
            message: `Your extension request for "${request.task?.title || 'the task'}" has been rejected.`,
            type: 'task',
            related_id: request.task_id,
          });

        if (notificationError) {
          console.error(
            'Could not create rejection notification:',
            notificationError
          );
        }
      }

      setSuccessMessage('Extension request rejected.');
      await loadRequests();
    } catch (err: any) {
      console.error('Failed to reject extension request:', err);
      setError(err?.message || 'Failed to reject extension request.');
    } finally {
      setProcessingId(null);
    }
  }

  const filteredRequests = requests.filter((request) => {
    if (statusFilter === 'all') {
      return true;
    }

    return request.status === statusFilter;
  });

  const pendingCount = requests.filter(
    (request) => request.status === 'pending'
  ).length;

  const approvedCount = requests.filter(
    (request) => request.status === 'approved'
  ).length;

  const rejectedCount = requests.filter(
    (request) => request.status === 'rejected'
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full p-6 lg:p-8">
      {/* HEADER */}

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Extension Requests
          </h1>

          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Review student requests to extend task deadlines.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadRequests()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      
        

      {/* FILTERS */}

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 mr-1">
          Show:
        </span>

        {(
          [
            ['all', 'All Requests'],
            ['pending', 'Pending'],
            ['approved', 'Approved'],
            ['rejected', 'Rejected'],
          ] as [RequestStatus, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatusFilter(value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              statusFilter === value
                ? 'bg-sky-500 text-white border-sky-500'
                : 'border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* MESSAGES */}

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-500">
          {successMessage}
        </div>
      )}

      {/* REQUEST LIST */}

      {filteredRequests.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 dark:bg-slate-700">
            <Clock className="w-7 h-7 text-gray-400 dark:text-slate-400" />
          </div>

          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            No {statusFilter === 'all' ? '' : `${statusFilter} `}extension requests
          </h2>

          <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">
            Requests from your connected students will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((request) => {
            const isExpanded = expandedRequests.includes(
              request.id
            );

            const isProcessing =
              processingId === request.id;

            const studentName =
              request.student?.full_name ||
              'Unknown student';

            const taskTitle =
              request.task?.title ||
              'Task unavailable';

            const requestedDeadline = (request as any)
              .requested_deadline as string | null | undefined;

            const requestedExtension = (request as any)
              .requested_extension as number | string | null | undefined;

            const reason =
              (request as any).reason ||
              (request as any).message ||
              '';

            return (
              <div
                key={request.id}
                className="card p-5"
              >
                {/* REQUEST HEADER */}

                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                        {taskTitle}
                      </h3>

                      <span
                        className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-medium capitalize ${getStatusClasses(
                          request.status
                        )}`}
                      >
                        {request.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1.5">
                        <User className="w-4 h-4 text-sky-500" />
                        {studentName}
                      </span>

                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-sky-500" />
                        Current deadline:{' '}
                        {formatDateTime(request.task?.deadline)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleExpanded(request.id)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-slate-700 px-3 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    {isExpanded ? (
                      <>
                        Hide details
                        <ChevronUp className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        View details
                        <ChevronDown className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>

                {/* EXPANDED DETAILS */}

                {isExpanded && (
                  <div className="mt-5 border-t border-gray-100 dark:border-slate-700 pt-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="rounded-xl bg-gray-50 dark:bg-slate-900/50 p-4">
                        <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">
                          Current deadline
                        </p>

                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {formatDateTime(request.task?.deadline)}
                        </p>
                      </div>

                      <div className="rounded-xl bg-gray-50 dark:bg-slate-900/50 p-4">
                        <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">
                          Requested deadline
                        </p>

                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {requestedDeadline
                            ? formatDateTime(requestedDeadline)
                            : requestedExtension
                            ? `${requestedExtension} additional day(s)`
                            : 'Not specified'}
                        </p>
                      </div>
                    </div>

                    {reason && (
                      <div>
                        <p className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white mb-2">
                          <MessageSquare className="w-4 h-4 text-sky-500" />
                          Student's reason
                        </p>

                        <div className="rounded-xl bg-gray-50 dark:bg-slate-900/50 p-4 text-sm text-gray-600 dark:text-slate-300 whitespace-pre-wrap">
                          {reason}
                        </div>
                      </div>
                    )}

                    <div className="text-xs text-gray-400 dark:text-slate-500">
                      Requested on:{' '}
                      {formatDateTime(
                        (request as any).created_at
                      )}
                    </div>
                  </div>
                )}

                {/* ACTIONS */}

                {request.status === 'pending' && (
                  <div className="flex flex-wrap items-center justify-end gap-3 mt-5 pt-4 border-t border-gray-100 dark:border-slate-700">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() =>
                        void handleReject(request)
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 dark:border-red-500/30 px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50 transition-colors"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}

                      Reject
                    </button>

                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() =>
                        void handleApprove(request)
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 transition-colors"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}

                      Approve Request
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}