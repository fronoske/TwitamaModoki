/**
 * 汎用カラムコンポーネント
 *
 * Phase 3のURL自動保存により、すべてのカラム
 * （ホーム、検索、リスト、通知、DM等）が同じロジックで動作する。
 *
 * currentUrl があれば、どのXページでも表示可能。
 */

import { useRef, useCallback, useState, useEffect } from "react";
import { useIframeInit } from "@/hooks/useIframeInit";
import { useMediaFullscreen } from "@/hooks/useMediaFullscreen";
import { useIframeUrlSync } from "@/hooks/useIframeUrlSync";
import { useAppStore } from "@/store";
import { IMAGE_MODAL_SELECTOR } from "@/config/xSelectors";
import { RateLimitPanel } from "@/components/RateLimitPanel";
import { logger } from "@/utils/logger";
import "./GenericColumn.css";

// フローティングボタンの設定
const SCROLL_BUTTON_HIDE_DELAY = 2000; // スクロール停止後、ボタンが消えるまでの時間（ミリ秒）
const SCROLL_BUTTON_FADE_DURATION = 500; // フェードアウトの時間（ミリ秒）

interface GenericColumnProps {
    columnId: string;
    currentUrl: string;
}

/**
 * 汎用カラムコンポーネント
 *
 * URLベースで動作するため、カラムの種類を意識する必要がない。
 * iframe内でユーザーが移動すると、URLとタイトルが自動的に記録される。
 */
export function GenericColumn({ columnId, currentUrl }: GenericColumnProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const { updateColumnUrl, display } = useAppStore();
    const [isScrolling, setIsScrolling] = useState(false); // スクロール中かどうか
    const [isFading, setIsFading] = useState(false);
    const [iframeUrl, setIframeUrl] = useState(currentUrl); // iframe内の実際のURLを追跡
    const scrollTimeoutRef = useRef<number | null>(null);
    const fadeTimeoutRef = useRef<number | null>(null);

    // iframe初期化（広告非表示、カスタムCSS注入、アカウント名検出）
    useIframeInit(iframeRef, { hideAds: true });
    useMediaFullscreen(iframeRef);

    // URL変更を監視して自動保存
    const handleUrlChange = useCallback(
        (url: string, title: string) => {
            logger.log(`📝 カラム ${columnId}: URL更新 - ${title} (${url})`);
            setIframeUrl(url); // iframe内のURLを更新
            updateColumnUrl(columnId, url, title);
        },
        [columnId, updateColumnUrl]
    );

    useIframeUrlSync(iframeRef, {
        onUrlChange: handleUrlChange,
        columnId, // カラムIDを渡す
    });

    // iframe内のスクロールイベントを監視
    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) return;

        const handleLoad = () => {
            try {
                const iframeDoc = iframe.contentWindow?.document;
                if (!iframeDoc) return;

                let lastScrollTop = 0;

                const handleScroll = () => {
                    // 画像モーダルが表示されている場合はボタンを表示しない
                    const isImageModalOpen = iframeDoc.querySelector(IMAGE_MODAL_SELECTOR) !== null;
                    if (isImageModalOpen) {
                        setIsScrolling(false);
                        setIsFading(false);
                        return;
                    }

                    // 実際にスクロール位置が変化したかチェック
                    const currentScrollTop = iframeDoc.documentElement.scrollTop || iframeDoc.body.scrollTop;
                    if (Math.abs(currentScrollTop - lastScrollTop) < 5) {
                        // スクロール量が5px未満なら無視（画面遷移などの誤検知を防ぐ）
                        return;
                    }
                    lastScrollTop = currentScrollTop;

                    // スクロール中フラグを立てる（フェードアウトをキャンセル）
                    setIsScrolling(true);
                    setIsFading(false);

                    // 既存のタイマーをクリア
                    if (scrollTimeoutRef.current !== null) {
                        clearTimeout(scrollTimeoutRef.current);
                    }
                    if (fadeTimeoutRef.current !== null) {
                        clearTimeout(fadeTimeoutRef.current);
                    }

                    // 指定時間後にフェードアウト開始
                    scrollTimeoutRef.current = window.setTimeout(() => {
                        setIsFading(true);

                        // フェードアウト完了後にスクロール中フラグを下ろす
                        fadeTimeoutRef.current = window.setTimeout(() => {
                            setIsScrolling(false);
                            setIsFading(false);
                        }, SCROLL_BUTTON_FADE_DURATION);
                    }, SCROLL_BUTTON_HIDE_DELAY);
                };

                iframeDoc.addEventListener("scroll", handleScroll);

                return () => {
                    iframeDoc.removeEventListener("scroll", handleScroll);
                    if (scrollTimeoutRef.current !== null) {
                        clearTimeout(scrollTimeoutRef.current);
                    }
                    if (fadeTimeoutRef.current !== null) {
                        clearTimeout(fadeTimeoutRef.current);
                    }
                };
            } catch (error) {
                logger.error("スクロールイベント監視エラー:", error);
            }
        };

        iframe.addEventListener("load", handleLoad);

        return () => {
            iframe.removeEventListener("load", handleLoad);
        };
    }, []);

    // スクロール関数
    const scrollToTop = () => {
        const iframe = iframeRef.current;
        if (!iframe) return;

        try {
            const iframeWin = iframe.contentWindow;
            if (iframeWin) {
                iframeWin.scrollTo({ top: 0, behavior: "smooth" });
            }
        } catch (error) {
            logger.error("上へスクロールエラー:", error);
        }
    };

    const scrollToBottom = () => {
        const iframe = iframeRef.current;
        if (!iframe) return;

        try {
            const iframeDoc = iframe.contentWindow?.document;
            if (iframeDoc) {
                const scrollHeight = iframeDoc.documentElement.scrollHeight;
                iframe.contentWindow?.scrollTo({ top: scrollHeight, behavior: "smooth" });
            }
        } catch (error) {
            logger.error("下へスクロールエラー:", error);
        }
    };

    return (
        <div className="generic-column" style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", position: "relative" }}>
            <RateLimitPanel currentUrl={iframeUrl} />
            <iframe
                ref={iframeRef}
                src={currentUrl}
                style={{
                    width: "100%",
                    flex: 1,
                    border: 0,
                }}
                allow="fullscreen"
                title="Xページ"
            />

            {/* フローティングスクロールボタン */}
            {(() => {
                const showTopButton = display.scrollToTopVisibility === "always" || (display.scrollToTopVisibility === "scroll-only" && isScrolling);
                const showBottomButton = display.scrollToBottomVisibility === "always" || (display.scrollToBottomVisibility === "scroll-only" && isScrolling);

                if (!showTopButton && !showBottomButton) return null;

                // 「常に表示」の場合はフェードアウトしない
                const shouldFade = (display.scrollToTopVisibility === "scroll-only" || display.scrollToBottomVisibility === "scroll-only") && isFading;

                return (
                    <div className={`floating-scroll-buttons ${display.scrollButtonPosition === "left" ? "left" : "right"} ${shouldFade ? "fading" : ""}`}>
                        {showTopButton && (
                            <button className="scroll-button scroll-to-top" onClick={scrollToTop} aria-label="上へスクロール">
                                ↑
                            </button>
                        )}
                        {showBottomButton && (
                            <button className="scroll-button scroll-to-bottom" onClick={scrollToBottom} aria-label="下へスクロール">
                                ↓
                            </button>
                        )}
                    </div>
                );
            })()}
        </div>
    );
}
