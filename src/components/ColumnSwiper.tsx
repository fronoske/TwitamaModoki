/**
 * カラムのスワイパーコンポーネント
 */

import { useRef, useEffect } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperType } from "swiper";
import { useAppStore } from "@/store";
import { ColumnView } from "./ColumnView";

import "swiper/css";
import "./ColumnSwiper.css";

export function ColumnSwiper() {
    const { columns, currentColumnIndex, setCurrentColumnIndex } = useAppStore();
    const swiperRef = useRef<SwiperType | null>(null);

    const handleSlideChange = (swiper: SwiperType) => {
        setCurrentColumnIndex(swiper.activeIndex);
    };

    const handleSwiper = (swiper: SwiperType) => {
        swiperRef.current = swiper;
    };

    // currentColumnIndexが外部から変更された時にSwiperを同期
    useEffect(() => {
        if (swiperRef.current && swiperRef.current.activeIndex !== currentColumnIndex) {
            swiperRef.current.slideTo(currentColumnIndex);
        }
    }, [currentColumnIndex]);

    // iframe内からのスワイプイベントをリッスン
    useEffect(() => {
        const handleSwipeEvent = (e: Event) => {
            const customEvent = e as CustomEvent<{ direction: string }>;
            const direction = customEvent.detail.direction;

            if (!swiperRef.current) return;

            if (direction === "left") {
                // 左スワイプ = 次のカラムへ
                swiperRef.current.slideNext();
            } else if (direction === "right") {
                // 右スワイプ = 前のカラムへ
                swiperRef.current.slidePrev();
            }
        };

        window.addEventListener("twitama-modoki-swipe", handleSwipeEvent);

        return () => {
            window.removeEventListener("twitama-modoki-swipe", handleSwipeEvent);
        };
    }, []);

    // .swiper要素のscrollTopを監視してリセット（RateLimitPanelが隠れる問題の対策）
    useEffect(() => {
        // Swiperの初期化を待つ
        const checkInterval = setInterval(() => {
            const swiperEl = document.querySelector(".swiper");
            if (swiperEl) {
                clearInterval(checkInterval);

                // scrollTopを監視してリセット
                const resetScrollTop = () => {
                    if (swiperEl.scrollTop !== 0) {
                        swiperEl.scrollTop = 0;
                    }
                };

                // 定期的にチェック（100ms間隔）
                const monitorInterval = setInterval(resetScrollTop, 100);

                // scrollイベントでも即座にリセット
                swiperEl.addEventListener("scroll", resetScrollTop);

                // クリーンアップ
                return () => {
                    clearInterval(monitorInterval);
                    swiperEl.removeEventListener("scroll", resetScrollTop);
                };
            }
        }, 100);

        return () => {
            clearInterval(checkInterval);
        };
    }, []);

    return (
        <div className="column-swiper-container">
            <Swiper spaceBetween={0} slidesPerView={1} onSlideChange={handleSlideChange} onSwiper={handleSwiper} initialSlide={currentColumnIndex}>
                {columns.map((column) => (
                    <SwiperSlide key={column.id}>
                        <ColumnView column={column} />
                    </SwiperSlide>
                ))}
            </Swiper>
        </div>
    );
}
