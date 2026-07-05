import * as React from "react"
import { CircleAlertIcon, HomeIcon, RotateCcwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { reportClientError } from "@/lib/client-error-reporting"

type AppErrorBoundaryState = {
  error: Error | null
}

export class AppErrorBoundary extends React.Component<
  React.PropsWithChildren,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    error: null,
  }

  static getDerivedStateFromError(error: Error) {
    return {
      error,
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    void reportClientError({
      error,
      eventName: "render_error",
      metadata: {
        componentStack: info.componentStack,
      },
    })

    if (import.meta.env.DEV) {
      console.error("SalesFrame render error", error, info)
    }
  }

  handleTryAgain = () => {
    this.setState({ error: null })
  }

  handleHome = () => {
    window.location.assign("/")
  }

  render() {
    if (!this.state.error) return this.props.children

    const isWorkspaceConnectionError = this.state.error.message.includes("workspace connection")
    const description = isWorkspaceConnectionError ? "Workspace connection" : "Let's get you back in"
    const title = isWorkspaceConnectionError
      ? "SalesFrame is having trouble reaching your workspace"
      : "SalesFrame needs another pass at this view"
    const body = isWorkspaceConnectionError
      ? "Your browser opened SalesFrame, but the workspace connection did not finish. Try once more, or head back to the homepage while SalesFrame gets things back in shape."
      : "Something got stuck opening this view. Try again and SalesFrame will pick up from your latest saved work."

    return (
      <main className="grid min-h-svh place-items-center bg-background p-4 text-foreground">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <CircleAlertIcon className="size-5" />
            </div>
            <CardDescription>{description}</CardDescription>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {body}
            </p>
            <div className="flex flex-wrap gap-2 max-sm:[&_[data-slot=button]]:w-full">
              <Button className="h-10 gap-2 md:h-8" onClick={this.handleTryAgain}>
                <RotateCcwIcon />
                Try again
              </Button>
              <Button className="h-10 gap-2 md:h-8" variant="outline" onClick={this.handleHome}>
                <HomeIcon />
                Back to homepage
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    )
  }
}
