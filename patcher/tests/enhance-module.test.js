import { getConfig, isEnabled } from "../patches/shared/enhance.js";

console.log("[Test] Testing enhance.js module load...");

const cfg = getConfig();
console.log(`[Test] Enabled: ${isEnabled()}`);
console.log(`[Test] API Base: ${cfg.apiBase}`);
console.log(`[Test] Model: ${cfg.model}`);

if (cfg.apiBase && cfg.model && isEnabled()) {
  console.log(" SUCCESS: enhance.js module loaded and configuration verified!");
  process.exit(0);
} else {
  console.error(" FAILED: Invalid module configuration");
  process.exit(1);
}
