

# Fix: App Stuck on Loading Spinner

## Problem
The app shows a loading spinner forever because `AuthContext` sets `loading = true` initially and relies entirely on Supabase auth calls (`getSession` and `onAuthStateChange`) to set it to `false`. If these calls hang or fail silently, the app never progresses.

The browser shows zero network requests to Supabase, confirming the auth client calls are not completing.

## Solution

### 1. Add error handling and timeout to AuthContext (`src/contexts/AuthContext.tsx`)

- Wrap `getSession()` in a try/catch so any error sets `loading = false` (redirecting to login)
- Add a safety timeout (e.g., 5 seconds) that forces `loading = false` if auth hasn't responded
- Add `.catch()` to the `user_roles` query so a failed role lookup doesn't block loading

### 2. Add Supabase client validation (`src/integrations/supabase/client.ts`)

- Note: This file is auto-generated and should not be edited. The env vars appear correct.

### 3. Summary of changes

Only one file needs modification:

**`src/contexts/AuthContext.tsx`**
- Add a `setTimeout` fallback (5 seconds) that sets `loading = false` if auth hasn't responded
- Add try/catch around `getSession()` call  
- Add `.catch()` to `user_roles` query in both the `onAuthStateChange` callback and the `getSession` path
- Clean up timeout when auth resolves or component unmounts

## Technical Details

```text
Current flow:
  loading = true
  -> getSession() hangs forever
  -> loading stays true
  -> spinner forever

Fixed flow:
  loading = true
  -> setTimeout(5s) as safety net
  -> getSession() with try/catch
     -> success: set state, clear timeout, loading = false
     -> error: clear timeout, loading = false (user goes to login)
  -> timeout fires: loading = false (user goes to login)
```

This is a minimal, targeted fix that ensures the app always becomes interactive regardless of backend connectivity.
