import * as Sentry from "@sentry/cloudflare";

export const onRequest = [
  // Make sure Sentry is the first middleware
  Sentry.sentryPagesPlugin((context) => ({
    dsn: "https://58cca808cd286019376fb01cc260ba59@o4510985596043264.ingest.de.sentry.io/4510985622650965",

    // Setting this option to true will send default PII data to Sentry.
    // For example, automatic IP address collection on events
    sendDefaultPii: true,
  })),
  // Add more middlewares here
];