import * as Sentry from "@sentry/astro";

Sentry.init({
  dsn: "https://122dd5fa55f21de39dc39c7abbe5555d@o4510985596043264.ingest.de.sentry.io/4510985606922320",
  // Adds request headers and IP for users, for more info visit:
  // https://docs.sentry.io/platforms/javascript/guides/astro/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
});