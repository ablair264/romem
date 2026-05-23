"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Database,
  Brain,
  AlertTriangle,
  Code,
  BookOpen,
  Server,
  Cog,
  Wrench,
  Layers,
  GitBranch,
  Bot,
  Zap,
  Eye,
  ChevronRight,
} from "lucide-react";
import type { MemoryEntry } from "../shared/schema";

type RawNode = {
  id: string;
  label: string;
  norm: string;
  count: number;
  recency: number;
  isHot: boolean;
  isDuplicate: boolean;
  duplicateGroup: string[];
};

type SimNode = RawNode & {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
};

type Edge = {
  source: string;
  target: string;
  weight: number;
  isConflict: boolean;
};

function normalizeCategory(name: string): string {
  return name
    .toLowerCase()
    .replace(/[()[\]{}]/g, "")
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function iconForCategory(label: string) {
  const l = label.toLowerCase();
  if (l.includes("database") || l.includes("storage") || l.includes("schema")) return Database;
  if (l.includes("architecture") || l.includes("design")) return Layers;
  if (l.includes("provider") || l.includes("auth")) return Cog;
  if (l.includes("worker") || l.includes("loop")) return GitBranch;
  if (l.includes("trigger") || l.includes("method")) return Code;
  if (l.includes("backend") || l.includes("responsibilit") || l.includes("api")) return Server;
  if (l.includes("driver") || l.includes("version")) return Wrench;
  if (l.includes("frontend") || l.includes("ui")) return BookOpen;
  if (l.includes("validation") || l.includes("rule")) return AlertTriangle;
  if (l.includes("skill") || l.includes("agent")) return Bot;
  return Brain;
}

function nodeRadius(count: number, isHot: boolean): number {
  const base = 22 + Math.min(count, 12) * 3;
  return isHot ? base + 6 : base;
}

export function BrainMap({
  categories,
  memories,
  onSelectCategory,
  onMergeDuplicates,
}: {
  categories: string[];
  memories: MemoryEntry[];
  onSelectCategory: (category: string) => void;
  onMergeDuplicates?: (group: string[]) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 1200, h: 720 });
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [simNodes, setSimNodes] = useState<SimNode[]>([]);
  const [tick, setTick] = useState(0);

  const rawNodes = useMemo<RawNode[]>(() => {
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const dayMs = 24 * 60 * 60 * 1000;

    const byNorm = new Map<string, string[]>();
    for (const cat of categories) {
      const norm = normalizeCategory(cat);
      if (!byNorm.has(norm)) byNorm.set(norm, []);
      byNorm.get(norm)!.push(cat);
    }

    return categories.map((cat) => {
      const memsInCat = memories.filter((m) => m.category === cat);
      const latestUpdate = memsInCat.reduce(
        (max, m) => Math.max(max, new Date(m.updatedAt).getTime()),
        0,
      );
      const norm = normalizeCategory(cat);
      const group = byNorm.get(norm) ?? [cat];
      return {
        id: cat,
        label: cat,
        norm,
        count: memsInCat.length,
        recency: latestUpdate ? Math.max(0, 1 - (now - latestUpdate) / weekMs) : 0,
        isHot: latestUpdate > 0 && now - latestUpdate < dayMs,
        isDuplicate: group.length > 1,
        duplicateGroup: group,
      };
    });
  }, [categories, memories]);

  const tagEdges = useMemo<Edge[]>(() => {
    const tagToCats = new Map<string, Set<string>>();
    for (const mem of memories) {
      for (const tag of mem.tags ?? []) {
        if (!tagToCats.has(tag)) tagToCats.set(tag, new Set());
        tagToCats.get(tag)!.add(mem.category);
      }
    }
    const edgeMap = new Map<string, number>();
    for (const cats of tagToCats.values()) {
      const arr = Array.from(cats);
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const a = arr[i]!;
          const b = arr[j]!;
          const key = a < b ? `${a}|${b}` : `${b}|${a}`;
          edgeMap.set(key, (edgeMap.get(key) ?? 0) + 1);
        }
      }
    }
    return Array.from(edgeMap.entries()).map(([key, weight]) => {
      const [source, target] = key.split("|") as [string, string];
      return { source, target, weight, isConflict: false };
    });
  }, [memories]);

  const conflictEdges = useMemo<Edge[]>(() => {
    const byNorm = new Map<string, string[]>();
    for (const n of rawNodes) {
      if (!byNorm.has(n.norm)) byNorm.set(n.norm, []);
      byNorm.get(n.norm)!.push(n.id);
    }
    const edges: Edge[] = [];
    for (const ids of byNorm.values()) {
      if (ids.length < 2) continue;
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          edges.push({ source: ids[i]!, target: ids[j]!, weight: 1, isConflict: true });
        }
      }
    }
    return edges;
  }, [rawNodes]);

  const allEdges = useMemo(() => [...tagEdges, ...conflictEdges], [tagEdges, conflictEdges]);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setDims({ w: Math.max(720, width), h: Math.max(520, height) });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (rawNodes.length === 0) {
      setSimNodes([]);
      return;
    }
    const cx = dims.w / 2;
    const cy = dims.h / 2;
    const r0 = Math.min(dims.w, dims.h) / 3.2;

    const init: SimNode[] = rawNodes.map((n, i) => {
      const angle = (i / Math.max(rawNodes.length, 1)) * Math.PI * 2;
      const jitter = 40 * (Math.sin(i * 13.37) + 1);
      return {
        ...n,
        x: cx + Math.cos(angle) * (r0 + jitter),
        y: cy + Math.sin(angle) * (r0 + jitter),
        vx: 0,
        vy: 0,
        r: nodeRadius(n.count, n.isHot),
      };
    });

    const iterations = 220;
    const repulsion = 32000;
    const edgeAttraction = 0.012;
    const damping = 0.82;
    const centerGravity = 0.003;

    for (let iter = 0; iter < iterations; iter++) {
      for (let i = 0; i < init.length; i++) {
        for (let j = i + 1; j < init.length; j++) {
          const a = init[i]!;
          const b = init[j]!;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist2 = dx * dx + dy * dy + 0.1;
          const dist = Math.sqrt(dist2);
          const force = repulsion / dist2;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx -= fx;
          a.vy -= fy;
          b.vx += fx;
          b.vy += fy;
        }
      }

      for (const e of allEdges) {
        const a = init.find((n) => n.id === e.source);
        const b = init.find((n) => n.id === e.target);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) + 0.1;
        const targetDist = e.isConflict ? 140 : 200;
        const stretch = (dist - targetDist) * edgeAttraction;
        a.vx += (dx / dist) * stretch;
        a.vy += (dy / dist) * stretch;
        b.vx -= (dx / dist) * stretch;
        b.vy -= (dy / dist) * stretch;
      }

      for (const n of init) {
        n.vx += (cx - n.x) * centerGravity;
        n.vy += (cy - n.y) * centerGravity;
        n.vx *= damping;
        n.vy *= damping;
        n.x += n.vx;
        n.y += n.vy;
        const m = 90;
        n.x = Math.max(m, Math.min(dims.w - m, n.x));
        n.y = Math.max(m, Math.min(dims.h - m, n.y));
      }
    }

    setSimNodes(init);
  }, [rawNodes, allEdges, dims.w, dims.h]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      setTick((x) => x + dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const nodeById = useMemo(() => {
    const m = new Map<string, SimNode>();
    for (const n of simNodes) m.set(n.id, n);
    return m;
  }, [simNodes]);

  const hotCount = rawNodes.filter((n) => n.isHot).length;
  const dupGroups = new Set(rawNodes.filter((n) => n.isDuplicate).map((n) => n.norm)).size;

  const focusedNode = focusId ? nodeById.get(focusId) : null;

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden rounded-[10px] border border-[rgba(255,255,255,0.06)]"
      style={{
        background:
          "radial-gradient(ellipse at 20% 30%, #1c1240 0%, transparent 55%)," +
          "radial-gradient(ellipse at 80% 70%, #0a1d3a 0%, transparent 55%)," +
          "linear-gradient(140deg, #07091a 0%, #0d0a25 100%)",
      }}
    >
      {/* Substrate grid */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.18]" aria-hidden>
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(120,150,255,0.18)" strokeWidth="0.5" />
          </pattern>
          <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(110,210,230,0.22)" />
            <stop offset="100%" stopColor="rgba(110,210,230,0)" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        <circle cx="50%" cy="50%" r="40%" fill="url(#centerGlow)" />
      </svg>

      {/* Concentric guide rings */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
        {[0.18, 0.3, 0.42].map((rf, i) => (
          <circle
            key={i}
            cx={dims.w / 2}
            cy={dims.h / 2}
            r={Math.min(dims.w, dims.h) * rf}
            fill="none"
            stroke="rgba(110,180,230,0.08)"
            strokeWidth="1"
            strokeDasharray="2 6"
          />
        ))}
      </svg>

      {/* Edges */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
        {allEdges.map((e, i) => {
          const a = nodeById.get(e.source);
          const b = nodeById.get(e.target);
          if (!a || !b) return null;
          const isHighlighted =
            hoverId === e.source || hoverId === e.target || focusId === e.source || focusId === e.target;
          const baseOpacity = e.isConflict ? 0.55 : 0.22 + Math.min(e.weight, 5) * 0.05;
          const opacity = isHighlighted ? Math.min(1, baseOpacity + 0.35) : baseOpacity;
          const stroke = e.isConflict ? "#ff5677" : "#5ee0f0";
          const dash = e.isConflict ? "6 6" : "3 8";

          return (
            <g key={`${e.source}-${e.target}-${i}`} style={{ opacity }}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={stroke}
                strokeWidth={e.isConflict ? 1.5 : 1}
                strokeDasharray={dash}
                strokeDashoffset={-tick * (e.isConflict ? 12 : 24)}
              />
              {e.isConflict && (
                <circle
                  cx={(a.x + b.x) / 2}
                  cy={(a.y + b.y) / 2}
                  r={4}
                  fill="#ff5677"
                  opacity={0.6 + Math.sin(tick * 3) * 0.4}
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Nodes */}
      {simNodes.map((node) => {
        const Icon = iconForCategory(node.label);
        const isHover = hoverId === node.id;
        const isFocused = focusId === node.id;
        const isDuplicate = node.isDuplicate;

        return (
          <div
            key={node.id}
            className="absolute"
            style={{
              left: node.x - node.r,
              top: node.y - node.r,
              width: node.r * 2,
              height: node.r * 2,
            }}
          >
            {/* Sonar pulse rings for hot nodes */}
            {node.isHot && (
              <>
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute inset-0 rounded-full border pointer-events-none"
                    style={{ borderColor: isDuplicate ? "rgba(255,86,119,0.5)" : "rgba(94,224,240,0.5)" }}
                    initial={{ scale: 1, opacity: 0.6 }}
                    animate={{ scale: 2.4, opacity: 0 }}
                    transition={{
                      duration: 2.8,
                      repeat: Infinity,
                      delay: i * 0.93,
                      ease: "easeOut",
                    }}
                  />
                ))}
              </>
            )}

            {/* Outer glow ring */}
            <motion.div
              className="absolute inset-0 rounded-full"
              animate={{
                boxShadow: isHover || isFocused
                  ? isDuplicate
                    ? "0 0 40px rgba(255,86,119,0.6), inset 0 0 20px rgba(255,86,119,0.15)"
                    : "0 0 40px rgba(94,224,240,0.6), inset 0 0 20px rgba(94,224,240,0.15)"
                  : node.isHot
                  ? "0 0 20px rgba(94,224,240,0.4)"
                  : "0 0 8px rgba(94,224,240,0.15)",
              }}
              transition={{ duration: 0.25 }}
            />

            {/* Concentric outer ring (decorative) */}
            <div
              className="absolute inset-[-12px] rounded-full pointer-events-none"
              style={{
                border: `1px solid ${
                  isDuplicate ? "rgba(255,86,119,0.25)" : "rgba(94,224,240,0.18)"
                }`,
              }}
            />

            <motion.button
              type="button"
              onMouseEnter={() => setHoverId(node.id)}
              onMouseLeave={() => setHoverId((v) => (v === node.id ? null : v))}
              onClick={() => setFocusId((v) => (v === node.id ? null : node.id))}
              onDoubleClick={() => onSelectCategory(node.label)}
              className="absolute inset-0 rounded-full flex items-center justify-center cursor-pointer group"
              style={{
                background: isDuplicate
                  ? "radial-gradient(circle at 30% 30%, #2a0e1a, #1a0810 70%)"
                  : node.isHot
                  ? "radial-gradient(circle at 30% 30%, #103040, #0a1828 70%)"
                  : "radial-gradient(circle at 30% 30%, #0e1830, #07091a 70%)",
                border: `1.5px solid ${
                  isDuplicate
                    ? "rgba(255,86,119,0.7)"
                    : node.isHot
                    ? "rgba(94,224,240,0.85)"
                    : "rgba(120,160,220,0.35)"
                }`,
              }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.97 }}
            >
              <Icon
                size={node.r * 0.7}
                strokeWidth={1.6}
                style={{
                  color: isDuplicate
                    ? "#ff8aa0"
                    : node.isHot
                    ? "#7cebff"
                    : "#a8c4ec",
                }}
              />
              {node.count > 0 && (
                <div
                  className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 rounded-full flex items-center justify-center text-[10px] font-mono font-bold"
                  style={{
                    background: isDuplicate ? "#ff5677" : "#5ee0f0",
                    color: "#07091a",
                  }}
                >
                  {node.count}
                </div>
              )}
            </motion.button>

            {/* Label */}
            <div
              className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none"
              style={{ top: node.r * 2 + 10 }}
            >
              <div
                className="text-[11px] font-semibold tracking-wide"
                style={{
                  color: isHover || isFocused ? "#e8f4ff" : "#a8c4ec",
                  textShadow: "0 1px 8px rgba(0,0,0,0.9)",
                }}
              >
                {node.label.length > 22 ? node.label.slice(0, 20) + "…" : node.label}
              </div>
              {isDuplicate && (
                <div className="text-[9px] font-mono uppercase tracking-widest mt-0.5" style={{ color: "#ff8aa0" }}>
                  Duplicate ×{node.duplicateGroup.length}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Empty state */}
      {simNodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <Brain size={48} className="mx-auto mb-3 opacity-30" style={{ color: "#5ee0f0" }} />
            <div className="text-sm text-muted">No memories yet. Submit a task summary to populate the map.</div>
          </div>
        </div>
      )}

      {/* HUD: stats + legend */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-[6px] bg-[rgba(7,9,26,0.8)] border border-[rgba(94,224,240,0.2)] backdrop-blur-sm">
          <Zap size={12} style={{ color: "#5ee0f0" }} />
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#a8c4ec]">
            {simNodes.length} nodes · {hotCount} active · {dupGroups} conflicts
          </span>
        </div>
      </div>

      <div className="absolute bottom-4 right-4 flex flex-col gap-1.5 pointer-events-none">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-[#7a92b6]">
          <span className="inline-block w-3 h-[2px]" style={{ background: "#5ee0f0", borderRadius: 2 }} />
          shared tag
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-[#7a92b6]">
          <span className="inline-block w-3 h-[2px]" style={{ background: "#ff5677", borderRadius: 2 }} />
          duplicate
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-[#7a92b6]">
          <span className="inline-block w-2 h-2 rounded-full border" style={{ borderColor: "#5ee0f0" }} />
          recent (24h)
        </div>
      </div>

      {/* Focus panel — slides in when node clicked */}
      <AnimatePresence>
        {focusedNode && (
          <motion.div
            initial={{ x: 420, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 420, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="absolute top-0 right-0 bottom-0 w-[380px] z-20"
            style={{
              background: "linear-gradient(180deg, rgba(13,10,37,0.96), rgba(7,9,26,0.96))",
              borderLeft: "1px solid rgba(94,224,240,0.25)",
              boxShadow: "-20px 0 60px rgba(0,0,0,0.6)",
            }}
          >
            <div className="p-5 h-full overflow-y-auto">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-[#7a92b6]">Category</div>
                  <h3 className="text-lg font-bold tracking-tight text-[#e8f4ff] mt-0.5">
                    {focusedNode.label}
                  </h3>
                </div>
                <button
                  onClick={() => setFocusId(null)}
                  className="text-[#7a92b6] hover:text-[#e8f4ff] cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-5">
                <div className="rounded-[6px] p-2.5 border border-[rgba(94,224,240,0.15)] bg-[rgba(94,224,240,0.05)]">
                  <div className="text-[9px] font-mono uppercase tracking-widest text-[#7a92b6]">Facts</div>
                  <div className="text-lg font-bold text-[#7cebff]">{focusedNode.count}</div>
                </div>
                <div className="rounded-[6px] p-2.5 border border-[rgba(94,224,240,0.15)] bg-[rgba(94,224,240,0.05)]">
                  <div className="text-[9px] font-mono uppercase tracking-widest text-[#7a92b6]">Recency</div>
                  <div className="text-lg font-bold text-[#7cebff]">
                    {Math.round(focusedNode.recency * 100)}%
                  </div>
                </div>
                <div
                  className="rounded-[6px] p-2.5 border bg-[rgba(255,86,119,0.05)]"
                  style={{
                    borderColor: focusedNode.isDuplicate
                      ? "rgba(255,86,119,0.3)"
                      : "rgba(94,224,240,0.15)",
                  }}
                >
                  <div className="text-[9px] font-mono uppercase tracking-widest text-[#7a92b6]">Conflicts</div>
                  <div
                    className="text-lg font-bold"
                    style={{ color: focusedNode.isDuplicate ? "#ff8aa0" : "#7cebff" }}
                  >
                    {focusedNode.isDuplicate ? focusedNode.duplicateGroup.length - 1 : 0}
                  </div>
                </div>
              </div>

              {focusedNode.isDuplicate && (
                <div className="mb-5 rounded-[6px] p-3 border border-[rgba(255,86,119,0.3)] bg-[rgba(255,86,119,0.05)]">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={14} style={{ color: "#ff8aa0" }} />
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#ff8aa0]">
                      Duplicate group
                    </span>
                  </div>
                  <div className="space-y-1 mb-3">
                    {focusedNode.duplicateGroup.map((name) => (
                      <div key={name} className="text-xs text-[#e8f4ff] font-mono">
                        · {name}
                      </div>
                    ))}
                  </div>
                  {onMergeDuplicates && (
                    <button
                      onClick={() => onMergeDuplicates(focusedNode.duplicateGroup)}
                      className="w-full px-3 py-2 rounded-[5px] text-[11px] font-bold uppercase tracking-wider cursor-pointer"
                      style={{
                        background: "rgba(255,86,119,0.15)",
                        border: "1px solid rgba(255,86,119,0.5)",
                        color: "#ff8aa0",
                      }}
                    >
                      Merge into one
                    </button>
                  )}
                </div>
              )}

              <div className="space-y-2 mb-4">
                <div className="text-[10px] font-mono uppercase tracking-widest text-[#7a92b6]">
                  Facts in this category
                </div>
                {memories
                  .filter((m) => m.category === focusedNode.label)
                  .slice(0, 6)
                  .map((m) => (
                    <div
                      key={m.id}
                      className="rounded-[6px] p-2.5 bg-[rgba(94,224,240,0.04)] border border-[rgba(94,224,240,0.1)]"
                    >
                      <div className="text-[11px] text-[#d8e8ff] leading-relaxed">{m.fact}</div>
                    </div>
                  ))}
              </div>

              <button
                onClick={() => onSelectCategory(focusedNode.label)}
                className="w-full px-3 py-2.5 rounded-[6px] cursor-pointer flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider"
                style={{
                  background: "rgba(94,224,240,0.12)",
                  border: "1px solid rgba(94,224,240,0.4)",
                  color: "#7cebff",
                }}
              >
                <Eye size={12} />
                Open in Memories
                <ChevronRight size={12} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
