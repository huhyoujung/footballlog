import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {},
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "dssyfyurslaopejnioqx.supabase.co",
      },
    ],
  },
};

const config = withPWA({
  dest: "public",
  disable: true, // Custom SW를 직접 관리하므로 PWA 플러그인 비활성화
  register: false,
  workboxOptions: {
    disableDevLogs: true,
  },
})(nextConfig);

export default config;
