/** @type {import('next').NextConfig} */
const nextConfig = {
  // required for static export (render.com)
  output: 'export',
  
  images: {
    unoptimized: true,
  },
  
  // Optional: trailing slashes
  trailingSlash: true,
  
  webpack: (config, { isServer }) => {
    // Enable WebAssembly
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Fix for WASM module loading
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    });

    // Handle WASM file output location
    if (!isServer) {
      config.output.webassemblyModuleFilename = 'static/wasm/[modulehash].wasm';
    } else {
      config.output.webassemblyModuleFilename = './../static/wasm/[modulehash].wasm';
    }

    // Suppress optional dependency warnings (these are peer dependencies that are optional)
    config.resolve.fallback = {
      ...config.resolve.fallback,
      '@react-native-async-storage/async-storage': false,
      'pino-pretty': false,
    };

    // Ignore optional peer dependencies
    config.ignoreWarnings = [
      { module: /@metamask\/sdk/ },
      { module: /pino/ },
    ];

    return config;
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://x.cartridge.gg https://*.cartridge.gg",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https://api.cartridge.gg https://x.cartridge.gg https://*.cartridge.gg wss://*.cartridge.gg https://starknet-sepolia.g.alchemy.com https://*.starknet.io",
              "frame-src 'self' https://x.cartridge.gg https://*.cartridge.gg",
              "child-src 'self' https://x.cartridge.gg https://*.cartridge.gg blob:",
              "worker-src 'self' blob:",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
