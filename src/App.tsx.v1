import React, { useMemo, useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

// 单文件 React 组件：Hanoi Explorer
// 功能：
// - 输入层数 n（默认为 3）
// - 展示最少步数（2^n - 1），用 BigInt 防止溢出
// - 生成最优解步骤（若 n <= 12，可生成/播放/单步执行；>12 仅显示步数，避免浏览器卡顿）
// - 可视化三根柱子与盘片移动，支持播放速度调节
// - 支持重置

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="px-6 py-8 border-b bg-white sticky top-0 z-10">
        <h1 className="text-3xl font-bold tracking-tight">汉诺塔 · 最快步骤演示</h1>
        <p className="text-sm text-gray-600 mt-2">输入层数，查看最少步数，并可在可视化面板中逐步/自动演示最优移动方案。</p>
      </header>
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

// —— 全局状态容器（极简，基于浏览器内存）——
// 为了简化单文件实现，这里用一个非常轻量的 event-bus + 全局存储。
const GlobalState = {
  n: 3,
  setN(n: number) {
    this.n = n;
    listeners.forEach((fn) => fn());
  },
  // 生成的最优步骤（仅当 n<=12 时存放实际步骤）
  moves: [] as Move[],
  setMoves(moves: Move[]) {
    this.moves = moves;
    listeners.forEach((fn) => fn());
  },
  playing: false,
  setPlaying(p: boolean) {
    this.playing = p;
    listeners.forEach((fn) => fn());
  },
  speedMs: 600,
  setSpeedMs(ms: number) {
    this.speedMs = ms;
    listeners.forEach((fn) => fn());
  },
  stepIndex: 0,
  setStepIndex(i: number) {
    this.stepIndex = i;
    listeners.forEach((fn) => fn());
  },
};

const listeners = new Set<() => void>();
const useGlobal = () => {
  const [, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick((v) => v + 1);
    listeners.add(fn);
    return () => void listeners.delete(fn);
  }, []);
  return GlobalState;
};

// —— 类型定义 ——
type Peg = 0 | 1 | 2; // A,B,C 分别用 0,1,2 表示
interface Move {
  from: Peg;
  to: Peg;
}

// —— 工具函数 ——
function bigintPow2(n: number): bigint {
  // 2^n using BigInt
  return 1n << BigInt(n);
}

function minMovesBigInt(n: number): bigint {
  if (n < 0) return 0n;
  return bigintPow2(n) - 1n;
}

