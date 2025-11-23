import { DEFAULT_RATE_LIMIT_STATE, RateLimitCategory, RateLimitState } from "@/types";
import { RATE_LIMIT_STORAGE_KEY } from "@/storage";
import { logger } from "@/utils/logger";

/**
 * Background Service Worker
 *
 * 主な役割:
 * 1. declarativeNetRequest でセキュリティヘッダーを削除（iframe表示を可能にする）
 * 2. レート制限情報を取得・共有
 * 3. メッセージハンドリング
 */

// 開発モードの検出
const isDevelopment = !("update_url" in chrome.runtime.getManifest());

type RateLimitPattern = {
    category: RateLimitCategory;
    patterns: RegExp[];
};

const RATE_LIMIT_PATTERNS: RateLimitPattern[] = [
    {
        category: "tweetPost",
        patterns: [/CreateTweet/i, /TweetCreate/i],
    },
    {
        category: "userTimeline",
        patterns: [/UserTweets/i, /UserTweetsAndReplies/i],
    },
    {
        category: "homeLatestTimeline",
        patterns: [/HomeLatestTimeline/i],
    },
    {
        category: "listTweets",
        patterns: [/ListLatestTweetsTimeline/i, /ListTweets/i],
    },
    {
        category: "searchLatest",
        patterns: [/SearchTimeline/i],
    },
    {
        category: "dmFetch",
        patterns: [/DmInbox/i, /DmConversation/i, /DmHistory/i],
    },
    {
        category: "accountSettings",
        patterns: [/\/account\/settings\.json/i],
    },
    {
        category: "badgeCount",
        patterns: [/badge_count\/badge_count\.json/i],
    },
];

const rateLimitState: RateLimitState = JSON.parse(JSON.stringify(DEFAULT_RATE_LIMIT_STATE));

function getHeaderValue(headers: chrome.webRequest.HttpHeader[] | undefined, name: string): number | null {
    if (!headers) return null;
    const found = headers.find((header) => header.name?.toLowerCase() === name);
    if (!found || !found.value) return null;
    const parsed = Number(found.value);
    return Number.isNaN(parsed) ? null : parsed;
}

function detectRateLimitCategory(url: string): RateLimitCategory | null {
    const entry = RATE_LIMIT_PATTERNS.find((rule) => rule.patterns.some((pattern) => pattern.test(url)));
    return entry ? entry.category : null;
}

function setupRateLimitMonitor() {
    if (!chrome.webRequest?.onHeadersReceived) {
        logger.warn("TwitamaModoki: webRequest APIが利用できません。レート制限情報は取得されません。");
        return;
    }

    chrome.webRequest.onHeadersReceived.addListener(
        (details) => {
            const category = detectRateLimitCategory(details.url);
            if (!category) {
                return;
            }

            const limit = getHeaderValue(details.responseHeaders, "x-rate-limit-limit");
            const remaining = getHeaderValue(details.responseHeaders, "x-rate-limit-remaining");
            const resetAt = getHeaderValue(details.responseHeaders, "x-rate-limit-reset");

            if (limit === null && remaining === null && resetAt === null) {
                return;
            }

            const previous = rateLimitState[category];
            const newLimit = limit ?? previous.limit;
            const newRemaining = remaining ?? previous.remaining;
            const newResetAt = resetAt ?? previous.resetAt;

            // 値が実際に変更された場合のみ更新
            if (
                previous.limit === newLimit &&
                previous.remaining === newRemaining &&
                previous.resetAt === newResetAt
            ) {
                return; // 変更なし、更新不要
            }

            logger.log(`🔍 TwitamaModoki: レート制限更新 [${category}]`, {
                url: details.url,
                limit: newLimit,
                remaining: newRemaining,
                resetAt: newResetAt,
            });

            rateLimitState[category] = {
                limit: newLimit,
                remaining: newRemaining,
                resetAt: newResetAt,
                lastUpdated: Date.now(),
            };

            chrome.storage.local.set({ [RATE_LIMIT_STORAGE_KEY]: rateLimitState });
        },
        {
            urls: ["*://*.x.com/i/api/*", "*://*.twitter.com/i/api/*", "*://api.x.com/*", "*://api.twitter.com/*"],
        },
        ["responseHeaders"]
    );
}

/**
 * セキュリティヘッダーを削除してiframe表示を可能にする
 * Open-Deck と同じ仕組み
 */
function setupHeaderRemoval() {
    const rules: chrome.declarativeNetRequest.Rule[] = [
        {
            id: 1,
            priority: 1,
            action: {
                type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
                responseHeaders: [
                    {
                        header: "Content-Security-Policy",
                        operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE,
                    },
                    {
                        header: "X-Frame-Options",
                        operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE,
                    },
                ],
            },
            condition: {
                urlFilter: "x.com",
                resourceTypes: [
                    chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
                    chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
                    chrome.declarativeNetRequest.ResourceType.STYLESHEET,
                    chrome.declarativeNetRequest.ResourceType.SCRIPT,
                    chrome.declarativeNetRequest.ResourceType.IMAGE,
                    chrome.declarativeNetRequest.ResourceType.FONT,
                    chrome.declarativeNetRequest.ResourceType.OBJECT,
                    chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
                    chrome.declarativeNetRequest.ResourceType.PING,
                    chrome.declarativeNetRequest.ResourceType.CSP_REPORT,
                    chrome.declarativeNetRequest.ResourceType.MEDIA,
                    chrome.declarativeNetRequest.ResourceType.WEBSOCKET,
                    chrome.declarativeNetRequest.ResourceType.OTHER,
                ],
            },
        },
    ];

    chrome.declarativeNetRequest.updateSessionRules(
        {
            removeRuleIds: [1],
            addRules: rules,
        },
        () => {
            logger.log("✅ TwitamaModoki: セキュリティヘッダー削除ルール設定完了");
            logger.log("   - Content-Security-Policy: 削除");
            logger.log("   - X-Frame-Options: 削除");
        }
    );
}

// インストール時
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install") {
        logger.log("TwitamaModoki: 初回インストール");
        setupHeaderRemoval();
    } else if (details.reason === "update") {
        logger.log("TwitamaModoki: 更新されました");
        setupHeaderRemoval();

        // 開発モードの場合、アクティブなタブをリロード
        if (isDevelopment) {
            chrome.tabs.query({ url: ["*://*.twitter.com/*", "*://*.x.com/*"] }, (tabs) => {
                tabs.forEach((tab) => {
                    if (tab.id) {
                        chrome.tabs.reload(tab.id);
                    }
                });
            });
        }
    }
});

// 起動時にもヘッダー削除ルールを設定
chrome.runtime.onStartup.addListener(() => {
    logger.log("TwitamaModoki: 起動");
    setupHeaderRemoval();
});

// メッセージハンドリング
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    logger.log("TwitamaModoki: メッセージ受信", message);

    if (message.type === "reload-extension" && isDevelopment) {
        // 開発モード: 拡張機能をリロード
        chrome.runtime.reload();
    }

    if (message.type === "setup-header-removal") {
        // ヘッダー削除ルールの再設定
        setupHeaderRemoval();
        sendResponse({ status: "ok" });
    }

    sendResponse({ status: "ok" });
    return true;
});

// 開発モード通知
if (isDevelopment) {
    logger.log("🔧 TwitamaModoki: 開発モードで実行中");
}

// 初回読み込み時にヘッダー削除ルールを設定
setupHeaderRemoval();
setupRateLimitMonitor();

export {};
