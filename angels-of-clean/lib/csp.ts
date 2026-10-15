// Content-Security-Policy for every page. Imported by next.config.ts (public
// pages, built once) and middleware.ts (admin pages, per request), so keep it
// free of Next.js and Node-only imports.
//
// Public pages are prerendered, so their scripts can't carry a per-request
// nonce and inline scripts stay allowed there. Admin pages render customer-
// typed text behind a privileged session, so they get a nonce instead: an
// injected <script> without this request's nonce won't run.

type CspOptions = {
  // Per-request nonce. When set, inline scripts must carry it.
  nonce?: string;
  isDev: boolean;
  supabaseUrl: string | undefined;
};

// The browser Supabase client talks to the project directly (session refresh,
// and realtime if it is ever used), so its origin must be allowed explicitly.
function supabaseOrigins(supabaseUrl: string | undefined): string[] {
  if (!supabaseUrl) return [];
  try {
    const { origin, host } = new URL(supabaseUrl);
    return [origin, `wss://${host}`];
  } catch {
    return [];
  }
}

export function buildCsp({ nonce, isDev, supabaseUrl }: CspOptions): string {
  // Dev tooling (React Refresh, error overlay) evaluates code; production
  // bundles don't.
  const devEval = isDev ? ["'unsafe-eval'"] : [];
  const scriptSrc = nonce
    ? ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...devEval]
    : ["'self'", "'unsafe-inline'", ...devEval];

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": scriptSrc,
    // React style props, FullCalendar's injected stylesheet, and next/font all
    // need inline styles. A nonce here would switch 'unsafe-inline' off.
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "blob:", "data:"],
    // next/font self-hosts Google Fonts, so nothing loads from Google.
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...supabaseOrigins(supabaseUrl)],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(" ")}`)
    .join("; ");
}

// 128 random bits, base64-encoded. Web Crypto works in both the edge and Node
// runtimes.
export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}
