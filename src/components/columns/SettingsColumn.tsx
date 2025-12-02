/**
 * 設定画面カラム
 */

import { useRef, useState, useEffect } from "react";
import { useAppStore } from "@/store";
import { Column, AppConfig } from "@/types";
import { STORAGE_KEY } from "@/storage";
import { LIST_NAME_CONFIG, COMMUNITY_NAME_CONFIG, USER_PROFILE_NAME_CONFIG } from "@/config/xSelectors";
import { getColumnTypeFromUrl } from "@/utils/columnType";
import { RateLimitPanel } from "@/components/RateLimitPanel";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, MouseSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { logger } from "@/utils/logger";
import "./SettingsColumn.css";

export function SettingsColumn() {
    const {
        autoRefresh,
        setAutoRefresh,
        addColumn,
        setCurrentColumnIndex,
        columns,
        resetToDefault,
        moveColumn,
        removeColumn,
        display,
        setFontSize,
        setScrollButtonPosition,
        setDisplayConfig,
        updateColumnUrl,
        filters,
        addFilter,
        updateFilter,
        removeFilter,
        toggleFilter,
    } = useAppStore();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [version, setVersion] = useState<string>("読み込み中...");
    const [isRefreshingNames, setIsRefreshingNames] = useState(false);
    const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState<string>("");
    const longPressTimerRef = useRef<number | null>(null);
    const [showFilterForm, setShowFilterForm] = useState(false);
    const [editingFilterId, setEditingFilterId] = useState<string | null>(null);
    const [filterForm, setFilterForm] = useState({
        name: "",
        screenName: "",
        textPattern: "",
        isRetweet: undefined as boolean | undefined,
        hasMedia: undefined as boolean | undefined,
    });
    const [showSettingsMenu, setShowSettingsMenu] = useState(false);

    // dnd-kitのセンサー設定
    // ハンドル要素のみをドラッグ可能にするため、activationConstraintを設定
    const sensors = useSensors(
        useSensor(MouseSensor, {
            activationConstraint: {
                distance: 0,
            },
        }),
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 0,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // ドラッグ終了時のハンドラー
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = columns.findIndex((col) => col.id === active.id);
            const newIndex = columns.findIndex((col) => col.id === over.id);

            if (oldIndex !== -1 && newIndex !== -1) {
                moveColumn(oldIndex, newIndex);
            }
        }
    };

    // バージョン情報を取得
    useEffect(() => {
        const getVersion = async () => {
            try {
                const manifest = chrome.runtime.getManifest();
                setVersion(manifest.version_name || manifest.version);
            } catch {
                setVersion("0.1.0");
            }
        };
        getVersion();
    }, []);

    const handleAutoRefreshToggle = () => {
        setAutoRefresh(!autoRefresh.enabled);
    };

    const handleIntervalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const interval = parseInt(e.target.value, 10);
        if (!isNaN(interval) && interval > 0) {
            setAutoRefresh(autoRefresh.enabled, interval);
        }
    };

    const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const fontSize = parseInt(e.target.value, 10);
        if (!isNaN(fontSize)) {
            setFontSize(fontSize);
        }
    };

    const handleScrollButtonPositionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const position = e.target.value === "left" ? "left" : "right";
        setScrollButtonPosition(position);
    };

    /**
     * 設定のエクスポート
     * chrome.storageの設定をJSONファイルとしてダウンロード
     */
    const handleExport = async () => {
        try {
            // chrome.storageから設定を取得
            const result = await chrome.storage.local.get(STORAGE_KEY);
            const config = result[STORAGE_KEY];

            if (!config) {
                alert("エクスポートする設定がありません。");
                return;
            }

            // JSON文字列に変換（整形付き）
            const jsonString = JSON.stringify(config, null, 2);

            // Blobを作成
            const blob = new Blob([jsonString], { type: "application/json" });

            // ダウンロードリンクを作成
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;

            // ファイル名（ローカルタイムのタイムスタンプ付き）
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, "0");
            const day = String(now.getDate()).padStart(2, "0");
            const hours = String(now.getHours()).padStart(2, "0");
            const minutes = String(now.getMinutes()).padStart(2, "0");
            const seconds = String(now.getSeconds()).padStart(2, "0");
            const timestamp = `${year}${month}${day}-${hours}${minutes}${seconds}`;
            a.download = `twitama-modoki-${timestamp}.json`;

            // ダウンロード実行
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            logger.log("✅ TwitamaModoki: 設定をエクスポート");
        } catch (error) {
            logger.error("❌ TwitamaModoki: エクスポートエラー:", error);
            alert("設定のエクスポートに失敗しました。");
        }
    };

    /**
     * 設定のインポート
     * JSONファイルから設定を読み込んでchrome.storageに保存
     */
    const handleImport = () => {
        // ファイル選択ダイアログを開く
        fileInputRef.current?.click();
    };

    /**
     * ファイル選択時の処理
     */
    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            // ファイルを読み込み
            const text = await file.text();
            const config = JSON.parse(text) as AppConfig;

            // バリデーション
            if (!validateConfig(config)) {
                alert("設定ファイルの形式が正しくありません。");
                return;
            }

            // chrome.storageに保存
            await chrome.storage.local.set({ [STORAGE_KEY]: config });
            logger.log("✅ TwitamaModoki: 設定をインポート完了");

            // ページ全体をリロード（最も確実な方法）
            window.location.reload();
        } catch (error) {
            logger.error("❌ TwitamaModoki: インポートエラー:", error);
            alert("設定のインポートに失敗しました。\nファイル形式を確認してください。");
        } finally {
            // ファイル選択をリセット（同じファイルを再選択可能にする）
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    /**
     * 設定ファイルのバリデーション
     */
    const validateConfig = (config: unknown): config is AppConfig => {
        // 必須フィールドのチェック
        if (!config || typeof config !== "object") return false;

        // Type guard: config is now known to be an object, cast for property access
        const cfg = config as Record<string, unknown>;

        if (!Array.isArray(cfg.columns)) return false;
        if (!cfg.autoRefresh || typeof cfg.autoRefresh !== "object") return false;
        if (!Array.isArray(cfg.filters)) return false;

        // autoRefreshの構造チェック
        const autoRefresh = cfg.autoRefresh as Record<string, unknown>;
        if (typeof autoRefresh.enabled !== "boolean") return false;
        if (typeof autoRefresh.interval !== "number") return false;

        return true;
    };

    /**
     * 設定クリア
     * TwitamaModokiのすべての設定を初期化
     */
    const handleClearSettings = async () => {
        if (
            !window.confirm(
                "すべての設定をクリアしますか？\n\n以下のデータが削除されます：\n- すべてのカラム\n- アカウント名\n- 自動更新設定\n- フィルター設定\n\nこの操作は取り消せません。"
            )
        ) {
            return;
        }

        try {
            // 1. chrome.storageから削除
            await chrome.storage.local.remove(STORAGE_KEY);
            logger.log("✅ TwitamaModoki: chrome.storageをクリア");

            // 2. ストアをデフォルト状態にリセット
            resetToDefault();
            logger.log("✅ TwitamaModoki: ストアをリセット");
        } catch (error) {
            logger.error("❌ TwitamaModoki: 設定クリアエラー:", error);
            alert("設定のクリアに失敗しました。");
        }
    };

    /**
     * カラム名を再取得
     * リスト/コミュニティカラムの名前をDOMから再取得して更新
     */
    const handleRefreshColumnNames = async () => {
        setIsRefreshingNames(true);
        let updatedCount = 0;

        try {
            // すべてのカラムをチェック
            for (const column of columns) {
                const columnType = getColumnTypeFromUrl(column.currentUrl);

                // リスト、コミュニティ、ユーザープロフィール以外はスキップ
                if (columnType !== "list" && columnType !== "community" && columnType !== "user-profile") {
                    continue;
                }

                // 対応するiframeを探す
                const iframe = document.querySelector(`iframe[src="${column.currentUrl}"]`) as HTMLIFrameElement;
                if (!iframe?.contentWindow?.document) {
                    logger.log(`⏭️ TwitamaModoki: iframe未検出 - ${column.title}`);
                    continue;
                }

                // DOMから名前を取得
                let newName: string | null = null;
                if (columnType === "list") {
                    newName = LIST_NAME_CONFIG.getListName(iframe.contentWindow.document);
                } else if (columnType === "community") {
                    newName = COMMUNITY_NAME_CONFIG.getCommunityName(iframe.contentWindow.document);
                } else if (columnType === "user-profile") {
                    newName = USER_PROFILE_NAME_CONFIG.getUserName(iframe.contentWindow.document);
                }

                // 名前が取得できて、かつ現在のタイトルと異なる場合のみ更新
                if (newName && newName !== column.title) {
                    logger.log(`✅ TwitamaModoki: カラム名更新 - "${column.title}" → "${newName}"`);
                    updateColumnUrl(column.id, column.currentUrl, newName);
                    updatedCount++;
                }
            }

            if (updatedCount > 0) {
                alert(`${updatedCount}個のカラム名を更新しました`);
            } else {
                alert("更新が必要なカラムはありませんでした");
            }
        } catch (error) {
            logger.error("❌ TwitamaModoki: カラム名再取得エラー:", error);
            alert("カラム名の再取得に失敗しました。");
        } finally {
            setIsRefreshingNames(false);
        }
    };

    /**
     * カラム名の編集開始
     */
    const handleStartEditColumnTitle = (column: Column) => {
        setEditingColumnId(column.id);
        setEditingTitle(column.title);
    };

    /**
     * カラム名の編集完了
     */
    const handleFinishEditColumnTitle = (columnId: string) => {
        if (editingTitle.trim() && editingTitle !== columns.find((c) => c.id === columnId)?.title) {
            const column = columns.find((c) => c.id === columnId);
            if (column) {
                updateColumnUrl(columnId, column.currentUrl, editingTitle.trim());
            }
        }
        setEditingColumnId(null);
        setEditingTitle("");
    };

    /**
     * カラム名の編集キャンセル
     */
    const handleCancelEditColumnTitle = () => {
        setEditingColumnId(null);
        setEditingTitle("");
    };

    /**
     * 長押し開始（モバイル対応）
     */
    const handleTouchStart = (column: Column) => {
        longPressTimerRef.current = window.setTimeout(() => {
            handleStartEditColumnTitle(column);
        }, 500); // 500ms長押しで編集モード
    };

    /**
     * タッチ移動（ドラッグ開始）で長押しキャンセル
     */
    const handleTouchMove = () => {
        if (longPressTimerRef.current !== null) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

    /**
     * 長押しキャンセル
     */
    const handleTouchEnd = () => {
        if (longPressTimerRef.current !== null) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

    /**
     * フィルタフォームを開く（新規追加）
     */
    const handleOpenFilterForm = () => {
        setEditingFilterId(null);
        setFilterForm({
            name: "",
            screenName: "",
            textPattern: "",
            isRetweet: undefined,
            hasMedia: undefined,
        });
        setShowFilterForm(true);
    };

    /**
     * フィルタフォームを開く（編集）
     */
    const handleEditFilter = (filterId: string) => {
        const filter = filters.find((f) => f.id === filterId);
        if (!filter) return;

        setEditingFilterId(filterId);
        setFilterForm({
            name: filter.name,
            screenName: filter.screenName || "",
            textPattern: filter.textPattern || "",
            isRetweet: filter.isRetweet,
            hasMedia: filter.hasMedia,
        });
        setShowFilterForm(true);
    };

    /**
     * フィルタフォームをキャンセル
     */
    const handleCancelFilterForm = () => {
        setShowFilterForm(false);
        setEditingFilterId(null);
    };

    /**
     * フィルタを保存
     */
    const handleSaveFilter = () => {
        // バリデーション
        if (!filterForm.name.trim()) {
            alert("フィルタ名を入力してください。");
            return;
        }

        // 正規表現のバリデーション
        if (filterForm.textPattern) {
            try {
                new RegExp(filterForm.textPattern);
            } catch (error) {
                alert("正規表現が不正です。\n\n" + (error as Error).message);
                return;
            }
        }

        // 少なくとも1つの条件が設定されているかチェック
        if (!filterForm.screenName && !filterForm.textPattern && filterForm.isRetweet === undefined && filterForm.hasMedia === undefined) {
            alert("少なくとも1つの条件を設定してください。");
            return;
        }

        if (editingFilterId) {
            // 更新
            updateFilter(editingFilterId, {
                name: filterForm.name.trim(),
                screenName: filterForm.screenName.trim() || undefined,
                textPattern: filterForm.textPattern.trim() || undefined,
                isRetweet: filterForm.isRetweet,
                hasMedia: filterForm.hasMedia,
            });
        } else {
            // 新規追加
            addFilter({
                id: `filter-${Date.now()}`,
                name: filterForm.name.trim(),
                enabled: true,
                screenName: filterForm.screenName.trim() || undefined,
                textPattern: filterForm.textPattern.trim() || undefined,
                isRetweet: filterForm.isRetweet,
                hasMedia: filterForm.hasMedia,
            });
        }

        setShowFilterForm(false);
        setEditingFilterId(null);
    };

    /**
     * 新規カラム追加
     * - 常にホーム画面から開始
     * - ユーザーは自由に他のページに移動できる
     * - URLとタイトルは自動的に記録される
     */
    const handleAddColumn = () => {
        const initialUrl = "https://x.com/home";
        const initialTitle = "ホーム";

        const newColumn: Column = {
            id: `column-${Date.now()}`,
            title: initialTitle,
            currentUrl: initialUrl,
            config: { type: "column" }, // シンプル化：すべて "column" タイプ
        };
        addColumn(newColumn);

        // 追加したカラムに自動的に移動
        // 設定カラムの直前に追加されるので、その位置にジャンプ
        const settingsIndex = columns.findIndex((c) => c.config.type === "settings");
        if (settingsIndex !== -1) {
            setCurrentColumnIndex(settingsIndex);
        }
    };

    return (
        <div className="settings-column">
            <div className="settings-content">
                <section className="settings-section">
                    <h3>表示設定</h3>

                    <h4 style={{ marginTop: "0", marginBottom: "10px" }}>本文フォント</h4>
                    <div className="setting-item">
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontSize: "14px", fontWeight: "600" }}>{display.fontSize}%</span>
                            <button
                                onClick={() => setFontSize(100)}
                                className="btn-reset-font"
                                title="100%にリセット"
                                style={{
                                    padding: "4px 8px",
                                    background: "transparent",
                                    border: "1px solid #38444d",
                                    borderRadius: "4px",
                                    color: "#8899a6",
                                    fontSize: "12px",
                                    cursor: "pointer",
                                    transition: "all 0.2s",
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = "#1da1f2";
                                    e.currentTarget.style.color = "#1da1f2";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = "#38444d";
                                    e.currentTarget.style.color = "#8899a6";
                                }}
                            >
                                ↻
                            </button>
                            <input
                                type="range"
                                min="80"
                                max="150"
                                step="5"
                                value={display.fontSize}
                                onChange={handleFontSizeChange}
                                className="font-size-slider"
                                style={{ flex: 1 }}
                            />
                        </div>
                        <div className="font-size-preview" style={{ fontSize: `${display.fontSize}%` }}>
                            プレビュー：これはサンプルテキストです
                        </div>
                    </div>

                    <h4 style={{ marginTop: "20px", marginBottom: "10px" }}>スクロールボタン</h4>

                    <div className="setting-item">
                        <span className="setting-label">配置</span>
                        <div className="button-position-options">
                            <label>
                                <input
                                    type="radio"
                                    name="scroll-button-position"
                                    value="left"
                                    checked={display.scrollButtonPosition === "left"}
                                    onChange={handleScrollButtonPositionChange}
                                />
                                左下
                            </label>
                            <label>
                                <input
                                    type="radio"
                                    name="scroll-button-position"
                                    value="right"
                                    checked={display.scrollButtonPosition === "right"}
                                    onChange={handleScrollButtonPositionChange}
                                />
                                右下
                            </label>
                        </div>
                    </div>

                    <div className="setting-item">
                        <span className="setting-label">上ボタン表示</span>
                        <div className="button-position-options">
                            <label>
                                <input
                                    type="radio"
                                    name="scroll-to-top-visibility"
                                    value="always"
                                    checked={display.scrollToTopVisibility === "always"}
                                    onChange={(e) => setDisplayConfig({ scrollToTopVisibility: e.target.value as "always" | "scroll-only" | "never" })}
                                />
                                常に
                            </label>
                            <label>
                                <input
                                    type="radio"
                                    name="scroll-to-top-visibility"
                                    value="scroll-only"
                                    checked={display.scrollToTopVisibility === "scroll-only"}
                                    onChange={(e) => setDisplayConfig({ scrollToTopVisibility: e.target.value as "always" | "scroll-only" | "never" })}
                                />
                                スクロール時
                            </label>
                            <label>
                                <input
                                    type="radio"
                                    name="scroll-to-top-visibility"
                                    value="never"
                                    checked={display.scrollToTopVisibility === "never"}
                                    onChange={(e) => setDisplayConfig({ scrollToTopVisibility: e.target.value as "always" | "scroll-only" | "never" })}
                                />
                                非表示
                            </label>
                        </div>
                    </div>

                    <div className="setting-item">
                        <span className="setting-label">下ボタン表示</span>
                        <div className="button-position-options">
                            <label>
                                <input
                                    type="radio"
                                    name="scroll-to-bottom-visibility"
                                    value="always"
                                    checked={display.scrollToBottomVisibility === "always"}
                                    onChange={(e) => setDisplayConfig({ scrollToBottomVisibility: e.target.value as "always" | "scroll-only" | "never" })}
                                />
                                常に
                            </label>
                            <label>
                                <input
                                    type="radio"
                                    name="scroll-to-bottom-visibility"
                                    value="scroll-only"
                                    checked={display.scrollToBottomVisibility === "scroll-only"}
                                    onChange={(e) => setDisplayConfig({ scrollToBottomVisibility: e.target.value as "always" | "scroll-only" | "never" })}
                                />
                                スクロール時
                            </label>
                            <label>
                                <input
                                    type="radio"
                                    name="scroll-to-bottom-visibility"
                                    value="never"
                                    checked={display.scrollToBottomVisibility === "never"}
                                    onChange={(e) => setDisplayConfig({ scrollToBottomVisibility: e.target.value as "always" | "scroll-only" | "never" })}
                                />
                                非表示
                            </label>
                        </div>
                    </div>

                    <h4 style={{ marginTop: "20px", marginBottom: "10px" }}>その他</h4>

                    <div className="setting-item">
                        <span className="setting-label">下部バナー表示</span>
                        <div className="button-position-options">
                            <label>
                                <input
                                    type="radio"
                                    name="bottom-banner-mode"
                                    value="always"
                                    checked={display.bottomBannerMode === "always"}
                                    onChange={(e) => setDisplayConfig({ bottomBannerMode: e.target.value as "always" | "home-only" | "never" })}
                                />
                                常に
                            </label>
                            <label>
                                <input
                                    type="radio"
                                    name="bottom-banner-mode"
                                    value="home-only"
                                    checked={display.bottomBannerMode === "home-only"}
                                    onChange={(e) => setDisplayConfig({ bottomBannerMode: e.target.value as "always" | "home-only" | "never" })}
                                />
                                ホームのみ
                            </label>
                            <label>
                                <input
                                    type="radio"
                                    name="bottom-banner-mode"
                                    value="never"
                                    checked={display.bottomBannerMode === "never"}
                                    onChange={(e) => setDisplayConfig({ bottomBannerMode: e.target.value as "always" | "home-only" | "never" })}
                                />
                                非表示
                            </label>
                        </div>
                    </div>

                    <h4 style={{ marginTop: "20px", marginBottom: "10px" }}>非表示設定</h4>
                    <p className="help-text">非表示にしたい項目をチェックしてください</p>

                    <div className="setting-item">
                        <label>
                            <input type="checkbox" checked={display.hideAds} onChange={(e) => setDisplayConfig({ hideAds: e.target.checked })} />
                            <span>広告（プロモーション）</span>
                        </label>
                    </div>

                    <div className="setting-item">
                        <label>
                            <input
                                type="checkbox"
                                checked={display.hideListHeaders}
                                onChange={(e) => setDisplayConfig({ hideListHeaders: e.target.checked })}
                            />
                            <span>リストカラムのヘッダー</span>
                        </label>
                    </div>

                    <div className="setting-item">
                        <label>
                            <input
                                type="checkbox"
                                checked={display.hidePostMenuButton}
                                onChange={(e) => setDisplayConfig({ hidePostMenuButton: e.target.checked })}
                            />
                            <span>ポスト左上のメニューボタン（⋯）</span>
                        </label>
                    </div>

                    <div className="setting-item">
                        <label>
                            <input
                                type="checkbox"
                                checked={display.hideVerificationUpsell}
                                onChange={(e) => setDisplayConfig({ hideVerificationUpsell: e.target.checked })}
                            />
                            <span>「まだ認証されていません」パネル</span>
                        </label>
                    </div>

                    <div className="setting-item">
                        <label>
                            <input
                                type="checkbox"
                                checked={display.hideRecommendedUsers}
                                onChange={(e) => setDisplayConfig({ hideRecommendedUsers: e.target.checked })}
                            />
                            <span>おすすめユーザー《実験的》</span>
                        </label>
                    </div>
                </section>

                <section className="settings-section">
                    <h3>自動更新《未実装》</h3>
                    <div className="setting-item">
                        <label>
                            <input type="checkbox" checked={autoRefresh.enabled} onChange={handleAutoRefreshToggle} />
                            <span>自動更新を有効にする</span>
                        </label>
                    </div>
                    {autoRefresh.enabled && (
                        <div className="setting-item">
                            <label>
                                更新間隔（秒）:
                                <input type="number" min="1" value={autoRefresh.interval} onChange={handleIntervalChange} className="interval-input" />
                            </label>
                        </div>
                    )}
                </section>

                <section className="settings-section">
                    <h3>カラム管理</h3>
                    {/* カラム一覧と並び替え */}
                    <div className="column-list">
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                            <h4 style={{ margin: 0 }}>カラム一覧</h4>
                            <button onClick={handleRefreshColumnNames} className="btn-refresh-names" disabled={isRefreshingNames}>
                                {isRefreshingNames ? "再取得中..." : "🔄 カラム名を再取得"}
                            </button>
                        </div>
                        <p className="help-text">右端を掴んで並び替え、カラム名を長押しして編集</p>

                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext
                                items={columns.filter((col) => col.config.type !== "settings").map((col) => col.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {columns
                                    .filter((col) => col.config.type !== "settings")
                                    .map((column) => (
                                        <SortableColumnItem
                                            key={column.id}
                                            column={column}
                                            isEditing={editingColumnId === column.id}
                                            editingTitle={editingTitle}
                                            onStartEdit={handleStartEditColumnTitle}
                                            onFinishEdit={() => handleFinishEditColumnTitle(column.id)}
                                            onCancelEdit={handleCancelEditColumnTitle}
                                            onEditingTitleChange={setEditingTitle}
                                            onRemove={removeColumn}
                                            onTouchStart={handleTouchStart}
                                            onTouchMove={handleTouchMove}
                                            onTouchEnd={handleTouchEnd}
                                        />
                                    ))}
                            </SortableContext>
                        </DndContext>

                        {columns.filter((c) => c.config.type !== "settings").length === 0 && (
                            <p className="help-text">カラムがありません。下のボタンから追加してください。</p>
                        )}
                    </div>
                    <div className="column-management-buttons">
                        <button onClick={handleAddColumn} className="btn-primary">
                            + 新規カラム追加
                        </button>
                    </div>

                    <p className="help-text">
                        カラムを追加するとホーム画面が表示されます。
                        <br />
                        カラム内でSearch, List, User, Communityページなどに移動するとそのページが自動保存されます（個別投稿ページは保存されません）。
                    </p>
                </section>

                <section className="settings-section">
                    <h3>フィルタ設定</h3>
                    <p className="help-text">ルールにマッチするポストを非表示にします。各ルール内のすべての条件はAND条件です。空欄の条件は無視されます。</p>

                    {/* フィルタ一覧 */}
                    <div className="filter-list">
                        {filters.map((filter) => (
                            <div key={filter.id} className="filter-item">
                                <div className="filter-header">
                                    <label className="filter-checkbox">
                                        <input type="checkbox" checked={filter.enabled} onChange={() => toggleFilter(filter.id)} />
                                        <span className="filter-name">{filter.name}</span>
                                    </label>
                                    <div className="filter-actions">
                                        <button className="btn-icon" onClick={() => handleEditFilter(filter.id)} title="編集">
                                            ✎
                                        </button>
                                        <button className="btn-icon btn-delete-filter" onClick={() => removeFilter(filter.id)} title="削除">
                                            ×
                                        </button>
                                    </div>
                                </div>
                                <div className="filter-conditions">
                                    {filter.screenName && <span className="filter-tag">@{filter.screenName}</span>}
                                    {filter.textPattern && <span className="filter-tag">/{filter.textPattern}/</span>}
                                    {filter.isRetweet !== undefined && <span className="filter-tag">{filter.isRetweet ? "RTのみ" : "RT以外"}</span>}
                                    {filter.hasMedia !== undefined && <span className="filter-tag">{filter.hasMedia ? "メディア付き" : "メディアなし"}</span>}
                                </div>
                            </div>
                        ))}
                    </div>

                    <button onClick={handleOpenFilterForm} className="btn-primary" style={{ marginTop: "16px" }}>
                        + フィルタルール追加
                    </button>

                    {/* フィルタフォーム（モーダル風） */}
                    {showFilterForm && (
                        <div className="filter-form-overlay" onClick={handleCancelFilterForm}>
                            <div className="filter-form" onClick={(e) => e.stopPropagation()}>
                                <h4>{editingFilterId ? "フィルタルール編集" : "フィルタルール追加"}</h4>

                                <div className="form-group">
                                    <label>フィルタ名 *</label>
                                    <input
                                        type="text"
                                        value={filterForm.name}
                                        onChange={(e) => setFilterForm({ ...filterForm, name: e.target.value })}
                                        placeholder="例: スパムアカウント"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>ユーザー名（@なし、大文字小文字は無視）</label>

                                    <input
                                        type="text"
                                        value={filterForm.screenName}
                                        onChange={(e) => setFilterForm({ ...filterForm, screenName: e.target.value })}
                                        placeholder="例: spam_user"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>本文テキスト（正規表現）</label>
                                    <input
                                        type="text"
                                        value={filterForm.textPattern}
                                        onChange={(e) => setFilterForm({ ...filterForm, textPattern: e.target.value })}
                                        placeholder="例: (広告|宣伝)"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>リツイート</label>
                                    <select
                                        value={filterForm.isRetweet === undefined ? "" : filterForm.isRetweet ? "true" : "false"}
                                        onChange={(e) =>
                                            setFilterForm({
                                                ...filterForm,
                                                isRetweet: e.target.value === "" ? undefined : e.target.value === "true",
                                            })
                                        }
                                    >
                                        <option value="">すべて</option>
                                        <option value="true">RTのみ</option>
                                        <option value="false">RT以外のみ</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>メディア</label>
                                    <select
                                        value={filterForm.hasMedia === undefined ? "" : filterForm.hasMedia ? "true" : "false"}
                                        onChange={(e) =>
                                            setFilterForm({
                                                ...filterForm,
                                                hasMedia: e.target.value === "" ? undefined : e.target.value === "true",
                                            })
                                        }
                                    >
                                        <option value="">すべて</option>
                                        <option value="true">メディア付きのみ</option>
                                        <option value="false">メディアなしのみ</option>
                                    </select>
                                </div>

                                <div className="form-actions">
                                    <button className="btn-secondary" onClick={handleCancelFilterForm}>
                                        キャンセル
                                    </button>
                                    <button className="btn-primary" onClick={handleSaveFilter}>
                                        保存
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </section>

                <section className="settings-section">
                    <h3>設定管理</h3>
                    <div style={{ position: "relative" }}>
                        <button className="btn-secondary" onClick={() => setShowSettingsMenu(!showSettingsMenu)}>
                            選択してください ▼
                        </button>
                        {showSettingsMenu && (
                            <>
                                <div
                                    style={{
                                        position: "fixed",
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        zIndex: 999,
                                    }}
                                    onClick={() => setShowSettingsMenu(false)}
                                />
                                <div className="settings-dropdown-menu">
                                    <button
                                        className="settings-menu-item"
                                        onClick={() => {
                                            handleExport();
                                            setShowSettingsMenu(false);
                                        }}
                                    >
                                        <span>📤</span>
                                        <span>エクスポート</span>
                                    </button>
                                    <button
                                        className="settings-menu-item"
                                        onClick={() => {
                                            handleImport();
                                            setShowSettingsMenu(false);
                                        }}
                                    >
                                        <span>📥</span>
                                        <span>インポート</span>
                                    </button>
                                    <button
                                        className="settings-menu-item settings-menu-item-danger"
                                        onClick={() => {
                                            handleClearSettings();
                                            setShowSettingsMenu(false);
                                        }}
                                    >
                                        <span>🗑️</span>
                                        <span>設定リセット</span>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                    {/* 非表示のファイル入力 */}
                    <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileChange} style={{ display: "none" }} />
                    <p className="help-text">エクスポート：設定をJSONファイルとして保存</p>
                    <p className="help-text">インポート：JSONファイルから設定を復元</p>
                    <p className="help-text warning-text">設定リセット：⚠️TwitamaModokiのすべての設定を削除</p>
                </section>

                {/* レート制限情報 */}
                <section className="settings-section">
                    <h3>レート制限状況（参考情報）</h3>
                    <p className="help-text">
                        X APIのaccountSettingsとbadgeCount、tweetPostのレート制限状況です。通常、これらのAPI制限は閲覧に影響ありません。
                    </p>
                    <div style={{ marginTop: "10px" }}>
                        <RateLimitPanel currentUrl="https://x.com/home" includeCategories={["accountSettings", "badgeCount", "tweetPost"]} vertical={true} />
                    </div>
                </section>

                {/* バージョン情報 */}
                <section className="settings-section">
                    <h3>バージョン情報</h3>
                    <div className="version-info">
                        <span className="version-text">TwitamaModoki {version}</span>
                    </div>
                </section>
            </div>
        </div>
    );
}

// ソート可能なカラムアイテムコンポーネント
interface SortableColumnItemProps {
    column: Column;
    isEditing: boolean;
    editingTitle: string;
    onStartEdit: (column: Column) => void;
    onFinishEdit: () => void;
    onCancelEdit: () => void;
    onEditingTitleChange: (title: string) => void;
    onRemove: (columnId: string) => void;
    onTouchStart: (column: Column) => void;
    onTouchMove: () => void;
    onTouchEnd: () => void;
}

function SortableColumnItem({
    column,
    isEditing,
    editingTitle,
    onStartEdit,
    onFinishEdit,
    onCancelEdit,
    onEditingTitleChange,
    onRemove,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
}: SortableColumnItemProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: column.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className="column-item swiper-no-swiping" data-id={column.id}>
            <div className="column-drag-handle" {...attributes} {...listeners} data-handle>≡</div>
            {isEditing ? (
                <input
                    type="text"
                    className="column-title-input"
                    value={editingTitle}
                    onChange={(e) => onEditingTitleChange(e.target.value)}
                    onBlur={onFinishEdit}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            onFinishEdit();
                        } else if (e.key === "Escape") {
                            onCancelEdit();
                        }
                    }}
                    autoFocus
                />
            ) : (
                <span
                    className="column-title"
                    onDoubleClick={() => onStartEdit(column)}
                    onTouchStart={() => onTouchStart(column)}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                    onTouchCancel={onTouchEnd}
                    title="長押しで編集"
                >
                    {column.title}
                </span>
            )}
            <button className="btn-icon btn-delete-column" onClick={() => onRemove(column.id)} title="削除">
                ×
            </button>
        </div>
    );
}
