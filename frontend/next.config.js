const path = require("path");
const { loadEnvConfig } = require("@next/env");

// The repo keeps a single .env at its root; backend/app/config.py resolves it
// the same way. Next only reads a .env sitting beside next.config.js, so point
// it one level up or NEXT_PUBLIC_API_BASE_URL silently falls back to the
// default in lib/api.ts.
//
// The fourth argument is forceReload, and it is required: Next has already run
// loadEnvConfig for this directory by the time it evaluates this file, and the
// result is memoised, so without it the call returns that cached (empty) load
// and never reads ../.env at all.
loadEnvConfig(
  path.join(__dirname, ".."),
  process.env.NODE_ENV !== "production",
  console,
  true
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

module.exports = nextConfig;
