import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryDirectory = path.resolve(scriptDirectory, "..");
const crateDirectory = path.join(repositoryDirectory, "crates", "infini-wasm");
const outputDirectory = path.join(
    repositoryDirectory,
    "packages",
    "infini-core",
    "src",
    "runtime",
    "wasm",
);
const wasmPack = process.platform === "win32" ? "wasm-pack.exe" : "wasm-pack";

rmSync(outputDirectory, { recursive: true, force: true });
mkdirSync(outputDirectory, { recursive: true });

const build = spawnSync(
    wasmPack,
    [
        "build",
        crateDirectory,
        "--target",
        "web",
        "--release",
        "--out-dir",
        outputDirectory,
        "--out-name",
        "infini_wasm",
    ],
    {
        cwd: repositoryDirectory,
        encoding: "utf8",
        stdio: "inherit",
        env: {
            ...process.env,
            RUSTFLAGS: [process.env.RUSTFLAGS, "-Ctarget-cpu=mvp"]
                .filter(Boolean)
                .join(" "),
        },
    },
);
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);

rmSync(path.join(outputDirectory, "package.json"), { force: true });
rmSync(path.join(outputDirectory, ".gitignore"), { force: true }); // .gitignore breaks npm publish.
rmSync(path.join(outputDirectory, "README.md"), { force: true });
