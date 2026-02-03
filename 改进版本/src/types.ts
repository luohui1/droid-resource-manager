import type { ElectronAPI } from '../../electron/preload'

declare global {
  interface Window {
    api: ElectronAPI
  }
}

export type TaskStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
export type DroidStatus = 'idle' | 'running' | 'error'
export type AutoLevel = 'low' | 'medium' | 'high' | 'full'
export type DroidRole = 'main' | 'sub'

// ============ Droid 定义 ============
export interface Droid {
  id: string
  name: string
  description?: string
  role: DroidRole
  systemPrompt: string
  model?: string
  autoLevel?: AutoLevel
  tools?: {
    enabled?: string[]
    disabled?: string[]
  }
  subDroidIds?: string[]
  source: 'created' | 'imported'
  sourcePath?: string
  projectId: string
  createdAt: number
  updatedAt: number
}

export interface CreateDroidDto {
  name: string
  description?: string
  role: DroidRole
  systemPrompt: string
  model?: string
  autoLevel?: AutoLevel
  tools?: {
    enabled?: string[]
    disabled?: string[]
  }
  subDroidIds?: string[]
  projectId: string
}

// ============ 工作流定义 ============
export interface WorkflowStep {
  id: string
  droidId: string
  name: string
  prompt?: string
  dependsOn?: string[]
}

export interface Workflow {
  id: string
  name: string
  description?: string
  projectId: string
  mainDroidId: string
  steps: WorkflowStep[]
  autoDispatch: boolean
  createdAt: number
  updatedAt: number
}

// ============ 项目 ============
export interface Project {
  id: string
  name: string
  path: string
  description?: string
  mainDroidId?: string
  defaultModel?: string
  createdAt: number
  updatedAt: number
}

export interface Task {
  id: string
  name: string
  prompt: string
  projectId: string
  droidId: string
  status: TaskStatus
  priority: number
  autoLevel: AutoLevel
  model?: string
  output: string[]
  error?: string
  retryCount: number
  createdAt: number
  startedAt?: number
  completedAt?: number
  usage?: {
    inputTokens: number
    outputTokens: number
  }
}

export interface DroidState {
  id: string
  name: string
  path: string
  scope: 'global' | 'project'
  projectPath?: string
  status: DroidStatus
  currentTaskId?: string
  queuedTaskIds: string[]
  completedCount: number
  failedCount: number
}

export interface SchedulerConfig {
  maxParallelTasks: number
  maxTasksPerDroid: number
  defaultAutoLevel: AutoLevel
  defaultModel: string
  taskTimeout: number
  watchdogInterval: number
  retryOnFailure: boolean
  maxRetries: number
  retryDelay: number
}

export interface SchedulerStatus {
  running: number
  pending: number
  completed: number
  failed: number
  paused: boolean
}