function formatBigInt(n: bigint): string {
  const s = n.toString();
  // 千分位分隔
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function generateMoves(n: number, from: Peg, to: Peg, aux: Peg, acc: Move[]) {
  if (n <= 0) return;
  generateMoves(n - 1, from, aux, to, acc);
  acc.push({ from, to });
  generateMoves(n - 1, aux, to, from, acc);
}

// —— 控制面板 ——
function ControlPanel() {
  const gs = useGlobal();
  const [inputN, setInputN] = useState<number>(gs.n);

  const MIN_N = 1;
  const MAX_N_FOR_PLAY = 12; // 动画/列举上限，避免浏览器卡顿
  const MAX_N_HARD = 64; // 仅用于展示步数上限（BigInt 可承受，UI 也合理）

  const stepsStr = useMemo(() => formatBigInt(minMovesBigInt(inputN)), [inputN]);

  const canPlay = inputN <= MAX_N_FOR_PLAY;

  const applyN = () => {
    let n = Math.max(MIN_N, Math.min(MAX_N_HARD, Math.floor(inputN)));
    GlobalState.setN(n);
    GlobalState.setPlaying(false);
    GlobalState.setStepIndex(0);

    if (n <= MAX_N_FOR_PLAY) {
      const acc: Move[] = [];
      generateMoves(n, 0, 2, 1, acc); // A->C using B
      GlobalState.setMoves(acc);
    } else {
      GlobalState.setMoves([]); // 仅显示步数，不生成
    }
  };

  useEffect(() => {
    // 初始化一次
    applyN();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bg-white rounded-2xl shadow p-5 space-y-5">
      <div className="space-y-2">
        <label className="block text-sm font-medium">层数（n）</label>
        <input
          type="number"
          min={MIN_N}
          max={MAX_N_HARD}
          value={inputN}
          onChange={(e) => setInputN(Number(e.target.value))}
          className="w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring focus:ring-indigo-200"
        />
        <div className="text-xs text-gray-500">动画/列举上限：{MAX_N_FOR_PLAY} 层；超过该值将仅显示最少步数。</div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="text-gray-600">最少步数</div>
          <div className="text-2xl font-semibold mt-1">{stepsStr}</div>
          <div className="text-xs text-gray-500 mt-1">公式：2^n − 1</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="text-gray-600">是否可演示</div>
          <div className={`text-2xl font-semibold mt-1 ${canPlay ? "text-emerald-600" : "text-amber-600"}`}>
            {canPlay ? "可播放" : "仅显示步数"}
          </div>
          <div className="text-xs text-gray-500 mt-1">n ≤ {MAX_N_FOR_PLAY} 时提供完整步骤与动画</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={applyN}
          className="px-4 py-2 rounded-xl bg-indigo-600 text-white shadow hover:bg-indigo-500 active:scale-[0.98]"
        >
          生成/更新
        </button>
        <button
          onClick={() => {
            GlobalState.setPlaying(false);
            GlobalState.setStepIndex(0);
          }}
          className="px-4 py-2 rounded-xl bg-gray-200 text-gray-900 hover:bg-gray-300"
        >
          重置
        </button>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">播放速度（毫秒/步）</label>
        <input
          type="range"
          min={120}
          max={1200}
          step={60}
          value={gs.speedMs}
          onChange={(e) => GlobalState.setSpeedMs(Number(e.target.value))}
          className="w-full"
        />
        <div className="text-xs text-gray-500">当前：{gs.speedMs} ms/步（数值越小越快）</div>
      </div>

      <HowItWorks />
    </div>
  );
}

function HowItWorks() {
  return (
    <details className="rounded-xl bg-gray-50 p-4 text-sm">
      <summary className="cursor-pointer font-medium">原理说明（展开/收起）</summary>
      <div className="mt-2 leading-6 text-gray-600">
        汉诺塔的最优解使用递归：要把 n 层从 A 移到 C，先把 n-1 层从 A 移到 B，再把第 n 层从 A 移到 C，最后把 n-1 层从 B 移到 C。最少步数为 <code>2^n − 1</code>。
      </div>
    </details>
  );
}

// —— 可视化与播放 ——
function Visualizer() {
  const gs = useGlobal();
  const { n, moves, playing, speedMs, stepIndex } = gs;
  const MAX_N_FOR_PLAY = 12;

  // 初始化三根柱子的盘片（用数字表示半径/大小；0 最大，在视觉上更宽）
  const initialPegs = useMemo(() => {
    const pegA = Array.from({ length: n }, (_, i) => n - i); // n..1
    return [pegA, [], []] as number[][];
  }, [n]);

  // 根据 stepIndex 应用对应数量的 move，得到当前 pegs 状态
  const pegs = useMemo(() => {
    const state = initialPegs.map((p) => [...p]);
    for (let i = 0; i < Math.min(stepIndex, moves.length); i++) {
      const { from, to } = moves[i];
      const disk = state[from].pop();
      if (disk === undefined) continue;
      state[to].push(disk);
    }
    return state;
  }, [initialPegs, moves, stepIndex]);

  // 自动播放控制
  useEffect(() => {
    if (!playing) return;
    if (moves.length === 0) return; // n 太大时不播放
    if (stepIndex >= moves.length) {
      GlobalState.setPlaying(false);
      return;
    }
    const t = setTimeout(() => {
      GlobalState.setStepIndex(stepIndex + 1);
    }, speedMs);
    return () => clearTimeout(t);
  }, [playing, stepIndex, moves.length, speedMs]);

  const onPrev = () => {
    GlobalState.setPlaying(false);
    GlobalState.setStepIndex(Math.max(0, stepIndex - 1));
  };
  const onNext = () => {
    GlobalState.setPlaying(false);
    GlobalState.setStepIndex(Math.min(moves.length, stepIndex + 1));
  };
  const onTogglePlay = () => {
    if (moves.length === 0) return;
    if (stepIndex >= moves.length) GlobalState.setStepIndex(0);
    GlobalState.setPlaying(!playing);
  };

  // 盘片样式工具
  const diskWidth = (size: number) => {
    // size: 1..n；越大越宽
    const minW = 40; // px
    const maxW = 180; // px
    if (n <= 1) return maxW;
    const w = minW + ((size - 1) * (maxW - minW)) / (n - 1);
    return w;
  };

  const progress = moves.length ? Math.min(1, stepIndex / moves.length) : 0;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-gray-600">
            层数：<span className="font-medium text-gray-900">{n}</span>；
            最少步数：<span className="font-medium text-gray-900">{formatBigInt(minMovesBigInt(n))}</span>
            {moves.length > 0 && (
              <>
                <span className="mx-2">|</span>
                当前步：<span className="font-medium text-gray-900">{Math.min(stepIndex, moves.length)} / {moves.length}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={onPrev} className="px-3 py-2 rounded-xl bg-gray-200 hover:bg-gray-300">上一步</button>
            <button onClick={onTogglePlay} className={`px-4 py-2 rounded-xl ${moves.length ? (gs.playing ? "bg-rose-600 text-white hover:bg-rose-500" : "bg-emerald-600 text-white hover:bg-emerald-500") : "bg-gray-200 text-gray-500"}`}>
              {gs.playing ? "暂停" : "播放"}
            </button>
            <button onClick={onNext} className="px-3 py-2 rounded-xl bg-gray-200 hover:bg-gray-300">下一步</button>
            <button onClick={() => { GlobalState.setPlaying(false); GlobalState.setStepIndex(0); }} className="px-3 py-2 rounded-xl bg-gray-200 hover:bg-gray-300">回到开始</button>
          </div>
        </div>

        <div className="mt-4 h-2 w-full rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full bg-indigo-500" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-6">
        <div className="grid grid-cols-3 gap-4 h-[360px]">
          {[0, 1, 2].map((peg: Peg) => (
            <div key={peg} className="relative rounded-xl bg-gradient-to-b from-gray-50 to-gray-100 border flex items-end justify-center p-3">
              {/* 立柱 */}
              <div className="absolute bottom-3 h-3/4 w-1.5 bg-gray-400 rounded-full" />
              <div className="absolute bottom-0 left-0 right-0 h-2 bg-gray-300 rounded-b-xl" />

              {/* 盘片，从下到上渲染 */}
              <div className="w-full flex flex-col items-center gap-1 pb-2">
                <AnimatePresence initial={false}>
                  {pegs[peg]
                    .slice()
                    .reverse()
                    .map((size, idx) => (
                      <motion.div
                        key={`${peg}-${size}`}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        className="h-6 rounded-full shadow-sm flex items-center justify-center text-xs font-medium text-white"
                        style={{ width: diskWidth(size), background: `hsl(${(size * 37) % 360} 70% 50%)` }}
                        title={`盘 ${size}`}
                      >
                        {size}
                      </motion.div>
                    ))}
                </AnimatePresence>
              </div>

              {/* Peg 标签 */}
              <div className="absolute top-2 left-2 text-xs text-gray-500">{pegLabel(peg)}</div>
            </div>
          ))}
        </div>
      </div>

      <MoveList />
    </div>
  );
}

function pegLabel(p: Peg) {
  return p === 0 ? "A" : p === 1 ? "B" : "C";
}

function MoveList() {
  const gs = useGlobal();
  const { moves, stepIndex } = gs;

  if (moves.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow p-5 text-sm text-gray-600">
        当前层数较大或尚未生成步骤。将层数设置为不超过 12，并点击“生成/更新”即可查看完整步骤列表与动画演示。
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">步骤列表（最优解）</h3>
        <div className="text-xs text-gray-500">点击任意行可跳转到该步</div>
      </div>
      <div className="mt-3 max-h-72 overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50">
            <tr className="text-left">
              <th className="px-3 py-2 w-20">#</th>
              <th className="px-3 py-2">从</th>
              <th className="px-3 py-2">到</th>
            </tr>
          </thead>
          <tbody>
            {moves.map((m, i) => (
              <tr
                key={i}
                className={`border-t cursor-pointer ${i < stepIndex ? "bg-emerald-50/50" : i === stepIndex ? "bg-indigo-50" : "hover:bg-gray-50"}`}
                onClick={() => {
                  GlobalState.setPlaying(false);
                  GlobalState.setStepIndex(i + 1); // 跳到该步完成后
                }}
              >
                <td className="px-3 py-2 tabular-nums">{i + 1}</td>
                <td className="px-3 py-2">{pegLabel(m.from)}</td>
                <td className="px-3 py-2">{pegLabel(m.to)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
