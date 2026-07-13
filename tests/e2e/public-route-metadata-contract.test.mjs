import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const root = new URL("../../", import.meta.url)
const read = (path) => readFile(new URL(path, root), "utf8")

test("legal pages expose a semantic heading and route-specific metadata", async () => {
  const legalPage = await read("src/components/legal-document-page.tsx")

  assert.match(legalPage, /<CardTitle><h1>\{title\}<\/h1><\/CardTitle>/)
  assert.match(legalPage, /globalThis\.document\.title = `\$\{title\} · SalesFrame`/)
  assert.match(legalPage, /const canonicalUrl = `https:\/\/salesframe\.ai\/\$\{document\}`/)
  assert.match(legalPage, /meta\[name="robots"\]/)
  assert.match(legalPage, /index, follow, max-snippet:-1/)
  assert.match(legalPage, /meta\[name="description"\]/)
})

test("authentication and private workspace routes cannot inherit indexable homepage metadata", async () => {
  const app = await read("src/App.tsx")

  assert.match(app, /function applyPublicAuthPageMetadata/)
  assert.match(app, /noindex, nofollow, noarchive/)
  assert.match(app, /https:\/\/salesframe\.ai\/\$\{mode === "signup" \? "signup" : "login"\}/)
  assert.match(app, /function applyAuthenticatedPageMetadata/)
  assert.match(app, /link\[rel="canonical"\][\s\S]*https:\/\/salesframe\.ai\/app/)
  assert.match(app, /if \(legalPage \|\| publicMarketingPath \|\| isPublicLandingRouteOverride\(\)\) return/)
})

test("public marketing routes restore crawlable robots metadata after auth navigation", async () => {
  const landing = await read("src/components/marketing-landing-page.tsx")
  const marketingPage = await read("src/components/public-marketing-page.tsx")

  for (const source of [landing, marketingPage]) {
    assert.match(source, /meta\[name="robots"\]/)
    assert.match(source, /index, follow, max-image-preview:large/)
  }
})
