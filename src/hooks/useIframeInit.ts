/**
 * iframe初期化のカスタムフック
 * Open-Deck の仕組みを参考に実装
 */

import { useEffect, RefObject, useCallback } from "react";
import Hammer from "hammerjs";
import {
    TOP_BANNER_SELECTOR,
    BOTTOM_BANNER_SELECTOR,
    LIST_HEADER_SELECTOR,
    BANNER_HEADER_SELECTOR,
    IMAGE_MODAL_SELECTOR,
    TEXT_SELECTORS,
} from "@/config/xSelectors";
import { useAppStore } from "@/store";
import { FilterRule } from "@/types";
import { isListColumn, isHomeColumn, isUserProfileColumn } from "@/utils/columnType";
import { logger } from "@/utils/logger";

interface IframeInitOptions {
    /**
     * 広告を非表示にするか
     */
    hideAds?: boolean;

    /**
     * 追加のカスタムCSS
     */
    customCss?: string;
}

/**
 * iframeの初期化処理を行うカスタムフック
 *
 * @param iframeRef - iframeへのRef
 * @param options - 初期化オプション
 */
export function useIframeInit(iframeRef: RefObject<HTMLIFrameElement | null>, options: IframeInitOptions = {}) {
    const { customCss = "" } = options;
    const { display } = useAppStore();

    // スタイルを適用する関数（useCallbackでメモ化）
    const applyStyles = useCallback(
        (iframeDoc: Document, currentUrl: string) => {
            // 既存のTwitamaModokiスタイルを削除（再読み込み対応）
            const existingStyles = iframeDoc.querySelectorAll("style[data-twitama-modoki]");
            existingStyles.forEach((style) => style.remove());

            // カスタムCSSを注入
            const style = iframeDoc.createElement("style");
            style.setAttribute("data-twitama-modoki", "true");

            logger.log("🔤 TwitamaModoki: フォントサイズを適用:", display.fontSize + "%");

            let css = `
          /* フォントサイズのベース設定 */
          html {
            scrollbar-width: thin;
          }
          
          body {
            user-select: text !important;
            -webkit-user-select: text !important;
            touch-action: auto !important;
          }
          
          /* テキスト要素のフォントサイズとline-heightを変更 */
          ${TEXT_SELECTORS.map((selector) => `${selector}`).join(",\n          ")} {
            font-size: ${display.fontSize}% !important;
            line-height: 1.3 !important;
          }
        `;

            // 広告非表示
            if (display.hideAds) {
                css += `
          /* プロモーション（広告）を非表示 */
          div[data-testid="cellInnerDiv"]:has([data-testid="placementTracking"]):not(:has([data-testid="tweet"])) {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
          }
          `;
            }

            // おすすめユーザー非表示（JavaScriptで動的に処理）

            // 認証アップセル非表示
            if (display.hideVerificationUpsell) {
                css += `
          /* 認証アップセルを非表示 */
          div[data-testid="verified_profile_visitor_upsell"] {
            display: none !important;
          }
          `;
            }

            // 認証済みアカウントのポスト非表示（ポスト詳細画面のみ）
            // body.twitama-post-detail クラスは MutationObserver で動的に付与される
            if (display.hideVerifiedPosts) {
                css += `
          /* ポスト詳細画面でのみ認証済みアカウントのポストを非表示 */
          body.twitama-post-detail article[data-testid="tweet"][tabindex="0"]:has(div[data-testid="User-Name"] svg[data-testid="icon-verified"]) {
            display: none !important;
          }
          `;
            }

            // 【Listカラム専用】バナーとヘッダーを非表示
            if (display.hideListHeaders && isListColumn(currentUrl)) {
                css += `
          /* 上部バナーを非表示（Listカラム） */
          ${TOP_BANNER_SELECTOR} {
            display: none !important;
          }
          
          /* リスト画面特有のヘッダーを非表示 */
          ${LIST_HEADER_SELECTOR} {
            display: none !important;
          }
          
          /* バナーヘッダーを非表示 */
          ${BANNER_HEADER_SELECTOR} {
            display: none !important;
          }
          `;
                logger.log("🚫 TwitamaModoki: バナーとヘッダーを非表示（Listカラム）");
            }

            // 【下部バナー非表示】設定に基づいて制御
            const shouldHideBottomBanner = display.bottomBannerMode === "never" || (display.bottomBannerMode === "home-only" && !isHomeColumn(currentUrl));

            if (shouldHideBottomBanner) {
                css += `
          /* 下部バナーを非表示 */
          ${BOTTOM_BANNER_SELECTOR} {
            display: none !important;
          }
          `;
                logger.log("🚫 TwitamaModoki: 下部バナーを非表示");
            } else {
                logger.log("✅ TwitamaModoki: 下部バナーを表示");
            }

            // 三点リーダー非表示
            if (display.hidePostMenuButton) {
                css += `
          /* 三点リーダーを非表示 */
          article button[data-testid="caret"] {
            display: none !important;
          }
          `;
            }

            css += `
          
          /* ポストヘッダーのカスタマイズ */
          
          /* User-Nameの親要素の幅を100%に */
          article div[data-testid="User-Name"] {
            width: 100% !important;
            max-width: 100% !important;
          }
          
          /* User-Nameの祖先要素も幅100%に */
          article div:has(> div > div[data-testid="User-Name"]), article div:has(> div[data-testid="User-Name"]) {
            width: 100% !important;
            max-width: 100% !important;
            flex: 1 !important;
          }
          
          /* User-Name全体を縦2行レイアウトに */
          div[data-testid="User-Name"] {
            display: flex !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 2px !important;
            margin-bottom: 4px !important;
          }
          
          /* 1行目：ユーザー名、バッジ、相対時刻を横並び */
          div[data-testid="User-Name"] > div:first-child {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            gap: 4px !important;
            margin-bottom: -0.2em !important;
            width: 100% !important;
          }
          
          /* 1行目の相対時刻（オリジナル）を右寄せ */
          div[data-testid="User-Name"] > div:first-child a[href*="/status/"] {
            margin-left: auto !important;
            flex: 0 0 auto !important;
          }
          
          /* 2行目：screenNameと絶対時刻を横並び */
          div[data-testid="User-Name"] > div:nth-child(2) > div:first-child {
            display: flex !important;
            flex-grow: 1 !important;
            align-items: center !important;
            width: 100% !important;
            gap: 6px !important;
          }
          
          /* 中黒（·）を非表示 */
          div[data-testid="User-Name"] > div:nth-child(2) > div:first-child > div[aria-hidden="true"] {
            display: none !important;
          }
          
          /* 2行目の元の日時要素（a要素を含むdiv）を非表示 */
          div[data-testid="User-Name"] > div:nth-child(2) > div:first-child > div:has(a[href*="/status/"]) {
            display: none !important;
          }
          
          /* screenName（左寄せ） */
          div[data-testid="User-Name"] > div:nth-child(2) > div:first-child > div:first-child {
            flex: 1 1 auto !important;
            min-width: 0 !important;
            text-align: left !important;
          }
          
          /* 絶対時刻（右寄せ） */
          .twitama-modoki-absolute-time {
            flex: 0 0 auto !important;
            margin-left: auto !important;
            text-align: right !important;
            color: rgb(113, 118, 123) !important;
            font-size: inherit !important;
          }
        `;
            logger.log("✨ TwitamaModoki: ポストヘッダーをカスタマイズ");

            if (customCss) {
                css += `\n${customCss}`;
            }

            style.textContent = css;
            iframeDoc.head.appendChild(style);

            logger.log("✅ TwitamaModoki: カスタムCSS注入完了");
        },
        [
            display.fontSize,
            display.hideAds,
            display.hideListHeaders,
            display.hidePostMenuButton,
            display.hideVerificationUpsell,
            display.hideVerifiedPosts,
            display.bottomBannerMode,
            customCss,
        ]
    );

    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) return;

        let cleanupAbsoluteTime: (() => void) | null = null;

        const handleLoad = () => {
            logger.log("TwitamaModoki: iframe 読み込み完了");

            try {
                // iframe内のdocumentにアクセス
                const iframeDoc = iframe.contentWindow?.document;
                if (!iframeDoc) {
                    logger.warn("TwitamaModoki: iframe document にアクセスできません");
                    return;
                }

                const currentUrl = iframeDoc.location.href;
                applyStyles(iframeDoc, currentUrl);

                cleanupAbsoluteTime?.();
                const absoluteTimeFormatter = new AbsoluteTimeFormatter(iframeDoc);
                cleanupAbsoluteTime = absoluteTimeFormatter.start();

                // フィルタリング処理を開始
                const { filters, display: currentDisplay } = useAppStore.getState();
                applyFilters(iframeDoc, filters);

                // おすすめユーザー非表示（ユーザーカラムのみ）
                if (currentDisplay.hideRecommendedUsers && isUserProfileColumn(currentUrl)) {
                    hideRecommendedUsersSection(iframeDoc);
                }

                // HammerJSを使ったスワイプ検出
                const hammer = new Hammer(iframeDoc.body, {
                    touchAction: "pan-y", // 縦スクロールのみ許可、横スワイプは制御
                    inputClass: Hammer.TouchInput, // タッチ入力のみ
                });

                // 横スワイプと縦スワイプを認識（閾値を調整）
                hammer.get("swipe").set({
                    direction: Hammer.DIRECTION_ALL,
                    threshold: 10, // スワイプと認識する最小距離（px）
                    velocity: 0.3, // スワイプと認識する最小速度
                });

                // デバッグ用：すべてのイベントをログ
                hammer.on("swipe", (e) => {
                    logger.log("🔍 TwitamaModoki: Hammerイベント発火", e.type);
                });

                // スワイプイベント
                hammer.on("swipeleft swiperight swipedown", (e) => {
                    // 画像モーダルが表示されているかチェック
                    const modalElement = iframeDoc.querySelector(IMAGE_MODAL_SELECTOR);
                    const isImageModalOpen = modalElement !== null;

                    logger.log("🔍 TwitamaModoki: HammerJSスワイプ検出", {
                        type: e.type,
                        isImageModalOpen,
                        modalElement: modalElement ? "存在" : "なし",
                    });

                    if (isImageModalOpen) {
                        // 画像モーダル表示時の処理
                        logger.log("🖼️ TwitamaModoki: 画像モーダル表示中");

                        // 下スワイプでモーダルを閉じる
                        // ※ X.comのネイティブ swipe-to-dismiss が既にhistory.back()を行うため、
                        //    ここで追加呼び出しすると二重にback()されリロードが発生する
                        // if (e.type === "swipedown") {
                        //     logger.log("⬇️ TwitamaModoki: 下スワイプ検出 - モーダルを閉じます");
                        //     iframe.contentWindow?.history.back();
                        // }
                        // 画像モーダル表示時は横スワイプをiframe内で処理（カラム切り替えしない）
                        // → 何もしない（イベントを親に送信しない）
                        return;
                    } else {
                        // 通常時の横スワイプ処理（カラム切り替え）
                        if (e.type === "swipeleft" || e.type === "swiperight") {
                            const direction = e.type === "swipeleft" ? "left" : "right";
                            const event = new CustomEvent("twitama-modoki-swipe", { detail: { direction } });
                            window.dispatchEvent(event);
                            logger.log("👆 TwitamaModoki: スワイプ検出 (" + direction + ")");
                        }
                    }
                });
            } catch (error) {
                logger.error("TwitamaModoki: iframe初期化エラー:", error);
            }
        };

        iframe.addEventListener("load", handleLoad);

        return () => {
            iframe.removeEventListener("load", handleLoad);
            cleanupAbsoluteTime?.();
        };
    }, [iframeRef, applyStyles]);

    // フォントサイズが変更されたときに、既存のiframe内のスタイルを更新
    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) return;

        try {
            const iframeDoc = iframe.contentWindow?.document;
            if (!iframeDoc) return;

            const currentUrl = iframeDoc.location.href;
            logger.log("🔄 TwitamaModoki: フォントサイズ変更を検出 →", display.fontSize + "%");
            applyStyles(iframeDoc, currentUrl);
        } catch (error) {
            // iframe がまだロードされていない場合などはエラーになるが、load イベントで処理されるので問題ない
            logger.log("⏳ TwitamaModoki: iframe 未ロード（load イベントで処理されます）");
        }
    }, [iframeRef, display.fontSize, applyStyles]);

    // 【ポスト詳細画面検出】MutationObserverで <h2 role="heading"> 内の <span>ポスト</span> を監視し、
    // body に twitama-post-detail クラスを動的に付与/除去する
    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) return;

        let observer: MutationObserver | null = null;

        const handleLoad = () => {
            try {
                const iframeDoc = iframe.contentWindow?.document;
                if (!iframeDoc) return;

                const updatePostDetailClass = () => {
                    // <h2 role="heading"> の子孫 <span> に「ポスト」というテキストがあるかチェック
                    const headings = iframeDoc.querySelectorAll('h2[role="heading"]');
                    let isPostDetail = false;
                    for (const heading of headings) {
                        const spans = heading.querySelectorAll("span");
                        for (const span of spans) {
                            if (span.textContent?.trim() === "ポスト") {
                                isPostDetail = true;
                                break;
                            }
                        }
                        if (isPostDetail) break;
                    }

                    const body = iframeDoc.body;
                    if (!body) return;

                    if (isPostDetail && !body.classList.contains("twitama-post-detail")) {
                        body.classList.add("twitama-post-detail");
                        logger.log("📌 TwitamaModoki: ポスト詳細画面を検出 → twitama-post-detail クラス付与");
                    } else if (!isPostDetail && body.classList.contains("twitama-post-detail")) {
                        body.classList.remove("twitama-post-detail");
                        logger.log("📌 TwitamaModoki: ポスト詳細画面を離脱 → twitama-post-detail クラス除去");
                    }
                };

                // 初期状態を反映
                updatePostDetailClass();

                // 既存のオブザーバーがあれば停止
                if (observer) {
                    observer.disconnect();
                }

                // DOM変化を監視してポスト詳細画面かどうかを検出
                observer = new MutationObserver(() => {
                    updatePostDetailClass();
                });

                if (iframeDoc.body) {
                    observer.observe(iframeDoc.body, {
                        childList: true,
                        subtree: true,
                    });
                }
            } catch (error) {
                logger.error("TwitamaModoki: ポスト詳細画面検出エラー:", error);
            }
        };

        iframe.addEventListener("load", handleLoad);

        return () => {
            iframe.removeEventListener("load", handleLoad);
            if (observer) {
                observer.disconnect();
            }
        };
    }, [iframeRef]);
}

