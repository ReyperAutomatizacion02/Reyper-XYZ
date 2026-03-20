import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Habilitar compresión para reducir tamaño de respuestas
  compress: true,

  // Ocultar header "X-Powered-By: Next.js" por seguridad
  poweredByHeader: false,

  // Habilitar modo estricto de React para detectar problemas
  reactStrictMode: true,

  images: {
    // Formatos modernos de imagen para mejor compresión
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'dnqtxzqntuvclvtrojsb.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'files.edgestore.dev',
      },
      {
        protocol: "https",
        hostname: "prod-files-secure.s3.us-west-2.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "drive.google.com",
      }
    ],
  },

  // Transpile packages that might have issues with resolution or ESM
  transpilePackages: ['driver.js'],

  // Security headers (OWASP A05:2021)
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=()",
        },
      ],
    },
  ],

  // Optimizaciones experimentales
  experimental: {
    // Optimizar imports de paquetes grandes
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-select',
      '@radix-ui/react-dialog',
      '@radix-ui/react-popover',
    ],
  },
};

export default nextConfig;

