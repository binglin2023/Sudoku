import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const origin = `${protocol}://${host}`;

  return {
    title: "九宫 SUDOKU｜专注每一格",
    description: "一款精密、克制的 9×9 在线数独游戏，支持专家难度、笔记、提示与智能高亮。",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "九宫 SUDOKU",
      description: "专注每一格，挑战专家级数独。",
      type: "website",
      images: [{ url: `${origin}/og.png`, width: 1200, height: 630, alt: "九宫数独游戏" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "九宫 SUDOKU",
      description: "专注每一格，挑战专家级数独。",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
