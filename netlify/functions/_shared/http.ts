export class AppError extends Error {
  code: string
  status: number

  constructor(code: string, message: string, status = 500) {
    super(message)
    this.name = "AppError"
    this.code = code
    this.status = status
  }
}

export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  })
}

export function dataResponse(data: unknown, status = 200) {
  return jsonResponse({ data }, status)
}

export function errorResponse(error: unknown, defaultMessage = "Request failed.") {
  const appError =
    error instanceof AppError
      ? error
      : isMissingServerConfiguration(error)
        ? new AppError(
            "server_configuration_missing",
            "SalesFrame AI services are not configured for this environment.",
            503
          )
        : new AppError("server_error", error instanceof Error ? error.message : defaultMessage)

  return jsonResponse(
    {
      error: {
        code: appError.code,
        message: appError.message,
      },
    },
    appError.status
  )
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T
  } catch {
    throw badRequest("Request body must be valid JSON.")
  }
}

export function badRequest(message: string, code = "bad_request") {
  return new AppError(code, message, 400)
}

export function unauthorized(message = "Sign in before using this feature.") {
  return new AppError("unauthorized", message, 401)
}

export function forbidden(message = "You do not have access to this workspace data.") {
  return new AppError("forbidden", message, 403)
}

export function notFound(message = "Record was not found.") {
  return new AppError("not_found", message, 404)
}

export function methodNotAllowed() {
  return new AppError("method_not_allowed", "Method not allowed.", 405)
}

export function upstreamFailure(message: string, code = "upstream_failure") {
  return new AppError(code, message, 502)
}

function isMissingServerConfiguration(error: unknown) {
  return (
    error instanceof Error &&
    /^Missing required environment variable: /.test(error.message)
  )
}
