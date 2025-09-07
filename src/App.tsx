import { useMemo, useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import html2canvas from "html2canvas";
import JSZip from "jszip";

import GlobalState, { useGlobal } from "./state/GlobalState";
import type { Move, Snapshot, Point } from "./state/Types";
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
      } catch {}
    }
  }, []);
  
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* <header className="px-6 py-8 border-b bg-white sticky top-0 z-10">
        <h1 className="text-3xl font-bold tracking-tight">汉诺塔 · 最终版</h1>
        <p className="text-sm text-gray-600 mt-2">完整功能：播放、导出、箭头可定制。直接运行即可。</p>
      </header> */}
      <main className="p-6 max-w-6xl mx-auto grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-4">
          <ControlPanel />
        </div>
        <div className="xl:col-span-8">
          <Visualizer />
        </div>
      </main>
      <footer className="p-6 text-center text-xs text-gray-500">© {new Date().getFullYear()} Hanoi Explorer</footer>
    </div>
  );
}


// --------- Utilities ---------
function bigintPow2(n: number) { return 1n << BigInt(n); }
function minMovesBigInt(n: number) { return n < 0 ? 0n : bigintPow2(n) - 1n; }
function formatBigInt(n: bigint | number) { return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

function generateMoves(n: number, from: number, to: number, aux: number, acc: Move[]) {
  if (n <= 0) return;
  generateMoves(n - 1, from, aux, to, acc);
  acc.push({ from, to });
  generateMoves(n - 1, aux, to, from, acc);
}
function generateMovesAuto(n: number, startPeg: number, endPeg: number): Move[] {
  const acc: Move[] = [];
  if (n <= 0) return acc;
  const aux = [0, 1, 2].find(x => x !== startPeg && x !== endPeg)!;
  GlobalState.setMiddlePeg(aux)//更新过渡柱子序号
  generateMoves(n, startPeg, endPeg, aux, acc);
  return acc;
}
// 生成包含 step-0 的快照数组
function computeSnapshots(n: number, moves: Move[], startPeg = 0): Snapshot[] {
  const snapshots: Snapshot[] = [];
  const state: number[][] = [[], [], []];
  state[startPeg] = Array.from({ length: n }, (_, i) => n - i);
  snapshots.push(state.map(s => s.slice()));
  for (let i = 0; i < moves.length; i++) {
    const { from, to } = moves[i];
    const d = state[from].pop();
    if (d !== undefined) state[to].push(d);
    snapshots.push(state.map(s => s.slice()));
  }
  return snapshots;
}


// n计算n步以后的位置
function getStateAfterKMoves(n: number, moves: Move[], k: number,startPeg: number = 0):number[][] {
   // 初始化三个柱子
  const state: number[][] = [[], [], []];

  // 把所有盘子放到用户指定的起点柱子
  for (let i = n; i >= 1; i--) {
    state[startPeg].push(i);
  }
  // 执行前 k 步
  const steps = Math.max(0, Math.min(moves.length, k));
  for (let i = 0; i < steps; i++) {
    const { from, to } = moves[i];
    const disk = state[from].pop();
    if (disk !== undefined) {
      state[to].push(disk);
    }
  }
  return state;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a"); a.href = dataUrl; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); }

// ---------------------- Canvas-based snapshot renderer (used for ZIP export) ----------------------
async function exportSnapshotsAsZip(snapshots: Snapshot[], moves: Move[], gs: any) {
  if (!snapshots || snapshots.length === 0) return;
  const zip = new JSZip();
  const W = 900; const H = 360;

  function drawSnapshotToCanvas(snapshot: Snapshot, moveIndex: number) {
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    // background
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    // draw base plate
    ctx.fillStyle = '#f3f4f6'; ctx.fillRect(0, H - 40, W, 40);
    // peg centers
    const xs = [W * 0.16, W * 0.5, W * 0.84];
    // draw pegs
    xs.forEach((x) => {
      ctx.fillStyle = '#6b7280'; ctx.fillRect(x - 6, H - 280, 12, 240);
    });
    // draw disks
    snapshot.forEach((pegArr, pegIdx) => {
      pegArr.slice().forEach((size, idxFromBottom) => {
        const diskIdx = idxFromBottom; // bottom=0
        const w = diskWidth(size, gs.n);
        const h = 22;
        const x = xs[pegIdx] - w / 2;
        const y = H - 48 - diskIdx * (h + 2) - h + 6; // stack from bottom
        ctx.fillStyle = (gs.diskColors && gs.diskColors[size]) ? gs.diskColors[size] : `hsl(${(size*37)%360} 70% 50%)`;
        roundRect(ctx, x, y, w, h, 8, true, false);
        // label
        ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(size), xs[pegIdx], y + h/2);
      });
    });
    // draw arrow for upcoming move (moves[moveIndex] if exists)
    const upcoming = moves && moves.length > 0 ? moves[moveIndex] : null;
    if (upcoming) {
      const from = upcoming.from; const to = upcoming.to;
      const p1x = xs[from]; const p1y = H - 280 - 8 + 30; // near top of peg
      const p2x = xs[to]; const p2y = H - 280 - 8 + 30;
      // control point
      const mx = (p1x + p2x) / 2; const controlY = Math.min(p1y, p2y) - Math.abs(p2x - p1x) * 0.35 - 20;
      // curve
      ctx.strokeStyle = gs.arrowColor || '#ff0000'; ctx.lineWidth = gs.arrowWidth || 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p1x, p1y); ctx.quadraticCurveTo(mx, controlY, p2x, p2y); ctx.stroke();
      // draw arrowhead
      drawArrowHead(ctx, p1x, p1y, p2x, p2y, mx, controlY, gs.arrowColor || '#ff0000');
    }

    return canvas;
  }

  for (let k = 0; k < snapshots.length; k++) {
    const c = drawSnapshotToCanvas(snapshots[k], k);
    const data = c.toDataURL('image/png').split(',')[1];
    zip.file(`step-${k}.png`, data, { base64: true });
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, 'hanoi-steps.zip');
}