class AbsoluteTimeFormatter {
    private observer: MutationObserver | null = null;
    private readonly processedAttr = "data-twitama-modoki-abs";
    private readonly tweetTimeSelector = 'a[href*="/status/"] time';

    constructor(private doc: Document) {}

    public start(): () => void {
        this.updateTweetTimestamps();

        if (this.doc.body) {
            this.observer = new MutationObserver(() => {
                this.updateTweetTimestamps();
            });
            this.observer.observe(this.doc.body, {
                childList: true,
                subtree: true,
            });
        }

        const cleanup = () => {
            this.observer?.disconnect();
            this.observer = null;
        };

        const visibilityHandler = () => {
            if (!this.doc.hidden) {
                this.updateTweetTimestamps();
            }
        };
        this.doc.addEventListener("visibilitychange", visibilityHandler);

        return () => {
            cleanup();
            this.doc.removeEventListener("visibilitychange", visibilityHandler);
        };
    }

    private updateTweetTimestamps() {
        const timeElements = this.doc.querySelectorAll<HTMLTimeElement>(`${this.tweetTimeSelector}:not([${this.processedAttr}="1"])`);

        timeElements.forEach((timeElement) => {
            const date = this.getDateFromElement(timeElement);
            if (!date) {
                return;
            }

            // 元の相対時刻を保存
            const originalText = timeElement.textContent || "";
            timeElement.setAttribute("data-original-time", originalText);

            const formatted = this.formatTime(date);

            // time要素の親のUser-Name要素を取得
            const userNameDiv = timeElement.closest('div[data-testid="User-Name"]');
            if (!userNameDiv) {
                return;
            }

            // 相対時刻のリンク要素（time要素の親のa要素）を取得
            const timeLink = timeElement.closest<HTMLAnchorElement>('a[href*="/status/"]');
            if (timeLink) {
                // 1行目に相対時刻のリンクを移動
                const firstRow = userNameDiv.querySelector(":scope > div:first-child");
                if (firstRow && !firstRow.querySelector('a[href*="/status/"]')) {
                    // リンクをクローンして1行目に追加
                    const clonedLink = timeLink.cloneNode(true) as HTMLAnchorElement;
                    firstRow.appendChild(clonedLink);
                }
            }

            // 絶対時刻を新しいspan要素として追加
            const absoluteTimeSpan = this.doc.createElement("span");
            absoluteTimeSpan.className = "twitama-modoki-absolute-time";
            absoluteTimeSpan.textContent = formatted;
            absoluteTimeSpan.setAttribute("aria-label", formatted);

            // 2行目に絶対時刻を追加
            const secondRow = userNameDiv.querySelector(":scope > div:nth-child(2) > div:first-child");
            if (secondRow && !secondRow.querySelector(".twitama-modoki-absolute-time")) {
                secondRow.appendChild(absoluteTimeSpan);
            }

            timeElement.setAttribute(this.processedAttr, "1");

            const parentLink = timeElement.closest<HTMLAnchorElement>('a[href*="/status/"]');
            parentLink?.setAttribute("title", formatted);
        });
    }

