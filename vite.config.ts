import path from "path"
import { Readable } from "node:stream"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv, type Plugin } from "vite"

const localFunctionRoutes: Record<string, string> = {
  "/api/assistant/briefing": "assistant-briefing",
  "/api/assistant/preferences": "assistant-preferences",
  "/api/assistant/threads": "assistant-threads",
  "/api/assistant/turns": "assistant-turns",
  "/api/assistant/voice-token": "assistant-voice-token",
  "/api/client-error": "client-error",
  "/api/deepgram/health": "deepgram-health",
  "/api/deepgram/token": "deepgram-token",
  "/api/import/accounts": "import-accounts",
  "/api/import/enrichment-status": "import-enrichment-status",
  "/api/import/opportunities": "import-opportunities",
  "/api/openai/account-enrichment": "account-enrichment",
  "/api/openai/contact-enrichment": "contact-enrichment",
  "/api/openai/customer-research": "customer-research",
  "/api/openai/health": "openai-health",
  "/api/openai/key": "openai-key",
  "/api/openai/live-guidance": "live-guidance",
  "/api/openai/live-question": "live-question",
  "/api/openai/live-state": "live-state",
  "/api/openai/post-call-outputs": "post-call-outputs",
  "/api/openai/seller-domain-research": "seller-domain-research",
  "/api/openai/speaker-attribution": "speaker-attribution",
  "/api/meeting-bots": "meeting-bots",
  "/api/session/activity": "session-activity",
  "/api/session/policy": "session-policy",
  "/api/session/status": "session-status",
  "/api/system/env": "env-check",
}

type LocalDynamicFunctionRoute = {
  functionName: string
  parameterNames: string[]
  pattern: RegExp
}

const localDynamicFunctionRoutes: LocalDynamicFunctionRoute[] = [
  {
    functionName: "assistant-messages",
    parameterNames: ["threadId"],
    pattern: /^\/api\/assistant\/threads\/([^/]+)\/messages$/,
  },
  {
    functionName: "assistant-thread",
    parameterNames: ["threadId"],
    pattern: /^\/api\/assistant\/threads\/([^/]+)$/,
  },
  {
    functionName: "assistant-action-confirm",
    parameterNames: ["proposalId"],
    pattern: /^\/api\/assistant\/actions\/([^/]+)\/confirm$/,
  },
  {
    functionName: "assistant-actions",
    parameterNames: ["proposalId"],
    pattern: /^\/api\/assistant\/actions\/([^/]+)$/,
  },
  {
    functionName: "next-call-brief-evidence",
    parameterNames: ["briefId", "itemId"],
    pattern: /^\/api\/next-call-briefs\/([^/]+)\/items\/([^/]+)\/evidence$/,
  },
  {
    functionName: "next-call-brief-apply",
    parameterNames: ["briefId"],
    pattern: /^\/api\/next-call-briefs\/([^/]+)\/apply-next-step$/,
  },
  {
    functionName: "next-call-brief",
    parameterNames: ["opportunityId"],
    pattern: /^\/api\/opportunities\/([^/]+)\/next-call-brief$/,
  },
  {
    functionName: "meeting-bots",
    parameterNames: ["sessionId", "participantId"],
    pattern: /^\/api\/meeting-bots\/([^/]+)\/participants\/([^/]+)\/attribution$/,
  },
  {
    functionName: "meeting-bots",
    parameterNames: ["sessionId"],
    pattern: /^\/api\/meeting-bots\/([^/]+)\/(?:heartbeat|disconnect|fallback)$/,
  },
  {
    functionName: "meeting-bots",
    parameterNames: ["sessionId"],
    pattern: /^\/api\/meeting-bots\/([^/]+)$/,
  },
]

function resolveLocalFunctionRoute(pathname: string) {
  const exactFunctionName = localFunctionRoutes[pathname]
  if (exactFunctionName) return { functionName: exactFunctionName, params: {} as Record<string, string> }

  for (const route of localDynamicFunctionRoutes) {
    const match = route.pattern.exec(pathname)
    if (!match) continue
    const params = Object.fromEntries(
      route.parameterNames.map((name, index) => [name, decodeLocalRouteParameter(match[index + 1] ?? "")])
    )
    return { functionName: route.functionName, params }
  }

  return null
}

function decodeLocalRouteParameter(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function normalizeModuleId(id: string) {
  return id.split(path.sep).join("/")
}

function localNetlifyFunctionsPlugin(): Plugin {
  return {
    name: "salesframe-local-netlify-functions",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const requestUrl = req.url ? new URL(req.url, `http://${req.headers.host ?? "127.0.0.1"}`) : null
        const route = requestUrl ? resolveLocalFunctionRoute(requestUrl.pathname) : null

        if (!requestUrl || !route) {
          next()
          return
        }

        try {
          const requestOptions: RequestInit & { duplex?: "half" } = {
            headers: req.headers as Record<string, string>,
            method: req.method,
          }

          if (req.method !== "GET" && req.method !== "HEAD") {
            requestOptions.body = Readable.toWeb(req) as unknown as RequestInit["body"]
            requestOptions.duplex = "half"
          }

          const module = await server.ssrLoadModule(`/netlify/functions/${route.functionName}.ts`)
          const localContext = {
            params: route.params,
            requestId: `local-${Date.now().toString(36)}`,
            waitUntil(promise: Promise<unknown>) {
              void Promise.resolve(promise).catch(() => {
                server.config.logger.error(`Local background work failed in ${route.functionName}.`)
              })
            },
          }
          const response: Response = await module.default(
            new Request(requestUrl.toString(), requestOptions),
            localContext
          )

          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (error) {
          server.config.logger.error(error instanceof Error ? error.stack ?? error.message : String(error))
          res.statusCode = 500
          res.setHeader("Content-Type", "application/json")
          res.end(JSON.stringify({ error: { code: "local_function_error", message: "Local function failed." } }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""))

  return {
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            const normalizedId = normalizeModuleId(id)

            if (
              normalizedId.includes("/src/hooks/use-call-capture.ts") ||
              normalizedId.includes("/src/lib/call-audio-preflight.ts") ||
              normalizedId.includes("/src/lib/turn-assembler.ts")
            ) return "call-capture"

            if (
              normalizedId.includes("/src/lib/supabase/salesframe-adapters.tsx") ||
              normalizedId.includes("/src/lib/supabase/salesframe-data.ts")
            ) return "salesframe-data"

            return undefined
          }

          if (
            id.includes("lucide-react") ||
            id.includes("radix-ui") ||
            id.includes("react-day-picker")
          ) return "ui"
          if (id.includes("@supabase")) return "supabase"
          if (
            id.includes("/node_modules/react/") ||
            id.includes("/node_modules/react-dom/") ||
            id.includes("/node_modules/scheduler/")
          ) return "react"

          return "vendor"
        },
      },
    },
  },
  plugins: [localNetlifyFunctionsPlugin(), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}
})
