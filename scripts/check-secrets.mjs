import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"

const secretRules = [
  {
    label: "OpenAI API key",
    pattern: /\bsk-(?:proj|live|test)-[A-Za-z0-9_-]{32,}\b/g,
  },
  {
    label: "OpenAI API key",
    pattern: /\bsk-[A-Za-z0-9]{32,}\b/g,
  },
  {
    label: "GitHub token",
    pattern: /\bgh[pousr]_[A-Za-z0-9_]{24,}\b/g,
  },
  {
    label: "GitHub fine-grained token",
    pattern: /\bgithub_pat_[A-Za-z0-9_]{80,}\b/g,
  },
  {
    label: "Supabase secret key",
    pattern: /\bsb_secret_[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    label: "Supabase personal access token",
    pattern: /\bsbp_[A-Fa-f0-9]{32,}\b/g,
  },
  {
    label: "Recall API key or raw 40-character credential",
    pattern: /\b[A-Fa-f0-9]{40}\b/g,
  },
  {
    label: "Credentialed Postgres URL",
    pattern: /\bpostgres(?:ql)?:\/\/[^:\s/@]+:[^@\s]+@/gi,
  },
]

const binaryExtensions = new Set([
  ".avif",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".mov",
  ".mp3",
  ".mp4",
  ".otf",
  ".pdf",
  ".png",
  ".ttf",
  ".webm",
  ".webp",
  ".woff",
  ".woff2",
])

function getRepositoryFiles() {
  const trackedFiles = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  const untrackedFiles = execFileSync(
    "git",
    ["ls-files", "--others", "--exclude-standard", "-z"],
    { encoding: "utf8" }
  )

  return [...new Set(`${trackedFiles}${untrackedFiles}`.split("\0").filter(Boolean))]
}

function getExtension(filePath) {
  const index = filePath.lastIndexOf(".")
  return index >= 0 ? filePath.slice(index).toLowerCase() : ""
}

function getLineAndColumn(text, index) {
  const before = text.slice(0, index)
  const lines = before.split("\n")

  return {
    column: lines[lines.length - 1].length + 1,
    line: lines.length,
  }
}

function decodeBase64Url(value) {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=")
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
}

function findServiceRoleJwt(text) {
  const matches = []
  const jwtPattern = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g

  for (const match of text.matchAll(jwtPattern)) {
    const token = match[0]
    const payload = token.split(".")[1]

    try {
      const decoded = JSON.parse(decodeBase64Url(payload))
      if (decoded?.role === "service_role") {
        matches.push({
          index: match.index ?? 0,
          label: "Supabase service-role JWT",
        })
      }
    } catch {
      // Ignore non-JSON JWT-shaped strings.
    }
  }

  return matches
}

const findings = []

for (const filePath of getRepositoryFiles()) {
  if (binaryExtensions.has(getExtension(filePath))) continue

  let text = ""
  try {
    text = readFileSync(filePath, "utf8")
  } catch {
    continue
  }

  for (const rule of secretRules) {
    for (const match of text.matchAll(rule.pattern)) {
      findings.push({
        filePath,
        ...getLineAndColumn(text, match.index ?? 0),
        label: rule.label,
      })
    }
  }

  for (const match of findServiceRoleJwt(text)) {
    findings.push({
      filePath,
      ...getLineAndColumn(text, match.index),
      label: match.label,
    })
  }
}

if (findings.length) {
  console.error("Potential secrets were found in repository files:")
  for (const finding of findings) {
    console.error(`- ${finding.filePath}:${finding.line}:${finding.column} ${finding.label}`)
  }
  console.error("Move live secrets to Netlify or Supabase environment settings before committing.")
  process.exit(1)
}

console.log("No secrets found in tracked or untracked repository files.")
