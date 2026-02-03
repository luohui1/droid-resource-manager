// ============ 核心类型定义 ============

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
  // 主 Droid 特有：可调度的子 Droid 列表
  subDroidIds?: string[]
  // 来源
  source: 'created' | 'imported'  // created=UI创建, imported=从.factory读取
  sourcePath?: string             // imported 时的文件路径
  projectId: string               // 所属项目
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

// ============ 工作流定义（简化版 DAG）============
export interface WorkflowStep {
  id: string
  droidId: string
  name: string
  prompt?: string           // 可选，覆盖任务 prompt
  dependsOn?: string[]      // 依赖的步骤 ID（前置步骤完成后才执行）
  condition?: string        // 条件表达式（可选）
}

export interface Workflow {
  id: string
  name: string
  description?: string
  projectId: string
  mainDroidId: string       // 主 Droid（负责分发）
  steps: WorkflowStep[]     // 执行步骤
  autoDispatch: boolean     // 是否由主 Droid 自动分发
  createdAt: number
  updatedAt: number
}

export interface CreateWorkflowDto {
  name: string
  description?: string
  projectId: string
  mainDroidId: string
  steps: Omit<WorkflowStep, 'id'>[]
  autoDispatch?: boolean
}

// ============ 项目 ============
export interface Project {
  id: string
  name: string
  path: string
  description?: string
  mainDroidId?: string      // 项目主 Droid
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
  enabledTools?: string[]
  disabledTools?: string[]
  sessionId?: string
  pid?: number
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

export interface CreateTaskDto {
  name: string
  prompt: string
  projectId: string
  droidId: string
  autoLevel?: AutoLevel
  model?: string
  priority?: number
  enabledTools?: string[]
  disabledTools?: string[]
}

export interface CreateProjectDto {
  name: string
  path: string
  description?: string
  defaultDroidId?: string
  defaultModel?: string
}

export interface StreamJsonEvent {
  type: 'init' | 'assistant' | 'tool_use' | 'tool_result' | 'result' | 'error'
  session_id?: string
  text?: string
  tool?: { name: string; input: unknown }
  result?: unknown
  usage?: { input_tokens: number; output_tokens: number }
  error?: string
}
