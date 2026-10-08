// Sets the project version across package.json, src-tauri/tauri.conf.json, and
// src-tauri/Cargo.toml to the value passed as the first argument.
//
// Used by the release workflow so the built app's displayed version always
// equals the released Git tag (e.g. tag `v0.1.0` -> version `0.1.0`, shown as
// `v0.1.0` in the About screen).
import { readFileSync, writeFileSync } from "node:fs";

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+([-+].+)?$/.test(version)) {
  console.error(`set_version: invalid semver "${version ?? ""}"`);
  process.exit(1);
}

function setJson(path, mutate) {
  const json = JSON.parse(readFileSync(path, "utf8"));
  mutate(json);
  writeFileSync(path, JSON.stringify(json, null, 2) + "\n");
  console.log(`updated ${path} -> ${version}`);
}

setJson("package.json", (p) => {
  p.version = version;
});
setJson("src-tauri/tauri.conf.json", (c) => {
  c.version = version;
});

// Replace only the first `version = "..."` line (the [package] version).
const cargoPath = "src-tauri/Cargo.toml";
const cargo = readFileSync(cargoPath, "utf8").replace(
  /^version = ".*"$/m,
  `version = "${version}"`,
);
writeFileSync(cargoPath, cargo);
console.log(`updated ${cargoPath} -> ${version}`);
