/**
 * メインアプリケーションコンポーネント
 */

import { useEffect } from "react";
import { useAppStore } from "@/store";
import { loadRateLimits, watchRateLimits } from "@/storage";
import { ColumnSwiper } from "./ColumnSwiper";
import { TabBar } from "./TabBar";
import "./App.css";

// manifest.jsonからバージョンを取得
const getVersion = async () => {
    try {
        const manifest = chrome.runtime.getManifest();
        return manifest.version_name || manifest.version;
    } catch {
        return "0.1.0";
    }
};

export function App() {
    const { loadFromStorage, isLoading, setRateLimits } = useAppStore();

    useEffect(() => {
        loadFromStorage();
    }, [loadFromStorage]);

    useEffect(() => {
        let unsubscribe: (() => void) | undefined;

        loadRateLimits().then((limits) => {
            setRateLimits(limits);
        });

        unsubscribe = watchRateLimits((limits) => {
            setRateLimits(limits);
        });

        return () => {
            unsubscribe?.();
        };
    }, [setRateLimits]);

    // ページタイトルを設定
    useEffect(() => {
        getVersion().then((version) => {
            document.title = `TwitamaModoki ${version}`;
        });
    }, []);

    if (isLoading) {
        return (
            <div className="twitama-modoki-loading">
                <div className="loading-spinner">読み込み中...</div>
            </div>
        );
    }

    return (
        <div className="twitama-modoki-app">
            <ColumnSwiper />
            <TabBar />
        </div>
    );
}
