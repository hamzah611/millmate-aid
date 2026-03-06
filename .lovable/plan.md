

## Diagnosis

The console shows `Auth timeout: forcing loading=false` — this means the 5-second safety timeout in `AuthContext` fires before the authentication fully resolves. Here's what happens:

1. Page loads → token refresh starts (succeeds in ~1s)
2. `onAuthStateChange` fires → queries `user_roles` table (can be slow on cold-start)
3. If `user_roles` query takes >4s, the 5s timeout fires first with `user=null`
4. App briefly redirects to `/auth`, then `onAuthStateChange` resolves, sets `user`, redirects back to `/`
5. Only NOW do dashboard/page queries start firing — adding more delay

The root cause is **two layers of sequential waiting**: auth resolution, then data fetching. Combined with database cold-start latency, this creates the prolonged loading.

## Plan

### 1. Fix AuthContext race condition
- Wait for `getSession()` to return before subscribing to `onAuthStateChange` (recommended Supabase pattern)
- Remove the `await` on `user_roles` query from the auth callback — fetch role in parallel without blocking auth resolution
- Increase timeout from 5s to 8s to account for cold-start
- Set session/user from `getSession` immediately, then let `onAuthStateChange` handle subsequent changes

### 2. Enable React Query to start fetching earlier
- Add `enabled: !!user` to queries so they fire immediately when user becomes available, without waiting for full auth context
- This is already implicitly happening since routes only render when `user` is set, but the auth fix above will make user available faster

### 3. Add better loading UX
- Replace plain "Loading..." text in tables with skeleton rows (already have the Skeleton component)
- Show dashboard card skeletons instead of just `₨ 0` while loading

These changes will cut perceived load time significantly by eliminating the auth race condition.

