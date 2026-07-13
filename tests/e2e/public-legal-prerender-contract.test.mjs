import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  getPublicLegalDocument,
  getPublicLegalPageMetadata,
  normalizePublicLegalPath,
  publicLegalPaths,
} from "../../src/lib/public-legal-routes.ts"
import { publicMarketingPaths } from "../../src/lib/public-marketing-routes.ts"

const root = new URL("../../", import.meta.url)
const read = (path) => readFile(new URL(path, root), "utf8")

test("legal prerenders extend rather than replace the 29 marketing routes", () => {
  assert.equal(publicMarketingPaths.length, 29)
  assert.deepEqual(publicLegalPaths, ["/terms", "/privacy"])
  assert.equal(new Set([...publicMarketingPaths, ...publicLegalPaths]).size, 31)
})

test("legal route normalization supports clean and generated HTML paths", () => {
  assert.equal(normalizePublicLegalPath("/terms"), "/terms")
  assert.equal(normalizePublicLegalPath("/terms/"), "/terms")
  assert.equal(normalizePublicLegalPath("/privacy.html"), "/privacy")
  assert.equal(getPublicLegalDocument("/terms"), "terms")
  assert.equal(getPublicLegalDocument("/privacy"), "privacy")
  assert.equal(normalizePublicLegalPath("/login"), null)
})

test("each legal route has crawler-ready route-specific metadata and schema", () => {
  for (const path of publicLegalPaths) {
    const metadata = getPublicLegalPageMetadata(path)
    assert.ok(metadata)
    assert.equal(metadata.canonicalUrl, `https://salesframe.ai${path}`)
    assert.match(metadata.title, /SalesFrame/)
    assert.ok(metadata.description.length > 80)
    assert.match(metadata.robots, /^index, follow/)
    assert.ok(metadata.keywords.length > 30)

    const graph = metadata.schema["@graph"]
    assert.ok(Array.isArray(graph))
    assert.ok(graph.some((item) => item["@type"] === "WebPage" && item.url === metadata.canonicalUrl))
    assert.ok(graph.some((item) => item["@type"] === "BreadcrumbList"))
  }

  assert.notEqual(
    getPublicLegalPageMetadata("/terms").description,
    getPublicLegalPageMetadata("/privacy").description
  )
})

test("legal pages render through the shared prerender and hydration pipeline", async () => {
  const [legalPage, main, prerenderEntry, prerenderScript] = await Promise.all([
    read("src/components/legal-document-page.tsx"),
    read("src/main.tsx"),
    read("src/prerender-public-marketing.tsx"),
    read("scripts/prerender-public-pages.mjs"),
  ])

  assert.match(legalPage, /<CardTitle><h1>\{title\}<\/h1><\/CardTitle>/)
  assert.match(legalPage, /schema\.textContent = JSON\.stringify\(metadata\.schema\)/)
  assert.match(legalPage, /export function PublicLegalDocumentPage/)
  assert.match(prerenderEntry, /publicLegalPaths\.map/)
  assert.match(prerenderEntry, /renderToString\(<PublicLegalDocumentPage/)
  assert.match(prerenderScript, /const routes = \[\.\.\.marketingRoutes, \.\.\.legalRoutes\]/)
  assert.match(prerenderScript, /replaceMeta\(html, "name", "robots", robots\)/)
  assert.match(main, /normalizePublicLegalPath\(window\.location\.pathname\)/)
  assert.match(main, /rootElement\.dataset\.prerenderedPublicRoute === publicLegalPath/)
  assert.match(main, /hydrateRoot\(rootElement, content\)/)
})