function roundRect(ctx: CanvasRenderingContext2D, x:number, y:number, w:number, h:number, r:number, fill:boolean, stroke:boolean){
  if (r === undefined) r = 5; if (r > w/2) r = w/2; if (r > h/2) r = h/2;
  ctx.beginPath(); ctx.moveTo(x+r, y); ctx.arcTo(x+w, y, x+w, y+h, r); ctx.arcTo(x+w, y+h, x, y+h, r); ctx.arcTo(x, y+h, x, y, r); ctx.arcTo(x, y, x+w, y, r); ctx.closePath();
  if (fill) ctx.fill(); if (stroke) ctx.stroke();
}
// TODO 注释了x1 y1
function drawArrowHead(ctx: CanvasRenderingContext2D, _x1:number, _y1:number, x2:number, y2:number, cx:number, cy:number, color:string){
  // compute tangent at end of quadratic curve to place triangle
  // approximate derivative at t=1: 2*(P2 - C)
  const dx = x2 - cx; const dy = y2 - cy; const len = Math.hypot(dx, dy) || 1; const ux = dx/len; const uy = dy/len;
  const size = 8;
  // base point
  const bx = x2 - ux * size; const by = y2 - uy * size;
  // perpendicular
  const px = -uy; const py = ux;
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(bx + px*size*0.6, by + py*size*0.6); ctx.lineTo(bx - px*size*0.6, by - py*size*0.6); ctx.closePath(); ctx.fill();
}

