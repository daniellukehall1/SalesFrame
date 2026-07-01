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
  onLegalClick,
  onSubmit,
  onSwitchToLogin,
  ...props
}: Omit<React.ComponentProps<"div">, "onSubmit"> & {
  isSubmitting?: boolean
  statusMessage?: string
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
          <CardTitle className="text-xl">Create your account</CardTitle>
          <CardDescription>
            Enter your email below to create your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="signup-name">Full Name</FieldLabel>
                <Input
                  id="signup-name"
                  type="text"
                  value={name}
                  placeholder="John Doe"
                  required
                  onChange={(event) => setName(event.currentTarget.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="signup-email">Email</FieldLabel>
                <Input
                  id="signup-email"
                  type="email"
                  value={email}
                  placeholder="m@example.com"
                  required
                  onChange={(event) => setEmail(event.currentTarget.value)}
                />
              </Field>
              <Field>
                <Field className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="signup-password">Password</FieldLabel>
                    <Input
                      id="signup-password"
                      type="password"
                      value={password}
                      required
                      onChange={(event) => setPassword(event.currentTarget.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="signup-confirm-password">
                      Confirm Password
                    </FieldLabel>
                    <Input
                      id="signup-confirm-password"
                      type="password"
                      value={confirmPassword}
                      required
                      onChange={(event) => setConfirmPassword(event.currentTarget.value)}
                    />
                  </Field>
                </Field>
                <FieldDescription>
                  Must be at least 8 characters long.
                </FieldDescription>
              </Field>
              <Field>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Creating account..." : "Create Account"}
                </Button>
                {statusMessage ? (
                  <FieldDescription className="text-center" aria-live="polite">
                    {statusMessage}
                  </FieldDescription>
                ) : null}
                <FieldDescription className="text-center">
                  Already have an account?{" "}
                  <button
                    type="button"
                    className="underline underline-offset-4 hover:text-primary"
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
        By clicking continue, you agree to our{" "}
        <button
          type="button"
          className="underline underline-offset-4 hover:text-primary"
          onClick={() => onLegalClick?.("terms")}
        >
          Terms of Service
        </button>{" "}
        and{" "}
        <button
          type="button"
          className="underline underline-offset-4 hover:text-primary"
          onClick={() => onLegalClick?.("privacy")}
        >
          Privacy Policy
        </button>
        .
      </FieldDescription>
    </div>
  )
}
