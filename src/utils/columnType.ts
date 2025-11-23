/**
 * カラムの種類を判定するユーティリティ
 */

export type ColumnType = "home" | "notifications" | "messages" | "search" | "list" | "explore" | "bookmarks" | "community" | "user-profile" | "unknown";

/**
 * URLからカラムの種類を判定
 */
export function getColumnTypeFromUrl(url: string): ColumnType {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;

        // ホーム
        if (pathname === "/home") return "home";

        // 通知
        if (pathname === "/notifications") return "notifications";

        // メッセージ
        if (pathname === "/messages" || pathname.startsWith("/messages/")) return "messages";

        // 検索
        if (pathname === "/search") return "search";

        // リスト
        if (pathname.match(/^\/i\/lists\/.+$/)) return "list";

        // Explore
        if (pathname === "/explore" || pathname.startsWith("/explore/")) return "explore";

        // ブックマーク
        if (pathname === "/i/bookmarks") return "bookmarks";

        // コミュニティ
        if (pathname.match(/^\/i\/communities\/.+$/)) return "community";

        // ユーザープロフィール（他のどれにもマッチせず、Twitterのユーザー名形式にマッチ）
        // Twitterのユーザー名: 1-15文字の英数字とアンダースコア
        if (pathname.match(/^\/[a-zA-Z0-9_]{1,15}$/)) return "user-profile";

        return "unknown";
    } catch {
        return "unknown";
    }
}

/**
 * ホームカラムかどうか
 */
export function isHomeColumn(url: string): boolean {
    return getColumnTypeFromUrl(url) === "home";
}

/**
 * リストカラムかどうか
 */
export function isListColumn(url: string): boolean {
    return getColumnTypeFromUrl(url) === "list";
}

/**
 * ユーザープロフィールカラムかどうか
 */
export function isUserProfileColumn(url: string): boolean {
    return getColumnTypeFromUrl(url) === "user-profile";
}

/**
 * 通知カラムかどうか
 */
export function isNotificationsColumn(url: string): boolean {
    return getColumnTypeFromUrl(url) === "notifications";
}

/**
 * メッセージカラムかどうか
 */
export function isMessagesColumn(url: string): boolean {
    return getColumnTypeFromUrl(url) === "messages";
}

/**
 * 検索カラムかどうか
 */
export function isSearchColumn(url: string): boolean {
    return getColumnTypeFromUrl(url) === "search";
}

/**
 * Exploreカラムかどうか
 */
export function isExploreColumn(url: string): boolean {
    return getColumnTypeFromUrl(url) === "explore";
}

/**
 * ブックマークカラムかどうか
 */
export function isBookmarksColumn(url: string): boolean {
    return getColumnTypeFromUrl(url) === "bookmarks";
}

/**
 * コミュニティカラムかどうか
 */
export function isCommunityColumn(url: string): boolean {
    return getColumnTypeFromUrl(url) === "community";
}
