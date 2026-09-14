/**
 * X (Twitter) のDOM要素セレクタ設定
 *
 * ⚠️ Xのレイアウト変更時はここを修正してください
 *
 * このファイルは、Xのページ構造に依存するセレクタを一箇所に集約し、
 * レイアウト変更時の修正を容易にするためのものです。
 */

import { logger } from "@/utils/logger";

/**
 * 上部バナーのセレクタ
 *
 * 現在の構造: div#layers > div で、子孫に div[data-testid="TopNavBar"] を持つもの
 *
 * Listカラムでは非表示、それ以外では表示します。
 */
export const TOP_BANNER_SELECTOR = 'div#layers > div:has(div[data-testid="TopNavBar"])';

/**
 * 下部バナーのセレクタ
 *
 * 現在の構造: div#layers > div で、子孫に div[data-testid="BottomBar"] を持つもの
 *
 * 常に非表示にすることで画面を最大化します。
 */
export const BOTTOM_BANNER_SELECTOR = 'div#layers > div:has(div[data-testid="BottomBar"])';

/**
 * Listカラム特有のヘッダーのセレクタ
 *
 * 現在の構造: div[data-testid="cellInnerDiv"] で、子孫に div[data-testid="UserAvatar-Container-unknown"] を持つもの
 *
 * Listカラムでのみ非表示にします。
 */
export const LIST_HEADER_SELECTOR = 'div[data-testid="cellInnerDiv"]:has(div[data-testid="UserAvatar-Container-unknown"])';

/**
 * バナーヘッダーのセレクタ
 *
 * 現在の構造: header[role="banner"]
 *
 * Listカラムでのみ非表示にします。
 */
export const BANNER_HEADER_SELECTOR = 'header[role="banner"]';

/**
 * 画像モーダルのセレクタ
 *
 * 現在の構造: div[data-testid="swipe-to-dismiss"]
 *
 * この要素が存在する場合、画像モーダルが表示されていると判定します。
 */
export const IMAGE_MODAL_SELECTOR = 'div[data-testid="swipe-to-dismiss"]';

/**
 * フォントサイズを変更する対象のテキスト要素セレクタ
 *
 * ⚠️ Xのレイアウト変更時や、新たにサイズ変更したい要素を見つけた場合は、
 * この配列に追加してください。
 *
 * 現在の対象:
 * - ツイート本文
 * - 「もっと見る」リンク
 */
export const TEXT_SELECTORS = ['div[data-testid="tweetText"]', 'div[data-testid="tweet-text-show-more-link"]'];

/**
 * リスト名を取得するためのセレクタ設定
 *
 * 現在の構造: *[data-testid="TopNavBar"]
 *
 * TopNavBar から取得したテキストの '@' 以前の部分がリスト名です。
 */
export const LIST_NAME_CONFIG = {
    /**
     * リスト名を含む要素のセレクタ
     */
    selector: '*[data-testid="TopNavBar"]',

    /**
     * リスト名取得用のヘルパー関数
     *
     * @param doc - iframe内のDocument
     * @returns リスト名、取得できない場合はnull
     */
    getListName(doc: Document): string | null {
        try {
            const element = doc.querySelector(this.selector);
            if (!element?.textContent) return null;

            const text = element.textContent.trim();
            // '@' 以降を削除
            const atIndex = text.indexOf("@");
            return atIndex !== -1 ? text.substring(0, atIndex).trim() : text;
        } catch (error) {
            logger.error("❌ TwitamaModoki: リスト名取得エラー:", error);
            return null;
        }
    },
};

/**
 * コミュニティ名を取得するためのセレクタ設定
 *
 * 現在の構造: *[data-testid="TopNavBar"]
 *
 * TopNavBar から取得したテキストの '@' 以前の部分がコミュニティ名です。
 */
export const COMMUNITY_NAME_CONFIG = {
    /**
     * コミュニティ名を含む要素のセレクタ
     */
    selector: '*[data-testid="TopNavBar"]',

    /**
     * コミュニティ名取得用のヘルパー関数
     *
     * @param doc - iframe内のDocument
     * @returns コミュニティ名、取得できない場合はnull
     */
    getCommunityName(doc: Document): string | null {
        try {
            const element = doc.querySelector(this.selector);
            if (!element?.textContent) return null;

            const text = element.textContent.trim();
            // '@' 以降を削除
            const atIndex = text.indexOf("@");
            return atIndex !== -1 ? text.substring(0, atIndex).trim() : text;
        } catch (error) {
            logger.error("❌ TwitamaModoki: コミュニティ名取得エラー:", error);
            return null;
        }
    },
};

/**
 * ユーザープロフィール名を取得するためのセレクタ設定
 *
 * 現在の構造: div[data-testid="UserName"]
 *
 * UserName から取得したテキストの '@' 以降がスクリーンネーム（@を含む）です。
 */
export const USER_PROFILE_NAME_CONFIG = {
    /**
     * ユーザー名を含む要素のセレクタ
     */
    selector: 'div[data-testid="UserName"]',

    /**
     * スクリーンネーム取得用のヘルパー関数
     *
     * @param doc - iframe内のDocument
     * @returns スクリーンネーム（@を含む）、取得できない場合はnull
     */
    getUserName(doc: Document): string | null {
        try {
            const element = doc.querySelector(this.selector);
            if (!element?.textContent) return null;

            const text = element.textContent.trim();
            // '@' 以降を抽出（@を含む）
            const atIndex = text.indexOf("@");
            if (atIndex === -1) return null;

            return text.substring(atIndex).trim();
        } catch (error) {
            logger.error("❌ TwitamaModoki: スクリーンネーム取得エラー:", error);
            return null;
        }
    },
};

/**
 * その他の将来的に必要になるかもしれないセレクタ
 */
export const X_SELECTORS = {
    /**
     * プロフィール名
     */
    profileName: '[data-testid="UserName"]',

    /**
     * ツイート入力欄
     */
    tweetComposer: '[data-testid="tweetTextarea_0"]',

    // 必要に応じて追加
};
