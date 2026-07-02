import {
  ArrowLeftIcon,
  AudioLinesIcon,
  MoonIcon,
  ShieldCheckIcon,
  SunIcon,
  TargetIcon,
} from "lucide-react"

import { LoginForm, type LoginFormValues } from "@/components/login-form"
import { SignupForm, type SignupFormValues } from "@/components/signup-form"
import { Button } from "@/components/ui/button"

export type AuthMode = "login" | "signup"
export type AuthStatusTone = "success" | "error" | "info"

export function AuthPage({
  darkMode,
  isSubmitting = false,
  mode,
  statusMessage,
  statusTone = "info",
  onDarkModeChange,
  onForgotPassword,
  onBackHome,
  onFieldChange,
  onLegalClick,
  onLogin,
  onModeChange,
  onSignup,
}: {
  darkMode: boolean
  isSubmitting?: boolean
  mode: AuthMode
  statusMessage?: string
  statusTone?: AuthStatusTone
  onDarkModeChange: (value: boolean) => void
  onBackHome: () => void
  onFieldChange?: () => void
  onForgotPassword: (email: string) => void
  onLegalClick: (document: "terms" | "privacy") => void
  onLogin: (values: LoginFormValues) => void
  onModeChange: (mode: AuthMode) => void
  onSignup: (values: SignupFormValues) => void
}) {
  const isLogin = mode === "login"

  return (
    <main className="grid min-h-svh bg-background text-foreground lg:grid-cols-[minmax(360px,0.9fr)_minmax(420px,1fr)]">
      <section className="hidden border-r bg-sidebar p-8 lg:flex lg:flex-col">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <AudioLinesIcon aria-hidden="true" className="size-4" />
          </div>
          <div>
            <p className="font-medium">SalesFrame</p>
            <p className="text-xs text-muted-foreground">Live call coach</p>
          </div>
        </div>

        <div className="mt-auto grid gap-5">
          <div>
            <h1 className="max-w-md text-3xl font-semibold tracking-tight">
              One calm place for calls, accounts, opportunities, and the next best question.
            </h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
              SalesFrame keeps the sales method in the background, so the seller can stay present in the conversation.
            </p>
          </div>
          <div className="grid gap-3 text-sm">
            <div className="flex items-center gap-3 rounded-lg border bg-background/50 p-3">
              <TargetIcon className="size-4 text-muted-foreground" />
              <span>Every call starts with the right account, opportunity, and playbook context.</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg border bg-background/50 p-3">
              <ShieldCheckIcon className="size-4 text-muted-foreground" />
              <span>Each workspace keeps its own records, settings, and AI key separate.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="flex min-h-svh flex-col">
        <header className="flex h-16 items-center justify-between px-4 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={onBackHome}
            >
              <ArrowLeftIcon className="size-3.5" />
              <span className="hidden sm:inline">Back to home</span>
              <span className="sm:hidden">Home</span>
            </Button>
            <div className="hidden items-center gap-3 sm:flex lg:hidden">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <AudioLinesIcon aria-hidden="true" className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium">SalesFrame</p>
                <p className="text-xs text-muted-foreground">Live call coach</p>
              </div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-10 md:size-7"
              aria-label="Toggle theme"
              onClick={() => onDarkModeChange(!darkMode)}
            >
              {darkMode ? <SunIcon /> : <MoonIcon />}
            </Button>
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center px-4 py-8 md:px-8">
          <div className="w-full max-w-sm">
            {isLogin ? (
              <LoginForm
                isSubmitting={isSubmitting}
                statusMessage={statusMessage}
                statusTone={statusTone}
                onFieldChange={onFieldChange}
                onForgotPassword={onForgotPassword}
                onSubmit={onLogin}
                onSwitchToSignup={() => onModeChange("signup")}
              />
            ) : (
              <SignupForm
                isSubmitting={isSubmitting}
                statusMessage={statusMessage}
                statusTone={statusTone}
                onFieldChange={onFieldChange}
                onLegalClick={onLegalClick}
                onSubmit={onSignup}
                onSwitchToLogin={() => onModeChange("login")}
              />
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
