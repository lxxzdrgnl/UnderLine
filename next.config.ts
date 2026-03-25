import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.45.76', '127.0.0.1'],
  outputFileTracingRoot: path.join(__dirname),
  output: 'standalone',
};

export default nextConfig;
