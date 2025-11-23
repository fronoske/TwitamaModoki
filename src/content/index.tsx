/**
 * Content Script - Xページに統合
 * https://x.com/run-twitama-modoki でのみ動作
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "@/components/App";
import { logger } from "@/utils/logger";

// Content Script用のスタイルを注入
const injectStyles = () => {
    const style = document.createElement("style");
    style.textContent = `
    /* Xの既存のコンテンツを隠す */
    body.twitama-modoki-active {
      overflow: hidden;
    }
    
    body.twitama-modoki-active > *:not(#twitama-modoki-root) {
      display: none !important;
    }
    
    /* TwitamaModokiのルート要素 */
    #twitama-modoki-root {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 999999;
    }
  `;
    document.head.appendChild(style);
};

// URLチェック: /run-twitama-modoki で始まるか確認
function shouldActivate(): boolean {
    const path = window.location.pathname;
    return path.startsWith("/run-twitama-modoki");
}

// ページタイトルを設定・監視
let titleObserver: MutationObserver | null = null;
let twitamaModokiTitle = "TwitamaModoki";

function setupTitleObserver() {
    // 既存のオブザーバーを削除
    if (titleObserver) {
        titleObserver.disconnect();
    }

    // TwitamaModokiのタイトルを取得
    try {
        const manifest = chrome.runtime.getManifest();
        const version = manifest.version_name || manifest.version;
        twitamaModokiTitle = `TwitamaModoki ${version}`;
    } catch {
        twitamaModokiTitle = "TwitamaModoki";
    }

    // タイトルを設定
    document.title = twitamaModokiTitle;

    // タイトルの変更を監視して常にTwitamaModokiのタイトルに戻す
    titleObserver = new MutationObserver(() => {
        if (document.title !== twitamaModokiTitle) {
            document.title = twitamaModokiTitle;
        }
    });

    // <title>要素を監視
    const titleElement = document.querySelector("title");
    if (titleElement) {
        titleObserver.observe(titleElement, {
            childList: true,
            characterData: true,
            subtree: true,
        });
    }

    logger.log("✅ TwitamaModoki: ページタイトルを設定:", twitamaModokiTitle);
}

function stopTitleObserver() {
    if (titleObserver) {
        titleObserver.disconnect();
        titleObserver = null;
    }
}

// TwitamaModokiを初期化
async function initTwitamaModoki() {
    logger.log("TwitamaModoki: 初期化開始");

    // URLチェック
    if (!shouldActivate()) {
        logger.log("TwitamaModoki: URLが一致しないため起動しません");
        return;
    }

    // ページタイトルを設定・監視
    setupTitleObserver();

    // スタイルを注入
    injectStyles();

    // 既存のルート要素があれば削除
    const existingRoot = document.getElementById("twitama-modoki-root");
    if (existingRoot) {
        existingRoot.remove();
    }

    // ルート要素を作成
    const root = document.createElement("div");
    root.id = "twitama-modoki-root";
    document.body.appendChild(root);

    // Xの既存コンテンツを隠すクラスを追加
    document.body.classList.add("twitama-modoki-active");

    // Reactアプリをマウント
    const reactRoot = ReactDOM.createRoot(root);
    reactRoot.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );

    logger.log("TwitamaModoki: 初期化完了");
}

// TwitamaModokiを終了
function destroyTwitamaModoki() {
    logger.log("TwitamaModoki: 終了処理開始");

    // タイトル監視を停止
    stopTitleObserver();

    const root = document.getElementById("twitama-modoki-root");
    if (root) {
        root.remove();
    }

    document.body.classList.remove("twitama-modoki-active");

    logger.log("TwitamaModoki: 終了処理完了");
}

// DOMの準備ができてから初期化
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTwitamaModoki);
} else {
    initTwitamaModoki();
}

// ページ遷移を検知してON/OFF（SPAのため）
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        logger.log("TwitamaModoki: ページ遷移を検知:", url);

        if (shouldActivate()) {
            // /run-twitama-modoki に遷移した場合は起動
            const existingRoot = document.getElementById("twitama-modoki-root");
            if (!existingRoot) {
                initTwitamaModoki();
            }
        } else {
            // 別のページに遷移した場合は終了
            const existingRoot = document.getElementById("twitama-modoki-root");
            if (existingRoot) {
                destroyTwitamaModoki();
            }
        }
    }
}).observe(document, { subtree: true, childList: true });
