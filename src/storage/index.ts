/**
 * Chrome Storage 管理モジュール
 */

import { AppConfig, DEFAULT_CONFIG, DEFAULT_RATE_LIMIT_STATE, RateLimitState } from "@/types";
import { logger } from "@/utils/logger";

export const STORAGE_KEY = 'twitama_modoki_config';
export const RATE_LIMIT_STORAGE_KEY = "twitama_modoki_rate_limits";

/**
 * 設定をStorageから読み込む
 */
export async function loadConfig(): Promise<AppConfig> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    if (result[STORAGE_KEY]) {
      return result[STORAGE_KEY] as AppConfig;
    }
    return DEFAULT_CONFIG;
  } catch (error) {
    logger.error('設定の読み込みに失敗しました:', error);
    return DEFAULT_CONFIG;
  }
}

/**
 * 設定をStorageに保存する
 */
export async function saveConfig(config: AppConfig): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: config });
  } catch (error) {
    logger.error('設定の保存に失敗しました:', error);
    throw error;
  }
}

/**
 * 設定を部分的に更新する
 */
export async function updateConfig(
  updates: Partial<AppConfig>
): Promise<AppConfig> {
  const currentConfig = await loadConfig();
  const newConfig = { ...currentConfig, ...updates };
  await saveConfig(newConfig);
  return newConfig;
}

/**
 * 設定をリセットする
 */
export async function resetConfig(): Promise<void> {
  await saveConfig(DEFAULT_CONFIG);
}

/**
 * 設定をJSONとしてエクスポート
 */
export async function exportConfig(): Promise<string> {
  const config = await loadConfig();
  return JSON.stringify(config, null, 2);
}

/**
 * JSONから設定をインポート
 */
export async function importConfig(jsonString: string): Promise<void> {
  try {
    const config = JSON.parse(jsonString) as AppConfig;
    // 簡易的なバリデーション
    if (!config.columns || !config.autoRefresh || !config.filters) {
      throw new Error('無効な設定ファイルです');
    }
    await saveConfig(config);
  } catch (error) {
    logger.error('設定のインポートに失敗しました:', error);
    throw error;
  }
}

/**
 * Storage変更を監視する
 */
export function watchConfig(
  callback: (config: AppConfig) => void
): () => void {
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string
  ) => {
    if (areaName === 'local' && changes[STORAGE_KEY]) {
      callback(changes[STORAGE_KEY].newValue as AppConfig);
    }
  };

  chrome.storage.onChanged.addListener(listener);

  // リスナー解除関数を返す
  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
}

export async function loadRateLimits(): Promise<RateLimitState> {
  try {
    const result = await chrome.storage.local.get(RATE_LIMIT_STORAGE_KEY);
    if (result[RATE_LIMIT_STORAGE_KEY]) {
      const stored = result[RATE_LIMIT_STORAGE_KEY] as Partial<RateLimitState>;
      return { ...DEFAULT_RATE_LIMIT_STATE, ...stored } as RateLimitState;
    }
  } catch (error) {
        logger.error("レート制限情報の読み込みに失敗しました:", error);
  }
  return DEFAULT_RATE_LIMIT_STATE;
}

export async function saveRateLimits(limits: RateLimitState): Promise<void> {
  try {
    await chrome.storage.local.set({ [RATE_LIMIT_STORAGE_KEY]: limits });
  } catch (error) {
        logger.error("レート制限情報の保存に失敗しました:", error);
    throw error;
  }
}

export function watchRateLimits(callback: (limits: RateLimitState) => void): () => void {
  const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
    if (areaName === "local" && changes[RATE_LIMIT_STORAGE_KEY]) {
      callback(changes[RATE_LIMIT_STORAGE_KEY].newValue as RateLimitState);
    }
  };

  chrome.storage.onChanged.addListener(listener);

  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
}

