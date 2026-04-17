export const dispatchByAction = <TAction extends string, TResult>(
  action: TAction,
  handlers: Partial<Record<TAction, () => TResult>>,
  onUnknown: (action: TAction) => TResult
): TResult => {
  const handler = handlers[action]
  if (handler == null) {
    return onUnknown(action)
  }
  return handler()
}
