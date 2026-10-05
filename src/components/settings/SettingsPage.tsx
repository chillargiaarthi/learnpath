import { useEffect, useState } from 'react';
import {
  User,
  Palette,
  Bell,
  Save,
  Loader2,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type Theme = 'light' | 'dark';

function useTheme() {
  const getTheme = (): Theme => {
    const saved =
      localStorage.getItem('sb-theme') as Theme | null;

    if (saved === 'light' || saved === 'dark') {
      return saved;
    }

    return 'dark';
  };

  const setTheme = (t: Theme) => {
    localStorage.setItem('sb-theme', t);

    const root = document.documentElement;

    root.classList.remove('dark', 'reading');

    if (t === 'dark') {
      root.classList.add('dark');
    }
  };

  return { getTheme, setTheme };
}

export default function SettingsPage() {
  const { profile, refreshProfile } = useAuth();
  const { getTheme, setTheme } = useTheme();

  const [fullName, setFullName] = useState(
    profile?.full_name || ''
  );

  const [roleTitle, setRoleTitle] = useState(
    profile?.role_title || ''
  );

  const [notificationsEnabled, setNotificationsEnabled] =
    useState(
      profile?.notifications_enabled !== false
    );

  const [currentTheme, setCurrentTheme] =
    useState<Theme>(getTheme());

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [currentPassword, setCurrentPassword] =
    useState('');

  const [newPassword, setNewPassword] =
    useState('');

  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [showCurrentPassword, setShowCurrentPassword] =
    useState(false);

  const [showNewPassword, setShowNewPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [changingPassword, setChangingPassword] =
    useState(false);

  const [passwordMessage, setPasswordMessage] =
    useState('');

  const [passwordError, setPasswordError] =
    useState('');

  const [passwordUpdatedAt, setPasswordUpdatedAt] =
    useState<string | null>(null);

  const isGuide = profile?.role !== 'student';

  useEffect(() => {
    async function loadPasswordUpdatedAt() {
      if (!profile) return;

      const { data } = await supabase
        .from('profiles')
        .select('password_updated_at')
        .eq('id', profile.id)
        .maybeSingle();

      setPasswordUpdatedAt(
        data?.password_updated_at || null
      );
    }

    loadPasswordUpdatedAt();
  }, [profile]);

  async function save() {
    if (!profile) return;

    setSaving(true);

    const updates: Record<string, unknown> = {
      full_name:
        fullName.trim() || profile.full_name,

      notifications_enabled:
        notificationsEnabled,
    };

    if (isGuide) {
      updates.role_title =
        roleTitle.trim() || null;
    }

    await supabase
      .from('profiles')
      .update(updates)
      .eq('id', profile.id);

    await refreshProfile();

    setSaving(false);
    setSaved(true);

    setTimeout(() => {
      setSaved(false);
    }, 2000);
  }

  async function changePassword() {
    setPasswordError('');
    setPasswordMessage('');

    if (!profile?.email) {
      setPasswordError(
        'Unable to find your account email.'
      );
      return;
    }

    if (!currentPassword) {
      setPasswordError(
        'Please enter your current password.'
      );
      return;
    }

    if (!newPassword) {
      setPasswordError(
        'Please enter a new password.'
      );
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError(
        'New password must be at least 6 characters.'
      );
      return;
    }

    if (!confirmPassword) {
      setPasswordError(
        'Please confirm your new password.'
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(
        'New passwords do not match.'
      );
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError(
        'New password must be different from your current password.'
      );
      return;
    }

    setChangingPassword(true);

    const { error: verifyError } =
      await supabase.auth.signInWithPassword({
        email: profile.email,
        password: currentPassword,
      });

    if (verifyError) {
      setPasswordError(
        'Current password is incorrect.'
      );

      setChangingPassword(false);
      return;
    }

    const { error: updateError } =
      await supabase.auth.updateUser({
        password: newPassword,
      });

    if (updateError) {
      setPasswordError(updateError.message);

      setChangingPassword(false);
      return;
    }

    const updatedAt =
      new Date().toISOString();

    const { error: timestampError } =
      await supabase
        .from('profiles')
        .update({
          password_updated_at: updatedAt,
        })
        .eq('id', profile.id);

    if (timestampError) {
      setPasswordError(
        timestampError.message
      );

      setChangingPassword(false);
      return;
    }

    setPasswordUpdatedAt(updatedAt);

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');

    setPasswordMessage(
      'Password changed successfully.'
    );

    setChangingPassword(false);

    await refreshProfile();
  }

  function applyTheme(t: Theme) {
    setCurrentTheme(t);
    setTheme(t);
  }

  const themeOptions: {
    id: Theme;
    label: string;
    desc: string;
    preview: string;
  }[] = [
    {
      id: 'light',
      label: 'Light',
      desc: 'Easy on the eyes in daylight',
      preview:
        'bg-white border-gray-200',
    },
    {
      id: 'dark',
      label: 'Dark',
      desc: 'Easy on the eyes at night',
      preview:
        'bg-slate-800 border-slate-600',
    },
  ];

  function formatLastUpdated(
    value: string | null
  ) {
    if (!value) {
      return 'Not updated yet';
    }

    return new Date(value).toLocaleString(
      'en-IN',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }
    );
  }

  return (
    <div className="w-full p-6 lg:p-8">
      {/* HEADER */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Settings
        </h1>

        <p className="text-gray-500 dark:text-slate-400 text-sm mt-0.5">
          Manage your profile and preferences
        </p>
      </div>

      <div className="space-y-6">
        {/* PROFILE */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-500/10 flex items-center justify-center">
              <User className="w-4 h-4 text-sky-500" />
            </div>

            <h2 className="font-semibold text-slate-900 dark:text-white">
              Profile
            </h2>
          </div>

          <div className="space-y-4">
            {/* FULL NAME */}
            <div>
              <label className="label">
                Full Name
              </label>

              <input
                type="text"
                value={fullName}
                onChange={e =>
                  setFullName(e.target.value)
                }
                className="input mt-1.5"
              />
            </div>

            {/* EMAIL */}
            <div>
              <label className="label">
                Email
              </label>

              <input
                type="email"
                value={profile?.email || ''}
                disabled
                className="input mt-1.5 opacity-60 cursor-not-allowed"
              />
            </div>

            {/* ROLE TITLE */}
            {isGuide && (
              <div>
                <label className="label">
                  Role Title
                </label>

                <input
                  type="text"
                  value={roleTitle}
                  onChange={e =>
                    setRoleTitle(e.target.value)
                  }
                  placeholder="e.g. Math Tutor, Science Guide, Coach..."
                  className="input mt-1.5"
                />

                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1.5">
                  Displayed to students when they view your profile.
                </p>
              </div>
            )}

            {/* ROLE */}
            <div>
              <label className="label">
                Role
              </label>

              <input
                type="text"
                value={
                  isGuide
                    ? 'Guide'
                    : 'Student'
                }
                disabled
                className="input mt-1.5 opacity-60 cursor-not-allowed capitalize"
              />
            </div>
          </div>
        </div>

        {/* CHANGE PASSWORD */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
                <LockKeyhole className="w-4 h-4 text-red-500" />
              </div>

              <h2 className="font-semibold text-slate-900 dark:text-white">
                Change Password
              </h2>
            </div>

            <p className="text-xs text-gray-400 dark:text-slate-500">
              Last Updated:{' '}
              <span className="font-medium text-gray-500 dark:text-slate-400">
                {formatLastUpdated(
                  passwordUpdatedAt
                )}
              </span>
            </p>
          </div>

          <div className="space-y-4">
            {/* CURRENT PASSWORD */}
            <div>
              <label className="label">
                Current Password
              </label>

              <div className="relative mt-1.5">
                <input
                  type={
                    showCurrentPassword
                      ? 'text'
                      : 'password'
                  }
                  value={currentPassword}
                  onChange={e =>
                    setCurrentPassword(
                      e.target.value
                    )
                  }
                  className="input pr-11"
                  placeholder="Enter current password"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowCurrentPassword(
                      v => !v
                    )
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-slate-700 dark:hover:text-white"
                >
                  {showCurrentPassword ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <EyeOff className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* NEW PASSWORD */}
            <div>
              <label className="label">
                New Password
              </label>

              <div className="relative mt-1.5">
                <input
                  type={
                    showNewPassword
                      ? 'text'
                      : 'password'
                  }
                  value={newPassword}
                  onChange={e =>
                    setNewPassword(
                      e.target.value
                    )
                  }
                  className="input pr-11"
                  placeholder="Enter new password"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowNewPassword(
                      v => !v
                    )
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-slate-700 dark:hover:text-white"
                >
                  {showNewPassword ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <EyeOff className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* CONFIRM PASSWORD */}
            <div>
              <label className="label">
                Confirm New Password
              </label>

              <div className="relative mt-1.5">
                <input
                  type={
                    showConfirmPassword
                      ? 'text'
                      : 'password'
                  }
                  value={confirmPassword}
                  onChange={e =>
                    setConfirmPassword(
                      e.target.value
                    )
                  }
                  className="input pr-11"
                  placeholder="Confirm new password"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword(
                      v => !v
                    )
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-slate-700 dark:hover:text-white"
                >
                  {showConfirmPassword ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <EyeOff className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* PASSWORD ERROR */}
            {passwordError && (
              <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-4 py-3">
                <p className="text-sm text-red-600 dark:text-red-400">
                  {passwordError}
                </p>
              </div>
            )}

            {/* PASSWORD SUCCESS */}
            {passwordMessage && (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-4 py-3">
                <p className="text-sm text-emerald-600 dark:text-emerald-400">
                  {passwordMessage}
                </p>
              </div>
            )}

            {/* CHANGE PASSWORD */}
            <button
              type="button"
              onClick={changePassword}
              disabled={changingPassword}
              className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
            >
              {changingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Changing Password...
                </>
              ) : (
                'Change Password'
              )}
            </button>
          </div>
        </div>

        {/* APPEARANCE */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center">
              <Palette className="w-4 h-4 text-purple-500" />
            </div>

            <h2 className="font-semibold text-slate-900 dark:text-white">
              Appearance
            </h2>
          </div>

          {/* ONLY LIGHT + DARK */}
          <div className="grid grid-cols-2 gap-3">
            {themeOptions.map(opt => (
              <button
                key={opt.id}
                onClick={() =>
                  applyTheme(opt.id)
                }
                className={`relative flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  currentTheme === opt.id
                    ? 'border-sky-500 bg-sky-50 dark:bg-sky-500/10'
                    : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
                }`}
              >
                {currentTheme === opt.id && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-sky-500 rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}

                <div
                  className={`w-full h-10 rounded-lg border ${opt.preview}`}
                />

                <div className="text-center">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {opt.label}
                  </p>

                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                    {opt.desc}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* NOTIFICATIONS */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
              <Bell className="w-4 h-4 text-amber-500" />
            </div>

            <h2 className="font-semibold text-slate-900 dark:text-white">
              Notifications
            </h2>
          </div>

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                Enable notifications
              </p>
            </div>

            <div
              className={`relative w-12 h-6 rounded-full transition-colors ${
                notificationsEnabled
                  ? 'bg-sky-500'
                  : 'bg-gray-200 dark:bg-slate-600'
              }`}
              onClick={() =>
                setNotificationsEnabled(
                  v => !v
                )
              }
            >
              <div
                className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  notificationsEnabled
                    ? 'translate-x-7'
                    : 'translate-x-1'
                }`}
              />
            </div>
          </label>
        </div>

        {/* SAVE CHANGES */}
        <button
          onClick={save}
          disabled={saving}
          className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <Check className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}

          {saving
            ? 'Saving...'
            : saved
            ? 'Saved!'
            : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}