"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

interface HeaderStatusProps {
  currentUser: {
    displayName: string;
    source: "secondme" | "demo";
  } | null;
  isDevelopment: boolean;
}

function isDemoSearch(value: string | null) {
  return value === "1" || value === "true" || value === "demo";
}

function buildModeHref(pathname: string, searchParams: URLSearchParams, demoMode: boolean) {
  const params = new URLSearchParams(searchParams.toString());

  if (demoMode) {
    params.set("demo", "1");
  } else {
    params.delete("demo");
  }

  const query = params.toString();
  return query.length > 0 ? `${pathname}?${query}` : pathname;
}

export function HeaderStatus({ currentUser, isDevelopment }: HeaderStatusProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const demoMode = isDevelopment && isDemoSearch(searchParams.get("demo"));

  if (currentUser) {
    return (
      <>
        <span className="pill-link identity-pill">
          {currentUser.source === "secondme" ? "已连接" : "当前身份"} {currentUser.displayName}
        </span>
        <Link href="/api/auth/logout" className="pill-link">
          退出
        </Link>
      </>
    );
  }

  return (
    <>
      <Link href="/api/auth/login?next=/me" className="pill-link">
        连接 Second Me
      </Link>
      {demoMode ? (
        <>
          <span className="pill-link dev-pill">开发演示中</span>
          <Link href={buildModeHref(pathname, searchParams, false)} className="pill-link">
            返回正式入口
          </Link>
        </>
      ) : null}
      {!demoMode && isDevelopment ? (
        <Link href={buildModeHref(pathname, searchParams, true)} className="pill-link">
          开发演示
        </Link>
      ) : null}
    </>
  );
}
