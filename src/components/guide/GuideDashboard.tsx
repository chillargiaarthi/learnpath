import { useEffect, useState } from 'react';
import {
  Users,
  CheckCircle2,
  Clock,
  Flame,
  BarChart2,
  Target,
} from 'lucide-react';

import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

import {
  Profile,
  Task,
  TestAttempt,
} from '../../lib/types';


/* =========================================================
   STUDENT SUMMARY
========================================================= */

interface StudentSummary {
  profile: Profile;

  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  pendingTasks: number;

  avgScore: number | null;

  testsAttempted: number;

  streak: number;
}


/* =========================================================
   GUIDE DASHBOARD
========================================================= */

export default function GuideDashboard({
  selectedStudentId,
  onStudentSelect,
}: {
  selectedStudentId?: string | null;
  onStudentSelect?: (studentId: string | null) => void;
}) {
  const { profile } = useAuth();


  /* =======================================================
     STATE
  ======================================================= */

  const [summaries, setSummaries] =
    useState<StudentSummary[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [totals, setTotals] = useState({
    tasks: 0,
    completed: 0,
    pending: 0,
    overdue: 0,
    tests: 0,
    students: 0,
  });


  /* =======================================================
     LOAD DASHBOARD DATA
  ======================================================= */

  useEffect(() => {
    if (!profile) return;


    async function load() {
      setLoading(true);


      /* ===================================================
         LOAD DATA
      =================================================== */

      const [
        connRes,
        tasksRes,
        attemptsRes,
        streaksRes,
      ] = await Promise.all([

        /* Connected students */
        supabase
          .from('connection_requests')
          .select(
            '*, student:profiles!connection_requests_student_id_fkey(*)'
          )
          .eq(
            'guide_id',
            profile!.id
          )
          .eq(
            'status',
            'accepted'
          ),


        /* Guide tasks */
        supabase
          .from('tasks')
          .select('*')
          .eq(
            'mentor_id',
            profile!.id
          ),


        /* Test attempts */
        supabase
          .from('test_attempts')
          .select('*'),


        /* Study streaks */
        supabase
          .from('study_streaks')
          .select('*'),
      ]);


      /* ===================================================
         PREPARE DATA
      =================================================== */

      const students: Profile[] =
        (connRes.data || [])
          .map(
            (connection: any) =>
              connection.student
          )
          .filter(Boolean);


      const tasks: Task[] =
        tasksRes.data || [];


      const attempts: TestAttempt[] =
        attemptsRes.data || [];


      const streaks =
        streaksRes.data || [];


      /* ===================================================
         BUILD INDIVIDUAL STUDENT SUMMARIES
      =================================================== */

      const sums: StudentSummary[] =
        students.map((student) => {

          /* Student tasks */
          const studentTasks =
            tasks.filter(
              (task) =>
                task.student_id ===
                student.id
            );


          /* Student attempts */
          const studentAttempts =
            attempts.filter(
              (attempt) =>
                attempt.student_id ===
                  student.id &&
                attempt.status !==
                  'in_progress'
            );


          /* Scores */
          const scores =
            studentAttempts
              .filter(
                (attempt) =>
                  attempt.is_evaluated &&
                  attempt.max_score > 0
              )
              .map(
                (attempt) =>
                  (attempt.total_score /
                    attempt.max_score) *
                  100
              );


          /* Streak */
          const streak =
            streaks.find(
              (item: any) =>
                item.student_id ===
                student.id
            );


          return {
            profile: student,

            totalTasks:
              studentTasks.length,

            completedTasks:
              studentTasks.filter(
                (task) =>
                  task.status ===
                  'completed'
              ).length,

            pendingTasks:
              studentTasks.filter(
                (task) =>
                  task.status ===
                  'pending'
              ).length,

            overdueTasks:
              studentTasks.filter(
                (task) =>
                  task.status ===
                  'overdue'
              ).length,

            avgScore:
              scores.length
                ? Math.round(
                    scores.reduce(
                      (total, score) =>
                        total + score,
                      0
                    ) /
                      scores.length
                  )
                : null,

            testsAttempted:
              studentAttempts.length,

            streak:
              streak?.current_streak ??
              0,
          };
        });


      setSummaries(sums);


      /* ===================================================
         DETERMINE WHICH STUDENTS ARE BEING VIEWED
      ===================================================

         selectedStudentId = null
             → All connected students

         selectedStudentId = student ID
             → Only selected student
      =================================================== */

      const relevantIds =
        selectedStudentId
          ? [selectedStudentId]
          : students.map(
              (student) =>
                student.id
            );


      /* ===================================================
         FILTER TASKS
      =================================================== */

      const filteredTasks =
        tasks.filter(
          (task) =>
            relevantIds.includes(
              task.student_id
            )
        );


      /* ===================================================
         CALCULATE TOTALS
      =================================================== */

      const filteredAttempts =
        attempts.filter(
          (attempt) =>
            attempt.status !==
              'in_progress' &&
            relevantIds.includes(
              attempt.student_id
            )
        );


      setTotals({
        tasks:
          filteredTasks.length,

        completed:
          filteredTasks.filter(
            (task) =>
              task.status ===
              'completed'
          ).length,

        pending:
          filteredTasks.filter(
            (task) =>
              task.status ===
              'pending'
          ).length,

        overdue:
          filteredTasks.filter(
            (task) =>
              task.status ===
              'overdue'
          ).length,

        tests:
          filteredAttempts.length,

        students:
          selectedStudentId
            ? 1
            : students.length,
      });


      setLoading(false);
    }


    load();

  }, [
    profile,
    selectedStudentId,
  ]);


  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">

        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />

      </div>
    );
  }


  /* =======================================================
     SELECTED STUDENT
  ======================================================= */

  const selectedStudent =
    selectedStudentId
      ? summaries.find(
          (student) =>
            student.profile.id ===
            selectedStudentId
        )
      : null;


  /* =======================================================
     DISPLAY SUMMARIES
  ======================================================= */

  const displaySummaries =
    selectedStudentId
      ? summaries.filter(
          (student) =>
            student.profile.id ===
            selectedStudentId
        )
      : summaries;


  


  /* =======================================================
     TASK COMPLETION
  ======================================================= */

  const totalPct =
    totals.tasks > 0
      ? Math.round(
          (totals.completed /
            totals.tasks) *
            100
        )
      : 0;


  /* =======================================================
     HEADER TEXT
  ======================================================= */

  const dashboardTitle =
  selectedStudent
    ? `${selectedStudent.profile.full_name}'s Dashboard`
    : 'All Students Dashboard';


  const dashboardSubtitle =
    selectedStudent
      ? `Individual student overview`
      : `Overview of ${summaries.length} connected student${
          summaries.length !== 1
            ? 's'
            : ''
        }`;


  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="w-full p-6 lg:p-8">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="mb-8">

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">

          {/* Dashboard title */}

          <div className="flex items-center gap-3">

            <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-500/10 flex items-center justify-center">

              <Users className="w-5 h-5 text-sky-500" />

            </div>


            <div>

              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">

                {dashboardTitle}

              </h1>


              <p className="text-gray-500 dark:text-slate-400 text-sm mt-0.5">

                {dashboardSubtitle}

              </p>

            </div>

          </div>


          {/* =================================================
              STUDENT DROPDOWN
          ================================================= */}

          <div className="flex items-center gap-3">

            <label
              htmlFor="student-dashboard-filter"
              className="text-sm font-medium text-gray-700 dark:text-slate-300 whitespace-nowrap"
            >
              Student
            </label>


            <select
              id="student-dashboard-filter"
              value={selectedStudentId ?? ''}
              onChange={(event) =>
                onStudentSelect?.(
                  event.target.value ||
                    null
                )
              }
              className="min-w-[210px] rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            >

              <option value="">
                All Students
              </option>


              {summaries.map(
                (student) => (
                  <option
                    key={
                      student.profile.id
                    }
                    value={
                      student.profile.id
                    }
                  >
                    {
                      student.profile
                        .full_name
                    }
                  </option>
                )
              )}

            </select>

          </div>

        </div>

      </div>


      {/* =================================================
          SUMMARY CARDS
      ================================================= */}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">

        {[
          {
            label: selectedStudentId
              ? 'Student'
              : 'Students',

            value: totals.students,

            icon: Users,

            bg: 'bg-sky-50 dark:bg-sky-500/10',

            color: 'text-sky-500',
          },

          {
            label: 'Total Tasks',

            value: totals.tasks,

            icon: Target,

            bg: 'bg-gray-50 dark:bg-slate-700',

            color:
              'text-gray-500 dark:text-slate-400',
          },

          {
            label: 'Completed',

            value: totals.completed,

            icon: CheckCircle2,

            bg:
              'bg-emerald-50 dark:bg-emerald-500/10',

            color: 'text-emerald-500',
          },

          {
            label: 'Pending',

            value: totals.pending,

            icon: Clock,

            bg:
              'bg-amber-50 dark:bg-amber-500/10',

            color: 'text-amber-500',
          },

          {
            label: 'Tests Taken',

            value: totals.tests,

            icon: BarChart2,

            bg:
              'bg-purple-50 dark:bg-purple-500/10',

            color: 'text-purple-500',
          },
        ].map(
          ({
            label,
            value,
            icon: Icon,
            bg,
            color,
          }) => (

            <div
              key={label}
              className="card p-4"
            >

              <div
                className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}
              >

                <Icon
                  className={`w-4 h-4 ${color}`}
                />

              </div>


              <p className="text-2xl font-bold text-slate-900 dark:text-white">

                {value}

              </p>


              <p className="text-gray-500 dark:text-slate-400 text-xs mt-0.5">

                {label}

              </p>

            </div>
          )
        )}

      </div>


      {/* =================================================
          TASK COMPLETION
      ================================================= */}

      {totals.tasks > 0 && (

        <div className="card p-5 mb-6">

          <div className="flex items-center justify-between mb-2">

            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">

              Task Completion

            </h3>


            <span className="text-slate-900 dark:text-white font-bold text-sm">

              {totalPct}%

            </span>

          </div>


          <div className="h-2.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">

            <div
              className={`h-full rounded-full transition-all ${
                totalPct >= 70
                  ? 'bg-emerald-500'
                  : totalPct >= 40
                  ? 'bg-amber-500'
                  : 'bg-red-500'
              }`}
              style={{
                width: `${totalPct}%`,
              }}
            />

          </div>


          <div className="flex justify-between text-xs text-gray-400 dark:text-slate-500 mt-2">

            <span>
              {totals.completed}{' '}
              completed
            </span>

            <span>
              {totals.pending}{' '}
              pending
            </span>

            <span>
              {totals.overdue}{' '}
              overdue
            </span>

          </div>

        </div>

      )}


      {/* =================================================
          STUDENT SECTION
      ================================================= */}

      <div className="flex items-center justify-between mb-4">

        <h3 className="font-semibold text-slate-900 dark:text-white">

          {selectedStudentId
            ? 'Student Overview'
            : `Students (${displaySummaries.length})`}

        </h3>

      </div>


      {/* =================================================
          NO STUDENTS
      ================================================= */}

      {displaySummaries.length === 0 ? (

        <div className="card p-12 text-center">

          <Users className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />


          <p className="text-slate-900 dark:text-white font-medium mb-1">

            {selectedStudentId
              ? 'Student not found'
              : 'No connected students yet'}

          </p>


          <p className="text-gray-500 dark:text-slate-400 text-sm">

            {selectedStudentId
              ? 'The selected student is no longer connected.'
              : 'Go to Students tab to send connection requests.'}

          </p>

        </div>

      ) : (

        /* =================================================
           STUDENT CARDS
        ================================================= */

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {displaySummaries.map(
            (student) => {

              const pct =
                student.totalTasks
                  ? Math.round(
                      (student.completedTasks /
                        student.totalTasks) *
                        100
                    )
                  : 0;


              return (

                <div
                  key={
                    student.profile.id
                  }
                  className={`card p-5 hover:shadow-md transition-all ${
                    selectedStudentId
                      ? 'sm:col-span-2 lg:col-span-1'
                      : ''
                  }`}
                >

                  {/* ===================================
                      STUDENT INFORMATION
                  =================================== */}

                  <div className="flex items-center gap-3 mb-4">

                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-emerald-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">

                      {student.profile.full_name
                        .charAt(0)
                        .toUpperCase()}

                    </div>


                    <div className="min-w-0">

                      <p className="text-slate-900 dark:text-white font-semibold text-sm truncate">

                        {student.profile.full_name}

                      </p>


                      <p className="text-gray-400 dark:text-slate-500 text-xs truncate">

                        {student.profile.email}

                      </p>

                    </div>

                  </div>


                  {/* ===================================
                      TASK COMPLETION
                  =================================== */}

                  <div className="mb-3">

                    <div className="flex justify-between text-xs mb-1.5">

                      <span className="text-gray-500 dark:text-slate-400">

                        Task Completion

                      </span>


                      <span
                        className={`font-semibold ${
                          pct >= 70
                            ? 'text-emerald-500'
                            : pct >= 40
                            ? 'text-amber-500'
                            : 'text-red-500'
                        }`}
                      >

                        {pct}%

                      </span>

                    </div>


                    <div className="h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">

                      <div
                        className={`h-full rounded-full ${
                          pct >= 70
                            ? 'bg-emerald-500'
                            : pct >= 40
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                        }`}
                        style={{
                          width: `${pct}%`,
                        }}
                      />

                    </div>

                  </div>


                  {/* ===================================
                      TASK COUNTS
                  =================================== */}

                  <div className="grid grid-cols-3 gap-2 text-center mb-3">

                    <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-2">

                      <p className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">

                        {student.completedTasks}

                      </p>

                      <p className="text-gray-400 dark:text-slate-500 text-xs">

                        Done

                      </p>

                    </div>


                    <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl p-2">

                      <p className="text-amber-600 dark:text-amber-400 font-bold text-sm">

                        {student.pendingTasks}

                      </p>

                      <p className="text-gray-400 dark:text-slate-500 text-xs">

                        Pending

                      </p>

                    </div>


                    <div className="bg-red-50 dark:bg-red-500/10 rounded-xl p-2">

                      <p className="text-red-600 dark:text-red-400 font-bold text-sm">

                        {student.overdueTasks}

                      </p>

                      <p className="text-gray-400 dark:text-slate-500 text-xs">

                        Overdue

                      </p>

                    </div>

                  </div>


                  {/* ===================================
                      TESTS + STREAK
                  =================================== */}

                  <div className="flex justify-between text-xs text-gray-400 dark:text-slate-500 border-t border-gray-100 dark:border-slate-700/50 pt-3">

                    {student.avgScore !==
                      null && (

                      <span>

                        Avg:{' '}

                        <span className="text-slate-900 dark:text-white font-semibold">

                          {student.avgScore}%

                        </span>

                      </span>

                    )}


                    <span>

                      Tests:{' '}

                      <span className="text-slate-900 dark:text-white font-semibold">

                        {
                          student.testsAttempted
                        }

                      </span>

                    </span>


                    <span className="flex items-center gap-1">

                      <Flame className="w-3 h-3 text-orange-400" />

                      <span className="text-orange-500 dark:text-orange-400 font-semibold">

                        {student.streak}d

                      </span>

                    </span>

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