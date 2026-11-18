import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server packages that should not be bundled into Edge middleware
  serverExternalPackages: ["pg", "drizzle-orm"],
};

export default nextConfig;
