// Env vars are injected by Vercel in production and by local shell in dev.
// We deliberately avoid importing "dotenv/config" so the build doesn't
// require dotenv as a dependency on Vercel.
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
