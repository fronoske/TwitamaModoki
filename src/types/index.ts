/**
 * TwitamaModoki 型定義
 */

/**
 * カラムの種類
 *
 * Phase 3の実装により、すべてのカラムはURLベースで動作するため、
 * typeによる挙動の分岐は不要。シンプルに2種類のみ。
 *
 * - "column": 通常のカラム（ホーム、検索、リスト、通知、DM等）
 * - "settings": 設定画面カラム（特別扱い）
 */
export type ColumnType = "column" | "settings";

/**
 * カラム設定
 *
 * URLベースの設計により、カラムの種類を区別する必要がなくなった。
 * currentUrl フィールドがあれば、どのページでも表示可能。
 *
 * 将来、カラム別の設定が必要になった場合は、
 * metadata フィールドを追加して柔軟に対応できる。
 */
export interface ColumnConfig {
    type: ColumnType;
    // 将来の拡張用（必要になったら追加）
    // metadata?: Record<string, unknown>;
}

/**
 * カラム
 *
 * Phase 3で実装したURL自動保存により、
 * currentUrl だけで完全な復元が可能になった。
 */
export interface Column {
    id: string;
    title: string;
    currentUrl: string; // 現在のURL（復元用） - これが本質
    config: ColumnConfig;
}

/**
 * 自動更新設定
 */
export interface AutoRefreshConfig {
    enabled: boolean;
    interval: number; // 秒単位
}

/**
 * 表示設定
 */
export type ScrollButtonPosition = "right" | "left";
export type ScrollButtonVisibility = "always" | "scroll-only" | "never";

export interface DisplayConfig {
    fontSize: number; // フォントサイズ（%）: 80〜150
    scrollButtonPosition: ScrollButtonPosition; // フローティングボタンの配置
    scrollToTopVisibility: ScrollButtonVisibility; // 上スクロールボタンの表示
    scrollToBottomVisibility: ScrollButtonVisibility; // 下スクロールボタンの表示

    // 非表示設定
    hideAds: boolean; // 広告（プロモーション）を非表示
    hideListHeaders: boolean; // リストカラムのヘッダーを非表示
    hidePostMenuButton: boolean; // 投稿の三点リーダーを非表示
    hideRecommendedUsers: boolean; // 「おすすめユーザー」を非表示
    hideVerificationUpsell: boolean; // 「～さんはまだ認証されていません」を非表示
    bottomBannerMode: "always" | "home-only" | "never"; // 下部バナー表示モード
}

export type RateLimitCategory =
    | "tweetPost"
    | "userTimeline"
    | "homeLatestTimeline"
    | "listTweets"
    | "searchLatest"
    | "dmFetch"
    | "accountSettings"
    | "badgeCount";

export interface RateLimitInfo {
    limit: number | null;
    remaining: number | null;
    resetAt: number | null;
    lastUpdated: number | null;
}

export type RateLimitState = Record<RateLimitCategory, RateLimitInfo>;

/**
 * フィルタルール
 *
 * マッチするポストを非表示にする条件を定義
 * すべての条件はOR条件（いずれか1つでもマッチすれば非表示）
 */
export interface FilterRule {
    id: string;
    name: string; // フィルタの名前（管理用）
    enabled: boolean; // フィルタの有効/無効

    // フィルタ条件（すべてAND条件）
    screenName?: string; // ユーザー名（@なし、完全一致）
    textPattern?: string; // 本文テキスト（正規表現）
    isRetweet?: boolean; // true: RTのみ, false: RT以外のみ, undefined: 両方
    hasMedia?: boolean; // true: メディア付きのみ, false: メディアなしのみ, undefined: 両方
}

/**
 * アプリケーション全体の設定
 */
export interface AppConfig {
    columns: Column[];
    autoRefresh: AutoRefreshConfig;
    filters: FilterRule[];
    display: DisplayConfig;
    currentColumnIndex?: number; // 最後に開いていたカラムのインデックス
}

/**
 * デフォルト設定
 */
