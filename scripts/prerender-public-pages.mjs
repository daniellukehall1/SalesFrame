import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

const projectRoot = process.cwd()
const outputDirectory = path.join(projectRoot, "dist")
const serverBuildDirectory = path.join(projectRoot, ".salesframe-prerender")
const serverEntry = path.join(serverBuildDirectory, "prerender-public-marketing.js")

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('"', "&quot;")
}

function replaceMeta(html, attribute, name, value) {
  const pattern = new RegExp(`<meta\\s+${attribute}="${name}"[\\s\\S]*?\\/>`)
  const replacement = `<meta ${attribute}="${name}" content="${escapeAttribute(value)}" />`

  if (!pattern.test(html)) throw new Error(`Missing ${attribute}=${name} metadata in the HTML template`)
  return html.replace(pattern, replacement)
}

function replaceCanonical(html, canonicalUrl) {
  const pattern = /<link\s+rel="canonical"[\s\S]*?\/>/
  if (!pattern.test(html)) throw new Error("Missing canonical link in the HTML template")

  return html.replace(pattern, `<link rel="canonical" href="${escapeAttribute(canonicalUrl)}" />`)
}

function replaceStructuredData(html, routeSchema) {
  const pattern = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/
  const match = html.match(pattern)
  if (!match) throw new Error("Missing structured data in the HTML template")

  const baseSchema = JSON.parse(match[1])
  const sharedGraph = baseSchema["@graph"].filter((item) =>
    ["Organization", "WebSite", "SoftwareApplication"].includes(item["@type"])
  )
  const sharedSchema = {
    "@context": "https://schema.org",
    "@graph": sharedGraph,
  }

  return html.replace(
    pattern,
    `<script type="application/ld+json">\n${JSON.stringify(sharedSchema, null, 2)}\n    </script>\n    <script id="salesframe-public-page-schema" type="application/ld+json">\n${JSON.stringify(routeSchema, null, 2)}\n    </script>`
  )
}

function buildRouteDocument(template, route) {
  const { canonicalUrl, description, imageAlt, imageHeight, imageUrl, imageWidth, keywords, schema, title } = route.metadata
  let html = template.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`)

  html = replaceMeta(html, "name", "description", description)
  html = replaceMeta(html, "name", "keywords", keywords)
  html = replaceCanonical(html, canonicalUrl)
  html = replaceMeta(html, "property", "og:url", canonicalUrl)
  html = replaceMeta(html, "property", "og:title", title)
  html = replaceMeta(html, "property", "og:description", description)
  html = replaceMeta(html, "property", "og:image", imageUrl)
  html = replaceMeta(html, "property", "og:image:alt", imageAlt)
  html = replaceMeta(html, "property", "og:image:width", String(imageWidth))
  html = replaceMeta(html, "property", "og:image:height", String(imageHeight))
  html = replaceMeta(html, "name", "twitter:title", title)
  html = replaceMeta(html, "name", "twitter:description", description)
  html = replaceMeta(html, "name", "twitter:image", imageUrl)
  html = replaceMeta(html, "name", "twitter:image:alt", imageAlt)
  html = replaceStructuredData(html, schema)

  const rootMarkup = `<div id="root" data-prerendered-public-route="${escapeAttribute(route.path)}">${route.html}</div>`
  if (!html.includes('<div id="root"></div>')) throw new Error("Missing root mount point in the HTML template")

  return html.replace('<div id="root"></div>', rootMarkup)
}

try {
  const { prerenderPublicMarketingPages } = await import(pathToFileURL(serverEntry).href)
  const routes = prerenderPublicMarketingPages()
  const template = await readFile(path.join(outputDirectory, "index.html"), "utf8")

  for (const route of routes) {
    const outputPath = path.join(outputDirectory, `${route.path.slice(1)}.html`)
    const html = buildRouteDocument(template, route)

    await mkdir(path.dirname(outputPath), { recursive: true })
    await writeFile(outputPath, html)
  }

  process.stdout.write(`Prerendered ${routes.length} public marketing pages.\n`)
} finally {
  await rm(serverBuildDirectory, { force: true, recursive: true })
}
