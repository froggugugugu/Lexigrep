import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components はユーザー毎に動的な学習データが中心の本アプリでは
  // 恩恵が小さく Suspense 境界の制約が増えるため MVP では無効化する(ADR-0003)。
  cacheComponents: false,
  reactStrictMode: true,
  // 開発用インジケータが下部のアイランドに重なるので表示しない
  devIndicators: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=()",
        },
      ],
    },
  ],
};

export default nextConfig;
