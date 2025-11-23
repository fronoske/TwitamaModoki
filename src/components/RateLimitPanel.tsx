import { useMemo } from "react";
import { useAppStore } from "@/store";
import { RateLimitCategory } from "@/types";
import { getColumnTypeFromUrl } from "@/utils/columnType";
import "./RateLimitPanel.css";

type RateLimitItem = {
    key: RateLimitCategory;
    label: string;
    icon: string;
    shortLabel: string;
};

const RATE_LIMIT_ITEMS: RateLimitItem[] = [
    { key: "homeLatestTimeline", label: "ホーム時系列", icon: "🏠", shortLabel: "Home" },
    { key: "userTimeline", label: "ユーザーTL", icon: "👤", shortLabel: "User" },
    { key: "listTweets", label: "リスト", icon: "📋", shortLabel: "List" },
    { key: "searchLatest", label: "検索", icon: "🔍", shortLabel: "Search" },
    { key: "dmFetch", label: "DM", icon: "💬", shortLabel: "DM" },
    { key: "accountSettings", label: "アカウント設定", icon: "⚙️", shortLabel: "Account" },
    { key: "badgeCount", label: "バッジ", icon: "🔔", shortLabel: "Badge" },
    { key: "tweetPost", label: "投稿", icon: "✏️", shortLabel: "Post" },
];

function getRelevantCategories(url: string, excludeCategories: RateLimitCategory[] = []): RateLimitCategory[] {
    try {
        const columnType = getColumnTypeFromUrl(url);
        const categories = new Set<RateLimitCategory>();

        switch (columnType) {
            case "home":
                categories.add("homeLatestTimeline");
                break;

            case "notifications":
                // 通知画面には特定のレート制限なし
                break;

            case "messages":
                categories.add("dmFetch");
                break;

            case "search":
                categories.add("searchLatest");
                break;

            case "list":
                categories.add("listTweets");
                break;

            case "explore":
                categories.add("searchLatest");
                break;

            case "bookmarks":
                // ブックマーク画面には特定のレート制限なし
                break;

            case "community":
                // コミュニティ画面には特定のレート制限なし
                break;

            case "user-profile":
                categories.add("userTimeline");
                break;

            default:
                // デフォルトでは何も追加しない
                break;
        }

        // 除外カテゴリを削除
        excludeCategories.forEach((category) => categories.delete(category));

        return Array.from(categories);
    } catch {
        // エラー時は空配列を返す
        return [];
    }
}

function formatRemaining(limit: number | null, remaining: number | null): string {
    if (limit === null || remaining === null) {
        return "—";
    }
    return `${remaining} / ${limit}`;
}

function formatResetTime(resetAt: number | null): string {
    if (!resetAt) {
        return "—:—";
    }

    const resetDate = new Date(resetAt * 1000);
    const diffMs = resetDate.getTime() - Date.now();
    if (diffMs <= 0) {
        return "リセット済";
    }

    const pad = (value: number) => value.toString().padStart(2, "0");
    return `${pad(resetDate.getHours())}:${pad(resetDate.getMinutes())}`;
}

function formatReset(resetAt: number | null): string {
    if (!resetAt) {
        return "リセット未取得";
    }

    const resetDate = new Date(resetAt * 1000);
    const diffMs = resetDate.getTime() - Date.now();
    if (diffMs <= 0) {
        return "リセット済";
    }

    const pad = (value: number) => value.toString().padStart(2, "0");
    const timeLabel = `${pad(resetDate.getHours())}:${pad(resetDate.getMinutes())}`;
    const minutes = Math.floor(diffMs / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);
    const relativeLabel = minutes > 0 ? `${minutes}分後` : `${seconds}秒後`;

    return `${timeLabel} (${relativeLabel})`;
}

function getStatus(limit: number | null, remaining: number | null): "unknown" | "normal" | "warning" | "critical" {
    if (limit === null || remaining === null || limit === 0) {
        return "unknown";
    }

    const ratio = remaining / limit;
    if (ratio <= 0.1) {
        return "critical";
    }
    if (ratio <= 0.3) {
        return "warning";
    }
    return "normal";
}

interface RateLimitPanelProps {
    currentUrl: string;
    /** 除外するカテゴリ（デフォルトでbadgeCount、accountSettings、tweetPostを除外） */
    excludeCategories?: RateLimitCategory[];
    /** 含めるカテゴリ（指定した場合はこれらのみ表示、excludeCategoriesより優先） */
    includeCategories?: RateLimitCategory[];
    /** 縦並びレイアウトにするか（デフォルト: false） */
    vertical?: boolean;
}

export function RateLimitPanel({
    currentUrl,
    excludeCategories = ["badgeCount", "accountSettings", "tweetPost"],
    includeCategories,
    vertical = false,
}: RateLimitPanelProps) {
    const { rateLimits } = useAppStore();

    const items = useMemo(() => {
        let relevantCategories: RateLimitCategory[];

        if (includeCategories) {
            // includeCategoriesが指定されている場合はそれを使用
            relevantCategories = includeCategories;
        } else {
            // 通常の処理（URLベースで判定 + 除外）
            relevantCategories = getRelevantCategories(currentUrl, excludeCategories);
        }

        return RATE_LIMIT_ITEMS.filter((item) => relevantCategories.includes(item.key)).map((item) => {
            const info = rateLimits[item.key];
            return {
                ...item,
                limit: info?.limit ?? null,
                remaining: info?.remaining ?? null,
                resetAt: info?.resetAt ?? null,
                lastUpdated: info?.lastUpdated ?? null,
                status: getStatus(info?.limit ?? null, info?.remaining ?? null),
            };
        });
    }, [rateLimits, currentUrl, excludeCategories, includeCategories]);

    // アイテムが空の場合は何も表示しない
    if (items.length === 0) {
        return null;
    }

    return (
        <div className={`rate-limit-panel${vertical ? " vertical" : ""}`}>
            {items.map((item) => {
                const content = (
                    <>
                        <span className="rate-limit-icon" aria-hidden="true">
                            {item.icon}
                        </span>
                        <span className="rate-limit-short-label">{item.shortLabel}</span>
                        <span className="rate-limit-remaining">{formatRemaining(item.limit, item.remaining)}</span>
                        <span className="rate-limit-reset-time">( {formatResetTime(item.resetAt)} )</span>
                    </>
                );

                return (
                    <div key={item.key} className={`rate-limit-item ${item.status}`} title={`${item.label}: ${formatReset(item.resetAt)}`}>
                        {content}
                    </div>
                );
            })}
        </div>
    );
}
