import { useCallback, useEffect, useRef, useState, RefObject } from "react";
import { IMAGE_MODAL_SELECTOR } from "@/config/xSelectors";
import { logger } from "@/utils/logger";

const FULLSCREEN_BODY_CLASS = "twitama-media-fullscreen";
const FULLSCREEN_CONTROL_HIDE_DELAY = 3000;
const MEDIA_ROUTE_PATTERN = /\/status\/\d+\/(?:photo|video)\/\d+/;

function hasExpandedMedia(iframeDoc: Document): boolean {
    if (iframeDoc.querySelector(IMAGE_MODAL_SELECTOR)) return true;

    const hasLayerVideo = Array.from(iframeDoc.querySelectorAll('[data-testid="videoPlayer"], video')).some((element) => element.closest("#layers"));
    if (hasLayerVideo) return true;

    return MEDIA_ROUTE_PATTERN.test(iframeDoc.location.pathname);
}

function getVideoEventTarget(event: Event): HTMLVideoElement | null {
    const target = event.target as Element | null;
    return target?.tagName === "VIDEO" ? (target as HTMLVideoElement) : null;
}

/**
 * X の画像・動画ビューアーを監視し、トップページの全画面表示を制御する。
 */
export function useMediaFullscreen(iframeRef: RefObject<HTMLIFrameElement | null>) {
    const [isMediaViewerOpen, setIsMediaViewerOpen] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isFullscreenControlVisible, setIsFullscreenControlVisible] = useState(true);
    const fullscreenOwnerRef = useRef<Document | null>(null);
    const mediaDocumentRef = useRef<Document | null>(null);
    const controlHideTimeoutRef = useRef<number | null>(null);

    const clearControlHideTimer = useCallback(() => {
        if (controlHideTimeoutRef.current === null) return;

        window.clearTimeout(controlHideTimeoutRef.current);
        controlHideTimeoutRef.current = null;
    }, []);

    const showFullscreenControlTemporarily = useCallback(() => {
        if (!fullscreenOwnerRef.current) return;

        clearControlHideTimer();
        setIsFullscreenControlVisible(true);
        controlHideTimeoutRef.current = window.setTimeout(() => {
            controlHideTimeoutRef.current = null;
            setIsFullscreenControlVisible(false);
        }, FULLSCREEN_CONTROL_HIDE_DELAY);
    }, [clearControlHideTimer]);

    const clearFullscreenState = useCallback(() => {
        const outerDoc = fullscreenOwnerRef.current;
        const mediaDoc = mediaDocumentRef.current;

        fullscreenOwnerRef.current = null;
        mediaDocumentRef.current = null;
        clearControlHideTimer();
        outerDoc?.body.classList.remove(FULLSCREEN_BODY_CLASS);
        mediaDoc?.body.classList.remove(FULLSCREEN_BODY_CLASS);
        setIsFullscreen(false);
        setIsFullscreenControlVisible(true);
    }, [clearControlHideTimer]);

    const exitFullscreen = useCallback(() => {
        const outerDoc = fullscreenOwnerRef.current;
        if (!outerDoc) return;

        const shouldExit = outerDoc.fullscreenElement === outerDoc.documentElement;
        clearFullscreenState();

        if (shouldExit) {
            void outerDoc.exitFullscreen().catch((error: unknown) => {
                logger.warn("TwitamaModoki: メディアの全画面表示を解除できませんでした:", error);
            });
        }
    }, [clearFullscreenState]);

    const toggleFullscreen = useCallback(() => {
        const iframe = iframeRef.current;
        const iframeDoc = iframe?.contentWindow?.document;
        const outerDoc = iframe?.ownerDocument;
        if (!iframeDoc || !outerDoc) return;

        if (fullscreenOwnerRef.current === outerDoc && outerDoc.fullscreenElement === outerDoc.documentElement) {
            exitFullscreen();
            return;
        }

        if (outerDoc.fullscreenElement || !outerDoc.documentElement.requestFullscreen) return;

        outerDoc.documentElement
            .requestFullscreen({ navigationUI: "hide" })
            .then(() => {
                if (outerDoc.fullscreenElement !== outerDoc.documentElement) return;

                fullscreenOwnerRef.current = outerDoc;
                mediaDocumentRef.current = iframeDoc;
                outerDoc.body.classList.add(FULLSCREEN_BODY_CLASS);
                iframeDoc.body.classList.add(FULLSCREEN_BODY_CLASS);
                setIsFullscreen(true);
                showFullscreenControlTemporarily();
            })
            .catch((error: unknown) => {
                logger.warn("TwitamaModoki: メディアを全画面表示できませんでした:", error);
            });
    }, [exitFullscreen, iframeRef, showFullscreenControlTemporarily]);

    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) return;

        const outerDoc = iframe.ownerDocument;
        let cleanupDocument: (() => void) | null = null;

        const setupDocument = () => {
            cleanupDocument?.();

            try {
                const iframeDoc = iframe.contentWindow?.document;
                if (!iframeDoc?.body) return;

                let activeVideo = Array.from(iframeDoc.querySelectorAll<HTMLVideoElement>("video")).find((video) => !video.paused && !video.ended) ?? null;

                const syncMediaViewer = () => {
                    const playingVideo = Array.from(iframeDoc.querySelectorAll<HTMLVideoElement>("video")).find(
                        (video) => !video.paused && !video.ended,
                    );
                    if (playingVideo) activeVideo = playingVideo;
                    if (activeVideo && (!activeVideo.isConnected || activeVideo.ended)) activeVideo = null;

                    const isOpen = hasExpandedMedia(iframeDoc) || activeVideo !== null;
                    setIsMediaViewerOpen(isOpen);
                    if (!isOpen && mediaDocumentRef.current === iframeDoc) exitFullscreen();
                };

                const handleVideoPlay = (event: Event) => {
                    const video = getVideoEventTarget(event);
                    if (!video) return;

                    activeVideo = video;
                    syncMediaViewer();
                };

                const handleVideoFinished = (event: Event) => {
                    const video = getVideoEventTarget(event);
                    if (!video || video !== activeVideo) return;

                    activeVideo = null;
                    syncMediaViewer();
                };

                const handleFullscreenChange = () => {
                    if (fullscreenOwnerRef.current !== outerDoc) return;
                    if (outerDoc.fullscreenElement !== outerDoc.documentElement) clearFullscreenState();
                };

                const observer = new MutationObserver(syncMediaViewer);
                observer.observe(iframeDoc.body, { childList: true, subtree: true });
                iframeDoc.addEventListener("play", handleVideoPlay, true);
                iframeDoc.addEventListener("ended", handleVideoFinished, true);
                iframeDoc.addEventListener("emptied", handleVideoFinished, true);
                iframeDoc.addEventListener("pointerdown", showFullscreenControlTemporarily, true);
                iframeDoc.addEventListener("pointermove", showFullscreenControlTemporarily, true);
                iframeDoc.addEventListener("keydown", showFullscreenControlTemporarily, true);
                outerDoc.addEventListener("pointerdown", showFullscreenControlTemporarily, true);
                outerDoc.addEventListener("pointermove", showFullscreenControlTemporarily, true);
                outerDoc.addEventListener("keydown", showFullscreenControlTemporarily, true);
                outerDoc.addEventListener("fullscreenchange", handleFullscreenChange);
                syncMediaViewer();

                cleanupDocument = () => {
                    observer.disconnect();
                    iframeDoc.removeEventListener("play", handleVideoPlay, true);
                    iframeDoc.removeEventListener("ended", handleVideoFinished, true);
                    iframeDoc.removeEventListener("emptied", handleVideoFinished, true);
                    iframeDoc.removeEventListener("pointerdown", showFullscreenControlTemporarily, true);
                    iframeDoc.removeEventListener("pointermove", showFullscreenControlTemporarily, true);
                    iframeDoc.removeEventListener("keydown", showFullscreenControlTemporarily, true);
                    outerDoc.removeEventListener("pointerdown", showFullscreenControlTemporarily, true);
                    outerDoc.removeEventListener("pointermove", showFullscreenControlTemporarily, true);
                    outerDoc.removeEventListener("keydown", showFullscreenControlTemporarily, true);
                    outerDoc.removeEventListener("fullscreenchange", handleFullscreenChange);
                    if (mediaDocumentRef.current === iframeDoc) exitFullscreen();
                };
            } catch (error) {
                logger.warn("TwitamaModoki: メディアビューアーを監視できませんでした:", error);
            }
        };

        iframe.addEventListener("load", setupDocument);
        setupDocument();

        return () => {
            iframe.removeEventListener("load", setupDocument);
            cleanupDocument?.();
            clearControlHideTimer();
            setIsMediaViewerOpen(false);
        };
    }, [clearControlHideTimer, clearFullscreenState, exitFullscreen, iframeRef, showFullscreenControlTemporarily]);

    return {
        isMediaViewerOpen,
        isFullscreen,
        isFullscreenControlVisible,
        isSupported: Boolean(document.documentElement.requestFullscreen),
        toggleFullscreen,
    };
}