// --------- ControlPanel ---------
function ControlPanel() {
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

function HowItWorks() {
  return (
    <details className="rounded-xl bg-gray-50 p-3 text-sm">
      <summary className="cursor-pointer">原理说明</summary>
      <div className="mt-2 text-gray-600">递归移动：移动 n 层需先移动 n-1 层至辅助柱，再移动底层，最后移动 n-1 层到目标柱。最少步数为 2^n - 1。</div>
    </details>
  );
}

// --------- Visualizer (with curved arrow) ---------
function Visualizer() {
  const gs = useGlobal();
  const { n, moves, playing } = gs;
  const stepIndex = gs.stepIndex;
  const containerRef = useRef(null);
  const pegRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];

  const [pegPos, setPegPos] = useState([{x:0,y:0},{x:0,y:0},{x:0,y:0}]);

  const pegs = useMemo(() => {
    if (gs.snapshots && gs.snapshots.length) return gs.snapshots[Math.min(stepIndex, gs.snapshots.length - 1)];
    return getStateAfterKMoves(n, moves, stepIndex, gs.startPeg || 0);
  }, [n, moves, stepIndex, gs.snapshots, gs.startPeg]);

  // compute peg positions for arrow rendering
  useEffect(() => {
    function update() {
      const container = containerRef.current;
      if (!container) return;
      const rect = (container as HTMLElement).getBoundingClientRect();
      const pos: Point[] = pegRefs.map((r) => {
        const el = r.current;
        if (!el) return { x: rect.left + rect.width * 0.16, y: rect.top + 40 };
        const rrect = el.getBoundingClientRect();
        // use top center of peg area
        return { x: rrect.left + rrect.width / 2 - rect.left, y: rrect.top - rect.top + 8 };
      });
      setPegPos(pos);
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [pegs]);

  // playback effect using speedMultiplier
  useEffect(() => {
    if (!playing) return;
    if (!moves || moves.length === 0) return;
    if (gs.stepIndex >= moves.length) { GlobalState.setPlaying(false); return; }
    const effectiveMs = Math.max(20, gs.baseMs / gs.speedMultiplier);
    const t = setTimeout(() => { GlobalState.setStepIndex(Math.min(gs.stepIndex + 1, moves.length)); }, effectiveMs);
    return () => clearTimeout(t);
  }, [playing, gs.stepIndex, moves, gs.baseMs, gs.speedMultiplier]);

  const onPrev = () => { GlobalState.setPlaying(false); GlobalState.setStepIndex(Math.max(0, gs.stepIndex - 1)); };
  const onNext = () => { GlobalState.setPlaying(false); GlobalState.setStepIndex(Math.min(moves.length, gs.stepIndex + 1)); };
  const onTogglePlay = () => { if (!moves || moves.length === 0) return; if (gs.stepIndex >= moves.length) GlobalState.setStepIndex(0); GlobalState.setPlaying(!playing); };

  const currentMove: Move | null = moves && moves.length
  ? gs.stepIndex < moves.length ? moves[gs.stepIndex] : null
  : null;
  const progress = moves && moves.length ? Math.min(1, gs.stepIndex / moves.length) : 0;

  // helper to build curved path between two peg positions inside container
  // const buildPath = (p1: Point, p2: Point, curvature = 0.45) => {
  //   // p1/p2 are relative to container (x,y)
  //   const dx = p2.x - p1.x;
  //   const dy = p2.y - p1.y;
  //   const mx = p1.x + dx / 2;
  //   // control point above the pegs, negative dy to lift
  //   const controlY = Math.min(p1.y, p2.y) - Math.abs(dx) * curvature - 20;
  //   return `M ${p1.x},${p1.y} Q ${mx},${controlY} ${p2.x},${p2.y}`;
  // };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow p-5">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            层数：<span className="font-medium text-gray-900">{n}</span>； 最少步数：<span className="font-medium text-gray-900">{formatBigInt(minMovesBigInt(n))}</span>
            {moves && moves.length > 0 && (<><span className="mx-2">|</span> 当前步：<span className="font-medium">{Math.min(gs.stepIndex, moves.length)} / {moves.length}</span></>)}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={onPrev} className="px-3 py-2 rounded-xl bg-gray-200">上一步</button>
            <button onClick={onTogglePlay} className={`px-4 py-2 rounded-xl ${gs.playing ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>{gs.playing ? '暂停' : '播放'}</button>
            <button onClick={onNext} className="px-3 py-2 rounded-xl bg-gray-200">下一步</button>
            <button onClick={() => { GlobalState.setPlaying(false); GlobalState.setStepIndex(0); }} className="px-3 py-2 rounded-xl bg-gray-200">回到开始</button>
          </div>
        </div>
    

        <div className="mt-4 h-2 w-full rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full bg-indigo-500" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      <div id="hanoi-visual" ref={containerRef} className="relative bg-white rounded-2xl shadow p-6">
        <div className="grid grid-cols-3 gap-4 h-[360px]">
          {[0,1,2].map((peg, idx) => (
            <div key={peg} ref={pegRefs[idx]} className="relative rounded-xl bg-gradient-to-b from-gray-50 to-gray-100 border flex items-end justify-center p-3">
              <div className="absolute bottom-3 h-3/4 w-1.5 bg-gray-400 rounded-full" />
              <div className="absolute bottom-0 left-0 right-0 h-2 bg-gray-300 rounded-b-xl" />

              <div className="w-full flex flex-col items-center gap-1 pb-2">
                <AnimatePresence initial={false}>
                  {pegs[peg].slice().reverse().map((size) => (
                    <motion.div 
                      key={`${peg}-${size}`} 
                      layout initial={{ opacity:0, y:10 }} 
                      animate={{ opacity:1, y:0 }} 
                      exit={{ opacity:0 }} 
                      transition={{ type:'spring', stiffness:400, damping:30 }} 
                      className="h-6 rounded-full shadow-sm flex items-center justify-center text-xs font-medium text-white" 
                      style={{
                         width: `${diskWidth(size,n)}px`, 
                         background: GlobalState.diskColors[size] || "#888" // 默认灰色
                  }}>{size}</motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <div className="absolute top-2 left-2 text-xs text-gray-500">{pegLabel(peg,gs)}</div>
            </div>
          ))}
        </div>

        {/* SVG arrow layer: uses absolute coordinates relative to containerRef */}
        {gs.showArrow && currentMove && (
          <svg className="absolute inset-0 pointer-events-none">
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L9,4 L0,8 z" fill={gs.arrowColor} />
              </marker>
            </defs>
            {(() => {
              const p1 = pegPosSafe(pegPos, 0, currentMove ? currentMove.from : 0);
              const p2 = pegPosSafe(pegPos, 1, currentMove ? currentMove.to : 2);
              const d = buildSvgPath(p1, p2);
              return <path d={d} stroke={gs.arrowColor} strokeWidth={gs.arrowWidth} fill="none" strokeLinecap="round" markerEnd="url(#arrowhead)" />;
            })()}
          </svg>
        )}
      </div>

      <MoveList />
    </div>
  );
}

// helper: peg positions array might be empty at first; provide safe fallback
function pegPosSafe(pegPos: Point[], fallbackIndex: number, idx: number): Point {
  if (!pegPos || !pegPos[idx] || typeof pegPos[idx].x !== 'number') 
    return { x: (fallbackIndex+1)*100, y: 40 };
  return pegPos[idx];
}

function buildSvgPath(p1: Point, p2: Point) {
  // ensure numbers
  const x1 = Math.round(p1.x);
  const y1 = Math.round(p1.y + 8); // a little below top
  const x2 = Math.round(p2.x);
  const y2 = Math.round(p2.y + 8);
  const mx = Math.round((x1 + x2) / 2);
  // calculate a control point above the pegs to make an arch
  let controlY = Math.min(y1, y2) - Math.abs(x2 - x1) * 0.35 - 20;
  // --- IMPORTANT FIX ---
  // Prevent the control point from going above the visible area of the visual container
  // (this caused the curve to extend under the header / buttons). Clamp it to a small
  // top margin so the curve stays inside the visual box.
  const MIN_TOP_MARGIN = 12; // px from top of container
  if (controlY < MIN_TOP_MARGIN) controlY = MIN_TOP_MARGIN;
  return `M ${x1} ${y1} Q ${mx} ${Math.round(controlY)} ${x2} ${y2}`;
}

function diskWidth(size:number, n:number) {
  const minW = 40; const maxW = 180; if (n <= 1) return maxW; return minW + ((size - 1) * (maxW - minW)) / (n - 1);
}

function pegLabel(i: number, gs: typeof GlobalState): string  { 
  return gs.pegNames[i] || ["左", "中", "右"][i];

}

// --------- MoveList ---------
function MoveList() {
  const gs = useGlobal();
  const { moves } = gs;
  const stepIndex = gs.stepIndex;

  if (!moves || moves.length === 0) {
    return <div className="bg-white rounded-2xl shadow p-5 text-sm text-gray-600">当前层数较大或尚未生成步骤。将层数设置为不超过 12，并点击“生成/更新”即可查看完整步骤表。</div>;
  }

  // 新增复制函数
  const copyAllSteps = () => {
    const text = moves.map((m, i) => `${i + 1}. ${pegLabel(m.from, gs)} -> ${pegLabel(m.to, gs)}`).join('\n');
    navigator.clipboard.writeText(text)
      .then(() => {
        alert('步骤已复制到剪贴板！');
      })
      .catch(() => {
        alert('复制失败，请手动复制。');
      });
  };

  return (
    <div className="bg-white rounded-2xl shadow p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">步骤列表（最优解）</h3>
        <div className="text-xs text-gray-500">点击任意行可跳转到该步</div>
        <button onClick={copyAllSteps} className="text-xs px-2 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600">
            一键复制
          </button>
      </div>
      <div className="mt-3 max-h-72 overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50">
            <tr className="text-left"><th className="px-3 py-2 w-20">#</th><th className="px-3 py-2">从</th><th className="px-3 py-2">到</th></tr>
          </thead>
          <tbody>
            {moves.map((m, i) => (
              <tr key={i} className={`border-t cursor-pointer ${i < stepIndex ? 'bg-emerald-50/50' : i === stepIndex ? 'bg-indigo-50' : 'hover:bg-gray-50'}`} onClick={() => { GlobalState.setPlaying(false); GlobalState.setStepIndex(i+1); }}>
                <td className="px-3 py-2 tabular-nums">{i+1}</td>
                <td className="px-3 py-2">{pegLabel(m.from,gs)}</td>
                <td className="px-3 py-2">{pegLabel(m.to,gs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------- light tests ----------------------
(function runLightTests(){
  try {
    console.assert(minMovesBigInt(1).toString()==='1');
    console.assert(minMovesBigInt(2).toString()==='3');
    const mv: Move[] = [];
    generateMoves(3,0,2,1,mv);
    const s0 = getStateAfterKMoves(3,mv,0,0);
    console.assert(s0[0].length===3 && s0[1].length===0 && s0[2].length===0, '初始应在 A');
    // B->C
    const mv2: Move[] = generateMovesAuto(2,1,2);
    const snaps = computeSnapshots(2,mv2,1);
    console.assert(snaps.length === mv2.length + 1, '快照数量应比 moves 多 1');
  } catch(e) { console.warn('test fail', e); }
})();
