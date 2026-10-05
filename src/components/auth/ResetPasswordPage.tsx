import { useState } from 'react';
import { Eye, EyeOff, Loader2, CheckCircle, LockKeyhole } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 mb-4 shadow-lg shadow-blue-600/30">
            <LockKeyhole className="w-8 h-8 text-white" />
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

          {success ? (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>

              <h2 className="text-xl font-semibold text-white">
                Password Updated
              </h2>

              <p className="text-slate-400 text-sm mt-2">
                Your password has been changed successfully.
              </p>

              <button
  type="button"
  onClick={async () => {
    await supabase.auth.signOut();
    window.location.replace('/');
  }}
                className="w-full mt-6 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-all"
              >
                Go to Sign In
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-white">
                Create New Password
              </h2>

              <p className="text-slate-400 text-sm mt-1 mb-6">
                Enter your new password below.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">

                {/* New Password */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    New Password
                  </label>

                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      minLength={6}
                      required
                      className="w-full px-4 py-2.5 pr-11 rounded-xl bg-slate-900/60 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
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

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Confirm Password
                  </label>

                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) =>
                        setConfirmPassword(e.target.value)
                      }
                      placeholder="••••••••"
                      autoComplete="new-password"
                      required
                      minLength={6}
                      className="w-full px-4 py-2.5 pr-11 rounded-xl bg-slate-900/60 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showConfirmPassword ? (
                        <Eye className="w-4 h-4" />
                      ) : (
                        <EyeOff className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 mt-2"
                >
                  {loading && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}

                  Update Password
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}