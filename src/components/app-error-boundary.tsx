import * as React from "react"
import { CircleAlertIcon, RotateCcwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

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
    if (import.meta.env.DEV) {
      console.error("SalesFrame render error", error, info)
    }
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children

    const isWorkspaceConnectionError = this.state.error.message.includes("workspace service")
    const description = isWorkspaceConnectionError ? "Workspace connection" : "Let's get you back in"
    const title = isWorkspaceConnectionError
      ? "SalesFrame could not connect to the workspace service"
      : "SalesFrame needs to reload this workspace"
    const body = isWorkspaceConnectionError
      ? "The app opened, but the workspace connection is not ready. Try again once; if it keeps happening, contact support so we can fix the setup."
      : "We hit a snag opening this view. Reloading will bring you back to the latest saved workspace state."

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
            <Button className="w-fit gap-2" onClick={this.handleReload}>
              <RotateCcwIcon />
              {isWorkspaceConnectionError ? "Try again" : "Reload SalesFrame"}
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }
}
