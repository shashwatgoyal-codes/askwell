import type { NextConfig } from 'next';

const config: NextConfig = {
  // The shared workspace packages ship TypeScript source.
  transpilePackages: ['@askwell/improve', '@askwell/rules'],
  // PGlite (the local database) loads its own WebAssembly; keep it out of the bundle.
  serverExternalPackages: ['@electric-sql/pglite'],
};

export default config;
