import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma 7 + pnpm + Next 16: don't try to bundle Prisma; let the server
  // resolve it from node_modules at runtime. Without this, Turbopack can't
  // trace through @prisma/client's internal runtime-utils peer.
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg"],
};

export default nextConfig;
