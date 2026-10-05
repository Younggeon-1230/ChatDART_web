import "./globals.css";
import { DataSourceProvider } from "@/components/layout/DataSourceProvider";
import TopNav from "@/components/layout/TopNav";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "ChatDART | 기업 재무 분석",
  description: "기업 재무제표를 요약하고 비교하는 ChatDART",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-gradient-to-br from-sky-50 via-slate-50 to-blue-100 text-slate-900 antialiased">
        <DataSourceProvider>
          <Suspense fallback={null}>
            <TopNav />
          </Suspense>
          <main className="px-4 py-5 sm:px-4 md:px-3 md:py-6 xl:px-4">{children}</main>
        </DataSourceProvider>
      </body>
    </html>
  );
}
