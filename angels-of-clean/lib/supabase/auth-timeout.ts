// When the access token has expired, an auth call refreshes it first, and
// auth-js retries a failed refresh with backoff for up to 30 s
// (PERFORMANCE_DIAGNOSIS.md, cause 2). Middleware and requireAdmin each paid
// that wait, so a page or action could hang for 25–51 s. Bounding the wait lets
// them show "couldn't verify" quickly instead. Callers must treat a timeout as
// "not verified": it never grants access.
export const AUTH_TIMEOUT_MS = 4000;

export type AuthCallResult<T> = { timedOut: false; value: T } | { timedOut: true };

// The call itself can't be cancelled (auth-js takes no abort signal), so it
// keeps running in the background and its late result is ignored.
export function withAuthTimeout<T>(
  call: Promise<T>,
  ms: number = AUTH_TIMEOUT_MS,
): Promise<AuthCallResult<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<AuthCallResult<T>>((resolve) => {
    timer = setTimeout(() => resolve({ timedOut: true }), ms);
  });
  const result = call.then((value): AuthCallResult<T> => ({ timedOut: false, value }));
  return Promise.race([result, timeout]).finally(() => clearTimeout(timer));
}

// When middleware can't verify a sign-in it sends the visitor to the sign-in
// page's "couldn't verify" screen, /admin?auth=retry&next=<where they were
// going>, whose "Try again" goes back to `next`.
const RETRY_PARAM = "auth";
const RETRY_VALUE = "retry";
const NEXT_PARAM = "next";

export function authRetryUrl(requestUrl: URL): URL {
  const url = new URL("/admin", requestUrl);
  url.searchParams.set(RETRY_PARAM, RETRY_VALUE);
  url.searchParams.set(NEXT_PARAM, requestUrl.pathname + requestUrl.search);
  return url;
}

export function isAuthRetryUrl(url: URL): boolean {
  return url.pathname === "/admin" && url.searchParams.get(RETRY_PARAM) === RETRY_VALUE;
}

export function isAuthRetryParams(params: Record<string, string | string[] | undefined>) {
  return params[RETRY_PARAM] === RETRY_VALUE;
}

// `next` comes from the address bar, so only a path inside the admin panel on
// this site is followed; anything else (another origin, "//evil.example",
// "/admin-but-not") falls back to /admin, which routes by role.
export function authRetryTarget(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/")) return "/admin";
  const base = "https://origin.invalid";
  let url: URL;
  try {
    url = new URL(next, base);
  } catch {
    return "/admin";
  }
  const inAdmin = url.pathname === "/admin" || url.pathname.startsWith("/admin/");
  if (url.origin !== base || !inAdmin || isAuthRetryUrl(url)) return "/admin";
  return url.pathname + url.search;
}