    private getDateFromElement(timeElement: HTMLTimeElement): Date | null {
        const datetimeAttr = timeElement.getAttribute("datetime") || timeElement.dateTime;
        if (datetimeAttr) {
            const date = new Date(datetimeAttr);
            if (!Number.isNaN(date.getTime())) {
                return date;
            }
        }

        const tweetLink = timeElement.closest<HTMLAnchorElement>('a[href*="/status/"]');
        const tweetId = tweetLink
            ?.getAttribute("href")
            ?.split("/")
            .find((segment) => /^\d+$/.test(segment));

        if (tweetId) {
            return this.getDateFromSnowflake(Number(tweetId));
        }

        const relativeText = timeElement.textContent?.trim();
        if (relativeText) {
            const parsedDate = new Date(relativeText);
            if (!Number.isNaN(parsedDate.getTime())) {
                return parsedDate;
            }
        }

        return null;
    }

    private getDateFromSnowflake(id: number): Date {
        const epochMilliseconds = Math.floor(id / 4194304) + 1288834974657;
        return new Date(epochMilliseconds);
    }

    private formatTime(date: Date): string {
        const pad = (value: number) => value.toString().padStart(2, "0");
        const dayOfWeekSymbols = ["日", "月", "火", "水", "木", "金", "土"];
        const dayOfWeek = dayOfWeekSymbols[date.getDay()];

        const now = new Date();
        const includeYear = now.getFullYear() !== date.getFullYear();
        const yearPart = includeYear ? `${date.getFullYear()}/` : "";
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const hours = date.getHours();
        const minutes = pad(date.getMinutes());

        return `${yearPart}${month}/${day}(${dayOfWeek}) ${hours}:${minutes}`;
    }
}

