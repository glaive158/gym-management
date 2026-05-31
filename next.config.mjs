/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // The Next.js standalone server only serves files that were present in
  // public/ at build time. Runtime-written uploads (member avatars) live in
  // a Docker volume mounted at /app/public/uploads; route them through an
  // API handler that streams from disk so the URLs stored in the DB keep
  // working (/uploads/<file>).
  async rewrites() {
    return [
      { source: '/uploads/:file', destination: '/api/uploads/:file' },
    ];
  },
};
export default nextConfig;
