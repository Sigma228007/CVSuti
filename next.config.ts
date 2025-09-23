import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Увеличиваем таймаут для статических страниц
  staticPageGenerationTimeout: 120,
  // Убираем experimental, так как appDir теперь стабилен
};

export default nextConfig;