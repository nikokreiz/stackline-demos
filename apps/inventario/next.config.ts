import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@stackline/core"],
  agentRules: false,
  serverExternalPackages: ["@electric-sql/pglite"],
  // Las migraciones SQL se leen en tiempo de ejecución: hay que incluirlas en el bundle.
  outputFileTracingIncludes: { "/**/*": ["./drizzle/**/*"] },
};

export default nextConfig;
