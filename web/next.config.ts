import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  ...(process.env.NODE_ENV === "development" && {
    allowedDevOrigins: ["192.168.1.63"],
  }),
};

export default nextConfig;
