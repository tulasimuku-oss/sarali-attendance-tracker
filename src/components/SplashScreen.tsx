import { useEffect, useRef } from "react";

const SPLASH_SRC = `${import.meta.env.BASE_URL}splash.mp4`;
const SPLASH_MAX_MS = 12_000;
const SPLASH_FADE_MS = 420;

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const finished = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    const overlay = overlayRef.current;
    if (!video || !overlay) return;
    const player = video;
    const panel = overlay;

    let fadeTimer = 0;
    function finish() {
      if (finished.current) return;
      finished.current = true;
      panel.classList.add("is-leaving");
      fadeTimer = window.setTimeout(onDone, SPLASH_FADE_MS);
    }

    player.muted = true;
    player.playsInline = true;
    const tryPlay = () => {
      const playAttempt = player.play();
      if (playAttempt) playAttempt.catch(() => {});
    };
    tryPlay();
    player.addEventListener("canplay", tryPlay);
    player.addEventListener("ended", finish);
    player.addEventListener("error", finish);
    const failFast = window.setTimeout(() => {
      if (player.readyState < 2) finish();
    }, 800);
    const maxWait = window.setTimeout(finish, SPLASH_MAX_MS);
    return () => {
      player.removeEventListener("canplay", tryPlay);
      player.removeEventListener("ended", finish);
      player.removeEventListener("error", finish);
      window.clearTimeout(failFast);
      window.clearTimeout(maxWait);
      window.clearTimeout(fadeTimer);
    };
  }, [onDone]);

  return (
    <div
      ref={overlayRef}
      className="splash-screen"
      role="dialog"
      aria-label="Sarali"
      aria-live="polite"
    >
      <video
        ref={videoRef}
        className="splash-screen-video"
        src={SPLASH_SRC}
        autoPlay
        muted
        playsInline
        preload="auto"
      />
    </div>
  );
}
