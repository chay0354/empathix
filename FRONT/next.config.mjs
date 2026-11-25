import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // simli-client's index requires "./Client", but the published file is client.js.
    // That resolves on Windows and fails on Vercel's Linux builders.
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "simli-client$": path.join(root, "node_modules/simli-client/dist/client.js")
    };
    return config;
  },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "Permissions-Policy", value: "microphone=(self), camera=(self)" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }
      ]
    }];
  }
};
export default nextConfig;
