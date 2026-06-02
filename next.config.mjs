/** @type {import('next').NextConfig} */
const nextConfig = {
  // Renamed out of `experimental` in Next 15
  serverExternalPackages: ["@anthropic-ai/sdk", "pdf-parse"],
};

export default nextConfig;
