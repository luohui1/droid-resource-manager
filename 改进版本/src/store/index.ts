import { create } from 'zustand'
import type { Project, Task, DroidState, SchedulerConfig, SchedulerStatus, Droid } from '../types'

interface AppState {
  // Data
  projects: Project[]
  tasks: { pending: Task[]; history: Task[] }
  droidStates: DroidState[]  // 运行状态
  projectDroids: Droid[]     // 项目的 Droid 定义
  config: SchedulerConfig | null
  status: SchedulerStatus | null
  
  // UI State
  selectedProjectId: string | null
  selectedTaskId: string | null
  selectedDroidId: string | null
  currentView: 'dashboard' | 'projects' | 'tasks' | 'droids' | 'settings'
  sidebarCollapsed: boolean
  
  // Actions
  setProjects: (projects: Project[]) => void
  setTasks: (tasks: { pending: Task[]; history: Task[] }) => void
  setDroidStates: (droids: DroidState[]) => void
  setProjectDroids: (droids: Droid[]) => void
  setConfig: (config: SchedulerConfig) => void
  setStatus: (status: SchedulerStatus) => void
  
  selectProject: (id: string | null) => void
  selectTask: (id: string | null) => void
  selectDroid: (id: string | null) => void
  setView: (view: AppState['currentView']) => void
  toggleSidebar: () => void
  
  // Task updates
  updateTask: (taskId: string, updates: Partial<Task>) => void
  addTaskOutput: (taskId: string, line: string) => void
  
  // Droid updates
  updateDroidState: (droidId: string, updates: Partial<DroidState>) => void
  addProjectDroid: (droid: Droid) => void
  updateProjectDroid: (droidId: string, updates: Partial<Droid>) => void
  removeProjectDroid: (droidId: string) => void
}

export const useStore = create<AppState>((set) => ({
  // Initial data
  projects: [],
  tasks: { pending: [], history: [] },
  droidStates: [],
  projectDroids: [],
  config: null,
  status: null,
  
  // Initial UI state
  selectedProjectId: null,
  selectedTaskId: null,
  selectedDroidId: null,
  currentView: 'dashboard',
  sidebarCollapsed: false,
  
  // Data setters
  setProjects: (projects) => set({ projects }),
  setTasks: (tasks) => set({ tasks }),
  setDroidStates: (droidStates) => set({ droidStates }),
  setProjectDroids: (projectDroids) => set({ projectDroids }),
  setConfig: (config) => set({ config }),
  setStatus: (status) => set({ status }),
  
  // Selection actions
  selectProject: (id) => set({ selectedProjectId: id }),
  selectTask: (id) => set({ selectedTaskId: id }),
  selectDroid: (id) => set({ selectedDroidId: id }),
  setView: (view) => set({ currentView: view }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  
  // Task updates
  updateTask: (taskId, updates) => set((state) => {
    const updateInList = (list: Task[]) =>
      list.map(t => t.id === taskId ? { ...t, ...updates } : t)
    
    return {
      tasks: {
        pending: updateInList(state.tasks.pending),
        history: updateInList(state.tasks.history)
      }
    }
  }),
  
  addTaskOutput: (taskId, line) => set((state) => {
    const updateInList = (list: Task[]) =>
      list.map(t => t.id === taskId ? { ...t, output: [...t.output, line] } : t)
    
    return {
      tasks: {
        pending: updateInList(state.tasks.pending),
        history: state.tasks.history
      }
    }
  }),
  
  // Droid state updates
  updateDroidState: (droidId, updates) => set((state) => ({
    droidStates: state.droidStates.map(d => d.id === droidId ? { ...d, ...updates } : d)
  })),
  
  // Project Droid CRUD
  addProjectDroid: (droid) => set((state) => ({
    projectDroids: [...state.projectDroids, droid]
  })),
  
  updateProjectDroid: (droidId, updates) => set((state) => ({
    projectDroids: state.projectDroids.map(d => d.id === droidId ? { ...d, ...updates } : d)
  })),
  
  removeProjectDroid: (droidId) => set((state) => ({
    projectDroids: state.projectDroids.filter(d => d.id !== droidId)
  }))
}))
