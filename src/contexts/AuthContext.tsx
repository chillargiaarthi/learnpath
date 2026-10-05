import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useRef,
} from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Profile } from '../lib/types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;

  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: string | null }>;

  signUp: (
    email: string,
    password: string,
    fullName: string,
    role: 'mentor' | 'student'
  ) => Promise<{ error: string | null }>;

  resetPassword: (
    email: string
  ) => Promise<{ error: string | null }>;

  signOut: () => Promise<void>;

  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Prevent the temporary signup session from opening a dashboard
  const isSigningUp = useRef(false);

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    setProfile(data);
  }

  async function refreshProfile() {
    if (user) {
      await fetchProfile(user.id);
    }
  }

  useEffect(() => {
    // Check existing session when the application starts
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchProfile(session.user.id).finally(() => {
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    // Listen for authentication changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
  if (isSigningUp.current) {
    return;
  }

  setSession(session);
  setUser(session?.user ?? null);

  if (event === 'SIGNED_OUT') {
    setProfile(null);
    return;
  }

  // Only load the profile after an actual sign in.
  // Do not load it again for USER_UPDATED during password reset.
  if (event === 'SIGNED_IN' && session?.user) {
    fetchProfile(session.user.id);
  }
});
       

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // --------------------------------------------------
  // SIGN IN
  // --------------------------------------------------

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  }

  // --------------------------------------------------
  // SIGN UP
  // --------------------------------------------------

  async function signUp(
    email: string,
    password: string,
    fullName: string,
    role: 'mentor' | 'student'
  ) {
    isSigningUp.current = true;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      isSigningUp.current = false;
      return { error: error.message };
    }

    // Create profile
    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: data.user.id,
          role,
          full_name: fullName,
          email,
        });

      if (profileError) {
        isSigningUp.current = false;
        return { error: profileError.message };
      }
    }

    // Do not automatically sign in after account creation
    await supabase.auth.signOut();

    setUser(null);
    setSession(null);
    setProfile(null);

    isSigningUp.current = false;

    return { error: null };
  }

  // --------------------------------------------------
  // FORGOT PASSWORD
  // --------------------------------------------------

  async function resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/reset-password`,
      }
    );

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  }

  // --------------------------------------------------
  // SIGN OUT
  // --------------------------------------------------

  async function signOut() {
    await supabase.auth.signOut();

    setUser(null);
    setSession(null);
    setProfile(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signIn,
        signUp,
        resetPassword,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return ctx;
}