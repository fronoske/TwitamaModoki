/**
 * dist フォルダを ZIP に圧縮するスクリプト
 * ZIP ファイルはプロジェクトルート直下に出力される（vite build で消えないように）
 *
 * 使い方:
 *   node scripts/zip-dist.js           # TwitamaModoki-(version).zip
 *   node scripts/zip-dist.js dev       # TwitamaModoki-dev.zip
 */

import { rmSync } from "fs";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rootDir = join(__dirname, "..");
const distDir = join(rootDir, "dist");

// .vite キャッシュを削除
rmSync(join(distDir, ".vite"), { recursive: true, force: true });

// サフィックスを決定（引数があればそれを使い、なければ package.json のバージョン）
const suffix = process.argv[2] ||
    JSON.parse(readFileSync(join(rootDir, "package.json"), "utf-8")).version;

const zipName = `TwitamaModoki-${suffix}.zip`;
const zipPath = join(rootDir, zipName);

console.log(`📦 ${zipName} を作成中...`);

execSync(`7za a -tzip "${zipPath}" *`, {
    cwd: distDir,
    stdio: "inherit",
});

console.log(`✅ ${zipName} を作成しました`);
