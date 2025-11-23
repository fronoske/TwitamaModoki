/**
 * Zustand ストア - アプリケーション状態管理
 */

import { create } from "zustand";
import { AppConfig, Column, DEFAULT_CONFIG, RateLimitState, DEFAULT_RATE_LIMIT_STATE, FilterRule, DisplayConfig } from "@/types";
import { loadConfig, saveConfig } from "@/storage";
import { logger } from "@/utils/logger";

interface AppStore extends AppConfig {
    // 状態
    currentColumnIndex: number;
    isLoading: boolean;
    rateLimits: RateLimitState;

    // アクション
    setCurrentColumnIndex: (index: number) => void;
    setColumns: (columns: Column[]) => void;
    addColumn: (column: Column) => void;
    removeColumn: (columnId: string) => void;
    updateColumn: (columnId: string, updates: Partial<Column>) => void;
    updateColumnUrl: (columnId: string, url: string, title?: string) => void;
    moveColumn: (fromIndex: number, toIndex: number) => void;
    setAutoRefresh: (enabled: boolean, interval?: number) => void;
    setFontSize: (fontSize: number) => void;
    setScrollButtonPosition: (position: "left" | "right") => void;
    setDisplayConfig: (updates: Partial<DisplayConfig>) => void;
    setRateLimits: (limits: RateLimitState) => void;
    addFilter: (filter: FilterRule) => void;
    updateFilter: (filterId: string, updates: Partial<FilterRule>) => void;
    removeFilter: (filterId: string) => void;
    toggleFilter: (filterId: string) => void;
    resetToDefault: () => void;
    loadFromStorage: () => Promise<void>;
    saveToStorage: () => Promise<void>;
}

