import {useEffect } from "react";

import Visualizer from "./components/Visualizer";
import ControlPanel from "./components/ControlPanel";

import GlobalState from "./state/GlobalState";

// ==========================================
// Hanoi Explorer
// 功能：
// - 层数输入、最少步数、步骤列表、播放控制
// - 单步导出 PNG、批量导出 ZIP（包含 step-0.png）
// - 箭头为弯曲贝塞尔曲线并带箭头头部；可显示/隐藏、调色、调粗细
// - 播放速度倍率（0.5x-3x）、暂停/继续
// ==========================================

export default function App() {

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // 如果 URL 没有参数，则直接返回，不做任何修改
    if (!params.toString()){
        GlobalState.initDiskColors();
        return;
    }

    const n = Number(params.get("n")) ?? 4;
    const start = Number(params.get("start")) ?? 0;
    const end = Number(params.get("end")) ?? 2;
    const names = params.get("names");
    const colors = params.get("colors");

    GlobalState.setN(n);
    GlobalState.setStartPeg(start);
    GlobalState.setEndPeg(end);
    const aux = [0, 1, 2].find(x => x !== start && x !== end)!;
    GlobalState.setMiddlePeg(aux)//更新过渡柱子序号

    if (names) {
      GlobalState.setPegNames(names.split(","));
    }
    if (colors) {
      try {
        GlobalState.setDiskColors(JSON.parse(colors));
      } catch {
        // TODO
      }
    }
  }, []);
  
  return (
  <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900">
    {/* Header 可选保留 */}

    {/* Main：父容器不需要 items-center（会影响垂直对齐），这里用 flex justify-center */}
    <main className="flex-1 flex justify-center items-start">
      {/* 关键：加上 mx-auto，保留 max-w-6xl，w-full 让小屏自适应 */}
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* 左侧控制面板 */}
        <div className="xl:col-span-4">
          <div className="bg-white rounded-2xl shadow p-4">
            <ControlPanel />
          </div>
        </div>

        {/* 右侧可视化区 */}
        <div className="xl:col-span-8">
          <div className="bg-white rounded-2xl shadow p-4">
            <Visualizer />
          </div>
        </div>
      </div>
    </main>

    <footer className="border-t py-6 text-center text-xs text-gray-500 w-full">
      © {new Date().getFullYear()} Hanoi Explorer
    </footer>
  </div>
);

}