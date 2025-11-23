/**
 * 個別カラム表示コンポーネント
 */

import { Column } from "@/types";
import { GenericColumn } from "./columns/GenericColumn";
import { SettingsColumn } from "./columns/SettingsColumn";
import "./ColumnView.css";

interface ColumnViewProps {
    column: Column;
}

export function ColumnView({ column }: ColumnViewProps) {
    const renderColumn = () => {
        // Phase 3のURL自動保存により、すべてのカラムは
        // currentUrl ベースで動作する
        switch (column.config.type) {
            case "column":
                // 汎用カラム（ホーム、検索、リスト、通知、DM等すべて）
                return <GenericColumn columnId={column.id} currentUrl={column.currentUrl} />;
            case "settings":
                // 設定画面カラム
                return <SettingsColumn />;
            default:
                return <div>未対応のカラムタイプ</div>;
        }
    };

    return <div className="column-view">{renderColumn()}</div>;
}
