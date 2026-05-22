"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlarmClockCheck,
  Bot,
  BookText,
  ClipboardList,
  Database,
  FileDiff,
  FolderKanban,
  Inbox,
  Sparkles,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Folder,
  FileCode,
  Check,
  Calendar,
  ExternalLink,
  Copy,
  ChevronRight,
  HelpCircle,
  FileText,
  Minimize2,
  FolderOpen,
  Trash,
  Eye
} from "lucide-react";
import { api } from "../lib/api";
import type { AgentDocument, MemoryEntry, ProjectOverview, Proposal, SkillRecord, TaskSummaryRecord, Todo } from "../shared/schema";

type ViewKey = "overview" | "memories" | "proposals" | "todos" | "documents" | "skills" | "activity";
type Inspectable = MemoryEntry | Proposal | Todo | AgentDocument | SkillRecord | TaskSummaryRecord | null;

const projectId = "romem";

const navItems: Array<{ key: ViewKey; label: string; icon: typeof FolderKanban }> = [
  { key: "overview", label: "Overview", icon: FolderKanban },
  { key: "memories", label: "Memories", icon: Database },
  { key: "proposals", label: "Proposals", icon: FileDiff },
  { key: "todos", label: "TODOs", icon: ClipboardList },
  { key: "documents", label: "Agent Files", icon: BookText },
  { key: "skills", label: "Skills", icon: Bot },
  { key: "activity", label: "Activity", icon: Inbox },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

// Bencium animation transitions
const microTransition = { duration: 0.15, ease: [0.16, 1, 0.3, 1] as const };
const structuralTransition = { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const };

const listVariant = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04 }
  }
} as const;

const itemVariant = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 350, damping: 26 } }
} as const;

