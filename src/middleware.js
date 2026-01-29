import { paraglideMiddleware } from "./paraglide/server.js";

export function onRequest (context, next) {
    return paraglideMiddleware(context.request, ({ request }) => next(request));
};