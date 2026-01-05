import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "express",
  "express-session",
  "ws",
];

async function buildAll() {
  try {
    console.log("🗂️  Cleaning dist directory...");
    await rm("dist", { recursive: true, force: true });

    console.log("🏗️  Building client...");
    await viteBuild();
    console.log("✅ Client build completed");

    console.log("🔧 Building server...");
    const pkg = JSON.parse(await readFile("package.json", "utf-8"));
    const allDeps = [
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.devDependencies || {}),
    ];
    const externals = allDeps.filter((dep) => !allowlist.includes(dep));
    
    console.log(`📦 External dependencies: ${externals.length}`);
    console.log(`✅ Bundled dependencies: ${allowlist.length}`);

    await esbuild({
      entryPoints: ["server/index.ts"],
      platform: "node",
      bundle: true,
      format: "cjs",
      outfile: "dist/index.cjs",
      define: {
        "process.env.NODE_ENV": '"production"',
        "import.meta.url": "'file:///'",
      },
      minify: true,
      external: externals,
      logLevel: "info",
    });
    
    console.log("✅ Server build completed");
    console.log("🎉 Build successful!");
  } catch (error) {
    console.error("❌ Build failed:", error);
    process.exit(1);
  }
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