export const useAppStore = create<AppStore>((set, get) => ({
    // 初期状態
    columns: [],
    autoRefresh: { enabled: false, interval: 60 },
    filters: [],
    display: DEFAULT_CONFIG.display,
    currentColumnIndex: 0,
    isLoading: true,
    rateLimits: DEFAULT_RATE_LIMIT_STATE,

    // カラムインデックス設定
    setCurrentColumnIndex: (index: number) => {
        set({ currentColumnIndex: index });
        get().saveToStorage(); // インデックス変更を即座に保存
    },

    // カラム配列を設定
    setColumns: (columns: Column[]) => {
        set({ columns });
        get().saveToStorage();
    },

    // カラム追加
    addColumn: (column: Column) => {
        const { columns } = get();
        const settingsIndex = columns.findIndex((c) => c.config.type === "settings");

        let newColumns: Column[];
        if (settingsIndex !== -1) {
            // 設定カラムの前に挿入
            newColumns = [...columns.slice(0, settingsIndex), column, ...columns.slice(settingsIndex)];
        } else {
            // 設定カラムがない場合は末尾に追加
            newColumns = [...columns, column];
        }

        set({ columns: newColumns });
        get().saveToStorage();
    },

    // カラム削除
    removeColumn: (columnId: string) => {
        const { columns, currentColumnIndex } = get();
        const newColumns = columns.filter((c) => c.id !== columnId);

        // 現在のインデックスを調整
        const deletedIndex = columns.findIndex((c) => c.id === columnId);
        let newIndex = currentColumnIndex;
        if (deletedIndex <= currentColumnIndex && currentColumnIndex > 0) {
            newIndex = currentColumnIndex - 1;
        }

        set({ columns: newColumns, currentColumnIndex: newIndex });
        get().saveToStorage();
    },

    // カラム更新
    updateColumn: (columnId: string, updates: Partial<Column>) => {
        const { columns } = get();
        const newColumns = columns.map((c) => (c.id === columnId ? { ...c, ...updates } : c));
        set({ columns: newColumns });
        get().saveToStorage();
    },

    // カラムのURL更新（タイトルも同時に更新可能）
    updateColumnUrl: (columnId: string, url: string, title?: string) => {
        const { columns } = get();
        const newColumns = columns.map((c) => {
            if (c.id === columnId) {
                const updates: Partial<Column> = { currentUrl: url };
                if (title) {
                    updates.title = title;
                }
                return { ...c, ...updates };
            }
            return c;
        });
        set({ columns: newColumns });
        get().saveToStorage();
    },

    // カラム移動
    moveColumn: (fromIndex: number, toIndex: number) => {
        const { columns } = get();
        const newColumns = [...columns];
        const [movedColumn] = newColumns.splice(fromIndex, 1);
        newColumns.splice(toIndex, 0, movedColumn);
        set({ columns: newColumns });
        get().saveToStorage();
    },

    // 自動更新設定
    setAutoRefresh: (enabled: boolean, interval?: number) => {
        const currentInterval = get().autoRefresh.interval;
        set({
            autoRefresh: {
                enabled,
                interval: interval ?? currentInterval,
            },
        });
        get().saveToStorage();
    },

    // フォントサイズ設定
    setFontSize: (fontSize: number) => {
        set({
            display: { ...get().display, fontSize },
        });
        get().saveToStorage();
    },

    // スクロールボタン配置
    setScrollButtonPosition: (position: "left" | "right") => {
        set({
            display: { ...get().display, scrollButtonPosition: position },
        });
        get().saveToStorage();
    },

    // 表示設定を更新
    setDisplayConfig: (updates: Partial<DisplayConfig>) => {
        set({
            display: { ...get().display, ...updates },
        });
        get().saveToStorage();
    },

    // レート制限情報を更新
    setRateLimits: (limits: RateLimitState) => {
        set({ rateLimits: limits });
    },

    // フィルタ追加
    addFilter: (filter: FilterRule) => {
        set((state) => ({
            filters: [...state.filters, filter],
        }));
        get().saveToStorage();
    },

    // フィルタ更新
    updateFilter: (filterId: string, updates: Partial<FilterRule>) => {
        set((state) => ({
            filters: state.filters.map((f) => (f.id === filterId ? { ...f, ...updates } : f)),
        }));
        get().saveToStorage();
    },

    // フィルタ削除
    removeFilter: (filterId: string) => {
        set((state) => ({
            filters: state.filters.filter((f) => f.id !== filterId),
        }));
        get().saveToStorage();
    },

    // フィルタの有効/無効を切り替え
    toggleFilter: (filterId: string) => {
        set((state) => ({
            filters: state.filters.map((f) => (f.id === filterId ? { ...f, enabled: !f.enabled } : f)),
        }));
        get().saveToStorage();
    },

    // デフォルト設定にリセット
    resetToDefault: () => {
        set({
            columns: DEFAULT_CONFIG.columns,
            autoRefresh: DEFAULT_CONFIG.autoRefresh,
            filters: DEFAULT_CONFIG.filters,
            display: DEFAULT_CONFIG.display,
            currentColumnIndex: 0,
            rateLimits: DEFAULT_RATE_LIMIT_STATE,
        });
    },

    // Storageから読み込み
    loadFromStorage: async () => {
        try {
            set({ isLoading: true });
            const config = await loadConfig();

            // 保存されたcurrentColumnIndexを使用（存在しない場合は0）
            let restoredColumnIndex = config.currentColumnIndex ?? 0;

            // インデックスが範囲外の場合は0に修正
            if (restoredColumnIndex >= config.columns.length) {
                restoredColumnIndex = 0;
            }

            set({
                columns: config.columns,
                autoRefresh: config.autoRefresh,
                filters: config.filters,
                display: { ...DEFAULT_CONFIG.display, ...(config.display || {}) }, // 後方互換性のため
                currentColumnIndex: restoredColumnIndex, // 保存されたインデックスを復元
                isLoading: false,
            });
            logger.log("✅ TwitamaModoki: 設定読み込み完了 (カラム数:", config.columns.length, ", 復元カラム:", restoredColumnIndex, ")");
        } catch (error) {
            logger.error("❌ TwitamaModoki: 設定の読み込みエラー:", error);
            set({ isLoading: false });
        }
    },

    // Storageに保存
    saveToStorage: async () => {
        try {
            const { columns, autoRefresh, filters, display, currentColumnIndex } = get();
            await saveConfig({ columns, autoRefresh, filters, display, currentColumnIndex });
        } catch (error) {
            logger.error("設定の保存エラー:", error);
        }
    },
}));
