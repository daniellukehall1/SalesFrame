import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type PasswordRecoveryFormValues = {
  password: string
  confirmPassword: string
}

type ValidationError = {
  field: keyof PasswordRecoveryFormValues
  message: string
}

export function PasswordRecoveryForm({
  className,
  isSubmitting = false,
  statusMessage,
  statusTone = "info",
  onBackToLogin,
  onFieldChange,
  onSubmit,
  ...props
}: Omit<React.ComponentProps<"div">, "onSubmit"> & {
  isSubmitting?: boolean
  statusMessage?: string
  statusTone?: "success" | "error" | "info"
  onBackToLogin?: () => void
  onFieldChange?: () => void
  onSubmit?: (values: PasswordRecoveryFormValues) => void
}) {
  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [validationError, setValidationError] = React.useState<ValidationError | null>(null)

  const clearFieldError = (field: keyof PasswordRecoveryFormValues) => {
    setValidationError((currentError) => currentError?.field === field ? null : currentError)
    onFieldChange?.()
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) return

    if (password.length < 8) {
      setValidationError({
        field: "password",
        message: "Password must be at least 8 characters.",
      })
      return
    }

    if (password !== confirmPassword) {
      setValidationError({
        field: "confirmPassword",
        message: "Passwords do not match.",
      })
      return
    }

    setValidationError(null)
    onSubmit?.({ confirmPassword, password })
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <h1 className="font-heading text-xl leading-snug font-medium">Choose a new password</h1>
          <CardDescription>
            Use at least 8 characters, then sign in with your updated password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form noValidate onSubmit={handleSubmit}>
            <FieldGroup>
              <Field data-invalid={validationError?.field === "password" || undefined}>
                <FieldLabel htmlFor="recovery-password">New password</FieldLabel>
                <Input
                  id="recovery-password"
                  autoComplete="new-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  aria-describedby={
                    validationError?.field === "password"
                      ? "recovery-password-help recovery-password-error"
                      : "recovery-password-help"
                  }
                  aria-invalid={validationError?.field === "password" || undefined}
                  minLength={8}
                  name="password"
                  spellCheck={false}
                  type="password"
                  value={password}
                  required
                  className="min-h-11 sm:min-h-8"
                  disabled={isSubmitting}
                  onChange={(event) => {
                    setPassword(event.currentTarget.value)
                    clearFieldError("password")
                  }}
                />
                <FieldDescription id="recovery-password-help">
                  Must be at least 8 characters long.
                </FieldDescription>
                {validationError?.field === "password" ? (
                  <FieldError id="recovery-password-error" aria-live="assertive">
                    {validationError.message}
                  </FieldError>
                ) : null}
              </Field>
              <Field data-invalid={validationError?.field === "confirmPassword" || undefined}>
                <FieldLabel htmlFor="recovery-confirm-password">Confirm new password</FieldLabel>
                <Input
                  id="recovery-confirm-password"
                  autoComplete="new-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  aria-describedby={validationError?.field === "confirmPassword" ? "recovery-confirm-password-error" : undefined}
                  aria-invalid={validationError?.field === "confirmPassword" || undefined}
                  minLength={8}
                  name="confirmPassword"
                  spellCheck={false}
                  type="password"
                  value={confirmPassword}
                  required
                  className="min-h-11 sm:min-h-8"
                  disabled={isSubmitting}
                  onChange={(event) => {
                    setConfirmPassword(event.currentTarget.value)
                    clearFieldError("confirmPassword")
                  }}
                />
                {validationError?.field === "confirmPassword" ? (
                  <FieldError id="recovery-confirm-password-error" aria-live="assertive">
                    {validationError.message}
                  </FieldError>
                ) : null}
              </Field>
              <Field>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button type="submit" className="min-h-11 sm:min-h-8" disabled={isSubmitting}>
                    {isSubmitting ? "Updating password..." : "Update password"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 sm:min-h-8"
                    disabled={isSubmitting}
                    onClick={onBackToLogin}
                  >
                    Back to sign in
                  </Button>
                </div>
                {statusMessage ? (
                  <FieldDescription
                    className={cn(
                      "text-center",
                      statusTone === "error" && "text-destructive",
                      statusTone === "success" && "text-emerald-600"
                    )}
                    aria-live={statusTone === "error" ? "assertive" : "polite"}
                    role={statusTone === "error" ? "alert" : "status"}
                  >
                    {statusMessage}
                  </FieldDescription>
                ) : null}
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
