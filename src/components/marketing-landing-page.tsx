import * as React from "react"
import { AudioLinesIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

const heroVideoUrl = "/media/salesframe-hero.mp4"
const heroFallbackImageUrl = "/media/salesframe-hero-poster.png"
const contactEmail = "hello@salesframe.ai"
const scrubSensitivity = 0.8
const videoReadinessTimeoutMs = 3500
const mobileTypedIntro =
  "Glad you stopped in.\nSalesFrame is built to help you sell. Now, where do you want to start?"
const desktopTypedIntro =
  "Glad you stopped in.\nSalesFrame is built to help you sell.\nNow, where do you want to start?"

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
          "fixed inset-0 z-0 h-full w-full object-cover object-[70%_center] transition-opacity duration-500",
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
              prefersReducedMotion ? "translate-y-0 opacity-100 transition-none" : "transition-[opacity,transform] duration-[400ms] ease-out",
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
            <Button variant="outline" size="lg" className={landingOutlineButtonClass} asChild>
              <a href={`mailto:${contactEmail}?subject=${encodeURIComponent("How SalesFrame works")}`}>
                How it works
              </a>
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
    </main>
  )
}
