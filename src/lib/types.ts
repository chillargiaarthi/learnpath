export type Role = 'mentor' | 'student';
export type ResourceType = 'pdf' | 'image' | 'document' | 'link' | 'youtube';
export type TaskStatus = 'pending' | 'completed' | 'overdue' | 'extended';
export type TaskPriority = 'low' | 'medium' | 'high';
export type ExtensionStatus = 'pending' | 'approved' | 'rejected';
export type TestAttemptStatus = 'in_progress' | 'submitted' | 'terminated';
export type QuestionType = 'objective' | 'subjective';
export type NotificationType = 'task' | 'test' | 'extension' | 'resource' | 'general';

export interface Profile {
  id: string;
  user_id: string;
  role: Role;
  full_name: string;
  email: string;
  avatar_url?: string;
  role_title?: string;
  notifications_enabled?: boolean;
  created_at: string;
}

export interface ConnectionRequest {
  id: string;
  guide_id: string;
  student_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  guide?: Profile;
  student?: Profile;
}

export interface Resource {
  id: string;
  mentor_id: string;
  title: string;
  description?: string;
  type: ResourceType;
  url: string;
  tags: string[];
  created_at: string;
}

export interface Task {
  id: string;
  mentor_id: string;
  student_id: string;
  title: string;
  description?: string;
  deadline: string;
  priority: TaskPriority;
  status: TaskStatus;
  created_at: string;
  task_completions?: TaskCompletion[];
  extension_requests?: ExtensionRequest[];
  student?: Profile;
}

export interface TaskCompletion {
  id: string;
  task_id: string;
  student_id: string;
  notes?: string;
  completed_at: string;
}

export interface ExtensionRequest {
  id: string;
  task_id: string;
  student_id: string;
  reason: string;
  status: ExtensionStatus;
  new_deadline?: string;
  mentor_response?: string;
  created_at: string;
  reviewed_at?: string;
  task?: Task;
  student?: Profile;
}

export interface Test {
  id: string;
  mentor_id: string;
  title: string;
  description?: string;
  duration_minutes: number;
  max_violations: number;
  is_published: boolean;
  total_marks: number;
  assigned_to: string[];
  created_at: string;
  questions?: Question[];
}

export interface Question {
  id: string;
  test_id: string;
  question_text: string;
  type: QuestionType;
  options?: { label: string; value: string }[];
  correct_answer?: string;
  expected_answer?: string;
  marks: number;
  order_index: number;
}

export interface TestAttempt {
  id: string;
  test_id: string;
  student_id: string;
  started_at: string;
  submitted_at?: string;
  status: TestAttemptStatus;
  violation_count: number;
  total_score: number;
  max_score: number;
  is_evaluated: boolean;
  duration_seconds?: number;
  test?: Test;
  student?: Profile;
  test_answers?: TestAnswer[];
}

export interface TestAnswer {
  id: string;
  attempt_id: string;
  question_id: string;
  answer_text?: string;
  selected_option?: string;
  marks_awarded?: number;
  feedback?: string;
  is_evaluated: boolean;
  question?: Question;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  related_id?: string;
  created_at: string;
}

export interface StudyStreak {
  id: string;
  student_id: string;
  current_streak: number;
  longest_streak: number;
  last_activity_date?: string;
  total_days_active: number;
}
