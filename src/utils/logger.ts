/**
 * 開発時のみログを出力するカスタムロガー
 * 本番ビルド時は何も出力しない（ツリーシェイキングで削除される）
 */

const isDev = import.meta.env.MODE === "development";

// ビルド環境を確認（常に出力）
console.log(`🔧 TwitamaModoki Logger: MODE="${import.meta.env.MODE}", isDev=${isDev}`);

export const logger = {
    log: isDev ? console.log.bind(console) : () => {},
    debug: isDev ? console.debug.bind(console) : () => {},
    info: isDev ? console.info.bind(console) : () => {},
    warn: isDev ? console.warn.bind(console) : () => {},
    // error は本番でも出力（デバッグに必要）
    error: console.error.bind(console),
};
