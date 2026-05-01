## Problem

Users open the app and see a blank white page. The HTML and JS bundle load correctly (verified — `index.html` has `<div id="root">` and the JS asset returns), so React is mounting but failing to render any visible UI.

The root cause is in `src/contexts/AuthContext.tsx`:

1. The initial `supabase.auth.getSession()` promise can hang indefinitely in some environments (cold start, slow network, third-party cookie blocking, service-worker interference). When that happens, `loading` stays `true` for up to 8 seconds, then flips to `false` — but during that window the user sees only a tiny spinner on a white background which looks like a blank page.
2. If `getSession()` rejects (network error, CORS), the `.then()` handler never runs, so `loading` is never set to `false` until the 8s timeout — and there's no `.catch()`, so the error is swallowed silently.
3. The `ErrorBoundary` is mounted *inside* `BrowserRouter` which is *inside* `AuthProvider`. If `AuthProvider`'s render throws (e.g. a Supabase client init issue), the boundary never catches it and the whole tree goes blank.
4. The role fetch (`fetchRole`) inside `onAuthStateChange` queries the DB synchronously inside the auth callback — known anti-pattern that can deadlock the auth state machine on slow connections.

## Fix

### 1. `src/contexts/AuthContext.tsx`
- Add `.catch()` to `getSession()` so a rejection still flips `loading` to `false`.
- Reduce safety timeout from 8s to 3s so users aren't staring at a blank screen.
- Defer `fetchRole()` with `setTimeout(..., 0)` inside `onAuthStateChange` to avoid the documented Supabase deadlock pattern.
- Wrap the whole effect body in try/catch so a thrown synchronous error (e.g. localStorage unavailable in private mode) doesn't kill the provider.

### 2. `src/App.tsx`
- Move `ErrorBoundary` to wrap `AuthProvider` and `LanguageProvider` too, so any provider-level crash shows the error UI instead of a blank page.

### 3. `src/components/ErrorBoundary.tsx`
- Render a visible loader/message during the auth-loading state already handled in `AppRoutes` — no change needed here, but verify the spinner has enough contrast (it currently uses `border-primary` which is fine).

### 4. Loading screen in `AppRoutes`
- Replace the bare spinner with a spinner + "Loading…" text so even if styles haven't fully applied, the user sees something.

## Technical details

```text
App
└── QueryClientProvider
    └── ThemeProvider
        └── ErrorBoundary          ← move here (currently inside BrowserRouter)
            └── LanguageProvider
                └── AuthProvider
                    └── TooltipProvider
                        └── BrowserRouter
                            └── AppRoutes
```

`AuthProvider` changes:
```ts
useEffect(() => {
  const timeout = setTimeout(() => setLoading(false), 3000);
  try {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) setTimeout(() => fetchRole(session.user.id), 0);
      })
      .catch((e) => console.error("getSession failed", e))
      .finally(() => { clearTimeout(timeout); setLoading(false); });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) setTimeout(() => fetchRole(session.user.id), 0);
      else setUserRole(null);
      setLoading(false);
    });
    return () => { clearTimeout(timeout); subscription.unsubscribe(); };
  } catch (e) {
    console.error("Auth init failed", e);
    setLoading(false);
  }
}, []);
```

## Out of scope

- No DB migrations.
- No changes to email/auth confirmation settings (already auto-confirm).
- No changes to RLS or Supabase config.

After this, if the app still shows blank for a specific user, we'll need their browser console output to diagnose further (likely a third-party-cookie or extension issue).
