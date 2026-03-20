import Link from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";

interface AppLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  children: ReactNode;
}

function isFullNavigation(href: string) {
  return href.startsWith("/api/auth/");
}

export function AppLink({ href, children, ...props }: AppLinkProps) {
  if (isFullNavigation(href)) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} {...props}>
      {children}
    </Link>
  );
}
