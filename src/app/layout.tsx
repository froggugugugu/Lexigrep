import type { Metadata, Viewport } from "next";
import type React from "react";
import { GeistMono } from "geist/font/mono";
import { cookies } from "next/headers";
import {
  parseTheme,
  parseTimeZone,
  THEME_COOKIE,
  THEME_INIT_SCRIPT,
  TZ_COOKIE,
} from "@/features/settings/theme";
import { TimezoneSync } from "@/features/settings/TimezoneSync";
import { siteConfig } from "@/shared/site/config";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: siteConfig.name,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0f14" },
    { media: "(prefers-color-scheme: light)", color: "#f6f8fa" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const store = await cookies();
  const theme = parseTheme(store.get(THEME_COOKIE)?.value);
  const timeZone = parseTimeZone(store.get(TZ_COOKIE)?.value);

  return (
    <html
      lang="ja"
      data-theme={theme}
      suppressHydrationWarning
      className={`${GeistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <TimezoneSync current={timeZone} />
        {children}
      </body>
    </html>
  );
}
