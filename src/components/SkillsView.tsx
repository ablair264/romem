"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Sparkles, Plus, RefreshCw, FileCode } from "lucide-react";
import { api } from "../lib/api";
import type { SkillRecord } from "../shared/schema";

type Suggestion = { title: string; path: string; rationale: string };

export function SkillsView({
  skills,
  projectId,
  onPick,
}: {
  skills: SkillRecord[];
  projectId: string;
  onPick: (s: SkillRecord) => void;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  async function loadSuggestions() {
    setIsLoadingSuggestions(true);
    try {
      const res = await api.suggestSkills(projectId);
      setSuggestions(res.suggestions ?? []);
      setHasFetched(true);
    } catch (e) {
      setSuggestions([]);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }

  useEffect(() => {
    void loadSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return (
    <div className="space-y-6">
      {/* Ollama suggestion feed */}
      <div
        className="rounded-[8px] border overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, rgba(94,224,240,0.04) 0%, rgba(157,124,240,0.04) 100%)",
          borderColor: "rgba(94,224,240,0.18)",
        }}
      >
        <div className="px-5 py-3 flex items-center justify-between border-b" style={{ borderColor: "rgba(94,224,240,0.12)" }}>
          <div className="flex items-center gap-2">
            <Sparkles size={13} className="text-accent" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-accent">
              Ollama suggestions
            </span>
            {hasFetched && suggestions.length > 0 && (
              <span className="text-[10px] font-mono text-muted ml-1">
                {suggestions.length} new
              </span>
            )}
          </div>
          <button
            onClick={() => void loadSuggestions()}
            disabled={isLoadingSuggestions}
            className="text-[10px] font-mono uppercase tracking-widest text-muted hover:text-accent flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={10} className={isLoadingSuggestions ? "animate-spin" : ""} />
            {isLoadingSuggestions ? "Thinking…" : "Refresh"}
          </button>
        </div>

        <div className="p-4">
          {!hasFetched && (
            <div className="text-center py-6 text-muted text-xs">
              <Bot size={20} className="mx-auto opacity-30 mb-2" />
              Loading suggestions…
            </div>
          )}
          {hasFetched && suggestions.length === 0 && (
            <div className="text-center py-6 text-muted text-xs">
              No new skill suggestions. Add more memories to see patterns emerge.
            </div>
          )}
          {suggestions.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <AnimatePresence>
                {suggestions.map((s, i) => (
                  <motion.div
                    key={s.path}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-[7px] p-3.5 border bg-surface/40 hover:border-medium transition-all group"
                    style={{ borderColor: "rgba(94,224,240,0.18)" }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-bold text-primary leading-tight">{s.title}</div>
                        <div className="text-[10px] font-mono text-muted mt-0.5 truncate" title={s.path}>
                          {s.path}
                        </div>
                      </div>
                      <button
                        className="shrink-0 px-2 py-1 rounded-[5px] text-[10px] font-bold uppercase tracking-wider cursor-pointer flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: "rgba(94,224,240,0.15)", color: "#5fdbe7", border: "1px solid rgba(94,224,240,0.4)" }}
                        onClick={() => alert("Skill creation via proposal queue is pending implementation.")}
                      >
                        <Plus size={10} />
                        Create
                      </button>
                    </div>
                    <div className="text-[11px] text-secondary leading-relaxed">{s.rationale}</div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Existing skills grid */}
      <div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted mb-3">
          Installed skills · {skills.length}
        </div>
        {skills.length === 0 ? (
          <div className="rounded-[7px] border border-subtle bg-surface/40 py-12 text-center text-muted text-xs">
            <FileCode size={20} className="mx-auto opacity-30 mb-2" />
            No skills installed yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {skills.map((skill) => (
              <button
                key={skill.id}
                onClick={() => onPick(skill)}
                className="text-left bg-surface border border-subtle rounded-[7px] p-4 hover:border-medium hover:bg-surface-hover/30 transition-all flex items-start gap-3 cursor-pointer"
              >
                <div className="w-9 h-9 rounded-[7px] bg-accent-dim text-accent flex items-center justify-center shrink-0 border border-accent/20">
                  <Bot size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs text-primary truncate">{skill.title}</div>
                  <div className="text-[9px] text-muted font-mono truncate mt-1" title={skill.path}>
                    {skill.path}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
