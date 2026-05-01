import React, { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  userRole: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = (userId: string) => {
    Promise.resolve(
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single()
    )
      .then(({ data }) => setUserRole(data?.role ?? null))
      .catch(() => setUserRole(null));
  };

  useEffect(() => {
    // Safety timeout: if anything stalls, unblock the UI quickly.
    const timeout = setTimeout(() => {
      console.warn("Auth timeout: forcing loading=false");
      setLoading(false);
    }, 3000);

    let subscription: { unsubscribe: () => void } | null = null;

    try {
      // 1. Listen for auth changes FIRST so no event is missed.
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          // Defer DB call to avoid deadlocking the auth state machine.
          setTimeout(() => fetchRole(session.user.id), 0);
        } else {
          setUserRole(null);
        }
        clearTimeout(timeout);
        setLoading(false);
      });
      subscription = data.subscription;

      // 2. Restore session from storage. Handle rejection so loading always resolves.
      supabase.auth.getSession()
        .then(({ data: { session } }) => {
          setSession(session);
          setUser(session?.user ?? null);
          if (session?.user) {
            setTimeout(() => fetchRole(session.user.id), 0);
          }
        })
        .catch((e) => {
          console.error("getSession failed:", e);
        })
        .finally(() => {
          clearTimeout(timeout);
          setLoading(false);
        });
    } catch (e) {
      console.error("Auth init failed:", e);
      clearTimeout(timeout);
      setLoading(false);
    }

    return () => {
      clearTimeout(timeout);
      subscription?.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, userRole, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
