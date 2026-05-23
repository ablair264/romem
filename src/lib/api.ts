import type { AgentDocument, MemoryEntry, ProjectOverview, Proposal, SkillRecord, TaskSummaryInput, TaskSummaryRecord, Todo } from "../shared/schema";

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  health: () => request<{ ok: boolean; projectId: string; hasOllama: boolean; runtime: string }>("/api/health"),
  overview: (projectId: string) => request<ProjectOverview>(`/api/projects/${projectId}/overview`),
  memories: (projectId: string, params = new URLSearchParams()) => request<MemoryEntry[]>(`/api/projects/${projectId}/memories?${params}`),
  addCategory: (projectId: string, category: string) => request<{ category: string }>(`/api/projects/${projectId}/categories`, {
    method: "POST",
    body: JSON.stringify({ category }),
  }),

  proposals: (projectId: string) => request<Proposal[]>(`/api/projects/${projectId}/proposals`),
  todos: (projectId: string) => request<Todo[]>(`/api/projects/${projectId}/todos`),
  taskSummaries: (projectId: string) => request<TaskSummaryRecord[]>(`/api/projects/${projectId}/task-summaries`),
  agentFiles: (projectId: string) => request<AgentDocument[]>(`/api/projects/${projectId}/agent-files`),
  skills: (projectId: string) => request<SkillRecord[]>(`/api/projects/${projectId}/skills`),
  submitSummary: (projectId: string, payload: Omit<TaskSummaryInput, "projectId">) =>
    request<{ proposal: Proposal; taskSummary: TaskSummaryRecord; usedFallback: boolean }>(`/api/projects/${projectId}/task-summaries`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  approveProposal: (proposalId: string) => request<Proposal>(`/api/proposals/${proposalId}/approve`, { method: "POST", body: "{}" }),
  rejectProposal: (proposalId: string, reason?: string) =>
    request<Proposal>(`/api/proposals/${proposalId}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  updateMemory: (projectId: string, memoryId: string, fact: string, category: string, tags: string[], source?: string) =>
    request<MemoryEntry>(`/api/projects/${projectId}/memories/${memoryId}`, {
      method: "PUT",
      body: JSON.stringify({ fact, category, tags, source }),
    }),
  updateAgentFile: (projectId: string, fileId: string, content: string) =>
    request<AgentDocument>(`/api/projects/${projectId}/agent-files/${fileId}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    }),
  updateSkill: (projectId: string, skillId: string, content: string) =>
    request<SkillRecord>(`/api/projects/${projectId}/skills/${skillId}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    }),
  updateTodo: (projectId: string, todoId: string, title: string, status: "open" | "done") =>
    request<Todo>(`/api/projects/${projectId}/todos/${todoId}`, {
      method: "PUT",
      body: JSON.stringify({ title, status }),
    }),
  deleteMemory: (projectId: string, memoryId: string) =>
    request<{ success: boolean; memoryId: string }>(`/api/projects/${projectId}/memories/${memoryId}`, {
      method: "DELETE",
    }),
  deleteCategory: (projectId: string, categoryName: string) =>
    request<{ success: boolean; category: string }>(`/api/projects/${projectId}/categories/${categoryName}`, {
      method: "DELETE",
    }),
  mergeCategories: (projectId: string, sources: string[], target: string) =>
    request<{ success: boolean; target: string; mergedFrom: string[] }>(`/api/projects/${projectId}/categories/merge`, {
      method: "POST",
      body: JSON.stringify({ sources, target }),
    }),
  regenerateAgentFile: (projectId: string, filename: string) =>
    request<{ filename: string; content: string }>(`/api/projects/${projectId}/agent-files/regenerate`, {
      method: "POST",
      body: JSON.stringify({ filename }),
    }),
  suggestSkills: (projectId: string) =>
    request<{ suggestions: Array<{ title: string; path: string; rationale: string }> }>(`/api/projects/${projectId}/skills/suggest`, {
      method: "POST",
      body: "{}",
    }),
  projects: () => request<Array<{ id: string; name: string; rootPath: string; createdAt: string }>>("/api/projects"),
  createProject: (id: string, name: string) =>
    request<{ id: string; name: string; rootPath: string; createdAt: string }>("/api/projects", {
      method: "POST",
      body: JSON.stringify({ id, name }),
    }),
  settings: () => request<Record<string, string>>("/api/settings"),
  updateSettings: (settings: Record<string, string>) => request<Record<string, string>>("/api/settings", { method: "PUT", body: JSON.stringify(settings) }),
  connectSnippets: (projectId: string) => request<{ projectId: string; serverUrl: string; endpoint: string; contextUrl: string; digestUrl: string; snippets: Record<string, string> }>(`/api/projects/${projectId}/connect`),
  consolidate: (projectId: string) =>
    request<{ proposalId: string | null; deletedCount: number; mergedCount: number; skipped: boolean }>(`/api/projects/${projectId}/consolidate`, {
      method: "POST",
      body: "{}",
    }),
};

