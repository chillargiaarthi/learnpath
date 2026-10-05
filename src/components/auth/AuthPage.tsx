import { useState } from 'react';
import {
  BookOpen,
  GraduationCap,
  Eye,
  EyeOff,
  Loader2,
  BarChart2,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

type Mode = 'login' | 'register' | 'forgot';

export default function AuthPage() {
  const { signIn, signUp, resetPassword } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [role, setRole] = useState<'mentor' | 'student'>('student');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  function clearMessages() {
    setError('');
    setSuccess('');
  }

  function goToMode(newMode: Mode) {
    setMode(newMode);
    clearMessages();
    setPassword('');
    setShowPassword(false);

    if (newMode === 'login') {
      setFullName('');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    clearMessages();
    setLoading(true);

    // -----------------------------
    // SIGN IN
    // -----------------------------
    if (mode === 'login') {
      const { error } = await signIn(email.trim(), password);

      if (error) {
        setError(error);
      }

      setLoading(false);
      return;
    }

    // -----------------------------
    // CREATE ACCOUNT
    // -----------------------------
    if (mode === 'register') {
      if (!fullName.trim()) {
        setError('Full name is required');
        setLoading(false);
        return;
      }

      const { error } = await signUp(
        email.trim(),
        password,
        fullName.trim(),
        role
      );

      if (error) {
        setError(error);
      } else {
        // Account created → return to Sign In
        setMode('login');
        setFullName('');
        setPassword('');
        setShowPassword(false);

        setSuccess('Account created successfully. Please sign in.');
      }

      setLoading(false);
      return;
    }

    // -----------------------------
    // FORGOT PASSWORD
    // -----------------------------
    if (mode === 'forgot') {
      if (!email.trim()) {
        setError('Please enter your email address');
        setLoading(false);
        return;
      }

      const { error } = await resetPassword(email.trim());

      if (error) {
        setError(error);
      } else {
        setSuccess(
          'Password reset instructions have been sent to your email.'
        );
      }

      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 mb-4 shadow-lg shadow-blue-600/30">
            <BarChart2 className="w-8 h-8 text-white" />
          </div>

          <h1 className="text-3xl font-bold text-white tracking-tight">
            LearnPath
          </h1>

          <p className="text-slate-400 mt-1 text-sm">
            Connecting Guides with Students
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-8 shadow-xl">

          {/* SIGN IN / CREATE ACCOUNT TABS */}
          {mode !== 'forgot' && (
            <div className="flex bg-slate-900/60 rounded-xl p-1 mb-6">
              <button
                type="button"
                onClick={() => goToMode('login')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === 'login'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Sign In
              </button>

              <button
                type="button"
                onClick={() => goToMode('register')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === 'register'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          {/* FORGOT PASSWORD HEADER */}
          {mode === 'forgot' && (
            <div className="mb-6">
              <button
                type="button"
                onClick={() => goToMode('login')}
                className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Sign In
              </button>

              <h2 className="text-xl font-semibold text-white mt-5">
                Forgot Password?
              </h2>

              <p className="text-slate-400 text-sm mt-1">
                Enter your email and we'll send you a password reset link.
              </p>
            </div>
          )}

          {/* ROLE SELECTION */}
          {mode === 'register' && (
            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                I am a
              </label>

              <div className="flex gap-3">
                {[
                  {
                    value: 'student',
                    icon: GraduationCap,
                    label: 'Student',
                  },
                  {
                    value: 'mentor',
                    icon: BookOpen,
                    label: 'Guide',
                  },
                ].map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setRole(value as 'mentor' | 'student')
                    }
                    className={`flex-1 flex flex-col items-center gap-2 py-3 px-4 rounded-xl border-2 transition-all ${
                      role === value
                        ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                        : 'border-slate-600 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-medium">
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* FORM */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* FULL NAME */}
            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Full Name
                </label>

                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  autoComplete="name"
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
            )}

            {/* EMAIL */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Email
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="off"
                required
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>

            {/* PASSWORD */}
            {mode !== 'forgot' && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Password
                </label>

                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="off"
                    required
                    minLength={6}
                    className="w-full px-4 py-2.5 pr-11 rounded-xl bg-slate-900/60 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(!showPassword)
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? (
  <Eye className="w-4 h-4" />
) : (
  <EyeOff className="w-4 h-4" />
)}
                  </button>
                </div>
              </div>
            )}

            {/* FORGOT PASSWORD LINK */}
            {mode === 'login' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => goToMode('forgot')}
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  Forgot Password?
                </button>
              </div>
            )}

            {/* ERROR */}
            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* SUCCESS */}
            {success && (
              <div className="px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
                {success}
              </div>
            )}

            {/* SUBMIT */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 mt-2"
            >
              {loading && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}

              {mode === 'login' && 'Sign In'}
              {mode === 'register' && 'Create Account'}
              {mode === 'forgot' && 'Send Reset Link'}
            </button>
          </form>

          {/* BOTTOM LINK */}
          {mode !== 'forgot' && (
            <p className="text-center text-slate-400 text-sm mt-5">
              {mode === 'login'
                ? "Don't have an account? "
                : 'Already have an account? '}

              <button
                type="button"
                onClick={() =>
                  goToMode(
                    mode === 'login'
                      ? 'register'
                      : 'login'
                  )
                }
                className="text-blue-400 hover:text-blue-300 font-medium"
              >
                {mode === 'login'
                  ? 'Create Account'
                  : 'Sign In'}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}