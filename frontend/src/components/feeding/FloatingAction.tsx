import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";

/**
 * Social-media-style floating action button (owner's design, 18 Jul 2026):
 * fixed bottom-right, scrolls to its target section on tap. Presence rules
 * — visible on load and on any scroll/touch, FADES (never fully hides)
 * after a quiet moment so first-time users still discover it; hides
 * entirely only while its own target section is on screen.
 */

const IDLE_MS = 2500;

interface FloatingActionProps {
  label: string;
  targetRef: React.RefObject<HTMLElement | null>;
  /** Vertical slot when several floats stack bottom-right (0 = lowest). */
  bottomClass?: string;
  children: React.ReactNode;
}

export function FloatingAction({ label, targetRef, bottomClass = "bottom-6", children }: FloatingActionProps) {
  const [idle, setIdle] = useState(false);
  const [targetVisible, setTargetVisible] = useState(false);
  const idleTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const wake = () => {
      setIdle(false);
      window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(() => setIdle(true), IDLE_MS);
    };
    wake();
    window.addEventListener("scroll", wake, { passive: true, capture: true });
    window.addEventListener("touchstart", wake, { passive: true });
    window.addEventListener("pointerdown", wake, { passive: true });
    return () => {
      window.clearTimeout(idleTimer.current);
      window.removeEventListener("scroll", wake, { capture: true });
      window.removeEventListener("touchstart", wake);
      window.removeEventListener("pointerdown", wake);
    };
  }, []);

  useEffect(() => {
    const el = targetRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setTargetVisible(entry.isIntersecting),
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [targetRef]);

  const scrollToTarget = () => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    targetRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };

  return (
    <button
      type="button"
      aria-label={label}
      onClick={scrollToTarget}
      className={clsx(
        // Dark ink, never the theme color — the float must not blend with
        // the theme-colored day circles it hovers over; the white ring
        // separates it from any background. Extended pill: icon + visible
        // label (owner: nobody recognizes the icon alone).
        "fixed right-6 z-40 flex h-11 items-center gap-2 rounded-full bg-gray-900 px-4 text-white shadow-xl ring-2 ring-white transition-opacity duration-300 hover:opacity-100",
        bottomClass,
        targetVisible ? "pointer-events-none opacity-0" : idle ? "opacity-30" : "opacity-100",
      )}
    >
      {children}
      <span className="text-xs font-bold">{label}</span>
    </button>
  );
}
