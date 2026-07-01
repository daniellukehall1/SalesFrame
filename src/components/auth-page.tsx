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

export function AuthPage({
  darkMode,
  isSubmitting = false,
  mode,
  statusMessage,
  onDarkModeChange,
  onForgotPassword,
  onBackHome,
  onLegalClick,
  onLogin,
  onModeChange,
  onSignup,
}: {
  darkMode: boolean
  isSubmitting?: boolean
  mode: AuthMode
  statusMessage?: string
  onDarkModeChange: (value: boolean) => void
  onBackHome: () => void
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
            <AudioLinesIcon className="size-4" />
          </div>
          <div>
            <p className="font-medium">SalesFrame</p>
            <p className="text-xs text-muted-foreground">Seller Copilot</p>
          </div>
        </div>

        <div className="mt-auto grid gap-5">
          <div>
            <h1 className="max-w-md text-3xl font-semibold tracking-tight">
              Real-time sales methodology coaching, scoped by workspace.
            </h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
              Sign in to access accounts, opportunities, call recordings, settings, and workspace context.
            </p>
          </div>
          <div className="grid gap-3 text-sm">
            <div className="flex items-center gap-3 rounded-lg border bg-background/50 p-3">
              <TargetIcon className="size-4 text-muted-foreground" />
              <span>Opportunity and playbook context stay tied to the signed-in seller.</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg border bg-background/50 p-3">
              <ShieldCheckIcon className="size-4 text-muted-foreground" />
              <span>Secure workspace access keeps account and opportunity data separated.</span>
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
                <AudioLinesIcon className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium">SalesFrame</p>
                <p className="text-xs text-muted-foreground">Seller Copilot</p>
              </div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
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
                onForgotPassword={onForgotPassword}
                onSubmit={onLogin}
                onSwitchToSignup={() => onModeChange("signup")}
              />
            ) : (
              <SignupForm
                isSubmitting={isSubmitting}
                statusMessage={statusMessage}
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
