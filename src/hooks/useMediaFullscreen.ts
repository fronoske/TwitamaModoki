import { useEffect, RefObject } from "react";
import { MEDIA_VIEWER_SELECTOR } from "@/config/xSelectors";
import { logger } from "@/utils/logger";

const BUTTON_CLASS = "twitama-media-fullscreen-button";
const FULLSCREEN_BODY_CLASS = "twitama-media-fullscreen";

/**
 * X の画像・動画ビューアーに全画面表示ボタンを追加する。
 */
export function useMediaFullscreen(iframeRef: RefObject<HTMLIFrameElement | null>) {
    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) return;

        let cleanupDocument: (() => void) | null = null;

        const setupDocument = () => {
            cleanupDocument?.();

            try {
                const iframeDoc = iframe.contentWindow?.document;
                if (!iframeDoc?.body) return;

                let fullscreenStartedByApp = false;

                const getButtons = () => Array.from(iframeDoc.querySelectorAll<HTMLButtonElement>(`.${BUTTON_CLASS}`));

                const updateFullscreenUi = () => {
                    const isAppFullscreen = fullscreenStartedByApp && iframeDoc.fullscreenElement === iframeDoc.documentElement;
                    iframeDoc.body.classList.toggle(FULLSCREEN_BODY_CLASS, isAppFullscreen);

                    const label = isAppFullscreen ? "全画面解除" : "全画面表示";
                    getButtons().forEach((button) => {
                        if (button.textContent !== label) button.textContent = label;
                        button.setAttribute("aria-label", label);
                        button.setAttribute("aria-pressed", String(isAppFullscreen));
                    });

                    if (fullscreenStartedByApp && !isAppFullscreen && !iframeDoc.fullscreenElement) {
                        fullscreenStartedByApp = false;
                    }
                };

                const exitFullscreen = () => {
                    if (!fullscreenStartedByApp) return;

                    fullscreenStartedByApp = false;
                    iframeDoc.body.classList.remove(FULLSCREEN_BODY_CLASS);

                    if (iframeDoc.fullscreenElement === iframeDoc.documentElement) {
                        void iframeDoc.exitFullscreen().catch((error: unknown) => {
                            logger.warn("TwitamaModoki: メディアの全画面表示を解除できませんでした:", error);
                        });
                    }
                };

                const handleButtonClick = (event: MouseEvent) => {
                    event.preventDefault();
                    event.stopPropagation();

                    if (iframeDoc.fullscreenElement === iframeDoc.documentElement) {
                        exitFullscreen();
                        return;
                    }

                    if (iframeDoc.fullscreenElement || !iframeDoc.fullscreenEnabled || !iframeDoc.documentElement.requestFullscreen) {
                        return;
                    }

                    iframeDoc.documentElement
                        .requestFullscreen({ navigationUI: "hide" })
                        .then(() => {
                            fullscreenStartedByApp = iframeDoc.fullscreenElement === iframeDoc.documentElement;
                            syncButton();
                        })
                        .catch((error: unknown) => {
                            logger.warn("TwitamaModoki: メディアを全画面表示できませんでした:", error);
                        });
                };

                const createButton = () => {
                    const button = iframeDoc.createElement("button");
                    button.type = "button";
                    button.className = BUTTON_CLASS;
                    button.textContent = "全画面表示";
                    button.setAttribute("aria-label", "全画面表示");
                    button.setAttribute("aria-pressed", "false");
                    button.addEventListener("click", handleButtonClick);
                    return button;
                };

                const syncButton = () => {
                    const viewer = iframeDoc.querySelector<HTMLElement>(MEDIA_VIEWER_SELECTOR);
                    const existingButtons = getButtons();

                    if (!viewer) {
                        existingButtons.forEach((button) => button.remove());
                        exitFullscreen();
                        return;
                    }

                    if (!iframeDoc.fullscreenEnabled || !iframeDoc.documentElement.requestFullscreen) {
                        existingButtons.forEach((button) => button.remove());
                        return;
                    }

                    if (!viewer.querySelector(`.${BUTTON_CLASS}`)) {
                        existingButtons.forEach((button) => button.remove());
                        viewer.appendChild(createButton());
                    }

                    updateFullscreenUi();
                };

                const observer = new MutationObserver(syncButton);
                observer.observe(iframeDoc.body, { childList: true, subtree: true });
                iframeDoc.addEventListener("fullscreenchange", updateFullscreenUi);
                syncButton();

                cleanupDocument = () => {
                    observer.disconnect();
                    iframeDoc.removeEventListener("fullscreenchange", updateFullscreenUi);
                    getButtons().forEach((button) => button.removeEventListener("click", handleButtonClick));
                    getButtons().forEach((button) => button.remove());
                    exitFullscreen();
                };
            } catch (error) {
                logger.warn("TwitamaModoki: メディア全画面ボタンを初期化できませんでした:", error);
            }
        };

        iframe.addEventListener("load", setupDocument);
        setupDocument();

        return () => {
            iframe.removeEventListener("load", setupDocument);
            cleanupDocument?.();
        };
    }, [iframeRef]);
}
