export type Move = { from: number; to: number };
export type DiskColors = Record<number, string>;
export type Peg = number[];
export type Snapshot = Peg[];
export type Point = { x: number; y: number };