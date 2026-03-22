import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Set tracesSampleRate to 1.0 for production monitoring
  tracesSampleRate: 1.0,

  // Set profilesSampleRate to 1.0 for profiling
  profilesSampleRate: 1.0,

  // Filter out noisy errors
  ignoreErrors: [
    'NetworkError',
    'Network request failed',
    'Failed to fetch',
    'Load failed',
    'ChunkLoadError',
  ],

  // Replay configuration
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,

  // Send default PII
  sendDefaultPii: true,
});
