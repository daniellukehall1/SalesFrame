import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"

const root = new URL("../../", import.meta.url)

async function read(path) {
  return readFile(new URL(path, root), "utf8")
}

test("password recovery has accessible validation and calm submit states", async () => {
  const form = await read("src/components/password-recovery-form.tsx")

  assert.match(form, /export type PasswordRecoveryFormValues = \{[\s\S]*password: string[\s\S]*confirmPassword: string/)
  assert.match(form, /<h1[^>]*>Choose a new password<\/h1>/)
  assert.match(form, /<form noValidate onSubmit=\{handleSubmit\}>/)
  assert.match(form, /password\.length < 8[\s\S]*Password must be at least 8 characters\./)
  assert.match(form, /password !== confirmPassword[\s\S]*Passwords do not match\./)
  assert.match(form, /id="recovery-password"[\s\S]*autoComplete="new-password"[\s\S]*minLength=\{8\}[\s\S]*name="password"/)
  assert.match(form, /id="recovery-confirm-password"[\s\S]*autoComplete="new-password"[\s\S]*minLength=\{8\}[\s\S]*name="confirmPassword"/)
  assert.match(form, /aria-invalid=\{validationError\?\.field === "password" \|\| undefined\}/)
  assert.match(form, /aria-invalid=\{validationError\?\.field === "confirmPassword" \|\| undefined\}/)
  assert.match(form, /<FieldError id="recovery-password-error" aria-live="assertive">/)
  assert.match(form, /<FieldError id="recovery-confirm-password-error" aria-live="assertive">/)
  assert.match(form, /isSubmitting \? "Updating password\.\.\." : "Update password"/)
  assert.match(form, /disabled=\{isSubmitting\}[\s\S]*onClick=\{onBackToLogin\}[\s\S]*Back to sign in/)
  assert.match(form, /aria-live=\{statusTone === "error" \? "assertive" : "polite"\}/)
})

test("auth page exposes recovery mode and remains reachable in short dynamic viewports", async () => {
  const authPage = await read("src/components/auth-page.tsx")

  assert.match(authPage, /export type AuthMode = "login" \| "signup"/)
  assert.match(authPage, /export type AuthPageMode = AuthMode \| "recovery"/)
  assert.match(authPage, /mode: AuthPageMode/)
  assert.match(authPage, /onPasswordRecovery\?: \(values: PasswordRecoveryFormValues\) => void/)
  assert.match(authPage, /onRecoveryCancel\?: \(\) => void/)
  assert.match(authPage, /const isRecovery = mode === "recovery"/)
  assert.match(authPage, /aria-label="Back to home"[\s\S]*disabled=\{isRecovery && isSubmitting\}/)
  assert.match(authPage, /isRecovery \? \([\s\S]*<PasswordRecoveryForm/)
  assert.match(authPage, /onSubmit=\{onPasswordRecovery\}/)
  assert.match(authPage, /onRecoveryCancel\(\)[\s\S]*onModeChange\("login"\)/)
  assert.match(authPage, /<main className="grid h-dvh min-h-0 overflow-y-auto overscroll-y-contain/)
  assert.match(authPage, /<section className="flex min-h-dvh min-w-0 flex-col">/)
  assert.match(authPage, /<div className="my-auto w-full max-w-sm">/)
})
