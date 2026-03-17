import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";

import { isDevelopmentMode, resolveCurrentUserContext } from "../lib/current-user";
import { HeaderStatus } from "./_components/header-status";

import "./globals.css";

export const metadata: Metadata = {
  title: "双核职场",
  description: "用双核人格和 A2A 沙盘，提前验证你和谁能一起成事。",
};

const navItems = [
  { href: "/", label: "首页" },
  { href: "/me", label: "我的流程" },
  { href: "/assessment", label: "测评" },
  { href: "/match", label: "匹配" },
  { href: "/draw", label: "抽卡" },
];

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const currentUser = await resolveCurrentUserContext({
    allowDemoFallback: false,
    demoRequested: false,
  });

  return (
    <html lang="zh-CN">
      <body>
        <div className="page-shell">
          <header className="site-header">
            <Link href="/" className="brandmark">
              <span className="brandmark-kicker">SECOND ME A2A x 知乎职场语境</span>
              <strong>双核职场</strong>
              <span className="brandmark-copy">先验证协作兼容性，再决定要不要进入现实连接。</span>
            </Link>
            <nav className="nav-row">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} className="pill-link">
                  {item.label}
                </Link>
              ))}
              <HeaderStatus
                currentUser={
                  currentUser
                    ? {
                        displayName: currentUser.displayName,
                        source: currentUser.source,
                      }
                    : null
                }
                isDevelopment={isDevelopmentMode()}
              />
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
