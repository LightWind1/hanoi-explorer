import { useEffect, useState } from "react";

import type { Move, Snapshot } from "./state/Types";


// --------- Global state (simple event bus) ----------
export const GlobalState = {
  n: 4,
  setN(n: number) { this.n = n; emit(); },

  moves: [] as Move[],
  setMoves(m: Move[]) { this.moves = m; emit(); },

  snapshots: [] as Snapshot[], // 每一步的快照（包含 step-0）
  setSnapshots(s: Snapshot[]) { this.snapshots = s;console.log(s); emit(); },

  stepIndex: 0,
  setStepIndex(i: number) { this.stepIndex = i; emit(); },

  diskColors: {} as DiskColors, // 初始化为空
  initDiskColors(n: number = 4) {
    const defaultColors = ["#ffff00", "#0000ff", "#00ff00", "#ff0000"];
    const colors: Record<number, string> = {};
    for (let i = 1; i <= n; i++) {
      colors[i] = defaultColors[(i - 1) % defaultColors.length];
    }
    this.diskColors = colors;
    emit();
  },
  setDiskColors(colors: DiskColors) {
    this.diskColors = colors;
    emit();
  },
 
  pegNames: ["左", "中", "右"], // 默认名称

  startPeg: 0,
  middlePeg: 1,
  endPeg: 2,
  setStartPeg(start: number) {
    const oldStart = this.startPeg;
    const oldEnd = this.endPeg;
    console.log("oldEnd:"+this.endPeg)
    if (start === oldEnd) {
      // 自动互换
      console.log("触发自动互换")
      this.startPeg = oldEnd;
      this.endPeg = oldStart;
    } else {
      this.startPeg = start;
    }
    console.log("NewStart:"+this.startPeg)
    console.log("NewEnd:"+this.endPeg)
    emit(); // 确保组件渲染拿到最新值
  },
  
  setMiddlePeg(p: number) { this.middlePeg = p; emit(); },
  
  setEndPeg(end: number) {
    const oldStart = this.startPeg
    const oldEnd = this.endPeg;
    if (end === this.startPeg) {
      // 自动互换
      console.log("触发自动互换")
      this.endPeg = oldStart;
      this.startPeg = oldEnd;
    } else {
      this.endPeg = end;
    }
    emit();
  },

  
  playing: false,
  setPlaying(p: boolean) { this.playing = p; emit(); },
  baseMs: 600, // base ms per step at 1x
  setBaseMs(ms: number) { this.baseMs = ms; emit(); },
  speedMultiplier: 1,
  setSpeedMultiplier(m: number) { this.speedMultiplier = m; emit(); },


  showArrow: true,
  setShowArrow(b: boolean) { this.showArrow = b; emit(); },
  arrowColor: "#ff0000",
  setArrowColor(c: string) { this.arrowColor = c; emit(); },
  arrowWidth: 2,
  setArrowWidth(w: number) { this.arrowWidth = w; emit(); },
  setPegNames(names: string[]) {this.pegNames = names; emit(); },

};

const listeners = new Set<() => void>();
function emit() { listeners.forEach((fn) => fn()); }

export function useGlobal () {
  const [, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick((v) => v + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); }; // 用 {} 包裹，返回 void
  }, []);
  return GlobalState;
};

export default GlobalState;
