import { readFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"

const workspaceRoot = process.cwd()
const projectRef =
  process.env.SUPABASE_PROJECT_REF ||
  (await readOptionalText(path.join(workspaceRoot, "supabase/.temp/project-ref"))).trim()
const accessToken = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PAT

if (!projectRef) {
  fail("SUPABASE_PROJECT_REF is required, or supabase/.temp/project-ref must exist.")
}

if (!accessToken) {
  fail("SUPABASE_ACCESS_TOKEN is required to update hosted Supabase auth settings.")
}

const confirmationHtml = await readFile(
  path.join(workspaceRoot, "supabase/templates/confirmation.html"),
  "utf8"
)
const recoveryHtml = await readFile(
  path.join(workspaceRoot, "supabase/templates/recovery.html"),
  "utf8"
)

const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
  body: JSON.stringify({
    mailer_autoconfirm: false,
    mailer_subjects_confirmation: "Welcome to SalesFrame",
    mailer_subjects_recovery: "Reset your SalesFrame password",
    mailer_templates_confirmation_content: confirmationHtml,
    mailer_templates_recovery_content: recoveryHtml,
  }),
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  },
  method: "PATCH",
})

const bodyText = await response.text()

if (!response.ok) {
  fail(`Supabase auth template sync failed (${response.status}): ${bodyText}`)
}

console.log("Supabase auth email templates synced.")

async function readOptionalText(filePath) {
  try {
    return await readFile(filePath, "utf8")
  } catch {
    return ""
  }
}

function fail(message) {
  console.error(message)
  process.exit(1)
}