export const DEFAULT_CONFIG: AppConfig = {
    columns: [
        {
            id: "settings",
            title: "設定",
            currentUrl: "", // 設定画面はURLなし
            config: { type: "settings" },
        },
    ],
    autoRefresh: {
        enabled: false,
        interval: 60,
    },
    filters: [],
    display: {
        fontSize: 100, // デフォルトは100%
        scrollButtonPosition: "left",
        scrollToTopVisibility: "always",
        scrollToBottomVisibility: "always",
        hideAds: true,
        hideListHeaders: true,
        hidePostMenuButton: true,
        hideRecommendedUsers: false,
        hideVerificationUpsell: false,
        bottomBannerMode: "home-only",
    },
};

export const DEFAULT_RATE_LIMIT_STATE: RateLimitState = {
    tweetPost: { limit: null, remaining: null, resetAt: null, lastUpdated: null },
    userTimeline: { limit: null, remaining: null, resetAt: null, lastUpdated: null },
    homeLatestTimeline: { limit: null, remaining: null, resetAt: null, lastUpdated: null },
    listTweets: { limit: null, remaining: null, resetAt: null, lastUpdated: null },
    searchLatest: { limit: null, remaining: null, resetAt: null, lastUpdated: null },
    dmFetch: { limit: null, remaining: null, resetAt: null, lastUpdated: null },
    accountSettings: { limit: null, remaining: null, resetAt: null, lastUpdated: null },
    badgeCount: { limit: null, remaining: null, resetAt: null, lastUpdated: null },
};

/**
 * URLが記録すべきものかチェック（ホワイトリスト方式）
 *
 * 以下のパスのみ記録する：
 * - /home - ホーム
 * - /notifications - 通知
 * - /messages, /messages/* - DM
 * - /search - 検索
 * - /i/lists/* - リスト
 * - /explore, /explore/* - Explore
 * - /i/bookmarks - ブックマーク
 * - /i/communities/* - コミュニティ
 * - /[username] - ユーザープロフィール
 */
export function shouldRecordUrl(url: string): boolean {
    // getColumnTypeFromUrlを使って判定する場合は循環参照を避けるため、
    // ここでは従来通りの実装を維持
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;

        // ホワイトリスト：これらのパターンにマッチするURLのみ記録
        const allowedPatterns = [
            /^\/home$/, // ホーム
            /^\/notifications$/, // 通知
            /^\/messages(\/.*)?$/, // DM
            /^\/search$/, // 検索
            /^\/i\/lists\/.+$/, // リスト
            /^\/explore(\/.*)?$/, // Explore
            /^\/i\/bookmarks$/, // ブックマーク
            /^\/i\/communities\/.+$/, // コミュニティ
            /^\/[a-zA-Z0-9_]{1,15}$/, // ユーザープロフィール
        ];

        // いずれかのパターンにマッチするかチェック
        return allowedPatterns.some((pattern) => pattern.test(pathname));
    } catch {
        return false; // 無効なURLは記録しない
    }
}

/**
 * URLからカラムタイトルを推測
 */
export function getTitleFromUrl(url: string): string {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const searchParams = urlObj.searchParams;

        // ホーム
        if (pathname === "/home") return "Home";

        // 通知
        if (pathname === "/notifications") return "Notifications";

        // メッセージ
        if (pathname === "/messages" || pathname.startsWith("/messages/")) return "DM";

        // 検索
        if (pathname === "/search") {
            const keyword = searchParams.get("q");
            return keyword ? `🔍${keyword}` : "🔍Search";
        }

        // リスト
        if (pathname.includes("/i/lists/")) {
            // リスト名はiframe内から取得できないので、シンプルに「リスト」とする
            return "List";
        }

        // Explore/トレンド
        if (pathname === "/explore" || pathname.startsWith("/explore/")) return "Explore";

        // プロフィール
        if (pathname.match(/^\/[^/]+$/)) {
            const username = pathname.substring(1);
            return `@${username}`;
        }

        return "X";
    } catch {
        return "X";
    }
}