export default function Page() {
  const [health, setHealth] = useState<{ hasOllama: boolean; runtime: string } | null>(null);
  const [overview, setOverview] = useState<ProjectOverview | null>(null);
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [documents, setDocuments] = useState<AgentDocument[]>([]);
  const [skills, setSkills] = useState<SkillRecord[]>([]);
  const [activity, setActivity] = useState<TaskSummaryRecord[]>([]);
  
  const [search, setSearch] = useState("");
  const [activeView, setActiveView] = useState<ViewKey>("overview");
  const [selected, setSelected] = useState<Inspectable>(null);
  const [busyProposalId, setBusyProposalId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Folder Navigation State
  const [activeCategoryFolder, setActiveCategoryFolder] = useState<string | null>(null);
  const [isAddFolderOpen, setIsAddFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Custom Controls State
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [sortBy, setSortBy] = useState<"date" | "alpha" | "category">("date");
  const [rejectReason, setRejectReason] = useState("");
  const [copiedFileId, setCopiedFileId] = useState<string | null>(null);

  // Context Menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: "folder" | "memory";
    targetId: string;
  } | null>(null);

  // Right-click context menu handlers
  const handleFolderContextMenu = (e: React.MouseEvent, categoryName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: "folder",
      targetId: categoryName,
    });
  };

  const handleMemoryContextMenu = (e: React.MouseEvent, memoryId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: "memory",
      targetId: memoryId,
    });
  };

  async function handleDeleteMemory(memoryId: string) {
    if (!confirm("Are you sure you want to delete this memory fact?")) return;
    try {
      await api.deleteMemory(projectId, memoryId);
      setMemories((prev) => prev.filter((m) => m.id !== memoryId));
      if (selected && "id" in selected && selected.id === memoryId) setSelected(null);
      const overviewData = await api.overview(projectId);
      setOverview(overviewData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete memory.");
    }
  }

  async function handleDeleteCategory(categoryName: string) {
    if (
      !confirm(
        `Are you sure you want to delete the folder "${categoryName}"? This will delete the category AND all memories associated with it!`
      )
    )
      return;
    try {
      await api.deleteCategory(projectId, categoryName);
      setMemories((prev) => prev.filter((m) => m.category.toLowerCase() !== categoryName.toLowerCase()));
      if (activeCategoryFolder?.toLowerCase() === categoryName.toLowerCase()) {
        setActiveCategoryFolder(null);
      }
      const overviewData = await api.overview(projectId);
      setOverview(overviewData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete category folder.");
    }
  }

  // Global click/right-click event to close context menu
  useEffect(() => {
    const handleCloseMenu = () => setContextMenu(null);
    window.addEventListener("click", handleCloseMenu);
    window.addEventListener("contextmenu", handleCloseMenu);
    return () => {
      window.removeEventListener("click", handleCloseMenu);
      window.removeEventListener("contextmenu", handleCloseMenu);
    };
  }, []);

  // Edit Memory states
  const [isEditingMemory, setIsEditingMemory] = useState(false);
  const [editMemoryFact, setEditMemoryFact] = useState("");
  const [editMemoryCategory, setEditMemoryCategory] = useState("");
  const [editMemoryTags, setEditMemoryTags] = useState("");

  // Edit Code states (for Agent Files and Skills)
  const [editCodeContent, setEditCodeContent] = useState("");
  const [isSavingCode, setIsSavingCode] = useState(false);

  // Edit Todo states
  const [isEditingTodo, setIsEditingTodo] = useState(false);
  const [editTodoTitle, setEditTodoTitle] = useState("");
  const [editTodoStatus, setEditTodoStatus] = useState<"open" | "done">("open");

  // Reset folder view when active tab changes
  useEffect(() => {
    setActiveCategoryFolder(null);
    setIsAddFolderOpen(false);
    setNewFolderName("");
  }, [activeView]);

  const categoriesList = useMemo(() => {
    const fromOverview = overview?.categories ?? [];
    const fromMemories = memories.map((m) => m.category);
    return Array.from(new Set([...fromOverview, ...fromMemories])).filter(Boolean).sort();
  }, [overview, memories]);

  async function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      await api.addCategory(projectId, newFolderName);
      setNewFolderName("");
      setIsAddFolderOpen(false);
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create folder");
    }
  }


  async function refreshAll() {
    setIsRefreshing(true);
    try {
      setError(null);
      const [healthData, overviewData, memoriesData, proposalsData, todosData, docsData, skillsData, activityData] = await Promise.all([
        api.health(),
        api.overview(projectId),
        api.memories(projectId),
        api.proposals(projectId),
        api.todos(projectId),
        api.agentFiles(projectId),
        api.skills(projectId),
        api.taskSummaries(projectId),
      ]);
      setHealth(healthData);
      setOverview(overviewData);
      setMemories(memoriesData);
      setProposals(proposalsData);
      setTodos(todosData);
      setDocuments(docsData);
      setSkills(skillsData);
      setActivity(activityData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Romem data.");
    } finally {
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    void refreshAll();
  }, []);

  // Keyboard shortcut CMD+F to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        const searchInput = document.getElementById("global-search");
        if (searchInput) {
          searchInput.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Global filters
  const needle = search.toLowerCase();

  const filteredMemories = useMemo(() => {
    return memories.filter((memory) => {
      if (activeCategoryFolder && memory.category.toLowerCase() !== activeCategoryFolder.toLowerCase()) return false;
      return !needle || `${memory.fact} ${memory.tags.join(" ")}`.toLowerCase().includes(needle);
    });
  }, [memories, needle, activeCategoryFolder]);


  const filteredProposals = useMemo(() => {
    return proposals.filter((p) => !needle || `${p.summary} ${p.rationale} ${p.status}`.toLowerCase().includes(needle));
  }, [proposals, needle]);

  const filteredTodos = useMemo(() => {
    return todos.filter((t) => !needle || `${t.title} ${t.status}`.toLowerCase().includes(needle));
  }, [todos, needle]);

  const filteredDocuments = useMemo(() => {
    return documents.filter((d) => !needle || `${d.filename} ${d.path}`.toLowerCase().includes(needle));
  }, [documents, needle]);

  const filteredSkills = useMemo(() => {
    return skills.filter((s) => !needle || `${s.title} ${s.path}`.toLowerCase().includes(needle));
  }, [skills, needle]);

  const filteredActivity = useMemo(() => {
    return activity.filter((a) => !needle || `${a.payload.summary} ${a.agent} ${a.status}`.toLowerCase().includes(needle));
  }, [activity, needle]);

  const pendingApprovals = useMemo(() => proposals.filter((proposal) => proposal.status === "staged"), [proposals]);

  // Sort memories
  const sortedMemories = useMemo(() => {
    const list = [...filteredMemories];
    if (sortBy === "alpha") {
      return list.sort((a, b) => a.fact.localeCompare(b.fact));
    } else if (sortBy === "category") {
      return list.sort((a, b) => a.category.localeCompare(b.category));
    } else {
      return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
  }, [filteredMemories, sortBy]);

  async function onApprove(proposalId: string) {
    setBusyProposalId(proposalId);
    try {
      await api.approveProposal(proposalId);
      await refreshAll();
      setSelected(null); // Close modal on success
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve proposal.");
    } finally {
      setBusyProposalId(null);
    }
  }

  async function onReject(proposalId: string, reason = "Rejected from Romem UI") {
    setBusyProposalId(proposalId);
    try {
      await api.rejectProposal(proposalId, reason);
      await refreshAll();
      setSelected(null); // Close modal on success
      setRejectReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject proposal.");
    } finally {
      setBusyProposalId(null);
    }
  }

  // Helper check methods for rendering different cards
  const isMemory = (item: Inspectable): item is MemoryEntry => !!item && "fact" in item;
  const isProposal = (item: Inspectable): item is Proposal => !!item && "operations" in item;
  const isTodo = (item: Inspectable): item is Todo => !!item && "status" in item && "title" in item;
  const isDocument = (item: Inspectable): item is AgentDocument => !!item && "filename" in item;
  const isSkill = (item: Inspectable): item is SkillRecord => !!item && "path" in item && "title" in item;
  const isActivity = (item: Inspectable): item is TaskSummaryRecord => !!item && "payload" in item;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFileId(id);
    setTimeout(() => setCopiedFileId(null), 2000);
  };

  // Synchronize edit buffer states when selecting an inspectable
  useEffect(() => {
    if (selected) {
      if (isMemory(selected)) {
        setEditMemoryFact(selected.fact);
        setEditMemoryCategory(selected.category);
        setEditMemoryTags(selected.tags.join(", "));
        setIsEditingMemory(false);
      } else if (isDocument(selected) || isSkill(selected)) {
        setEditCodeContent(selected.content);
      } else if (isTodo(selected)) {
        setEditTodoTitle(selected.title);
        setEditTodoStatus(selected.status);
        setIsEditingTodo(false);
      }
    }
  }, [selected]);

  // Keyboard shortcut CMD+S to save code editor changes
  useEffect(() => {
    const handleSaveShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        if (selected && (isDocument(selected) || isSkill(selected))) {
          e.preventDefault();
          void handleSaveCode();
        }
      }
    };
    window.addEventListener("keydown", handleSaveShortcut);
    return () => window.removeEventListener("keydown", handleSaveShortcut);
  }, [selected, editCodeContent]);

  async function handleSaveMemory() {
    if (!selected || !isMemory(selected)) return;
    if (!editMemoryFact.trim()) {
      setError("Memory fact cannot be empty.");
      return;
    }
    if (!editMemoryCategory.trim()) {
      setError("Category cannot be empty.");
      return;
    }
    try {
      setError(null);
      const parsedTags = editMemoryTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      
      const updated = await api.updateMemory(
        projectId,
        selected.id,
        editMemoryFact,
        editMemoryCategory.toLowerCase().trim(),
        parsedTags,
        selected.source
      );
      
      setMemories((prev) => prev.map((m) => (m.id === selected.id ? updated : m)));
      setSelected(updated);
      setIsEditingMemory(false);
      
      const overviewData = await api.overview(projectId);
      setOverview(overviewData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save memory changes.");
    }
  }

  async function handleSaveCode() {
    if (!selected) return;
    setIsSavingCode(true);
    setError(null);
    try {
      if (isDocument(selected)) {
        const updated = await api.updateAgentFile(projectId, selected.id, editCodeContent);
        setDocuments((prev) => prev.map((d) => (d.id === selected.id ? updated : d)));
        setSelected(updated);
      } else if (isSkill(selected)) {
        const updated = await api.updateSkill(projectId, selected.id, editCodeContent);
        setSkills((prev) => prev.map((s) => (s.id === selected.id ? updated : s)));
        setSelected(updated);
      }
      
      const overviewData = await api.overview(projectId);
      setOverview(overviewData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save file changes.");
    } finally {
      setIsSavingCode(false);
    }
  }

  async function handleSaveTodo() {
    if (!selected || !isTodo(selected)) return;
    if (!editTodoTitle.trim()) {
      setError("Todo title cannot be empty.");
      return;
    }
    try {
      setError(null);
      const updated = await api.updateTodo(
        projectId,
        selected.id,
        editTodoTitle,
        editTodoStatus
      );
      
      setTodos((prev) => prev.map((t) => (t.id === selected.id ? updated : t)));
      setSelected(updated);
      setIsEditingTodo(false);
      
      const overviewData = await api.overview(projectId);
      setOverview(overviewData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save todo changes.");
    }
  }

  const handleEditorScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    const lineNumbers = document.getElementById("line-numbers-container");
    if (lineNumbers) {
      lineNumbers.scrollTop = target.scrollTop;
    }
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;

      const newValue = editCodeContent.substring(0, start) + "  " + editCodeContent.substring(end);
      setEditCodeContent(newValue);

      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }
  };

  return (
    <div className="flex h-screen w-full bg-background text-primary overflow-hidden font-sans relative">
      
      {/* SIDEBAR */}
      <aside className="w-64 flex flex-col flex-shrink-0 bg-sidebar border-r border-subtle">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-[7px] bg-gradient-to-br from-accent to-emerald-500 flex items-center justify-center border border-accent/20">
            <span className="text-[#0c0f16] font-bold text-lg leading-none">R</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted">Mastra System</span>
            <h1 className="text-sm font-bold tracking-tight">Romem</h1>
          </div>
        </div>

        {/* Runtime Overview Card */}
        <div className="px-6 pb-4">
          <div className="bg-surface rounded-[7px] p-3.5 border border-subtle flex flex-col gap-2 shadow-inner">
            <div className="flex justify-between items-center text-xs">
              <span className="text-secondary font-medium">Runtime</span>
              <span className="font-mono text-accent text-[11px]">{health?.runtime ?? "..."}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-secondary font-medium">Organizer</span>
              <span className="font-mono text-accent text-[11px]">{health?.hasOllama ? "Ollama" : "Fallback"}</span>
            </div>
            <div className="flex justify-between items-center text-xs pt-2.5 border-t border-subtle/60">
              <span className="text-secondary font-medium">Pending Approvals</span>
              <span className={`font-mono font-bold text-xs ${pendingApprovals.length > 0 ? "text-warning" : "text-muted"}`}>
                {pendingApprovals.length}
              </span>
            </div>
          </div>
        </div>

        {/* Sidebar Tabs Switcher (Sliding Pill Indicator) */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.key;
            return (
              <div key={item.key} className="relative w-full">
                <AnimatePresence initial={false}>
                  {isActive && (
                    <motion.div
                      layoutId="activeNavBg"
                      className="absolute inset-0 bg-accent-dim border-l-2 border-accent rounded-[7px]"
                      transition={structuralTransition}
                    />
                  )}
                </AnimatePresence>
                
                <button
                  onClick={() => setActiveView(item.key)}
                  className={`w-full relative z-10 flex items-center gap-3 px-3 py-2.5 rounded-[7px] transition-all text-xs font-medium cursor-pointer
                    ${isActive ? "text-accent" : "text-secondary hover:text-primary hover:bg-surface-hover/40"}`}
                >
                  <Icon size={14} className={isActive ? "text-accent" : "text-muted"} />
                  {item.label}
                </button>
              </div>
            );
          })}
        </nav>

        <div className="p-4 mt-auto border-t border-subtle">
          <div className="text-[9px] uppercase tracking-wider text-muted font-bold mb-1">Active Workspace</div>
          <div className="text-xs font-medium text-secondary truncate">{overview?.name ?? "..."}</div>
          <div className="text-[10px] font-mono text-muted truncate mt-1" title={overview?.rootPath}>
            {overview?.rootPath ?? "..."}
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col min-w-0 bg-background relative z-10">
        
        {/* TOPBAR */}
        <header className="h-16 flex-shrink-0 flex items-center justify-between px-8 border-b border-subtle bg-background/80 backdrop-blur-md z-20">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted font-bold">Operations Console</div>
            <h2 className="text-sm font-bold tracking-tight text-gradient">
              {navItems.find((item) => item.key === activeView)?.label}
            </h2>
          </div>
          
          <div className="flex items-center gap-4">
            
            {/* Custom Search Container */}
            <div className="relative group">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-accent transition-colors" />
              <input 
                id="global-search"
                type="text" 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                placeholder={`Search ${activeView === "overview" ? "activities" : activeView}...`} 
                className="bg-input border border-subtle rounded-[7px] py-1.5 pl-9 pr-14 text-xs w-64 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent-dim/30 transition-all font-sans text-primary placeholder-muted"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-mono text-muted bg-surface-hover border border-subtle px-1.5 py-0.5 rounded leading-none pointer-events-none">
                ⌘F
              </span>
            </div>

            {/* Custom Sort Controls (Only visible on Memories view) */}
            {activeView === "memories" && (
              <div className="relative">
                <button 
                  onClick={() => setIsSortOpen(!isSortOpen)}
                  className="h-8 px-3 rounded-[7px] border border-subtle bg-input text-xs font-semibold text-secondary hover:text-primary hover:border-medium flex items-center gap-2.5 transition-all cursor-pointer"
                >
                  Sort: <span className="text-accent uppercase font-mono">{sortBy}</span>
                  <span className="text-muted text-[8px] transition-transform duration-200" style={{ transform: isSortOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
                </button>
                
                <AnimatePresence>
                  {isSortOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setIsSortOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        transition={microTransition}
                        className="absolute right-0 mt-1.5 w-40 bg-surface border border-medium rounded-[7px] shadow-xl z-40 overflow-hidden"
                      >
                        {(["date", "alpha", "category"] as const).map((opt) => (
                          <button
                            key={opt}
                            onClick={() => {
                              setSortBy(opt);
                              setIsSortOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 text-xs font-medium hover:bg-surface-hover/60 transition-colors cursor-pointer
                              ${sortBy === opt ? "text-accent bg-accent-dim border-l-2 border-accent" : "text-secondary border-l-2 border-transparent"}`}
                          >
                            {opt === "date" ? "Date Updated" : opt === "alpha" ? "Alphabetical" : "Category"}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}

            <button 
              onClick={() => void refreshAll()}
              disabled={isRefreshing}
              className="w-8 h-8 rounded-[7px] border border-subtle flex items-center justify-center text-secondary hover:text-primary hover:border-medium transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={13} className={isRefreshing ? "animate-spin text-accent" : ""} />
            </button>
          </div>
        </header>

        {/* CONTENT SCROLL AREA */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {error && (
            <div className="mb-6 p-4 bg-danger/10 border border-danger/25 rounded-[7px] text-danger text-xs flex items-start gap-3">
              <XCircle size={15} className="mt-0.5 shrink-0 text-danger" />
              <p className="font-medium">{error}</p>
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={structuralTransition}
              className="h-full"
            >
              
              {/* OVERVIEW */}
              {activeView === "overview" && overview && (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: "Memories", val: overview.stats.memories, icon: Database },
                      { label: "Proposals", val: overview.stats.proposals, icon: FileDiff },
                      { label: "TODOs", val: overview.stats.todos, icon: ClipboardList },
                      { label: "Agent Files", val: overview.stats.agentDocuments, icon: BookText },
                    ].map((stat, i) => {
                      const StatIcon = stat.icon;
                      return (
                        <motion.div 
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04, ease: "easeOut" }}
                          key={stat.label} 
                          className="bg-surface border border-subtle rounded-[7px] p-5 hover:border-medium transition-all group relative overflow-hidden"
                        >
                          <div className="absolute right-4 top-4 text-muted/20 group-hover:text-accent/10 transition-colors pointer-events-none">
                            <StatIcon size={40} />
                          </div>
                          <div className="text-[10px] text-muted font-bold uppercase tracking-widest mb-1.5">{stat.label}</div>
                          <div className="text-3xl font-bold font-mono text-primary leading-none">{stat.val}</div>
                        </motion.div>
                      );
                    })}
                  </div>

                  <div className="bg-surface border border-subtle rounded-[7px] overflow-hidden shadow-sm">
                    <div className="px-6 py-4.5 border-b border-subtle bg-surface-hover/30 flex justify-between items-center">
                      <h3 className="font-bold text-xs uppercase tracking-wider text-secondary">Recent Task Activity</h3>
                      <span className="text-[10px] text-muted font-mono bg-background border border-subtle px-2 py-0.5 rounded-[4px]">
                        {overview.recentTasks.length} operations
                      </span>
                    </div>
                    <div className="divide-y divide-subtle/60">
                      {overview.recentTasks.map((task) => (
                        <button 
                          key={task.id} 
                          onClick={() => setSelected(task)}
                          className="w-full text-left px-6 py-4.5 hover:bg-surface-hover/40 transition-colors flex justify-between items-center group cursor-pointer"
                        >
                          <div className="min-w-0 flex-1 pr-4">
                            <div className="font-medium text-xs text-primary group-hover:text-accent transition-colors truncate">{task.payload.summary}</div>
                            <div className="text-[10px] text-muted mt-1.5 font-mono flex gap-4 items-center">
                              <span className={`px-1.5 py-0.5 rounded-[4px] text-[9px] uppercase tracking-wider font-semibold border
                                ${task.agent === 'codex' ? 'bg-accent/10 text-accent border-accent/20' : 
                                  task.agent === 'claude' ? 'bg-warning/10 text-warning border-warning/20' : 
                                  'bg-success/10 text-success border-success/20'}`}
                              >
                                {task.agent}
                              </span>
                              <span className={`font-medium ${task.status === 'applied' ? 'text-success' : task.status === 'rejected' ? 'text-danger' : 'text-warning'}`}>
                                [{task.status}]
                              </span>
                            </div>
                          </div>
                          <div className="text-[10px] text-muted font-mono shrink-0">{formatDate(task.createdAt)}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* MEMORIES */}
              {activeView === "memories" && (
                <div className="space-y-6">
                  {activeCategoryFolder === null ? (
                    <div>
                      {/* Sub-header / instructions */}
                      <div className="mb-6 flex justify-between items-center">
                        <p className="text-xs text-secondary font-medium">
                          Select a category folder to browse sync history, or create a new custom folder.
                        </p>
                        
                        {/* Inline folder creation indicator */}
                        {!isAddFolderOpen && (
                          <button
                            onClick={() => setIsAddFolderOpen(true)}
                            className="h-8 px-4 rounded-[7px] border border-subtle bg-input hover:border-accent text-xs font-bold text-secondary hover:text-accent transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            <span>+ Create Folder</span>
                          </button>
                        )}
                      </div>

                      {/* Custom Category Folders Grid */}
                      <motion.div 
                        variants={listVariant} 
                        initial="hidden" 
                        animate="show" 
                        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
                      >
                        {categoriesList.map((categoryName) => {
                          const count = memories.filter((m) => m.category.toLowerCase() === categoryName.toLowerCase()).length;
                          return (
                            <motion.div
                              variants={itemVariant}
                              key={categoryName}
                              onClick={() => setActiveCategoryFolder(categoryName)}
                              onContextMenu={(e) => handleFolderContextMenu(e, categoryName)}
                              className="bg-surface border border-subtle rounded-[7px] p-6 hover:bg-surface-hover/50 hover:border-accent hover:shadow-[0_0_15px_rgba(90,176,176,0.06)] transition-all flex flex-col justify-between h-36 relative overflow-hidden group cursor-pointer"
                            >
                              <div className="flex justify-between items-start">
                                {/* Folder visual icon with accent glow */}
                                <div className="w-10 h-10 rounded-[7px] bg-accent-dim text-accent flex items-center justify-center border border-accent/20 group-hover:bg-accent group-hover:text-[#0c0f16] transition-colors">
                                  <Folder size={18} className="stroke-[2.5]" />
                                </div>
                                <span className="font-mono text-[9px] text-muted tracking-wider uppercase font-bold">
                                  Category
                                </span>
                              </div>

                              <div className="mt-4">
                                <h4 className="font-bold text-xs uppercase tracking-wider text-primary group-hover:text-accent transition-colors">
                                  {categoryName}
                                </h4>
                                <div className="text-[10px] text-muted mt-1 font-mono">
                                  {count} {count === 1 ? "memory" : "memories"}
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}

                        {/* Expandable "Add Folder" Card */}
                        {isAddFolderOpen ? (
                          <motion.div
                            variants={itemVariant}
                            className="bg-surface border border-accent/30 rounded-[7px] p-6 flex flex-col justify-between h-36 relative overflow-hidden"
                          >
                            <form onSubmit={handleCreateFolder} className="h-full flex flex-col justify-between">
                              <div>
                                <div className="text-[9px] font-mono uppercase tracking-widest text-accent font-bold mb-2">New Category Name</div>
                                <input
                                  type="text"
                                  autoFocus
                                  value={newFolderName}
                                  onChange={(e) => setNewFolderName(e.target.value)}
                                  placeholder="e.g. security..."
                                  className="w-full bg-input border border-subtle rounded-[7px] py-1.5 px-3 text-xs text-primary focus:outline-none focus:border-accent transition-all placeholder-muted font-sans font-medium"
                                />
                              </div>
                              
                              <div className="flex gap-2 justify-end">
                                <button
                                  type="button"
                                  onClick={() => { setIsAddFolderOpen(false); setNewFolderName(""); }}
                                  className="h-7 px-3 rounded-[7px] border border-subtle hover:bg-surface-hover text-[10px] font-bold text-secondary transition-colors cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="submit"
                                  className="h-7 px-3.5 rounded-[7px] bg-accent hover:bg-accent/90 text-[#0c0f16] text-[10px] font-bold transition-colors cursor-pointer"
                                >
                                  Save Folder
                                </button>
                              </div>
                            </form>
                          </motion.div>
                        ) : (
                          <motion.div
                            variants={itemVariant}
                            onClick={() => setIsAddFolderOpen(true)}
                            className="bg-surface/30 border border-dashed border-subtle hover:border-accent/40 rounded-[7px] p-6 flex flex-col items-center justify-center h-36 hover:bg-surface-hover/20 transition-all group cursor-pointer text-center"
                          >
                            <div className="w-9 h-9 rounded-full border border-dashed border-muted/50 text-muted group-hover:text-accent group-hover:border-accent flex items-center justify-center transition-colors mb-2">
                              <span className="text-lg font-bold leading-none">+</span>
                            </div>
                            <span className="text-[10px] font-mono text-muted uppercase tracking-wider group-hover:text-accent transition-colors">
                              Add Folder
                            </span>
                          </motion.div>
                        )}
                      </motion.div>
                    </div>
                  ) : (
                    <div>
                      {/* Memories Breadcrumb Header & Action Bar */}
                      <div className="mb-6 flex justify-between items-center border-b border-subtle/40 pb-4">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setActiveCategoryFolder(null)}
                            className="w-8 h-8 rounded-[7px] border border-subtle flex items-center justify-center text-secondary hover:text-accent hover:border-accent bg-input transition-all cursor-pointer"
                            title="Go back to folder view"
                          >
                            <ChevronRight size={14} className="rotate-180 stroke-[2.5]" />
                          </button>
                          
                          <div className="flex items-center gap-2 font-mono text-xs">
                            <button
                              onClick={() => setActiveCategoryFolder(null)}
                              className="text-muted hover:text-secondary transition-colors cursor-pointer font-bold"
                            >
                              Memories
                            </button>
                            <ChevronRight size={10} className="text-muted" />
                            <span className="text-accent uppercase font-bold tracking-wider">
                              {activeCategoryFolder}
                            </span>
                          </div>
                        </div>

                        <div className="text-[10px] font-mono text-muted">
                          Showing {sortedMemories.length} {sortedMemories.length === 1 ? "item" : "items"}
                        </div>
                      </div>

                      {/* Render Memories for this selected Category folder */}
                      <motion.div variants={listVariant} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {sortedMemories.map((memory) => (
                          <motion.div
                            variants={itemVariant}
                            key={memory.id}
                            layoutId={`card-${memory.id}`}
                            onClick={() => setSelected(memory)}
                            onContextMenu={(e) => handleMemoryContextMenu(e, memory.id)}
                            className="text-left bg-surface border border-subtle rounded-[7px] p-5 hover:bg-surface-hover/40 hover:border-medium transition-all flex flex-col h-[170px] relative overflow-hidden group cursor-pointer"
                          >
                            <div className="flex justify-between items-center mb-3">
                              <span className={`text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-[4px] border
                                ${memory.category === 'architecture' ? 'text-accent bg-accent-dim border-accent/20' :
                                  memory.category === 'style-guide' ? 'text-warning bg-warning/5 border-warning/20' :
                                  memory.category === 'database' ? 'text-success bg-success/5 border-success/20' :
                                  memory.category === 'todo' ? 'text-warning bg-warning/5 border-warning/20' :
                                  memory.category === 'preference' ? 'text-danger bg-danger/5 border-danger/20' :
                                  'text-secondary bg-white/5 border-subtle'}`}
                              >
                                {memory.category}
                              </span>
                              <span className="text-[9px] font-mono text-muted uppercase tracking-wider">
                                #MEM-{memory.id.slice(0, 4)}
                              </span>
                            </div>
                            
                            <div className="flex-1 text-xs text-primary leading-relaxed line-clamp-3 mb-4 font-sans font-medium">
                              {memory.fact}
                            </div>
                            
                            <div className="mt-auto flex justify-between items-center pt-2.5 border-t border-subtle/50">
                              <div className="flex gap-1.5 overflow-hidden pr-2">
                                {memory.tags.slice(0, 2).map(t => (
                                  <span key={t} className="text-[9px] font-mono text-muted bg-[#080a0f] border border-subtle px-1.5 py-0.5 rounded-[3px] truncate max-w-[70px]">
                                    {t}
                                  </span>
                                ))}
                                {memory.tags.length > 2 && (
                                  <span className="text-[9px] font-mono text-muted bg-[#080a0f] border border-subtle px-1 py-0.5 rounded-[3px]">
                                    +{memory.tags.length - 2}
                                  </span>
                                )}
                              </div>
                              <span className="text-[9px] font-mono text-muted shrink-0">
                                {formatDate(memory.updatedAt).split(",")[0]}
                              </span>
                            </div>
                          </motion.div>
                        ))}
                        {sortedMemories.length === 0 && (
                          <div className="col-span-full py-16 text-center text-muted">
                            <HelpCircle size={28} className="mx-auto mb-2 opacity-30" />
                            <p className="text-xs font-mono">No memories match search query in this folder.</p>
                          </div>
                        )}
                      </motion.div>
                    </div>
                  )}
                </div>
              )}


              {/* PROPOSALS (PR style Terminal list) */}
              {activeView === "proposals" && (
                <div className="space-y-4">
                  {filteredProposals.map((proposal) => (
                    <motion.div
                      key={proposal.id}
                      layoutId={`card-${proposal.id}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-surface border border-subtle rounded-[7px] overflow-hidden flex items-stretch shadow-sm group hover:border-medium transition-all"
                    >
                      <button 
                        className="flex-1 text-left p-5 hover:bg-surface-hover/30 transition-colors cursor-pointer"
                        onClick={() => setSelected(proposal)}
                      >
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-3">
                          <h3 className="font-bold text-xs uppercase tracking-wider text-primary group-hover:text-accent transition-colors flex items-center gap-2">
                            <span className="font-mono text-muted text-[10px] tracking-normal">[PR-{proposal.id.slice(0, 5)}]</span>
                            {proposal.summary}
                          </h3>
                          <span className={`text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-[4px] border shrink-0 sm:self-center self-start
                            ${proposal.status === 'staged' ? 'bg-warning/10 text-warning border-warning/20' :
                              proposal.status === 'applied' ? 'bg-success/10 text-success border-success/20' :
                              'bg-danger/10 text-danger border-danger/20'
                            }`}
                          >
                            {proposal.status}
                          </span>
                        </div>
                        
                        <blockquote className="text-xs text-secondary pl-3 border-l border-subtle/80 italic mb-4 font-sans max-w-2xl truncate">
                          "{proposal.rationale}"
                        </blockquote>

                        <div className="text-[10px] text-muted font-mono flex flex-wrap gap-4 items-center pt-2 border-t border-subtle/40">
                          <span className="text-accent flex items-center gap-1">
                            <FileCode size={11} /> {proposal.operations.length} staged operation{proposal.operations.length !== 1 ? 's' : ''}
                          </span>
                          <span>•</span>
                          <span>Updated: {formatDate(proposal.updatedAt)}</span>
                        </div>
                      </button>
                      
                      {/* Direct PR Action Panel inside Collapsed state (Hoverable details) */}
                      {proposal.status === "staged" && (
                        <div className="w-36 border-l border-subtle flex flex-col shrink-0 bg-surface">
                          <button
                            disabled={busyProposalId === proposal.id}
                            onClick={() => void onApprove(proposal.id)}
                            className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold text-success hover:bg-success/15 disabled:opacity-30 transition-colors border-b border-subtle cursor-pointer"
                          >
                            <CheckCircle2 size={13} /> Approve
                          </button>
                          <button
                            disabled={busyProposalId === proposal.id}
                            onClick={() => void onReject(proposal.id)}
                            className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold text-danger hover:bg-danger/15 disabled:opacity-30 transition-colors cursor-pointer"
                          >
                            <XCircle size={13} /> Reject
                          </button>
                        </div>
                      )}
                    </motion.div>
                  ))}
                  {filteredProposals.length === 0 && (
                    <div className="py-16 text-center text-muted">
                      <HelpCircle size={28} className="mx-auto mb-2 opacity-30" />
                      <p className="text-xs font-mono">No proposals match search query.</p>
                    </div>
                  )}
                </div>
              )}

              {/* TODOS (Checklist rows) */}
              {activeView === "todos" && (
                <div className="bg-surface border border-subtle rounded-[7px] overflow-hidden">
                  <div className="divide-y divide-subtle/60">
                    {filteredTodos.map((todo) => {
                      const isCompleted = todo.status === "done";
                      return (
                        <motion.div
                          key={todo.id}
                          layoutId={`card-${todo.id}`}
                          onClick={() => setSelected(todo)}
                          className="w-full text-left px-6 py-4 hover:bg-surface-hover/40 transition-colors flex items-center justify-between group cursor-pointer"
                        >
                          <div className="flex items-center gap-4 min-w-0 flex-1">
                            {/* Bencium Custom Checkbox */}
                            <div className={`w-4.5 h-4.5 rounded-[4px] border flex items-center justify-center shrink-0 transition-all duration-200
                              ${isCompleted 
                                ? "bg-success/10 border-success text-success" 
                                : "border-subtle group-hover:border-accent bg-input"}`}
                            >
                              {isCompleted && <Check size={11} className="stroke-[3]" />}
                            </div>
                            
                            <div className="min-w-0 pr-4">
                              <div className={`font-semibold text-xs transition-colors truncate
                                ${isCompleted ? "text-muted line-through" : "text-primary group-hover:text-accent"}`}
                              >
                                {todo.title}
                              </div>
                              <div className="text-[9px] text-muted mt-1 font-mono flex items-center gap-1.5">
                                <span>Ref:</span>
                                <span className="bg-background border border-subtle px-1 py-0.2 rounded text-[8px]">
                                  {todo.sourceTaskSummaryId ? todo.sourceTaskSummaryId.slice(0, 10) : "manual"}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3 shrink-0">
                            <span className={`text-[9px] uppercase font-mono tracking-wider px-2 py-0.5 rounded-[4px] border
                              ${isCompleted ? "bg-[#0c0f16] text-muted border-subtle" : "bg-warning/5 text-warning border-warning/20"}`}
                            >
                              {todo.status}
                            </span>
                            <ChevronRight size={12} className="text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                  {filteredTodos.length === 0 && (
                    <div className="py-16 text-center text-muted">
                      <HelpCircle size={28} className="mx-auto mb-2 opacity-30" />
                      <p className="text-xs font-mono">No TODOs match search query.</p>
                    </div>
                  )}
                </div>
              )}

              {/* DOCUMENTS & SKILLS (Folder Architecture layout) */}
              {(activeView === "documents" || activeView === "skills") && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-y-6 gap-x-4">
                  {(activeView === "documents" ? filteredDocuments : filteredSkills).map((item) => {
                    const isDocItem = activeView === "documents";
                    return (
                      <div key={item.id} className="relative pt-3.5 group">
                        
                        {/* Custom Folder Tab */}
                        <div className="absolute top-0 left-4 h-4 px-3 bg-surface border-t border-x border-subtle rounded-t-[5px] text-[8px] font-mono text-muted uppercase tracking-widest flex items-center font-bold z-10 transition-colors group-hover:border-medium">
                          {isDocItem ? "doc" : "skill"}
                        </div>

                        {/* Folder Body */}
                        <motion.div
                          layoutId={`card-${item.id}`}
                          onClick={() => setSelected(item as Inspectable)}
                          className="w-full text-left bg-surface border border-subtle rounded-[7px] rounded-tl-none p-5 hover:border-medium hover:bg-surface-hover/30 transition-all flex items-start gap-4 cursor-pointer relative"
                        >
                          <div className="w-9 h-9 rounded-[7px] bg-accent-dim text-accent flex items-center justify-center shrink-0 border border-accent/20 group-hover:shadow-[0_0_12px_rgba(99,199,214,0.18)] transition-shadow">
                            {isDocItem ? <BookText size={15} /> : <Bot size={15} />}
                          </div>
                          
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-xs text-primary truncate">
                              {"filename" in item ? item.filename : item.title}
                            </div>
                            <div className="text-[9px] text-muted font-mono truncate mt-1.5" title={item.path}>
                              {item.path}
                            </div>
                          </div>
                        </motion.div>
                      </div>
                    );
                  })}
                  {(activeView === "documents" ? filteredDocuments : filteredSkills).length === 0 && (
                    <div className="col-span-full py-16 text-center text-muted">
                      <HelpCircle size={28} className="mx-auto mb-2 opacity-30" />
                      <p className="text-xs font-mono">No items match search query.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ACTIVITY */}
              {activeView === "activity" && (
                <div className="bg-surface border border-subtle rounded-[7px] overflow-hidden">
                  <div className="divide-y divide-subtle/60">
                    {filteredActivity.map((task) => (
                      <button 
                        key={task.id} 
                        onClick={() => setSelected(task)}
                        className="w-full text-left px-6 py-4.5 hover:bg-surface-hover/40 transition-colors flex items-center justify-between group cursor-pointer"
                      >
                        <div className="min-w-0 flex-1 pr-4">
                          <div className="font-semibold text-xs text-primary group-hover:text-accent transition-colors truncate">{task.payload.summary}</div>
                          <div className="text-[10px] text-muted mt-1.5 font-mono flex gap-4 items-center">
                            <span className={`px-1.5 py-0.5 rounded-[4px] text-[8px] uppercase tracking-wider font-semibold border
                              ${task.agent === 'codex' ? 'bg-accent/10 text-accent border-accent/20' : 
                                task.agent === 'claude' ? 'bg-warning/10 text-warning border-warning/20' : 
                                'bg-success/10 text-success border-success/20'}`}
                            >
                              {task.agent}
                            </span>
                            <span>ID: {task.payload.taskId.slice(0, 8)}...</span>
                          </div>
                        </div>
                        <Sparkles size={14} className="text-muted shrink-0 opacity-40 group-hover:text-accent group-hover:opacity-100 transition-all" />
                      </button>
                    ))}
                  </div>
                  {filteredActivity.length === 0 && (
                    <div className="py-16 text-center text-muted">
                      <HelpCircle size={28} className="mx-auto mb-2 opacity-30" />
                      <p className="text-xs font-mono">No tasks match search query.</p>
                    </div>
                  )}
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* LIQUID MORPH EXPANDED OVERLAY */}
      <AnimatePresence>
        {selected && (
          isDocument(selected) || isSkill(selected) ? (
            <motion.div
              layoutId={`card-${selected.id}`}
              transition={structuralTransition}
              className="fixed inset-0 z-50 flex flex-col bg-[#080a0f] text-primary overflow-hidden select-text"
            >
              {/* Full-bleed IDE cybernetic code editor workspace */}
              {/* Top Navigation Bar */}
              <div className="h-14 px-6 border-b border-subtle bg-surface flex items-center justify-between shrink-0 select-none">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-[7px] bg-accent-dim text-accent flex items-center justify-center border border-accent/20">
                    {isDocument(selected) ? <BookText size={14} /> : <Bot size={14} />}
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs truncate">
                    <span className="text-muted font-bold">WORKSPACE</span>
                    <ChevronRight size={10} className="text-muted" />
                    <span className="text-muted truncate">
                      {isDocument(selected) ? "documents" : "skills"}
                    </span>
                    <ChevronRight size={10} className="text-muted" />
                    <span className="text-accent truncate font-bold">
                      {"filename" in selected ? selected.filename : selected.title}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* Glowing Save button */}
                  {"content" in selected && (
                    <button
                      onClick={handleSaveCode}
                      disabled={isSavingCode || selected.content === editCodeContent}
                      className="h-8 px-4 rounded-[7px] bg-accent hover:bg-accent/90 disabled:bg-[#0c0f16] disabled:border-subtle/50 disabled:text-muted disabled:shadow-none disabled:cursor-not-allowed text-[#0c0f16] font-bold text-xs flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(99,199,214,0.2)] cursor-pointer"
                    >
                      {isSavingCode ? (
                        <>
                          <RefreshCw size={12} className="animate-spin" /> Saving...
                        </>
                      ) : (
                        <>
                          <Sparkles size={12} /> Save File
                        </>
                      )}
                    </button>
                  )}

                  {/* Synced copy action */}
                  {"content" in selected && (
                    <button
                      onClick={() => copyToClipboard(editCodeContent, selected.id)}
                      className="h-8 px-4 rounded-[7px] border border-subtle hover:border-medium bg-input flex items-center gap-1.5 text-xs font-bold text-secondary hover:text-primary transition-all cursor-pointer"
                    >
                      {copiedFileId === selected.id ? (
                        <>
                          <Check size={12} className="text-success" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy size={12} /> Copy Code
                        </>
                      )}
                    </button>
                  )}

                  {/* Minimize button */}
                  <button
                    onClick={() => { setSelected(null); }}
                    className="h-8 px-3.5 rounded-[7px] border border-subtle hover:border-medium bg-input flex items-center gap-1.5 text-xs font-bold text-secondary hover:text-primary transition-all cursor-pointer"
                    title="Minimize window"
                  >
                    <Minimize2 size={13} />
                    <span>Minimize</span>
                  </button>
                </div>
              </div>

              {/* Editor Workspace Container */}
              <div className="flex-1 flex min-h-0 animate-fade-in">
                
                {/* Left Sidebar (Stats & Info) */}
                <div className="w-64 border-r border-subtle bg-surface/30 p-6 flex flex-col justify-between shrink-0 hidden md:flex select-none">
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-[10px] font-mono uppercase tracking-widest text-muted font-bold mb-3">File Architecture</h4>
                      <div className="space-y-2 font-mono text-[10px]">
                        <div className="flex justify-between items-center py-1 border-b border-subtle/30 text-secondary">
                          <span className="text-muted">Type:</span>
                          <span className="uppercase">{isDocument(selected) ? "Agent File" : "Agent Skill"}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-subtle/30 text-secondary">
                          <span className="text-muted">Size:</span>
                          <span>{editCodeContent ? `${new Blob([editCodeContent]).size} B` : "N/A"}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-subtle/30 text-secondary">
                          <span className="text-muted">Lines:</span>
                          <span>{editCodeContent ? editCodeContent.split("\n").length : 0}</span>
                        </div>
                        {"path" in selected && (
                          <div className="py-2 text-secondary break-all">
                            <span className="text-muted block mb-1">Path:</span>
                            <span className="text-[9px] bg-background p-1.5 rounded border border-subtle/50 block font-bold leading-normal">{selected.path}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[10px] font-mono uppercase tracking-widest text-muted font-bold mb-2">Developer Tips</h4>
                      <p className="text-[10px] text-muted leading-relaxed font-sans font-medium">
                        This context file stores rules, structures, and guidelines referenced by Romem's synchronization agents. Do not mutate structure unless required.
                      </p>
                    </div>
                  </div>

                  <div className="font-mono text-[9px] text-muted leading-relaxed border-t border-subtle/40 pt-4">
                    <span>AGENT_STATUS: IDLE</span>
                    <br />
                    <span>REF: #{selected.id.slice(0, 10)}</span>
                  </div>
                </div>

                {/* Main Code Editor Terminal Window */}
                <div className="flex-1 flex flex-col min-h-0 bg-[#06080c]">
                  {/* File Breadcrumb Path header bar */}
                  <div className="h-9 px-4 bg-[#0a0d14] border-b border-subtle flex items-center justify-between shrink-0 select-none">
                    <div className="flex items-center gap-1.5 font-mono text-[10px] text-secondary truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                      <span className="text-muted">src/</span>
                      <span className="text-muted">{isDocument(selected) ? "documents" : "skills"}/</span>
                      <span className="text-accent font-bold truncate">{"filename" in selected ? selected.filename : selected.title}</span>
                    </div>
                    <span className="text-[9px] font-mono text-muted uppercase">utf-8</span>
                  </div>

                  {/* Fira Code / Mono editor body */}
                  <div className="flex-1 flex min-h-0 bg-[#06080c] relative">
                    {/* Line numbers panel */}
                    <div 
                      id="line-numbers-container"
                      className="w-12 select-none text-muted/30 text-right pr-4 border-r border-subtle/30 font-semibold font-mono text-[11px] leading-relaxed bg-[#06080c] py-6 overflow-hidden shrink-0"
                    >
                      {editCodeContent.split("\n").map((_, idx) => (
                        <div key={idx} className="h-[1.5rem] pr-1">{idx + 1}</div>
                      ))}
                    </div>

                    {/* Textarea Code Sandbox */}
                    <textarea
                      value={editCodeContent}
                      onChange={(e) => setEditCodeContent(e.target.value)}
                      onScroll={handleEditorScroll}
                      onKeyDown={handleEditorKeyDown}
                      className="flex-1 bg-transparent p-6 outline-none border-none font-mono text-[11px] text-secondary leading-relaxed resize-none custom-scrollbar h-full w-full select-text whitespace-pre overflow-auto"
                      style={{ 
                        lineHeight: "1.5rem",
                        tabSize: 2,
                      }}
                      placeholder="Write code or rules here..."
                      spellCheck={false}
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="h-8 px-6 bg-surface border-t border-subtle flex justify-between items-center text-[9px] font-mono text-muted shrink-0 select-none">
                <span>romem-v1.1 Workspace</span>
                <span>Press ESC or click Minimize to exit workspace</span>
              </div>
            </motion.div>
          ) : (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#080a0f]/85 backdrop-blur-sm">
              {/* Click outside to close */}
              <div className="absolute inset-0 cursor-zoom-out" onClick={() => { setSelected(null); setRejectReason(""); }} />
              
              <motion.div
                layoutId={`card-${selected.id}`}
                transition={structuralTransition}
                className={`w-full ${isMemory(selected) ? 'max-w-3xl h-[80vh]' : 'max-w-2xl max-h-[85vh]'} flex flex-col bg-elevated border border-medium rounded-[7px] shadow-2xl overflow-hidden relative z-10`}
              >
                
                {/* Header */}
                <div className="p-5.5 border-b border-subtle bg-surface-hover/30 flex justify-between items-start gap-4">
                  <div className="min-w-0">
                    <div className="text-[9px] font-mono uppercase tracking-widest text-accent font-bold mb-1.5 flex gap-2 items-center">
                      <span>INSPECTOR //</span>
                      {isMemory(selected) && <span>Category: {selected.category}</span>}
                      {isProposal(selected) && <span>Proposal ID: {selected.id.slice(0, 8)}</span>}
                      {isTodo(selected) && <span>Todo Details</span>}
                      {isActivity(selected) && <span>Task History</span>}
                    </div>
                    <h3 className="font-bold text-sm text-primary leading-snug break-words pr-2">
                      {isMemory(selected) && "Memory Detail"}
                      {isProposal(selected) && selected.summary}
                      {isTodo(selected) && selected.title}
                      {isActivity(selected) && selected.payload.summary}
                    </h3>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    {isMemory(selected) && !isEditingMemory && (
                      <button
                        onClick={() => setIsEditingMemory(true)}
                        className="h-7 px-3 rounded-[7px] border border-accent/20 hover:border-accent bg-accent-dim text-accent text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Sparkles size={11} /> Edit Memory
                      </button>
                    )}
                    {isTodo(selected) && !isEditingTodo && (
                      <button
                        onClick={() => setIsEditingTodo(true)}
                        className="h-7 px-3 rounded-[7px] border border-accent/20 hover:border-accent bg-accent-dim text-accent text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Sparkles size={11} /> Edit Todo
                      </button>
                    )}
                    <button
                      onClick={() => { setSelected(null); setRejectReason(""); }}
                      className="w-7 h-7 rounded-[7px] border border-subtle hover:border-medium flex items-center justify-center text-secondary hover:text-primary transition-colors cursor-pointer"
                    >
                      <XCircle size={14} />
                    </button>
                  </div>
                </div>

                {/* Scrollable Content Body */}
                <div className={`flex-1 min-h-0 ${isMemory(selected) ? 'flex flex-col p-6' : 'overflow-y-auto p-6.5 space-y-6 custom-scrollbar'}`}>
                  
                  {/* 1. MEMORY DETAILS VIEW */}
                  {isMemory(selected) && (
                    isEditingMemory ? (
                      <div className="flex-1 flex flex-col min-h-0 h-full">
                        <div className="grid grid-cols-2 gap-4 shrink-0 mb-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-mono text-muted uppercase tracking-widest font-bold">Category</label>
                            <input
                              type="text"
                              value={editMemoryCategory}
                              onChange={(e) => setEditMemoryCategory(e.target.value)}
                              className="w-full bg-input border border-subtle focus:border-accent rounded-[7px] py-2 px-3 text-xs text-primary focus:outline-none transition-all placeholder-muted font-sans font-medium animate-fade-in"
                              placeholder="e.g. style-guide"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-mono text-muted uppercase tracking-widest font-bold">Tags (comma-separated)</label>
                            <input
                              type="text"
                              value={editMemoryTags}
                              onChange={(e) => setEditMemoryTags(e.target.value)}
                              className="w-full bg-input border border-subtle focus:border-accent rounded-[7px] py-2 px-3 text-xs text-primary focus:outline-none transition-all placeholder-muted font-sans font-medium animate-fade-in"
                              placeholder="e.g. ui, styles, react"
                            />
                          </div>
                        </div>

                        <div className="text-[10px] font-mono text-muted mb-1.5 uppercase tracking-widest shrink-0 font-bold">Fact Content</div>
                        <textarea
                          value={editMemoryFact}
                          onChange={(e) => setEditMemoryFact(e.target.value)}
                          className="flex-1 min-h-0 p-5 bg-[#06080c] border border-subtle focus:border-accent rounded-[7px] text-xs leading-relaxed text-primary focus:outline-none focus:ring-1 focus:ring-accent-dim/30 resize-none font-sans font-medium custom-scrollbar mb-4 animate-fade-in"
                          placeholder="State the memory fact details..."
                        />

                        <div className="pt-4 border-t border-subtle/50 flex justify-end gap-3 shrink-0">
                          <button
                            type="button"
                            onClick={() => setIsEditingMemory(false)}
                            className="h-8 px-4 rounded-[7px] border border-subtle hover:bg-surface-hover text-xs font-bold text-secondary transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveMemory}
                            className="h-8 px-4.5 rounded-[7px] bg-accent hover:bg-accent/90 text-[#0c0f16] text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-[0_0_12px_rgba(99,199,214,0.15)] animate-fade-in"
                          >
                            <Sparkles size={11} /> Save Changes
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col min-h-0 space-y-5 h-full">
                        <div className="text-xs font-mono text-muted mb-1 uppercase tracking-widest shrink-0 font-bold">Fact Content</div>
                        <div className="flex-1 min-h-0 overflow-y-auto p-5 bg-surface rounded-[7px] border border-subtle text-xs leading-relaxed text-primary font-medium select-text whitespace-pre-wrap custom-scrollbar">
                          {selected.fact}
                        </div>
                        
                        <div className="pt-4 border-t border-subtle/50 flex flex-wrap items-center justify-between gap-4 text-[10px] font-mono text-muted shrink-0">
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                            <span>Source Agent: {selected.source}</span>
                          </div>

                          {selected.tags && selected.tags.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-muted/60">Tags:</span>
                              <div className="flex flex-wrap gap-1.5">
                                {selected.tags.map(t => (
                                  <span key={t} className="text-[9px] font-mono px-1.5 py-0.2 bg-input border border-subtle rounded-[4px] text-secondary font-semibold">
                                    {t}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-1.5">
                            <Calendar size={11} />
                            <span>Updated: {formatDate(selected.updatedAt)}</span>
                          </div>
                        </div>
                      </div>
                    )
                  )}

                  {/* 2. PROPOSAL / PR DETAILS VIEW */}
                  {isProposal(selected) && (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <div className="text-[10px] font-mono text-muted uppercase tracking-widest">Rationale</div>
                        <blockquote className="p-4 bg-surface rounded-[7px] border border-subtle text-xs leading-relaxed text-secondary italic">
                          "{selected.rationale}"
                        </blockquote>
                      </div>
                      
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-mono uppercase tracking-widest text-muted">Staged Operations ({selected.operations.length})</h4>
                        <div className="space-y-3.5">
                          {selected.operations.map(op => {
                            const isAdd = op.type.includes('create') || op.type.includes('upsert');
                            const isDel = op.type.includes('delete');
                            return (
                              <div key={op.id} className="bg-surface rounded-[7px] border border-subtle overflow-hidden">
                                
                                <div className="p-3 bg-surface-hover/30 border-b border-subtle flex justify-between items-center gap-3">
                                  <div className="min-w-0">
                                    <div className="font-bold text-xs text-primary leading-none mb-1 truncate">{op.title}</div>
                                    <div className="text-[9px] font-mono text-muted uppercase tracking-wider truncate flex gap-2">
                                      <span className={isAdd ? 'text-success' : isDel ? 'text-danger' : 'text-warning'}>
                                        [{op.type}]
                                      </span>
                                      <span>{op.target}</span>
                                    </div>
                                  </div>
                                </div>

                                {op.diff && (
                                  <div className="bg-[#080a0f] overflow-x-auto custom-scrollbar font-mono text-[10px] p-4 text-secondary leading-relaxed border-t border-subtle select-text max-h-[300px]">
                                    <pre className="whitespace-pre">
                                      {op.diff.split("\n").map((line, idx) => {
                                        const isPlus = line.startsWith("+");
                                        const isMinus = line.startsWith("-");
                                        return (
                                          <div 
                                            key={idx} 
                                            className={`flex items-start -mx-4 px-4 ${
                                              isPlus ? 'bg-success/8 text-success border-l-2 border-success/80' : 
                                              isMinus ? 'bg-danger/8 text-danger border-l-2 border-danger/80' : ''
                                            }`}
                                          >
                                            {/* Simple Line Numbers */}
                                            <span className="w-8 select-none text-muted/30 text-right pr-2 shrink-0">{idx + 1}</span>
                                            <span className="break-all whitespace-pre-wrap">{line}</span>
                                          </div>
                                        );
                                      })}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      
                      {/* Approve/Reject Interaction Panel */}
                      {selected.status === "staged" && (
                        <div className="pt-5.5 border-t border-subtle/80 space-y-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-mono text-muted uppercase tracking-widest font-bold">Rejection Reason (Required for rejection)</label>
                            <textarea
                              rows={2}
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="State the technical reasons for rejection..."
                              className="w-full bg-input border border-subtle rounded-[7px] p-3 text-xs text-primary focus:outline-none focus:border-accent transition-all placeholder-muted font-sans font-medium"
                            />
                          </div>
                          <div className="flex gap-3 justify-end">
                            <button
                              disabled={busyProposalId === selected.id}
                              onClick={() => void onReject(selected.id, rejectReason || undefined)}
                              className="h-9 px-4 rounded-[7px] border border-danger/30 hover:border-danger/60 text-danger hover:bg-danger/10 text-xs font-bold transition-all cursor-pointer flex items-center gap-2 disabled:opacity-30"
                            >
                              <XCircle size={13} /> Reject Proposal
                            </button>
                            <button
                              disabled={busyProposalId === selected.id}
                              onClick={() => void onApprove(selected.id)}
                              className="h-9 px-5 rounded-[7px] bg-success hover:bg-success/90 text-[#0c0f16] text-xs font-bold transition-all cursor-pointer flex items-center gap-2 disabled:opacity-30"
                            >
                              <CheckCircle2 size={13} /> Approve & Apply
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3. TODO DETAILS VIEW */}
                  {isTodo(selected) && (
                    isEditingTodo ? (
                      <div className="flex-1 flex flex-col min-h-0 h-full space-y-5">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-mono text-muted uppercase tracking-widest font-bold">Todo Title</label>
                          <textarea
                            value={editTodoTitle}
                            onChange={(e) => setEditTodoTitle(e.target.value)}
                            className="w-full h-24 p-4 bg-[#06080c] border border-subtle focus:border-accent rounded-[7px] text-xs leading-relaxed text-primary focus:outline-none focus:ring-1 focus:ring-accent-dim/30 resize-none font-sans font-medium custom-scrollbar animate-fade-in"
                            placeholder="e.g. Implement styled custom modal"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-mono text-muted uppercase tracking-widest font-bold">Todo Status</label>
                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={() => setEditTodoStatus("open")}
                              className={`flex-1 py-3 px-4 rounded-[7px] border font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                                editTodoStatus === "open"
                                  ? "bg-warning/15 border-warning text-warning shadow-[0_0_12px_rgba(245,158,11,0.15)] border-warning/60"
                                  : "border-subtle hover:border-medium bg-input text-secondary"
                              }`}
                            >
                              <HelpCircle size={13} />
                              <span>Open / In Progress</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditTodoStatus("done")}
                              className={`flex-1 py-3 px-4 rounded-[7px] border font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                                editTodoStatus === "done"
                                  ? "bg-success/15 border-success text-success shadow-[0_0_12px_rgba(34,197,94,0.15)] border-success/60"
                                  : "border-subtle hover:border-medium bg-input text-secondary"
                              }`}
                            >
                              <Check size={13} className="stroke-[3]" />
                              <span>Completed</span>
                            </button>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-subtle/50 flex justify-end gap-3 shrink-0">
                          <button
                            type="button"
                            onClick={() => setIsEditingTodo(false)}
                            className="h-8 px-4 rounded-[7px] border border-subtle hover:bg-surface-hover text-xs font-bold text-secondary transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveTodo}
                            className="h-8 px-4.5 rounded-[7px] bg-accent hover:bg-accent/90 text-[#0c0f16] text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-[0_0_12px_rgba(99,199,214,0.15)] animate-fade-in"
                          >
                            <Sparkles size={11} /> Save Changes
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-5">
                        <div className="p-4 bg-surface rounded-[7px] border border-subtle flex justify-between items-center gap-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-[4px] border flex items-center justify-center shrink-0
                              ${selected.status === 'done' ? "bg-success/15 border-success text-success" : "border-warning text-warning bg-warning/5"}`}
                            >
                              {selected.status === 'done' ? <Check size={12} className="stroke-[3]" /> : <HelpCircle size={12} />}
                            </div>
                            <span className="font-bold text-xs uppercase tracking-wider text-secondary">
                              Status: <span className={selected.status === 'done' ? 'text-success' : 'text-warning'}>{selected.status}</span>
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="text-[10px] font-mono text-muted uppercase tracking-widest">Source Task Reference</div>
                          <div className="p-3.5 bg-input border border-subtle rounded-[7px] font-mono text-xs text-secondary break-all">
                            {selected.sourceTaskSummaryId ?? "Created manually"}
                          </div>
                        </div>

                        <div className="pt-4 border-t border-subtle/50 flex justify-between items-center text-[10px] font-mono text-muted">
                          <span>Ref ID: #{selected.id.slice(0, 10)}</span>
                          <span>Created: {formatDate(selected.createdAt)}</span>
                        </div>
                      </div>
                    )
                  )}

                  {/* 5. TASK ACTIVITY DETAILS VIEW */}
                  {isActivity(selected) && (
                    <div className="space-y-5">
                      
                      <div className="p-4 bg-surface rounded-[7px] border border-subtle space-y-3">
                        <div className="flex justify-between items-center text-[10px] font-mono text-muted uppercase">
                          <span>Agent Engine</span>
                          <span>Staged Status</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className={`px-2 py-0.5 rounded-[4px] text-[10px] uppercase tracking-wider font-bold border
                            ${selected.agent === 'codex' ? 'bg-accent/10 text-accent border-accent/20' : 
                              selected.agent === 'claude' ? 'bg-warning/10 text-warning border-warning/20' : 
                              'bg-success/10 text-success border-success/20'}`}
                          >
                            {selected.agent}
                          </span>
                          <span className={`font-mono text-xs font-semibold
                            ${selected.status === 'applied' ? 'text-success' : selected.status === 'rejected' ? 'text-danger' : 'text-warning'}`}
                          >
                            [{selected.status}]
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-[10px] font-mono text-muted uppercase tracking-widest">Metadata Tags</div>
                        <div className="flex flex-wrap gap-2">
                          {selected.payload.tags.map((t: string) => (
                            <span key={t} className="text-[9px] font-mono px-2 py-0.5 bg-input border border-subtle rounded-[4px] text-secondary">
                              {t}
                            </span>
                          ))}
                          {selected.payload.tags.length === 0 && <span className="text-xs italic text-muted">No tags.</span>}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-[10px] font-mono text-muted uppercase tracking-widest">Full Action Payload JSON</div>
                        <div className="bg-[#080a0f] border border-subtle rounded-[7px] p-4 overflow-auto custom-scrollbar font-mono text-[9px] text-secondary leading-normal select-text max-h-[260px]">
                          <pre>{JSON.stringify(selected.payload, null, 2)}</pre>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-subtle bg-surface-hover/30 flex justify-between items-center text-[10px] font-mono text-muted shrink-0">
                  <span>romem-v1.1</span>
                  <span>Select ESC to close</span>
                </div>
              </motion.div>
            </div>
          )
        )}
      </AnimatePresence>

      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -5 }}
            transition={{ type: "spring", stiffness: 380, damping: 26 }}
            style={{
              position: "fixed",
              left: typeof window !== "undefined" ? Math.min(contextMenu.x, window.innerWidth - 200) : contextMenu.x,
              top: typeof window !== "undefined" ? Math.min(contextMenu.y, window.innerHeight - 90) : contextMenu.y,
              zIndex: 9999,
            }}
            className="w-48 bg-surface/95 border border-medium rounded-[7px] backdrop-blur-md shadow-2xl p-1 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            {contextMenu.type === "folder" ? (
              <>
                <button
                  onClick={() => {
                    setActiveCategoryFolder(contextMenu.targetId);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-[5px] text-xs font-semibold text-primary hover:bg-surface-hover/80 hover:text-accent transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <FolderOpen size={13} className="text-secondary" />
                  <span>Open Folder</span>
                </button>
                <div className="h-px bg-subtle/50 my-1" />
                <button
                  onClick={() => {
                    handleDeleteCategory(contextMenu.targetId);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-[5px] text-xs font-semibold text-danger hover:bg-danger/10 hover:text-danger transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Trash size={13} className="stroke-[2]" />
                  <span>Delete Folder</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    const mem = memories.find((m) => m.id === contextMenu.targetId);
                    if (mem) setSelected(mem);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-[5px] text-xs font-semibold text-primary hover:bg-surface-hover/80 hover:text-accent transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Eye size={13} className="text-secondary" />
                  <span>Inspect Memory</span>
                </button>
                <div className="h-px bg-subtle/50 my-1" />
                <button
                  onClick={() => {
                    handleDeleteMemory(contextMenu.targetId);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-[5px] text-xs font-semibold text-danger hover:bg-danger/10 hover:text-danger transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Trash size={13} className="stroke-[2]" />
                  <span>Delete Memory</span>
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.15);
        }
      `}</style>
    </div>
  );
}
