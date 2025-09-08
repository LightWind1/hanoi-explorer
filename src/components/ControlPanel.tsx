import { useMemo, useRef, useState, useEffect } from "react";
import GlobalState, { useGlobal} from "../state/GlobalState";
import type { Move, Snapshot, Point } from "../state/Types";
import { generateMovesAuto, exportSnapshotsAsZip ,computeSnapshots, minMovesBigInt, formatBigInt ,downloadDataUrl} from "../utils/hanoi";
import html2canvas from "html2canvas";

export default function ControlPanel() {
  const gs = useGlobal();
  const [inputN, setInputN] = useState(gs.n);
  const [exportOpen, setExportOpen] = useState(() => {
    try { const p = new URLSearchParams(window.location.search).get('export'); return p === 'open'; } catch { return false; }
  });

  const stepsStr = useMemo(() => formatBigInt(minMovesBigInt(inputN)), [inputN]);
  
  const canPlay = inputN <= 12  && gs.startPeg !== gs.endPeg;

  const applyN = () => {
    let n = Math.max(1, Math.min(64, Math.floor(inputN)));
    GlobalState.setN(n); 
    GlobalState.setPlaying(false); 
    GlobalState.setStepIndex(0);

    const start = gs.startPeg ?? 0; const end = gs.endPeg ?? 2;
    if (start === end) {
      GlobalState.setMoves([]);
      const snaps = computeSnapshots(n, [], start);
      GlobalState.setSnapshots(snaps);
    } else if (n <= 12) {
      const acc = generateMovesAuto(n, start, end);
      GlobalState.setMoves(acc);
      GlobalState.setSnapshots(computeSnapshots(n, acc, start));
    } else {
      GlobalState.setMoves([]);
      GlobalState.setSnapshots(computeSnapshots(n, [], start));
    }
  };

  useEffect(() => { applyN(); }, [gs.startPeg, gs.endPeg]);


  function HowItWorks() {
  return (
    <details className="rounded-xl bg-gray-50 p-3 text-sm">
      <summary className="cursor-pointer">原理说明</summary>
      <div className="mt-2 text-gray-600">递归移动：移动 n 层需先移动 n-1 层至辅助柱，再移动底层，最后移动 n-1 层到目标柱。最少步数为 2^n - 1。</div>
    </details>
  );
}

  const toggleExportOpen = (val?: boolean) => {
    const next = typeof val === 'boolean' ? val : !exportOpen;
    setExportOpen(next);
    try {
      const params = new URLSearchParams(window.location.search);
      params.set('export', next ? 'open' : 'closed');
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, '', newUrl);
    } catch (e) { /* ignore */ }
  };

  return (
    <div className="bg-white rounded-2xl shadow p-5 space-y-4">
      {/* 层数 */}
      <div>
        <label className="block text-sm font-medium">层数（n）</label>
        <input type="number" min={1} max={64} value={inputN} onChange={(e) => setInputN(Number(e.target.value))} className="w-full rounded-xl border px-3 py-2" />
        <div className="text-xs text-gray-500 mt-1">动画上限：12 层（超过只显示步数）</div>
      </div>

       {/* 新增 起点/终点选择 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">起点柱子</label>
          <select
            value={gs.startPeg}
            onChange={(e) => GlobalState.setStartPeg(Number(e.target.value))}
            className="w-full rounded-xl border px-3 py-2"
          >
            <option value={0}>{gs.pegNames[0]}</option>
            <option value={1}>{gs.pegNames[1]}</option>
            <option value={2}>{gs.pegNames[2]}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">终点柱子</label>
          <select
            value={gs.endPeg}
            onChange={(e) => GlobalState.setEndPeg(Number(e.target.value))}
            className="w-full rounded-xl border px-3 py-2"
          >
            {gs.pegNames.map((name, idx) => (
        <option key={idx} value={idx}>{name}</option>
      ))}
          </select>
        </div>
      </div>
      {/* 步数 / 可演示 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-gray-50 rounded-xl">
          <div className="text-sm text-gray-600">最少步数</div>
          <div className="text-2xl font-semibold mt-1">{stepsStr}</div>
        </div>
        <div className="p-3 bg-gray-50 rounded-xl">
          <div className="text-sm text-gray-600">是否可演示</div>
          <div className={`text-2xl font-semibold mt-1 ${canPlay ? 'text-emerald-600' : 'text-amber-600'}`}>{canPlay ? '可播放' : '仅显示步数'}</div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex flex-wrap gap-3">
        <button onClick={applyN} className="px-4 py-2 rounded-xl bg-indigo-600 text-white">生成/更新</button>
        <button onClick={() => { 
                  GlobalState.setPlaying(false); 
                  GlobalState.setStepIndex(0); 
                  GlobalState.setStartPeg(0);
                  GlobalState.setMiddlePeg(1);
                  GlobalState.setEndPeg(2);
                }} 
                  className="px-4 py-2 rounded-xl bg-gray-200">重置</button>

        <button onClick={() => {
                  const params = new URLSearchParams();
                  params.set("n", String(gs.n));
                  params.set("start", String(gs.startPeg));
                  params.set("end", String(gs.endPeg));
                  params.set("names", gs.pegNames.join(","));
                  params.set("colors", JSON.stringify(gs.diskColors));
                  const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
                  navigator.clipboard.writeText(url).then(() => {
                    alert("链接已复制，可以分享啦！");
                  });
                }}
                className="px-4 py-2 rounded-xl bg-gray-200">分享配置</button>
      </div>

      <details className="rounded-xl bg-gray-50 p-3" open={exportOpen}>
          <summary className="cursor-pointer font-medium flex justify-between items-center">
            <span>导出 / 保存</span>
            <div className="flex items-center gap-2">
              <button onClick={(e) => { e.preventDefault(); toggleExportOpen(); }} className="text-sm text-gray-500">{exportOpen ? '收起' : '展开'}</button>
            </div>
          </summary>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={async () => {
              // 导出当前可见步骤（DOM 截图）
              const el = document.getElementById('hanoi-visual');
              if (!el) return; const canvas = await html2canvas(el); downloadDataUrl(canvas.toDataURL('image/png'), `step-${gs.stepIndex}.png`);
            }} className="px-3 py-2 rounded-xl bg-indigo-600 text-white">导出当前步图片</button>

            <button onClick={async () => {
              // 使用 snapshots 直接绘制并打包
              await exportSnapshotsAsZip(gs.snapshots, gs.moves, gs);
            }} className="px-3 py-2 rounded-xl bg-teal-600 text-white">批量导出 ZIP</button>
          </div>
        </details>


      <div className="pt-2 border-t" />
        {/* 箭头配置 */}
    <details className="mt-4 border rounded p-2">  
    
      <summary className="cursor-pointer font-semibold flex justify-between items-center">
        <span>箭头配置</span>
        <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm">显示箭头</label>
          <input type="checkbox" checked={gs.showArrow} onChange={(e) => GlobalState.setShowArrow(e.target.checked)} />
        </div>

        <div>
          <label className="text-sm">箭头颜色</label>
          <input type="color" value={gs.arrowColor} onChange={(e) => GlobalState.setArrowColor(e.target.value)} className="ml-2" />
        </div>

        <div>
          <label className="text-sm">箭头粗细（px）</label>
          <input type="range" min={1} max={6} value={gs.arrowWidth} onChange={(e) => GlobalState.setArrowWidth(Number(e.target.value))} />
          <div className="text-xs text-gray-500">当前：{gs.arrowWidth}px</div>
        </div>

        <div>
          <label className="text-sm">播放速度倍率（0.5x - 3x）</label>
          <input type="range" min={0.5} max={3} step={0.1} value={gs.speedMultiplier} onChange={(e) => GlobalState.setSpeedMultiplier(Number(e.target.value))} />
          <div className="text-xs text-gray-500">当前：{gs.speedMultiplier.toFixed(1)}x</div>
        </div>
      </div>
      </summary>
      </details>
{/* 盘子颜色设置 */}
    <details className="mt-4 border rounded p-2">
      <summary className="cursor-pointer font-semibold flex justify-between items-center">
      <span>盘子颜色设置</span>
      <button
        title="恢复默认颜色"
        className="ml-2 text-gray-500 hover:text-gray-800"
        onClick={(e) => {
          e.preventDefault(); // 阻止折叠切换
          GlobalState.setDiskColors({});
        }}
    >
      ↺
    </button>
  </summary>
  <div className="mt-2 space-y-2">
    {Array.from({ length: gs.n }, (_, i) => {
      const size = i + 1;
      return (
        <div key={size} className="flex items-center space-x-2">
          <label className="w-16">盘子 {size}</label>
          <input
            type="color"
            value={gs.diskColors[size] || "#4f46e5"}
            onChange={(e) => {
              const newColors = { ...gs.diskColors, [size]: e.target.value };
              GlobalState.setDiskColors(newColors);
            }}
          />
        </div>
      );
    })}
  </div>
</details>
  {/* 柱子命名设置 */}
<details className="mt-4 border rounded p-2">
  <summary className="cursor-pointer font-semibold flex justify-between items-center">
    <span>柱子命名设置</span>
    <button
      title="恢复默认名称"
      className="ml-2 text-gray-500 hover:text-gray-800"
      onClick={(e) => {
        e.preventDefault(); // 阻止折叠切换
        GlobalState.setPegNames(["A", "B", "C"]);
      }}
    >
      ↺
    </button>
  </summary>
  <div className="mt-2 space-y-2">
    {["A", "B", "C"].map((defaultName, i) => (
      <div key={i} className="flex items-center space-x-2">
        <label className="w-12">柱子 {i+1}</label>
        <input
          type="text"
          value={gs.pegNames?.[i] || defaultName}
          onChange={(e) => {
            const newNames = [...gs.pegNames];
            newNames[i] = e.target.value;
            GlobalState.setPegNames(newNames);
          }}
          className="border px-1 rounded"
        />
      </div>
    ))}
  </div>
</details>

      <HowItWorks />
    </div>
  );
}

