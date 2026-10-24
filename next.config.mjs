import path from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // trace from this project folder (avoids picking up unrelated lockfiles above it)
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),
  // Allows a production build check without clobbering the running dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // INSTRUCTIONS/*.md are read at runtime by the agent (server-side).
  outputFileTracingIncludes: { "/**": ["./INSTRUCTIONS/**/*"] },
};
export default nextConfig;
