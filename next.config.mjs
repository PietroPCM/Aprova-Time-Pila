/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allows a production build check without clobbering the running dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // INSTRUCTIONS/*.md are read at runtime by the agent (server-side).
  outputFileTracingIncludes: { "/**": ["./INSTRUCTIONS/**/*"] },
};
export default nextConfig;
