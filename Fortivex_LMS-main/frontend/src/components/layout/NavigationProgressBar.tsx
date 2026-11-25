"use client";

import { useEffect, useState, Suspense } from "react";
import { usePathname } from "next/navigation";

function NavigationProgressBarInner() {
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // When route transition finishes, complete the bar and fade out
    setProgress(100);
    const timer = setTimeout(() => {
      setIsNavigating(false);
      setProgress(0);
    }, 220);
    return () => clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (!target || !target.href) return;

      try {
        const url = new URL(target.href, window.location.href);

        // Intercept internal page navigations to different routes
        if (
          url.origin === window.location.origin &&
          url.pathname !== window.location.pathname &&
          !target.hasAttribute("download") &&
          target.target !== "_blank" &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.shiftKey &&
          !e.altKey
        ) {
          setIsNavigating(true);
          setProgress(25);
          setTimeout(() => setProgress((p) => (p > 0 && p < 80 ? 65 : p)), 120);
          setTimeout(() => setProgress((p) => (p > 0 && p < 90 ? 85 : p)), 350);
        }
      } catch {
        // Ignore invalid URLs
      }
    };

    document.addEventListener("click", handleDocumentClick, { capture: true });
    return () => document.removeEventListener("click", handleDocumentClick, { capture: true });
  }, []);

  if (!isNavigating && progress === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "3px",
        zIndex: 999999,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress}%`,
          background: "linear-gradient(90deg, #4f46e5 0%, #8b5cf6 50%, #06b6d4 100%)",
          boxShadow: "0 0 12px rgba(99, 102, 241, 0.8), 0 0 6px rgba(139, 92, 246, 0.6)",
          transition:
            progress === 100
              ? "width 0.15s ease-out, opacity 0.2s ease-out"
              : "width 0.35s cubic-bezier(0.1, 0.6, 0.2, 1)",
          opacity: progress === 100 ? 0 : 1,
        }}
      />
    </div>
  );
}

export function NavigationProgressBar() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressBarInner />
    </Suspense>
  );
}
