import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@dual-core/domain"],
  serverExternalPackages: [
    "@prisma/adapter-better-sqlite3",
    "@prisma/client",
    "better-sqlite3",
    "prisma",
  ],
};

export default nextConfig;
