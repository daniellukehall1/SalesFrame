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
  "inline-flex min-h-10 items-center rounded-md px-1 underline underline-offset-4 outline-none transition-[color,box-shadow,opacity] duration-150 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline sm:min-h-7"

export type LoginFormValues = {
  email: string
  password: string
}

export function LoginForm({
  className,
  isSubmitting = false,
  statusMessage,
  statusTone = "info",
  onFieldChange,
  onForgotPassword,
  onSubmit,
  onSwitchToSignup,
  ...props
}: Omit<React.ComponentProps<"div">, "onSubmit"> & {
  isSubmitting?: boolean
  statusMessage?: string
  statusTone?: "success" | "error" | "info"
  onFieldChange?: () => void
  onForgotPassword?: (email: string) => void
  onSubmit?: (values: LoginFormValues) => void
  onSwitchToSignup?: () => void
}) {
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) return

    onSubmit?.({
      email,
      password,
    })
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>
            Pick up where the last conversation left off.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="login-email">Email</FieldLabel>
                <Input
                  id="login-email"
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
                <div className="flex items-center">
                  <FieldLabel htmlFor="login-password">Password</FieldLabel>
                  <button
                    type="button"
                    className={cn(authTextButtonClass, "ml-auto inline-block text-sm")}
                    disabled={isSubmitting}
                    onClick={() => onForgotPassword?.(email)}
                  >
                    Forgot your password?
                  </button>
                </div>
                <Input
                  id="login-password"
                  autoComplete="current-password"
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
                <Button type="submit" className="min-h-11 sm:min-h-8" disabled={isSubmitting}>
                  {isSubmitting ? "Opening SalesFrame..." : "Log in"}
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
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    className={authTextButtonClass}
                    disabled={isSubmitting}
                    onClick={onSwitchToSignup}
                  >
                    Sign up
                  </button>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
