import * as React from "react"
import { AudioLinesIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const heroVideoUrl = "/media/salesframe-hero.mp4"
const heroFallbackImageUrl = "/media/salesframe-hero-poster.png"
const howItWorksStepOneImageUrl = "/media/salesframe-how-it-works-step-1.jpg"
const contactEmail = "hello@salesframe.ai"
const scrubSensitivity = 0.8
const videoReadinessTimeoutMs = 3500
const mobileTypedIntro =
  "Glad you stopped in.\nSalesFrame is built to help you sell. Now, where do you want to start?"
const desktopTypedIntro =
  "Glad you stopped in.\nSalesFrame is built to help you sell.\nNow, where do you want to start?"

const howItWorksSteps = [
  {
    title: "Start with your selling world",
    body:
      "Set up your workspace, tell SalesFrame what you sell, and give the coach enough context to sound like it belongs in the room.",
    imageUrl: howItWorksStepOneImageUrl,
    imageAlt: "Two sales professionals reviewing SalesFrame on a laptop before a customer call.",
    note: "Start with the selling world your team already knows.",
  },
  {
    title: "Add the accounts and opportunities that matter",
    body:
      "Create accounts one by one, or bring them in from a CSV. SalesFrame turns the workspace into a clean selling map.",
    note: "Less hunting around. More useful conversations.",
  },
  {
    title: "Let AI enrich the account",
    body:
      "When there’s a website, SalesFrame can research the account, find useful signals, and shape sharper discovery angles.",
    note: "The call feels prepared before anyone says hello.",
  },
  {
    title: "Choose the playbooks you actually use",
    body:
      "MEDDICC, BANT, Sandler, SPICED, Challenger, and more. SalesFrame keeps the methodology discipline in the background.",
    note: "Human conversation up front. Methodology quietly underneath.",
  },
  {
    title: "Capture the conversation live",
    body:
      "SalesFrame listens as the call unfolds, keeps the transcript moving, and watches for the moments that change the next move.",
    note: "The coach follows the call, not a rigid checklist.",
  },
  {
    title: "Ask the better next question",
    body:
      "The coach reads the account, opportunity, playbooks, and conversation flow, then gives the seller one timely question.",
    note: "One better question can change the shape of the deal.",
  },
  {
    title: "Leave the call with the work already shaped",
    body:
      "After the call, SalesFrame helps turn the conversation into notes, evidence, follow-up, and prep for the next meeting.",
    note: "The call ends. The next move is already clearer.",
  },
]

function useIsMobileLandingViewport() {
  const getIsMobile = React.useCallback(() => {
    if (typeof window === "undefined") return false

    return window.matchMedia("(max-width: 639px)").matches
  }, [])
  const [isMobile, setIsMobile] = React.useState(getIsMobile)

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 639px)")
    const handleChange = () => setIsMobile(mediaQuery.matches)

    handleChange()

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange)

      return () => mediaQuery.removeEventListener("change", handleChange)
    }

    mediaQuery.addListener(handleChange)

    return () => mediaQuery.removeListener(handleChange)
  }, [])

  return isMobile
}

function usePrefersReducedMotion() {
  const getPrefersReducedMotion = React.useCallback(() => {
    if (typeof window === "undefined") return false

    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  }, [])
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(getPrefersReducedMotion)

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches)

    handleChange()

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange)

      return () => mediaQuery.removeEventListener("change", handleChange)
    }

    mediaQuery.addListener(handleChange)

    return () => mediaQuery.removeListener(handleChange)
  }, [])

  return prefersReducedMotion
}

function useTypewriter(text: string, speed = 38, startDelay = 600, prefersReducedMotion = false) {
  const [displayed, setDisplayed] = React.useState(prefersReducedMotion ? text : "")
  const [done, setDone] = React.useState(prefersReducedMotion)

  React.useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayed(text)
      setDone(true)
      return
    }

    setDisplayed("")
    setDone(false)

    let index = 0
    let intervalId: number | null = null
    const timeoutId = window.setTimeout(() => {
      intervalId = window.setInterval(() => {
        index += 1
        setDisplayed(text.slice(0, index))

        if (index >= text.length) {
          if (intervalId !== null) window.clearInterval(intervalId)
          setDone(true)
        }
      }, speed)
    }, startDelay)

    return () => {
      window.clearTimeout(timeoutId)
      if (intervalId !== null) window.clearInterval(intervalId)
    }
  }, [prefersReducedMotion, speed, startDelay, text])

  return { displayed, done }
}

function copyIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-3 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="9" y="9" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M5 15V7a2 2 0 0 1 2-2h8" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  )
}

function salesFrameWaveformMark() {
  return <AudioLinesIcon aria-hidden="true" className="size-6 shrink-0 text-black sm:size-7" />
}

function HowItWorksDialog({
  onOpenChange,
  onSignup,
  open,
}: {
  onOpenChange: (open: boolean) => void
  onSignup: () => void
  open: boolean
}) {
  const [stepIndex, setStepIndex] = React.useState(0)
  const activeStep = howItWorksSteps[stepIndex]
  const isFinalStep = stepIndex === howItWorksSteps.length - 1

  React.useEffect(() => {
    if (open) setStepIndex(0)
  }, [open])

  const handleBack = () => {
    setStepIndex((currentStep) => Math.max(0, currentStep - 1))
  }

  const handleNext = () => {
    setStepIndex((currentStep) => Math.min(howItWorksSteps.length - 1, currentStep + 1))
  }

  const handleSignup = () => {
    onOpenChange(false)
    onSignup()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid h-[min(720px,calc(100svh-1rem))] max-h-[calc(100svh-1rem)] grid-rows-[minmax(0,1fr)_auto] overflow-hidden bg-white p-4 text-black sm:max-w-lg">
        <DialogHeader className="sr-only">
          <DialogTitle>How SalesFrame works</DialogTitle>
          <DialogDescription>
            A quick look at how SalesFrame helps sellers prepare, run, and follow up from better sales calls.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 grid-rows-[160px_minmax(0,1fr)_auto] gap-4 sm:grid-rows-[240px_minmax(0,1fr)_auto]">
          {activeStep.imageUrl ? (
            <img
              src={activeStep.imageUrl}
              alt={activeStep.imageAlt ?? ""}
              className="h-full w-full rounded-lg object-cover object-center ring-1 ring-black/10"
              decoding="async"
            />
          ) : (
            <div
              aria-hidden="true"
              className="h-full rounded-lg bg-[linear-gradient(135deg,rgba(15,15,16,0.08),rgba(255,255,255,0.72))] ring-1 ring-black/10"
            />
          )}

          <div className="grid min-h-0 content-start gap-3 overflow-y-auto pr-1">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-black/45">
              Step {stepIndex + 1} of {howItWorksSteps.length}
            </p>
            <h2 className="font-heading text-2xl leading-tight tracking-tight text-black sm:text-[1.7rem]">
              {activeStep.title}
            </h2>
            <p className="text-sm leading-6 text-black/70 sm:text-base sm:leading-7">{activeStep.body}</p>
            <p className="rounded-lg bg-black/[0.04] p-3 text-sm leading-6 text-black/60">
              {activeStep.note}
            </p>
          </div>

          <div className="flex items-center justify-center gap-1.5" aria-label={`Step ${stepIndex + 1} of ${howItWorksSteps.length}`}>
            {howItWorksSteps.map((step, index) => (
              <button
                key={step.title}
                type="button"
                aria-label={`Show ${step.title}`}
                aria-current={index === stepIndex ? "step" : undefined}
                className={[
                  "h-2 rounded-full transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30",
                  index === stepIndex ? "w-7 bg-black" : "w-2 bg-black/20 hover:bg-black/40",
                ].join(" ")}
                onClick={() => setStepIndex(index)}
              />
            ))}
          </div>
        </div>

        <div className="-mx-4 -mb-4 grid gap-3 rounded-b-xl border-t border-black/10 bg-black/[0.03] p-4 sm:flex sm:items-center sm:justify-between">
          <Button variant="outline" className="border-black/15 bg-white text-black hover:bg-black hover:text-white" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <div className="grid gap-2 sm:flex sm:justify-end">
            <Button
              variant="outline"
              className="border-black/15 bg-white text-black hover:bg-black hover:text-white"
              disabled={stepIndex === 0}
              onClick={handleBack}
            >
              Back
            </Button>
            {isFinalStep ? (
              <Button className="bg-black text-white hover:bg-black/85" onClick={handleSignup}>
                Sign Up
              </Button>
            ) : (
              <Button className="bg-black text-white hover:bg-black/85" onClick={handleNext}>
                Next
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const landingOutlineButtonClass =
  "landing-action-button border-black/15 bg-white/90 text-black shadow-sm backdrop-blur-sm hover:border-black hover:bg-black hover:text-white focus-visible:border-black/30 focus-visible:ring-black/20"

const landingContactButtonClass =
  "landing-action-button landing-contact-button gap-2 border-white/80 bg-white/10 text-white shadow-sm backdrop-blur-sm hover:border-white hover:bg-white hover:text-black focus-visible:border-white focus-visible:ring-white/30 sm:gap-3"

const landingTextButtonClass =
  "rounded-sm outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"

export function MarketingLandingPage({
  onLogin,
  onSignup,
}: {
  onLogin: () => void
  onSignup: () => void
}) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const prevXRef = React.useRef<number | null>(null)
  const targetTimeRef = React.useRef(0)
  const seekingRef = React.useRef(false)
  const videoReadyRef = React.useRef(false)
  const copyResetTimeoutRef = React.useRef<number | null>(null)
  const isMobileLandingViewport = useIsMobileLandingViewport()
  const prefersReducedMotion = usePrefersReducedMotion()
  const [actionsVisible, setActionsVisible] = React.useState(prefersReducedMotion)
  const [copied, setCopied] = React.useState(false)
  const [howItWorksOpen, setHowItWorksOpen] = React.useState(false)
  const [videoReady, setVideoReady] = React.useState(false)
  const [videoUnavailable, setVideoUnavailable] = React.useState(false)
  const { displayed, done } = useTypewriter(
    isMobileLandingViewport ? mobileTypedIntro : desktopTypedIntro,
    38,
    600,
    prefersReducedMotion
  )

  const seekToTarget = React.useCallback(() => {
    const video = videoRef.current

    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return

    const nextTime = Math.max(0, Math.min(video.duration, targetTimeRef.current))

    if (Math.abs(video.currentTime - nextTime) < 0.03) return

    seekingRef.current = true
    video.currentTime = nextTime
  }, [])

  React.useEffect(() => {
    if (prefersReducedMotion) {
      setActionsVisible(true)
      return
    }

    const timerId = window.setTimeout(() => setActionsVisible(true), 400)

    return () => window.clearTimeout(timerId)
  }, [prefersReducedMotion])

  React.useEffect(() => {
    const timerId = window.setTimeout(() => {
      if (!videoReadyRef.current) setVideoUnavailable(true)
    }, videoReadinessTimeoutMs)

    return () => window.clearTimeout(timerId)
  }, [])

  React.useEffect(() => {
    if (prefersReducedMotion) return

    const handleMouseMove = (event: MouseEvent) => {
      const video = videoRef.current
      const previousX = prevXRef.current

      prevXRef.current = event.clientX

      if (!video || previousX === null || !Number.isFinite(video.duration) || video.duration <= 0) {
        return
      }

      const delta = event.clientX - previousX
      targetTimeRef.current = Math.max(
        0,
        Math.min(video.duration, targetTimeRef.current + (delta / window.innerWidth) * scrubSensitivity * video.duration)
      )

      if (!seekingRef.current) seekToTarget()
    }

    window.addEventListener("mousemove", handleMouseMove)

    return () => window.removeEventListener("mousemove", handleMouseMove)
  }, [prefersReducedMotion, seekToTarget])

  React.useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current)
      }
    }
  }, [])

  const handleLoadedMetadata = () => {
    const video = videoRef.current

    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return

    targetTimeRef.current = Math.min(0.12, video.duration)
    seekToTarget()
  }

  const handleSeeked = () => {
    seekingRef.current = false
    seekToTarget()
  }

  const handleVideoReady = () => {
    videoReadyRef.current = true
    setVideoReady(true)
    setVideoUnavailable(false)
  }

  const handleVideoUnavailable = () => {
    videoReadyRef.current = false
    setVideoReady(false)
    setVideoUnavailable(true)
  }

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(contactEmail)
      setCopied(true)
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current)
      }
      copyResetTimeoutRef.current = window.setTimeout(() => {
        setCopied(false)
        copyResetTimeoutRef.current = null
      }, 1800)
    } catch {
      window.location.href = `mailto:${contactEmail}`
    }
  }

  return (
    <main className="salesframe-landing relative min-h-svh overflow-hidden bg-white text-black">
      <img
        src={heroFallbackImageUrl}
        alt=""
        aria-hidden="true"
        decoding="async"
        draggable={false}
        fetchPriority="high"
        className="fixed inset-0 z-0 h-full w-full object-cover object-[70%_center]"
      />
      <video
        ref={videoRef}
        aria-hidden="true"
        className={[
          "fixed inset-0 z-0 h-full w-full object-cover object-[70%_center] transition-opacity duration-300",
          videoReady && !videoUnavailable ? "opacity-100" : "opacity-0",
        ].join(" ")}
        disablePictureInPicture
        draggable={false}
        muted
        playsInline
        poster={heroFallbackImageUrl}
        preload="auto"
        src={heroVideoUrl}
        onAbort={handleVideoUnavailable}
        onCanPlay={handleVideoReady}
        onError={handleVideoUnavailable}
        onLoadedData={handleVideoReady}
        onLoadedMetadata={handleLoadedMetadata}
        onSeeked={handleSeeked}
      />
      <div className="fixed inset-0 z-[1] bg-white/15" aria-hidden="true" />

      <header className="fixed inset-x-0 top-0 z-10 flex items-center justify-between px-5 py-4 sm:px-8 sm:py-5">
        <a
          href="/"
          aria-label="SalesFrame home"
          className={`${landingTextButtonClass} flex items-center gap-3 text-left`}
        >
          <span className="text-[21px] tracking-tight text-black sm:text-[26px]" style={{ fontFamily: "var(--font-heading)" }}>
            SalesFrame®
          </span>
          {salesFrameWaveformMark()}
        </a>

        <a
          href={`mailto:${contactEmail}?subject=${encodeURIComponent("SalesFrame enquiry")}`}
          className={`${landingTextButtonClass} text-[17px] text-black underline underline-offset-2 hover:opacity-60 sm:text-[21px] md:text-[23px]`}
        >
          Get in touch
        </a>
      </header>

      <section className="relative z-[2] flex h-svh flex-col justify-end overflow-hidden px-5 pb-12 sm:px-8 md:justify-center md:px-10 md:pb-0">
        <div className="relative z-10 max-w-xl">
          <h1 className="sr-only">
            SalesFrame is a real-time AI sales call coach that helps sellers ask the right next question.
          </h1>
          <p className="sr-only">
            SalesFrame listens to live sales calls, tracks opportunity context and selected sales playbooks, then suggests
            one natural next question for the seller.
          </p>
          <p
            className="landing-hero-copy pointer-events-none mb-5 select-none whitespace-pre-line text-black blur-[4px] sm:mb-6"
          >
            {"Hey there, nice to meet you,\nLet's sell some stuff"}
          </p>

          <p
            className="landing-hero-copy landing-typed-copy mb-5 min-h-[13rem] whitespace-pre-line text-black sm:mb-6 sm:min-h-[7.5rem] md:min-h-[6.75rem]"
          >
            {displayed}
            {!done ? <span className="landing-cursor ml-[2px] inline-block h-[1.1em] w-[2px] align-middle" /> : null}
          </p>

          <div
            className={[
              "landing-actions",
              prefersReducedMotion ? "translate-y-0 opacity-100 transition-none" : "transition-[opacity,transform] duration-300",
              actionsVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
            ].join(" ")}
          >
            <Button variant="outline" size="lg" className={landingOutlineButtonClass} asChild>
              <a
                href="/signup"
                onClick={(event) => {
                  event.preventDefault()
                  onSignup()
                }}
              >
                Sign Up
              </a>
            </Button>
            <Button variant="outline" size="lg" className={landingOutlineButtonClass} asChild>
              <a
                href="/login"
                onClick={(event) => {
                  event.preventDefault()
                  onLogin()
                }}
              >
                Login
              </a>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className={landingOutlineButtonClass}
              onClick={() => setHowItWorksOpen(true)}
            >
              How it works
            </Button>
            <Button variant="outline" size="lg" className={landingOutlineButtonClass} asChild>
              <a href={`mailto:${contactEmail}?subject=${encodeURIComponent("SalesFrame pricing")}`}>
                Pricing
              </a>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className={landingContactButtonClass}
              onClick={handleCopyEmail}
            >
              <span>
                Reach us: <span className="underline underline-offset-1">{copied ? "copied" : contactEmail}</span>
              </span>
              {copyIcon()}
            </Button>
          </div>
        </div>
      </section>
      <HowItWorksDialog open={howItWorksOpen} onOpenChange={setHowItWorksOpen} onSignup={onSignup} />
    </main>
  )
}
