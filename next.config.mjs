import { PHASE_PRODUCTION_BUILD } from "next/constants.js";

/** @type {import('next').NextConfig} */
const nextConfig = (phase) => {
  return {
    env: {
      IS_BUILD_PHASE: phase === PHASE_PRODUCTION_BUILD ? "true" : "false",
    },
  };
};

export default nextConfig;
