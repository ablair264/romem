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
  ChevronLeft,
  Tag,
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

type MemoryNode = {
  id: string;
  fact: string;
  short: string;
  tags: string[];
  updatedAt: string;
  x: number;
  y: number;
  r: number;
  recency: number;
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
  const [drillCategory, setDrillCategory] = useState<string | null>(null);
  const [drillOrigin, setDrillOrigin] = useState<{ x: number; y: number } | null>(null);
  const [hoverMemoryId, setHoverMemoryId] = useState<string | null>(null);
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

  // Force-directed layout for categories
  const simNodes = useMemo<SimNode[]>(() => {
    if (rawNodes.length === 0) return [];
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
    return init;
  }, [rawNodes, allEdges, dims.w, dims.h]);

  // Animation tick for edge dash flow ONLY — kept slow to avoid stress
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      setTick((t) => (t + 0.5) % 10000);
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

  // Level-1: memory nodes within drilled category
  const memoryNodes = useMemo<MemoryNode[]>(() => {
    if (!drillCategory) return [];
    const mems = memories.filter((m) => m.category === drillCategory);
    if (mems.length === 0) return [];
    const cx = dims.w / 2;
    const cy = dims.h / 2;
    const baseR = Math.min(dims.w, dims.h) / 4.5;
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;

    return mems.map((m, i) => {
      const angle = (i / mems.length) * Math.PI * 2 - Math.PI / 2;
      const ringR = baseR + (i % 2 === 0 ? 0 : 60);
      const updatedTime = new Date(m.updatedAt).getTime();
      const recency = Math.max(0, 1 - (now - updatedTime) / weekMs);
      return {
        id: m.id,
        fact: m.fact,
        short: m.fact.length > 40 ? m.fact.slice(0, 37) + "…" : m.fact,
        tags: m.tags ?? [],
        updatedAt: m.updatedAt,
        x: cx + Math.cos(angle) * ringR,
        y: cy + Math.sin(angle) * ringR,
        r: 28 + Math.min(m.fact.length / 40, 6) * 3,
        recency,
      };
    });
  }, [drillCategory, memories, dims.w, dims.h]);

  // Memory-level edges (shared tags between memories)
  const memoryEdges = useMemo(() => {
    if (!drillCategory) return [];
    const tagToMems = new Map<string, Set<string>>();
    for (const mn of memoryNodes) {
      for (const t of mn.tags) {
        if (!tagToMems.has(t)) tagToMems.set(t, new Set());
        tagToMems.get(t)!.add(mn.id);
      }
    }
    const edges: Array<{ source: string; target: string; weight: number }> = [];
    const seen = new Set<string>();
    for (const ids of tagToMems.values()) {
      const arr = Array.from(ids);
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const a = arr[i]!;
          const b = arr[j]!;
          const key = a < b ? `${a}|${b}` : `${b}|${a}`;
          if (seen.has(key)) continue;
          seen.add(key);
          edges.push({ source: a, target: b, weight: 1 });
        }
      }
    }
    return edges;
  }, [drillCategory, memoryNodes]);

  const memNodeById = useMemo(() => {
    const m = new Map<string, MemoryNode>();
    for (const n of memoryNodes) m.set(n.id, n);
    return m;
  }, [memoryNodes]);

  const focusedCatNode = drillCategory ? nodeById.get(drillCategory) : null;

  // Zoom transform: when drilling, scale the level-0 layer to feel like camera diving in
  const zoomFromX = drillOrigin?.x ?? dims.w / 2;
  const zoomFromY = drillOrigin?.y ?? dims.h / 2;

  const hotCount = rawNodes.filter((n) => n.isHot).length;
  const dupGroups = new Set(rawNodes.filter((n) => n.isDuplicate).map((n) => n.norm)).size;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden rounded-[10px] border border-[rgba(255,255,255,0.06)]"
      style={{
        background:
          "radial-gradient(ellipse at 20% 30%, #1c1240 0%, transparent 55%)," +
          "radial-gradient(ellipse at 80% 70%, #0a1d3a 0%, transparent 55%)," +
          "linear-gradient(140deg, #07091a 0%, #0d0a25 100%)",
      }}
    >
      {/* Keyframes for pulse rings — done via CSS so frame-by-frame setState doesn't restart anim */}
      <style>{`
        @keyframes brainmap-pulse {
          0%   { transform: scale(1);   opacity: 0.55; }
          80%  { opacity: 0; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        .bm-pulse {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          border: 1px solid;
          pointer-events: none;
          animation: brainmap-pulse 2.8s cubic-bezier(0.16,1,0.3,1) infinite;
          will-change: transform, opacity;
        }
        .bm-pulse-1 { animation-delay: 0s; }
        .bm-pulse-2 { animation-delay: 0.93s; }
        .bm-pulse-3 { animation-delay: 1.86s; }
        @keyframes brainmap-breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }
        .bm-breathe { animation: brainmap-breathe 4s ease-in-out infinite; }
      `}</style>

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

      {/* LEVEL 0: Categories */}
      <AnimatePresence>
        {!drillCategory && (
          <motion.div
            key="level-0"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{
              opacity: 0,
              scale: 4,
              transformOrigin: drillOrigin
                ? `${(drillOrigin.x / dims.w) * 100}% ${(drillOrigin.y / dims.h) * 100}%`
                : "50% 50%",
            }}
            transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
          >
            {/* Edges */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
              {allEdges.map((e, i) => {
                const a = nodeById.get(e.source);
                const b = nodeById.get(e.target);
                if (!a || !b) return null;
                const isHighlighted = hoverId === e.source || hoverId === e.target;
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
                      strokeDashoffset={-tick * (e.isConflict ? 4 : 6)}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Nodes */}
            {simNodes.map((node) => {
              const Icon = iconForCategory(node.label);
              const isHover = hoverId === node.id;
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
                  {/* Sonar pulses via CSS — no re-render flicker */}
                  {node.isHot && (
                    <>
                      <div
                        className="bm-pulse bm-pulse-1"
                        style={{ borderColor: isDuplicate ? "rgba(255,86,119,0.5)" : "rgba(94,224,240,0.5)" }}
                      />
                      <div
                        className="bm-pulse bm-pulse-2"
                        style={{ borderColor: isDuplicate ? "rgba(255,86,119,0.5)" : "rgba(94,224,240,0.5)" }}
                      />
                      <div
                        className="bm-pulse bm-pulse-3"
                        style={{ borderColor: isDuplicate ? "rgba(255,86,119,0.5)" : "rgba(94,224,240,0.5)" }}
                      />
                    </>
                  )}

                  {/* Concentric outer ring */}
                  <div
                    className="absolute inset-[-12px] rounded-full pointer-events-none"
                    style={{
                      border: `1px solid ${
                        isDuplicate ? "rgba(255,86,119,0.25)" : "rgba(94,224,240,0.18)"
                      }`,
                    }}
                  />

                  <button
                    type="button"
                    onMouseEnter={() => setHoverId(node.id)}
                    onMouseLeave={() => setHoverId((v) => (v === node.id ? null : v))}
                    onClick={() => {
                      setDrillOrigin({ x: node.x, y: node.y });
                      setDrillCategory(node.id);
                    }}
                    className="absolute inset-0 rounded-full flex items-center justify-center cursor-pointer bm-breathe transition-transform hover:scale-110"
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
                      boxShadow: isHover
                        ? isDuplicate
                          ? "0 0 40px rgba(255,86,119,0.5)"
                          : "0 0 40px rgba(94,224,240,0.5)"
                        : node.isHot
                        ? "0 0 18px rgba(94,224,240,0.35)"
                        : "0 0 8px rgba(94,224,240,0.12)",
                    }}
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
                  </button>

                  {/* Label */}
                  <div
                    className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none"
                    style={{ top: node.r * 2 + 10 }}
                  >
                    <div
                      className="text-[11px] font-semibold tracking-wide"
                      style={{
                        color: isHover ? "#e8f4ff" : "#a8c4ec",
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* LEVEL 1: Memory nodes within drilled category */}
      <AnimatePresence>
        {drillCategory && focusedCatNode && (
          <motion.div
            key="level-1"
            className="absolute inset-0"
            initial={{
              opacity: 0,
              scale: 0.2,
              transformOrigin: `${(zoomFromX / dims.w) * 100}% ${(zoomFromY / dims.h) * 100}%`,
            }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{
              opacity: 0,
              scale: 0.2,
              transformOrigin: `${(zoomFromX / dims.w) * 100}% ${(zoomFromY / dims.h) * 100}%`,
            }}
            transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
          >
            {/* Center anchor — the category node, scaled up */}
            <div
              className="absolute"
              style={{
                left: dims.w / 2 - 50,
                top: dims.h / 2 - 50,
                width: 100,
                height: 100,
              }}
            >
              <div className="bm-pulse bm-pulse-1" style={{ borderColor: "rgba(94,224,240,0.5)" }} />
              <div className="bm-pulse bm-pulse-2" style={{ borderColor: "rgba(94,224,240,0.5)" }} />
              <div className="bm-pulse bm-pulse-3" style={{ borderColor: "rgba(94,224,240,0.5)" }} />
              <div className="absolute inset-[-16px] rounded-full pointer-events-none" style={{ border: "1px solid rgba(94,224,240,0.25)" }} />
              <div
                className="absolute inset-0 rounded-full flex items-center justify-center bm-breathe"
                style={{
                  background: "radial-gradient(circle at 30% 30%, #103040, #0a1828 70%)",
                  border: "2px solid rgba(94,224,240,0.85)",
                  boxShadow: "0 0 60px rgba(94,224,240,0.45)",
                }}
              >
                {(() => {
                  const Icon = iconForCategory(focusedCatNode.label);
                  return <Icon size={48} strokeWidth={1.5} style={{ color: "#7cebff" }} />;
                })()}
              </div>
            </div>

            {/* Memory edges */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
              {memoryEdges.map((e, i) => {
                const a = memNodeById.get(e.source);
                const b = memNodeById.get(e.target);
                if (!a || !b) return null;
                const highlighted = hoverMemoryId === e.source || hoverMemoryId === e.target;
                return (
                  <line
                    key={i}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="#5ee0f0"
                    strokeWidth={1}
                    strokeDasharray="3 8"
                    strokeDashoffset={-tick * 6}
                    opacity={highlighted ? 0.55 : 0.22}
                  />
                );
              })}
              {/* Connectors from center to each memory */}
              {memoryNodes.map((mn) => (
                <line
                  key={`spoke-${mn.id}`}
                  x1={dims.w / 2}
                  y1={dims.h / 2}
                  x2={mn.x}
                  y2={mn.y}
                  stroke="#5ee0f0"
                  strokeWidth={0.7}
                  strokeDasharray="2 6"
                  strokeDashoffset={-tick * 4}
                  opacity={0.18}
                />
              ))}
            </svg>

            {/* Memory nodes */}
            {memoryNodes.map((mn) => {
              const isHover = hoverMemoryId === mn.id;
              const isHot = Date.now() - new Date(mn.updatedAt).getTime() < 24 * 60 * 60 * 1000;
              return (
                <div
                  key={mn.id}
                  className="absolute"
                  style={{
                    left: mn.x - mn.r,
                    top: mn.y - mn.r,
                    width: mn.r * 2,
                    height: mn.r * 2,
                  }}
                >
                  {isHot && (
                    <>
                      <div className="bm-pulse bm-pulse-1" style={{ borderColor: "rgba(157,124,240,0.5)" }} />
                      <div className="bm-pulse bm-pulse-2" style={{ borderColor: "rgba(157,124,240,0.5)" }} />
                    </>
                  )}
                  <div
                    className="absolute inset-[-10px] rounded-full pointer-events-none"
                    style={{ border: "1px solid rgba(157,124,240,0.2)" }}
                  />
                  <button
                    onMouseEnter={() => setHoverMemoryId(mn.id)}
                    onMouseLeave={() => setHoverMemoryId((v) => (v === mn.id ? null : v))}
                    onClick={() => onSelectCategory(drillCategory)}
                    className="absolute inset-0 rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-110"
                    style={{
                      background: "radial-gradient(circle at 30% 30%, #1a1340, #0d0a25 70%)",
                      border: `1.5px solid ${isHover ? "rgba(157,124,240,0.85)" : "rgba(157,124,240,0.45)"}`,
                      boxShadow: isHover
                        ? "0 0 30px rgba(157,124,240,0.5)"
                        : "0 0 12px rgba(157,124,240,0.18)",
                    }}
                  >
                    <Brain size={mn.r * 0.55} strokeWidth={1.6} style={{ color: isHover ? "#d4c1ff" : "#a8a0e8" }} />
                  </button>

                  {/* Tooltip-like label */}
                  <div
                    className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none"
                    style={{ top: mn.r * 2 + 8 }}
                  >
                    <div
                      className="text-[10px] font-medium"
                      style={{
                        color: isHover ? "#e8d8ff" : "#b8a8e0",
                        textShadow: "0 1px 8px rgba(0,0,0,0.9)",
                        maxWidth: 200,
                      }}
                    >
                      {mn.short}
                    </div>
                    {mn.tags.length > 0 && (
                      <div className="flex gap-1 justify-center mt-1 flex-wrap">
                        {mn.tags.slice(0, 2).map((t) => (
                          <span
                            key={t}
                            className="text-[8px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded-[3px]"
                            style={{
                              background: "rgba(157,124,240,0.1)",
                              border: "1px solid rgba(157,124,240,0.25)",
                              color: "#b8a8e0",
                            }}
                          >
                            <Tag size={7} className="inline mr-0.5" />
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Empty state inside drill */}
            {memoryNodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center" style={{ top: "60%" }}>
                <div className="text-sm text-muted text-center">
                  <Brain size={32} className="mx-auto mb-2 opacity-30" style={{ color: "#9d7cf0" }} />
                  Empty category — no memories yet.
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state — level 0 */}
      {simNodes.length === 0 && !drillCategory && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <Brain size={48} className="mx-auto mb-3 opacity-30" style={{ color: "#5ee0f0" }} />
            <div className="text-sm text-muted">No memories yet. Submit a task summary to populate the map.</div>
          </div>
        </div>
      )}

      {/* HUD: stats */}
      {!drillCategory && (
        <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-[6px] bg-[rgba(7,9,26,0.8)] border border-[rgba(94,224,240,0.2)] backdrop-blur-sm">
            <Zap size={12} style={{ color: "#5ee0f0" }} />
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#a8c4ec]">
              {simNodes.length} nodes · {hotCount} active · {dupGroups} conflicts
            </span>
          </div>
        </div>
      )}

      {/* Breadcrumb during drill */}
      <AnimatePresence>
        {drillCategory && (
          <motion.div
            initial={{ y: -16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -16, opacity: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="absolute top-4 left-4 flex items-center gap-2"
          >
            <button
              onClick={() => setDrillCategory(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[rgba(7,9,26,0.85)] border border-[rgba(94,224,240,0.3)] backdrop-blur-sm text-[10px] font-mono uppercase tracking-widest text-[#7cebff] hover:bg-[rgba(94,224,240,0.1)] cursor-pointer"
            >
              <ChevronLeft size={11} />
              Brain Map
            </button>
            <ChevronRight size={11} className="text-muted" />
            <div className="px-3 py-1.5 rounded-[6px] bg-[rgba(7,9,26,0.85)] border border-[rgba(157,124,240,0.35)] backdrop-blur-sm">
              <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "#d4c1ff" }}>
                {drillCategory}
              </span>
              <span className="text-[10px] font-mono text-muted ml-2">
                · {memoryNodes.length} {memoryNodes.length === 1 ? "fact" : "facts"}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      {!drillCategory && (
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
      )}

      {/* Hovered duplicate merge banner (level 0) */}
      <AnimatePresence>
        {!drillCategory && hoverId && (() => {
          const n = nodeById.get(hoverId);
          if (!n || !n.isDuplicate || !onMergeDuplicates) return null;
          return (
            <motion.div
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2.5 rounded-[7px] backdrop-blur-sm"
              style={{
                background: "rgba(26,8,16,0.92)",
                border: "1px solid rgba(255,86,119,0.5)",
              }}
            >
              <AlertTriangle size={14} style={{ color: "#ff8aa0" }} />
              <div className="text-[11px] text-[#ff8aa0]">
                <span className="font-bold">{n.duplicateGroup.length} duplicate categories</span>
                <span className="text-muted ml-2">{n.duplicateGroup.join(" · ")}</span>
              </div>
              <button
                onClick={() => onMergeDuplicates(n.duplicateGroup)}
                className="px-2.5 py-1 rounded-[5px] text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                style={{
                  background: "rgba(255,86,119,0.18)",
                  color: "#ff8aa0",
                  border: "1px solid rgba(255,86,119,0.5)",
                }}
              >
                Merge
              </button>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Open in Memories button while drilled */}
      <AnimatePresence>
        {drillCategory && memoryNodes.length > 0 && (
          <motion.button
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            onClick={() => onSelectCategory(drillCategory)}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 rounded-[7px] backdrop-blur-sm cursor-pointer"
            style={{
              background: "rgba(13,10,37,0.85)",
              border: "1px solid rgba(94,224,240,0.4)",
              color: "#7cebff",
            }}
          >
            <Eye size={12} />
            <span className="text-[11px] font-bold uppercase tracking-wider">Open in Memories</span>
            <ChevronRight size={12} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
