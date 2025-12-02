/**
 * iframeのURL変更を監視して自動保存するカスタムフック
 */

import { useEffect, RefObject, useRef } from "react";
import { shouldRecordUrl, getTitleFromUrl } from "@/types";
import { LIST_NAME_CONFIG, COMMUNITY_NAME_CONFIG, USER_PROFILE_NAME_CONFIG } from "@/config/xSelectors";
import { useAppStore } from "@/store";
import { logger } from "@/utils/logger";

interface UseIframeUrlSyncOptions {
    /**
     * URL変更時のコールバック
     */
    onUrlChange: (url: string, title: string) => void;

    /**
     * カラムID（保存済みタイトルの取得に使用）
     */
    columnId?: string;
}

/**
 * iframeのURL変更を監視して自動保存する
 *
 * - ホワイトリスト方式：特定のパスのみ記録
 * - URLが変更されたら自動的にタイトルも更新
 *
 * @param iframeRef - iframeへのRef
 * @param options - オプション
 */
export function useIframeUrlSync(iframeRef: RefObject<HTMLIFrameElement | null>, options: UseIframeUrlSyncOptions) {
    const { onUrlChange, columnId } = options;
    const { columns } = useAppStore(); // カラム情報を取得
    const lastUrlRef = useRef<string>("");
    const lastRecordedUrlRef = useRef<string>("");
    const resolvedNamesRef = useRef<Map<string, string>>(new Map()); // URL → 取得済みの名前

    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) return;

        const checkUrl = () => {
            try {
                const currentUrl = iframe.contentWindow?.location.href;

                if (!currentUrl || currentUrl === lastUrlRef.current) {
                    return; // 変更なし
                }

                lastUrlRef.current = currentUrl;
                logger.log("🔄 TwitamaModoki: URL変更検知:", currentUrl);

                // 記録すべきURLかチェック（ホワイトリスト）
                if (shouldRecordUrl(currentUrl)) {
                    // ホワイトリストに含まれる → 記録する
                    if (currentUrl !== lastRecordedUrlRef.current) {
                        lastRecordedUrlRef.current = currentUrl;

                        // タイトル取得（リスト画面・コミュニティ画面の場合はDOM解析で名前を取得）
                        const title = getTitleFromUrl(currentUrl);

                        // リスト画面の場合、DOMからリスト名を取得を試みる
                        if (currentUrl.includes("/i/lists/")) {
                            // 1. メモリキャッシュをチェック
                            const cachedName = resolvedNamesRef.current.get(currentUrl);
                            if (cachedName) {
                                logger.log(`📋 TwitamaModoki: メモリキャッシュからリスト名を使用:`, cachedName);
                                onUrlChange(currentUrl, cachedName);
                                return;
                            }

                            // 2. storageに保存されているタイトルをチェック
                            if (columnId) {
                                const currentColumn = columns.find((c) => c.id === columnId);
                                if (currentColumn && currentColumn.title !== "リスト" && currentColumn.currentUrl === currentUrl) {
                                    logger.log(`📋 TwitamaModoki: storageからリスト名を使用:`, currentColumn.title);
                                    resolvedNamesRef.current.set(currentUrl, currentColumn.title); // メモリキャッシュにも保存
                                    onUrlChange(currentUrl, currentColumn.title);
                                    return;
                                }
                            }

                            const iframeDoc = iframe.contentWindow?.document;
                            if (iframeDoc) {
                                // リトライロジック付きでリスト名を取得
                                const tryGetListName = (attempt: number = 1, maxAttempts: number = 5) => {
                                    const listName = LIST_NAME_CONFIG.getListName(iframeDoc);

                                    if (listName) {
                                        logger.log(`📋 TwitamaModoki: リスト名取得成功 (試行${attempt}/${maxAttempts}):`, listName);
                                        resolvedNamesRef.current.set(currentUrl, listName); // キャッシュに保存
                                        onUrlChange(currentUrl, listName);
                                    } else if (attempt < maxAttempts) {
                                        // まだ取得できない場合はリトライ
                                        const delay = attempt * 300; // 300ms, 600ms, 900ms, 1200ms
                                        logger.log(`⏳ TwitamaModoki: リスト名取得リトライ (試行${attempt + 1}/${maxAttempts}) - ${delay}ms後`);
                                        setTimeout(() => tryGetListName(attempt + 1, maxAttempts), delay);
                                    } else {
                                        // 最終的に取得できなかった場合はURLベースのタイトルを使用
                                        logger.log("⚠️ TwitamaModoki: リスト名取得失敗、デフォルトタイトルを使用:", title);
                                        onUrlChange(currentUrl, title);
                                    }
                                };

                                // 初回は500ms待ってから試行
                                setTimeout(() => tryGetListName(), 500);
                                return; // 非同期処理のためここでreturn
                            }
                        }

                        // コミュニティ画面の場合、DOMからコミュニティ名を取得を試みる
                        if (currentUrl.includes("/i/communities/")) {
                            // 1. メモリキャッシュをチェック
                            const cachedName = resolvedNamesRef.current.get(currentUrl);
                            if (cachedName) {
                                logger.log(`🏘️ TwitamaModoki: メモリキャッシュからコミュニティ名を使用:`, cachedName);
                                onUrlChange(currentUrl, cachedName);
                                return;
                            }

                            // 2. storageに保存されているタイトルをチェック
                            if (columnId) {
                                const currentColumn = columns.find((c) => c.id === columnId);
                                if (currentColumn && currentColumn.title !== "コミュニティ" && currentColumn.currentUrl === currentUrl) {
                                    logger.log(`🏘️ TwitamaModoki: storageからコミュニティ名を使用:`, currentColumn.title);
                                    resolvedNamesRef.current.set(currentUrl, currentColumn.title); // メモリキャッシュにも保存
                                    onUrlChange(currentUrl, currentColumn.title);
                                    return;
                                }
                            }

                            const iframeDoc = iframe.contentWindow?.document;
                            if (iframeDoc) {
                                // リトライロジック付きでコミュニティ名を取得
                                const tryGetCommunityName = (attempt: number = 1, maxAttempts: number = 5) => {
                                    const communityName = COMMUNITY_NAME_CONFIG.getCommunityName(iframeDoc);

                                    if (communityName) {
                                        logger.log(`🏘️ TwitamaModoki: コミュニティ名取得成功 (試行${attempt}/${maxAttempts}):`, communityName);
                                        resolvedNamesRef.current.set(currentUrl, communityName); // キャッシュに保存
                                        onUrlChange(currentUrl, communityName);
                                    } else if (attempt < maxAttempts) {
                                        // まだ取得できない場合はリトライ
                                        const delay = attempt * 300; // 300ms, 600ms, 900ms, 1200ms
                                        logger.log(`⏳ TwitamaModoki: コミュニティ名取得リトライ (試行${attempt + 1}/${maxAttempts}) - ${delay}ms後`);
                                        setTimeout(() => tryGetCommunityName(attempt + 1, maxAttempts), delay);
                                    } else {
                                        // 最終的に取得できなかった場合はURLベースのタイトルを使用
                                        logger.log("⚠️ TwitamaModoki: コミュニティ名取得失敗、デフォルトタイトルを使用:", title);
                                        onUrlChange(currentUrl, title);
                                    }
                                };

                                // 初回は500ms待ってから試行
                                setTimeout(() => tryGetCommunityName(), 500);
                                return; // 非同期処理のためここでreturn
                            }
                        }

                        // ユーザープロフィール画面の場合、DOMからユーザー名を取得を試みる
                        if (/^https:\/\/x\.com\/[a-zA-Z0-9_]{1,15}$/.test(currentUrl)) {
                            // 1. メモリキャッシュをチェック
                            const cachedName = resolvedNamesRef.current.get(currentUrl);
                            if (cachedName) {
                                logger.log(`👤 TwitamaModoki: メモリキャッシュからユーザー名を使用:`, cachedName);
                                onUrlChange(currentUrl, cachedName);
                                return;
                            }

                            // 2. storageに保存されているタイトルをチェック
                            if (columnId) {
                                const currentColumn = columns.find((c) => c.id === columnId);
                                if (currentColumn && currentColumn.title !== "ユーザープロフィール" && currentColumn.currentUrl === currentUrl) {
                                    logger.log(`👤 TwitamaModoki: storageからユーザー名を使用:`, currentColumn.title);
                                    resolvedNamesRef.current.set(currentUrl, currentColumn.title); // メモリキャッシュにも保存
                                    onUrlChange(currentUrl, currentColumn.title);
                                    return;
                                }
                            }

                            const iframeDoc = iframe.contentWindow?.document;
                            if (iframeDoc) {
                                // リトライロジック付きでユーザー名を取得
                                const tryGetUserName = (attempt: number = 1, maxAttempts: number = 5) => {
                                    const userName = USER_PROFILE_NAME_CONFIG.getUserName(iframeDoc);

                                    if (userName) {
                                        logger.log(`👤 TwitamaModoki: ユーザー名取得成功 (試行${attempt}/${maxAttempts}):`, userName);
                                        resolvedNamesRef.current.set(currentUrl, userName); // キャッシュに保存
                                        onUrlChange(currentUrl, userName);
                                    } else if (attempt < maxAttempts) {
                                        // まだ取得できない場合はリトライ
                                        const delay = attempt * 300; // 300ms, 600ms, 900ms, 1200ms
                                        logger.log(`⏳ TwitamaModoki: ユーザー名取得リトライ (試行${attempt + 1}/${maxAttempts}) - ${delay}ms後`);
                                        setTimeout(() => tryGetUserName(attempt + 1, maxAttempts), delay);
                                    } else {
                                        // 最終的に取得できなかった場合はURLベースのタイトルを使用
                                        logger.log("⚠️ TwitamaModoki: ユーザー名取得失敗、デフォルトタイトルを使用:", title);
                                        onUrlChange(currentUrl, title);
                                    }
                                };

                                // 初回は500ms待ってから試行
                                setTimeout(() => tryGetUserName(), 500);
                                return; // 非同期処理のためここでreturn
                            }
                        }

                        logger.log("💾 TwitamaModoki: URL記録:", currentUrl, "タイトル:", title);
                        onUrlChange(currentUrl, title);
                    }
                } else {
                    logger.log("⏭️  TwitamaModoki: URL記録スキップ（ホワイトリスト外）:", currentUrl);
                }
            } catch (error) {
                // クロスオリジンエラーは無視（発生しないはずだが念のため）
                // console.warn("TwitamaModoki: iframe URL アクセスエラー:", error);
            }
        };

        // iframe読み込み完了時にチェック
        const handleLoad = () => {
            setTimeout(checkUrl, 100); // 少し待ってからチェック

            // iframe内のイベントリスナーを設定
            try {
                const iframeWindow = iframe.contentWindow;
                if (iframeWindow) {
                    // popstateイベント: ブラウザの戻る/進むボタンやhistory.pushState/replaceStateで発火
                    iframeWindow.addEventListener("popstate", checkUrl);
                    // hashchangeイベント: URLのハッシュ部分が変更されたときに発火
                    iframeWindow.addEventListener("hashchange", checkUrl);
                }
            } catch (error) {
                // クロスオリジンエラーは無視
                logger.warn("TwitamaModoki: iframe内イベントリスナー設定エラー:", error);
            }
        };

        iframe.addEventListener("load", handleLoad);

        // SPAの内部遷移を検知するため、定期的にURLをチェック
        // イベントベースの検知と併用することで、確実に変更を捕捉
        const pollInterval = setInterval(checkUrl, 1000); // 1秒ごとにチェック

        return () => {
            iframe.removeEventListener("load", handleLoad);
            clearInterval(pollInterval);

            // iframe内のイベントリスナーをクリーンアップ
            try {
                const iframeWindow = iframe.contentWindow;
                if (iframeWindow) {
                    iframeWindow.removeEventListener("popstate", checkUrl);
                    iframeWindow.removeEventListener("hashchange", checkUrl);
                }
            } catch (error) {
                // クロスオリジンエラーは無視
            }
        };
    }, [iframeRef, onUrlChange, columnId, columns]);
}
