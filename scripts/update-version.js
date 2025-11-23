/**
 * ビルド時にバージョンを自動更新するスクリプト
 *
 * セマンティックバージョニングを採用:
 * - 開発版: vX.Y.Z-YYYYMMDD-HHMM
 * - リリース版: vX.Y.Z
 *
 * 使い方:
 *   node scripts/update-version.js development  # 開発版
 *   node scripts/update-version.js production   # リリース版
 *
 * manifest.template.json からバージョン付きの manifest.json を生成します。
 * manifest.json は .gitignore に含まれるため、コミット対象外です。
 */

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// package.jsonとmanifest関連ファイルのパス
const packageJsonPath = join(__dirname, "../package.json");
const manifestTemplatePath = join(__dirname, "../src/manifest.template.json");
const manifestJsonPath = join(__dirname, "../src/manifest.json");

// コマンドライン引数からビルドモードを取得
const buildMode = process.argv[2] || "development";
const isProduction = buildMode === "production";

// package.jsonを読み込み
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
const baseVersion = packageJson.version;

// バージョン文字列を生成
let versionName;
if (isProduction) {
    // リリース版: vX.Y.Z
    versionName = `v${baseVersion}`;
} else {
    // 開発版: vX.Y.Z-YYYYMMDD-HHMM
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const timestamp = `${year}${month}${day}-${hours}${minutes}`;
    versionName = `v${baseVersion}-${timestamp}`;
}

// manifest.template.jsonを読み込み
const manifestJson = JSON.parse(readFileSync(manifestTemplatePath, "utf-8"));

// バージョンを更新
manifestJson.version_name = versionName;

// manifest.jsonに書き込み（これは.gitignoreされている）
writeFileSync(manifestJsonPath, JSON.stringify(manifestJson, null, 2) + "\n", "utf-8");

console.log(`✅ バージョンを更新しました: ${versionName} (${buildMode} build)`);
