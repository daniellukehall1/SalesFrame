import path from "path"
import { Readable } from "node:stream"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv, type Plugin } from "vite"

const localFunctionRoutes: Record<string, string> = {
  "/api/import/accounts": "import-accounts",
  "/api/import/opportunities": "import-opportunities",
  "/api/openai/account-enrichment": "account-enrichment",
  "/api/openai/call-diarization": "call-diarization",
  "/api/openai/customer-research": "customer-research",
  "/api/openai/key": "openai-key",
  "/api/openai/live-guidance": "live-guidance",
  "/api/openai/live-state": "live-state",
  "/api/openai/post-call-outputs": "post-call-outputs",
  "/api/openai/realtime-transcription": "realtime-transcription",
  "/api/openai/seller-domain-research": "seller-domain-research",
  "/api/openai/speaker-attribution": "speaker-attribution",
}

function localNetlifyFunctionsPlugin(): Plugin {
  return {
    name: "salesframe-local-netlify-functions",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const requestUrl = req.url ? new URL(req.url, `http://${req.headers.host ?? "127.0.0.1"}`) : null
        const functionName = requestUrl ? localFunctionRoutes[requestUrl.pathname] : undefined

        if (!requestUrl || !functionName) {
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

          const module = await server.ssrLoadModule(`/netlify/functions/${functionName}.ts`)
          const response: Response = await module.default(new Request(requestUrl.toString(), requestOptions), {})

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
          if (!id.includes("node_modules")) return undefined
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
