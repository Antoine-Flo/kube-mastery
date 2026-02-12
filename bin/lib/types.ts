export type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E }

export const success = <T>(value: T): Result<T> => ({ ok: true, value })
export const error = <E = string>(message: E): Result<never, E> => ({
  ok: false,
  error: message
})
