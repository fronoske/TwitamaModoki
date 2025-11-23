/**
 * タブバーコンポーネント
 */

import { useAppStore } from "@/store";
import "./TabBar.css";

export function TabBar() {
    const { columns, currentColumnIndex, setCurrentColumnIndex } = useAppStore();

    const handleTabClick = (index: number) => {
        setCurrentColumnIndex(index);
    };

    return (
        <div className="tab-bar">
            <div className="tab-bar-scroll">
                {columns.map((column, index) => (
                    <button key={column.id} className={`tab-item ${index === currentColumnIndex ? "active" : ""}`} onClick={() => handleTabClick(index)}>
                        {column.title}
                    </button>
                ))}
            </div>
        </div>
    );
}
