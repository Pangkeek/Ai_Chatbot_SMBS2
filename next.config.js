const nextConfig = {
  async rewrites() {
    return [
      { source: '/health', destination: '/api/health' },
      { source: '/openapi.json', destination: '/api/openapi' },
    ];
  },
};

export default nextConfig;
