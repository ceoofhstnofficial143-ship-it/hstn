import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Set tracesSampleRate for server-side
  tracesSampleRate: 1.0,
  
  // Set profilesSampleRate for profiling
  profilesSampleRate: 1.0,
});
