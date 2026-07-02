import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const authTextButtonClass =
  "inline-flex min-h-10 items-center rounded-md px-1 underline underline-offset-4 outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline sm:min-h-7"

export type SignupFormValues = {
  name: string
  email: string
  password: string
  confirmPassword: string
}

export function SignupForm({
  className,
  isSubmitting = false,
  statusMessage,
  statusTone = "info",
  onFieldChange,
  onLegalClick,
  onSubmit,
  onSwitchToLogin,
  ...props
}: Omit<React.ComponentProps<"div">, "onSubmit"> & {
  isSubmitting?: boolean
  statusMessage?: string
  statusTone?: "success" | "error" | "info"
  onFieldChange?: () => void
  onLegalClick?: (document: "terms" | "privacy") => void
  onSubmit?: (values: SignupFormValues) => void
  onSwitchToLogin?: () => void
}) {
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) return

    onSubmit?.({
      confirmPassword,
      email,
      name,
      password,
    })
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Start selling with SalesFrame</CardTitle>
          <CardDescription>
            Set up your login, then we will help you shape the workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="signup-name">Full name</FieldLabel>
                <Input
                  id="signup-name"
                  autoComplete="name"
                  name="name"
                  type="text"
                  value={name}
                  placeholder="Your name"
                  required
                  className="min-h-11 sm:min-h-8"
                  onChange={(event) => {
                    setName(event.currentTarget.value)
                    onFieldChange?.()
                  }}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="signup-email">Email</FieldLabel>
                <Input
                  id="signup-email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  inputMode="email"
                  name="email"
                  spellCheck={false}
                  type="email"
                  value={email}
                  placeholder="you@company.com"
                  required
                  className="min-h-11 sm:min-h-8"
                  onChange={(event) => {
                    setEmail(event.currentTarget.value)
                    onFieldChange?.()
                  }}
                />
              </Field>
              <Field>
                <Field className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="signup-password">Password</FieldLabel>
                    <Input
                      id="signup-password"
                      autoComplete="new-password"
                      autoCapitalize="none"
                      autoCorrect="off"
                      minLength={8}
                      name="password"
                      spellCheck={false}
                      type="password"
                      value={password}
                      required
                      className="min-h-11 sm:min-h-8"
                      onChange={(event) => {
                        setPassword(event.currentTarget.value)
                        onFieldChange?.()
                      }}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="signup-confirm-password">
                      Confirm Password
                    </FieldLabel>
                    <Input
                      id="signup-confirm-password"
                      autoComplete="new-password"
                      autoCapitalize="none"
                      autoCorrect="off"
                      minLength={8}
                      name="confirmPassword"
                      spellCheck={false}
                      type="password"
                      value={confirmPassword}
                      required
                      className="min-h-11 sm:min-h-8"
                      onChange={(event) => {
                        setConfirmPassword(event.currentTarget.value)
                        onFieldChange?.()
                      }}
                    />
                  </Field>
                </Field>
                <FieldDescription>
                  Must be at least 8 characters long.
                </FieldDescription>
              </Field>
              <Field>
                <Button type="submit" className="min-h-11 sm:min-h-8" disabled={isSubmitting}>
                  {isSubmitting ? "Creating your account..." : "Create account"}
                </Button>
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
                <FieldDescription className="text-center">
                  Already have an account?{" "}
                  <button
                    type="button"
                    className={authTextButtonClass}
                    disabled={isSubmitting}
                    onClick={onSwitchToLogin}
                  >
                    Sign in
                  </button>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        By creating an account, you agree to our{" "}
        <button
          type="button"
          className={authTextButtonClass}
          disabled={isSubmitting}
          onClick={() => onLegalClick?.("terms")}
        >
          Terms of Service
        </button>{" "}
        and{" "}
        <button
          type="button"
          className={authTextButtonClass}
          disabled={isSubmitting}
          onClick={() => onLegalClick?.("privacy")}
        >
          Privacy Policy
        </button>
        .
      </FieldDescription>
    </div>
  )
}
