/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // Génère le dossier statique 'out' pour cPanel
  images: {
    unoptimized: true, // Requis car l'export statique ne supporte pas l'optimisation d'image native de Next.js
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com"
      },
      {
        protocol: "https",
        hostname: "api.lemanoir.bj" // Ton sous-domaine API de production
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000"
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "8000"
      }
    ]
  }
};

module.exports = nextConfig;