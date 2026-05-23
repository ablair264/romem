"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Sparkles, Save, Undo2, FileText, Check, AlertCircle } from "lucide-react";
import type { AgentDocument } from "../shared/schema";

const AGENT_META: Record<string, { label: string; tone: string; accent: string }> = {
  "CLAUDE.md": { label: "Claude", tone: "amber", accent: "#e8b059" },
  "GEMINI.md": { label: "Gemini", tone: "violet", accent: "#9d7cf0" },
  "AGENTS.md": { label: "Generic", tone: "teal", accent: "#5ee0f0" },
  "CODEX.md": { label: "Codex", tone: "green", accent: "#5fd49a" },
};

export function AgentsView({
  documents,
  canonicalAgents,
  activeAgentTab,
  setActiveAgentTab,
  agentDraft,
  setAgentDraft,
  agentDraftDirty,
  isRegenerating,
  isSavingAgent,
  regenPreview,
  onRegenerate,
  onAcceptRegen,
  onDiscardRegen,
  onSave,
  onRevert,
}: {
  documents: AgentDocument[];
  canonicalAgents: string[];
  activeAgentTab: string;
  setActiveAgentTab: (t: string) => void;
  agentDraft: string;
  setAgentDraft: (v: string) => void;
  agentDraftDirty: boolean;
  isRegenerating: boolean;
  isSavingAgent: boolean;
  regenPreview: string | null;
  onRegenerate: () => void;
  onAcceptRegen: () => void;
  onDiscardRegen: () => void;
  onSave: () => void;
  onRevert: () => void;
}) {
  const docByName = useMemo(() => {
    const m = new Map<string, AgentDocument>();
    for (const d of documents) m.set(d.filename, d);
    return m;
  }, [documents]);

  const currentDoc = docByName.get(activeAgentTab);
  const meta = AGENT_META[activeAgentTab] ?? AGENT_META["AGENTS.md"]!;
  const wordCount = agentDraft.trim().split(/\s+/).filter(Boolean).length;
  const lineCount = agentDraft.split("\n").length;

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-subtle pb-3">
        {canonicalAgents.map((filename) => {
          const m = AGENT_META[filename] ?? AGENT_META["AGENTS.md"]!;
          const isActive = activeAgentTab === filename;
          const exists = docByName.has(filename);
          return (
            <button
              key={filename}
              onClick={() => setActiveAgentTab(filename)}
              className="relative px-4 py-2 rounded-[7px] text-xs font-semibold transition-all cursor-pointer flex items-center gap-2"
              style={{
                background: isActive ? `${m.accent}15` : "transparent",
                border: `1px solid ${isActive ? `${m.accent}55` : "rgba(255,255,255,0.08)"}`,
                color: isActive ? m.accent : exists ? "#a8c4ec" : "#4a5568",
              }}
            >
              <FileText size={12} />
              <span>{m.label}</span>
              <span className="text-[9px] font-mono opacity-60">{filename}</span>
              {!exists && (
                <span className="text-[8px] font-mono uppercase tracking-widest text-muted ml-1">empty</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted">Instruction file</div>
          <h3 className="text-base font-bold mt-0.5" style={{ color: meta.accent }}>
            {meta.label} <span className="text-secondary font-mono text-xs ml-2">{activeAgentTab}</span>
          </h3>
          {currentDoc && (
            <div className="text-[10px] font-mono text-muted mt-1">
              {lineCount} lines · {wordCount} words · updated {new Date(currentDoc.updatedAt).toLocaleDateString()}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="px-3.5 py-2 rounded-[7px] text-[11px] font-bold uppercase tracking-wider cursor-pointer flex items-center gap-2 disabled:opacity-50"
            style={{
              background: `${meta.accent}15`,
              border: `1px solid ${meta.accent}55`,
              color: meta.accent,
            }}
          >
            <Sparkles size={12} className={isRegenerating ? "animate-spin" : ""} />
            {isRegenerating ? "Regenerating…" : "Regenerate with Ollama"}
          </button>

          {agentDraftDirty && (
            <button
              onClick={onRevert}
              className="px-3 py-2 rounded-[7px] text-[11px] font-semibold cursor-pointer flex items-center gap-2 text-secondary hover:text-primary border border-subtle hover:border-medium"
            >
              <Undo2 size={11} />
              Revert
            </button>
          )}

          <button
            onClick={onSave}
            disabled={isSavingAgent || (!agentDraftDirty && !regenPreview)}
            className="px-3.5 py-2 rounded-[7px] text-[11px] font-bold uppercase tracking-wider cursor-pointer flex items-center gap-2 disabled:opacity-40"
            style={{
              background: "#5ab0b0",
              color: "#0c0f16",
            }}
          >
            <Save size={11} />
            {isSavingAgent ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* Regenerate preview banner */}
      {regenPreview && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[7px] p-3 border flex items-start gap-3"
          style={{ borderColor: `${meta.accent}55`, background: `${meta.accent}10` }}
        >
          <AlertCircle size={14} className="mt-0.5 shrink-0" style={{ color: meta.accent }} />
          <div className="flex-1">
            <div className="text-[11px] font-bold uppercase tracking-widest mb-0.5" style={{ color: meta.accent }}>
              Ollama proposed a rewrite
            </div>
            <div className="text-[11px] text-secondary">
              Review the preview below. Accept to use as new content (still needs Save), or discard to keep the current draft.
            </div>
          </div>
          <button
            onClick={onAcceptRegen}
            className="px-2.5 py-1 rounded-[5px] text-[10px] font-bold uppercase tracking-wider cursor-pointer flex items-center gap-1"
            style={{ background: meta.accent, color: "#0c0f16" }}
          >
            <Check size={10} />
            Accept
          </button>
          <button
            onClick={onDiscardRegen}
            className="px-2.5 py-1 rounded-[5px] text-[10px] font-bold uppercase tracking-wider cursor-pointer text-secondary hover:text-primary border border-subtle"
          >
            Discard
          </button>
        </motion.div>
      )}

      {/* Side-by-side: current draft + regen preview */}
      <div className={`grid gap-4 ${regenPreview ? "grid-cols-2" : "grid-cols-1"}`}>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted mb-2 flex items-center justify-between">
            <span>Current draft</span>
            {agentDraftDirty && (
              <span className="text-warning">● unsaved</span>
            )}
          </div>
          <textarea
            value={agentDraft}
            onChange={(e) => setAgentDraft(e.target.value)}
            spellCheck={false}
            className="w-full bg-input border border-subtle focus:border-accent rounded-[7px] p-4 text-[12px] font-mono text-primary focus:outline-none transition-colors resize-none leading-relaxed"
            style={{ minHeight: "calc(100vh - 22rem)" }}
            placeholder={`# ${meta.label} instructions\n\nWrite content here, or click "Regenerate with Ollama" to consolidate from project memories.`}
          />
        </div>

        {regenPreview && (
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted mb-2 flex items-center gap-2">
              <Sparkles size={11} style={{ color: meta.accent }} />
              <span style={{ color: meta.accent }}>Ollama proposal</span>
            </div>
            <pre
              className="w-full rounded-[7px] p-4 text-[12px] font-mono whitespace-pre-wrap overflow-auto leading-relaxed"
              style={{
                minHeight: "calc(100vh - 22rem)",
                maxHeight: "calc(100vh - 22rem)",
                background: `${meta.accent}05`,
                border: `1px solid ${meta.accent}30`,
                color: "#d8e8ff",
              }}
            >
              {regenPreview}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
