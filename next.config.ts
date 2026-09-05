import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Self-contained server bundle, so the runner stage of the Dockerfile carries
  // no node_modules of its own.
  output: "standalone",
};

export default nextConfig;
