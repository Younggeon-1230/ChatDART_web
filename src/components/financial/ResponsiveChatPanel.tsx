"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { MessageCircle, X } from "lucide-react";

type ResponsiveChatPanelProps = {
  children: ReactNode;
  mobileContent: ReactNode;
  desktopClassName?: string;
};

export default function ResponsiveChatPanel({
  children,
  mobileContent,
  desktopClassName = "",
}: ResponsiveChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <>
      <div className={`hidden xl:block ${desktopClassName}`}>{children}</div>

      <button
        type="button"
        aria-label={isOpen ? "챗봇 닫기" : "챗봇 열기"}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="fixed bottom-20 right-5 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full border border-sky-100 bg-slate-900 text-white shadow-lg shadow-slate-900/25 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 md:bottom-24 md:right-6 xl:hidden"
      >
        {isOpen ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>

      {isOpen && (
        <div className="xl:hidden">
          <button
            type="button"
            aria-label="챗봇 닫기"
            className="fixed inset-0 z-[55] cursor-default bg-slate-950/20"
            onClick={() => setIsOpen(false)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-label="챗봇 대화"
            className="fixed bottom-36 right-4 z-[60] w-[min(360px,calc(100vw-32px))] max-h-[calc(100vh-12rem)] overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-2xl shadow-slate-900/20 md:bottom-40 md:right-6"
          >
            <div className="flex items-center justify-between border-b border-sky-100 bg-white px-4 py-3">
              <span className="text-sm font-semibold text-blue-950">
                챗봇 대화
              </span>
              <button
                type="button"
                aria-label="챗봇 닫기"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {mobileContent}
          </section>
        </div>
      )}
    </>
  );
}