/**
 * フィルタリング処理を適用
 */
function applyFilters(doc: Document, filters: FilterRule[]) {
    const processedAttr = "data-twitama-modoki-filtered";

    // 有効なフィルタのみ取得
    const activeFilters = filters.filter((f) => f.enabled);

    if (activeFilters.length === 0) {
        return; // フィルタがない場合は何もしない
    }

    const filterPosts = () => {
        // すべてのarticle要素（ポスト）を取得
        const posts = doc.querySelectorAll<HTMLElement>('article[data-testid="tweet"]');

        posts.forEach((post) => {
            // 既に処理済みの場合はスキップ
            if (post.getAttribute(processedAttr) === "1") {
                return;
            }

            // フィルタにマッチするかチェック
            let matchedFilter: FilterRule | undefined;
            const shouldHide = activeFilters.some((filter) => {
                if (matchesFilter(post, filter)) {
                    matchedFilter = filter;
                    return true;
                }
                return false;
            });

            if (shouldHide && matchedFilter) {
                post.style.display = "none";
                logger.log("🚫 TwitamaModoki: ポストをフィルタリング:", matchedFilter.name);
            }

            // 処理済みマークを付ける
            post.setAttribute(processedAttr, "1");
        });
    };

    // 初回実行
    filterPosts();

    // MutationObserverで動的に追加されるポストも監視
    const observer = new MutationObserver(() => {
        filterPosts();
    });

    observer.observe(doc.body, {
        childList: true,
        subtree: true,
    });
}

