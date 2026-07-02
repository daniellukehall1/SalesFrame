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

    return (
      <main className="grid min-h-svh place-items-center bg-background p-4 text-foreground">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <CircleAlertIcon className="size-5" />
            </div>
            <CardDescription>Let&apos;s get you back in</CardDescription>
            <CardTitle>SalesFrame needs to reload this workspace</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Something unexpected happened while rendering the current view. Reloading will return you to the latest saved workspace state.
            </p>
            <Button className="w-fit gap-2" onClick={this.handleReload}>
              <RotateCcwIcon />
              Reload SalesFrame
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }
}
