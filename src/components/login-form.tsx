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

export type LoginFormValues = {
  email: string
  password: string
}

export function LoginForm({
  className,
  isSubmitting = false,
  statusMessage,
  onForgotPassword,
  onSubmit,
  onSwitchToSignup,
  ...props
}: Omit<React.ComponentProps<"div">, "onSubmit"> & {
  isSubmitting?: boolean
  statusMessage?: string
  onForgotPassword?: (email: string) => void
  onSubmit?: (values: LoginFormValues) => void
  onSwitchToSignup?: () => void
}) {
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit?.({
      email,
      password,
    })
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Login to your account</CardTitle>
          <CardDescription>
            Enter your email below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="login-email">Email</FieldLabel>
                <Input
                  id="login-email"
                  type="email"
                  value={email}
                  placeholder="m@example.com"
                  required
                  onChange={(event) => setEmail(event.currentTarget.value)}
                />
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="login-password">Password</FieldLabel>
                  <button
                    type="button"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                    onClick={() => onForgotPassword?.(email)}
                  >
                    Forgot your password?
                  </button>
                </div>
                <Input
                  id="login-password"
                  type="password"
                  value={password}
                  required
                  onChange={(event) => setPassword(event.currentTarget.value)}
                />
              </Field>
              <Field>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Logging in..." : "Login"}
                </Button>
                {statusMessage ? (
                  <FieldDescription className="text-center" aria-live="polite">
                    {statusMessage}
                  </FieldDescription>
                ) : null}
                <FieldDescription className="text-center">
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    className="underline underline-offset-4 hover:text-primary"
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
