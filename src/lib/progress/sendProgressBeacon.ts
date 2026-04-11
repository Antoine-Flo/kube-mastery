const PROGRESS_COMPLETE_PATH = '/api/progress/complete'

export type ProgressBeaconPayload =
  | { lessonId: string }
  | { type: 'drill'; targetId: string }

/**
 * Fire-and-forget progress update. Uses sendBeacon so the request is not
 * cancelled when the page unloads right after navigation.
 */
export function sendProgressCompleteBeacon(
  payload: ProgressBeaconPayload
): void {
  const blob = new Blob([JSON.stringify(payload)], {
    type: 'application/json'
  })
  navigator.sendBeacon(PROGRESS_COMPLETE_PATH, blob)
}