/**
 * 「おすすめユーザー」セクションを非表示にする
 */
function hideRecommendedUsersSection(doc: Document) {
    const processedAttr = "data-twitama-modoki-recommended-checked";

    const hideCells = () => {
        // 未チェックのセルのみを取得（属性が存在しないもの）
        const cells = doc.querySelectorAll<HTMLElement>(`div[data-testid="cellInnerDiv"]:not([${processedAttr}])`);

        logger.log(`🔍 TwitamaModoki: おすすめユーザー検索中 (未チェックセル数: ${cells.length})`);

        let startCell: HTMLElement | null = null;
        let endCell: HTMLElement | null = null;

        cells.forEach((cell) => {
            const textContent = cell.textContent || "";

            // 開始セル: 「おすすめユーザー」を含む
            if (textContent.includes("おすすめユーザー")) {
                logger.log("✅ TwitamaModoki: 「おすすめユーザー」開始セル発見");
                startCell = cell;
                cell.setAttribute(processedAttr, "hidden"); // おすすめユーザーセクション
            }
            // 終了セル: 「さらに表示」リンクを含む
            else if (startCell && cell.querySelector('a[href^="/i/connect_people"]')) {
                const linkText = cell.querySelector('a[href^="/i/connect_people"]')?.textContent || "";
                logger.log(`🔍 TwitamaModoki: connect_peopleリンク発見 (テキスト: "${linkText}")`);
                if (linkText.includes("さらに表示")) {
                    logger.log("✅ TwitamaModoki: 「さらに表示」終了セル発見");
                    endCell = cell;
                    cell.setAttribute(processedAttr, "hidden"); // おすすめユーザーセクション
                }
            }
            // おすすめユーザーでなかったセル
            else {
                cell.setAttribute(processedAttr, "skip"); // 通常のセル
            }
        });

        // 開始から終了までのすべてのセルを非表示
        if (startCell && endCell) {
            let current = startCell as HTMLElement | null;
            let foundEnd = false;

            while (current && !foundEnd) {
                if (current === endCell) {
                    foundEnd = true;
                }

                current.style.display = "none";
                current.setAttribute(processedAttr, "hidden");

                current = current.nextElementSibling as HTMLElement | null;
            }

            logger.log("🚫 TwitamaModoki: おすすめユーザーセクションを非表示");
        }
    };

    hideCells();

    // MutationObserverで動的に追加されるセルも監視
    const observer = new MutationObserver(() => {
        hideCells();
    });

    if (doc.body) {
        observer.observe(doc.body, {
            childList: true,
            subtree: true,
        });
    }
}

