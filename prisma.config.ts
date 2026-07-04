import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

// โหลด .env.local โดยตรง
dotenv.config({ path: ".env.local" });

const migrationUrl =
  process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!migrationUrl) {
  throw new Error("DATABASE_URL or DIRECT_URL is not set");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: migrationUrl,
  },
});