export type RecordingPointerSnapshot =
  | { status: "read-failed" }
  | { status: "call-missing" }
  | { status: "found"; path: string | null }

export type RecordingUploadRecoveryAction = "linked" | "preserve-upload" | "remove-upload"

/**
 * A just-uploaded object is removable only when the call has gone away or a
 * different immutable upload won the pointer race. A null or unreadable pointer
 * can still be the result of an in-flight, ambiguously failed update, so the
 * upload is preserved for later reconciliation rather than risking data loss.
 */
export function getRecordingUploadRecoveryAction({
  pointer,
  uploadedPath,
}: {
  pointer: RecordingPointerSnapshot
  uploadedPath: string
}): RecordingUploadRecoveryAction {
  if (pointer.status === "read-failed") return "preserve-upload"
  if (pointer.status === "call-missing") return "remove-upload"
  if (pointer.path === uploadedPath) return "linked"
  if (pointer.path === null) return "preserve-upload"

  return "remove-upload"
}
