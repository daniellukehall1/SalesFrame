import type { Config, Context } from "@netlify/functions"

import {
  getEnv,
  optionalEnvNames,
  optionalFrontendEnvNames,
  optionalServerEnvNames,
  requiredEnvNames,
  requiredFrontendEnvNames,
  requiredServerEnvNames,
} from "./_shared/env"
import { dataResponse, errorResponse } from "./_shared/http"
import { requireUser } from "./_shared/supabase"

function getEnvStatus(name: string) {
  return {
    name,
    configured: Boolean(getEnv(name)),
  }
}

export default async (request: Request, _context: Context) => {
  try {
    await requireUser(request)

    const required = requiredEnvNames.map(getEnvStatus)
    const optional = optionalEnvNames.map(getEnvStatus)
    const missing = required
      .filter((item) => !item.configured)
      .map((item) => item.name)

    return dataResponse({
      ready: missing.length === 0,
      missing,
      required,
      optional,
      groups: {
        frontend: requiredFrontendEnvNames,
        optionalFrontend: optionalFrontendEnvNames,
        server: requiredServerEnvNames,
      },
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export const config: Config = {
  path: "/api/system/env",
  method: ["GET"],
}
