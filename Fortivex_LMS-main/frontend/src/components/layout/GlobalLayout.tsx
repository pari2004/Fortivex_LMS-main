"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { NavigationProgressBar } from "./NavigationProgressBar";
import { GlobalStudentChatbotWidget } from "@/components/chatbot/GlobalStudentChatbotWidget";
import { ReactNode, Suspense } from "react";

export function GlobalLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);
  
  if (pathname === "/login") {
    return <div id="auth-layout-wrapper" style={{ minHeight: "100vh", width: "100%" }}>{children}</div>;
  }

  return (
    <div className="app-layout-root">
      <Suspense fallback={null}>
        <NavigationProgressBar />
      </Suspense>
      <Sidebar mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0, width: "100%" }}>
        <Header onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)} />
        <main className="app-main-content">
          {children}
        </main>
      </div>
      <GlobalStudentChatbotWidget />
    </div>
  );
}

