export function onRequest(context) {
  setTimeout(() => {
    throw new Error("Sentry test error");
  });

  return new Response("Triggered test error", { status: 200 });
}