/**
 * ポストがフィルタにマッチするかチェック
 */
function matchesFilter(post: HTMLElement, filter: FilterRule): boolean {
    // すべての条件がAND条件

    // ユーザー名チェック
    if (filter.screenName) {
        // RTかどうかを先に判定
        const isRetweet = post.querySelector('[data-testid="socialContext"]') !== null;

        // RTの場合: 最初の a[href^="/"] がRTしたユーザー
        // 通常の場合: div[data-testid="User-Name"] 内の a[href^="/"] がポストしたユーザー
        const userLink = isRetweet
            ? post.querySelector<HTMLAnchorElement>('a[href^="/"]')
            : post.querySelector<HTMLAnchorElement>('div[data-testid="User-Name"] a[href^="/"]');

        if (userLink) {
            const href = userLink.getAttribute("href") || "";
            const screenName = href.replace(/^\//, "").split("/")[0];
            // 大文字小文字を区別しない比較
            if (screenName.toLowerCase() !== filter.screenName.toLowerCase()) {
                return false; // マッチしない
            }
        } else {
            return false; // ユーザー名が見つからない
        }
    }

    // 本文テキストチェック（正規表現）
    if (filter.textPattern) {
        try {
            const regex = new RegExp(filter.textPattern);
            const tweetText = post.querySelector('[data-testid="tweetText"]');
            if (tweetText) {
                const text = tweetText.textContent || "";
                if (!regex.test(text)) {
                    return false; // マッチしない
                }
            } else {
                return false; // 本文が見つからない
            }
        } catch (error) {
            logger.error("🚫 TwitamaModoki: 正規表現エラー:", filter.textPattern, error);
            return false; // 正規表現エラーの場合はマッチしない
        }
    }

    // リツイートチェック
    if (filter.isRetweet !== undefined) {
        const isRetweet = post.querySelector('[data-testid="socialContext"]') !== null;
        if (filter.isRetweet !== isRetweet) {
            return false; // マッチしない
        }
    }

    // メディアチェック
    if (filter.hasMedia !== undefined) {
        const hasMedia = post.querySelector('[data-testid="tweetPhoto"], [data-testid="videoPlayer"], [data-testid="card.wrapper"]') !== null;
        if (filter.hasMedia !== hasMedia) {
            return false; // マッチしない
        }
    }

    // すべての条件を満たした
    return true;
}
