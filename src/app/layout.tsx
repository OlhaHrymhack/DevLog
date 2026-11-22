import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { THEME_INIT_SCRIPT } from "@/features/themeToggle";
import { Providers } from "./Providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DevLog",
  description: "Трекер задач для інженерної команди з вбудованими AI-агентами",
};

type RootLayoutProps = Readonly<{ children: ReactNode }>;

const RootLayout = ({ children }: RootLayoutProps) => {
  return (
    <html lang="uk" data-theme="dark" suppressHydrationWarning className={`${inter.variable} ${jetBrainsMono.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col"><Providers>{children}</Providers></body>
    </html>
  );
};

export default RootLayout;
