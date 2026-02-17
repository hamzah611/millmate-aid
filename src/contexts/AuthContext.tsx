import React, { createContext, useContext, useEffect, useState, useRef } from "react";
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
  const resolvedRef = useRef(false);

  const resolve = () => {
    if (!resolvedRef.current) {
      resolvedRef.current = true;
      setLoading(false);
    }
  };

  useEffect(() => {
    // Safety timeout: force loading=false after 5s
    const timeout = setTimeout(() => {
      console.warn("Auth timeout: forcing loading=false");
      resolve();
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          try {
            const { data } = await supabase
              .from("user_roles")
              .select("role")
              .eq("user_id", session.user.id)
              .single();
            setUserRole(data?.role ?? null);
          } catch {
            setUserRole(null);
          }
        } else {
          setUserRole(null);
        }
        clearTimeout(timeout);
        resolve();
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        Promise.resolve(
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", session.user.id)
            .single()
        ).then(({ data }) => {
          setUserRole(data?.role ?? null);
        }).catch(() => {}).finally(() => {
          clearTimeout(timeout);
          resolve();
        });
      } else {
        clearTimeout(timeout);
        resolve();
      }
    }).catch(() => {
      clearTimeout(timeout);
      resolve();
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
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
