import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { Storage } from './storage'
import { ProcessManager } from './process-manager'
import { ProjectManager } from './project-manager'
import type {
  Task, DroidState, SchedulerConfig, SchedulerStatus,
  CreateTaskDto, StreamJsonEvent
} from './types'

type EventEmitter = (event: string, data: unknown) => void

export class Scheduler {
  private storage: Storage
  private processManager: ProcessManager
  private projectManager: ProjectManager
  private emit: EventEmitter
  private paused = false
  private watchdogTimer?: NodeJS.Timeout

  constructor(
    projectManager: ProjectManager,
    processManager: ProcessManager,
    emit: EventEmitter
  ) {
    this.projectManager = projectManager
    this.processManager = processManager
    this.emit = emit
    
    const userDataPath = process.env.APPDATA || 
      (process.platform === 'darwin' 
        ? path.join(os.homedir(), 'Library', 'Application Support')
        : path.join(os.homedir(), '.config'))
    
    this.storage = new Storage(path.join(userDataPath, 'droid-workflow-scheduler'))

    this.processManager.setCallbacks(
      this.handleProcessOutput.bind(this),
      this.handleProcessExit.bind(this)
    )

    this.startWatchdog()
  }

  // ============ Task Management ============
  createTask(dto: CreateTaskDto): Task {
    const config = this.storage.getConfig()
    const tasks = this.storage.getPendingTasks()

    const task: Task = {
      id: uuidv4(),
      name: dto.name,
      prompt: dto.prompt,
      projectId: dto.projectId,
      droidId: dto.droidId,
      status: 'pending',
      priority: dto.priority ?? 5,
      autoLevel: dto.autoLevel ?? config.defaultAutoLevel,
      model: dto.model,
      enabledTools: dto.enabledTools,
      disabledTools: dto.disabledTools,
      output: [],
      retryCount: 0,
      createdAt: Date.now()
    }

    tasks.push(task)
    this.storage.savePendingTasks(tasks)
    this.updateDroidQueue(task.droidId, task.id, 'add')
    this.emit('scheduler:event:task-created', task)

    if (!this.paused) {
      this.scheduleNext()
    }

    return task
  }

  cancelTask(taskId: string): boolean {
    const tasks = this.storage.getPendingTasks()
    const task = tasks.find(t => t.id === taskId)

    if (!task) return false

    if (task.status === 'running') {
      this.processManager.kill(taskId)
    }

    task.status = 'cancelled'
    task.completedAt = Date.now()
    this.moveToHistory(task)
    this.updateDroidQueue(task.droidId, taskId, 'remove')
    this.emit('scheduler:event:task-status', { taskId, status: 'cancelled' })

    return true
  }

  retryTask(taskId: string): Task | null {
    const history = this.storage.getHistoryTasks()
    const oldTask = history.find(t => t.id === taskId)

    if (!oldTask || oldTask.status !== 'failed') return null

    return this.createTask({
      name: oldTask.name,
      prompt: oldTask.prompt,
      projectId: oldTask.projectId,
      droidId: oldTask.droidId,
      autoLevel: oldTask.autoLevel,
      model: oldTask.model,
      priority: oldTask.priority
    })
  }

  getTask(taskId: string): Task | undefined {
    const pending = this.storage.getPendingTasks()
    const found = pending.find(t => t.id === taskId)
    if (found) return found

    const history = this.storage.getHistoryTasks()
    return history.find(t => t.id === taskId)
  }

  listTasks(): { pending: Task[]; history: Task[] } {
    return {
      pending: this.storage.getPendingTasks(),
      history: this.storage.getHistoryTasks()
    }
  }

  getTaskOutput(taskId: string): string[] {
    return this.storage.getTaskOutput(taskId)
  }

  updateTaskPriority(taskId: string, priority: number): Task | null {
    const tasks = this.storage.getPendingTasks()
    const task = tasks.find(t => t.id === taskId)

    if (!task || task.status === 'running') return null

    task.priority = Math.max(1, Math.min(10, priority))
    this.storage.savePendingTasks(tasks)
    return task
  }

  // ============ Droid Management ============
  getDroidStates(): DroidState[] {
    return this.storage.getDroidStates()
  }

  getDroidState(droidId: string): DroidState | undefined {
    return this.storage.getDroidStates().find(d => d.id === droidId)
  }

  getDroidQueue(droidId: string): Task[] {
    const state = this.getDroidState(droidId)
    if (!state) return []

    const tasks = this.storage.getPendingTasks()
    return state.queuedTaskIds
      .map(id => tasks.find(t => t.id === id))
      .filter((t): t is Task => !!t)
  }

  stopDroid(droidId: string): boolean {
    const state = this.getDroidState(droidId)
    if (!state?.currentTaskId) return false

    return this.cancelTask(state.currentTaskId)
  }

  listAvailableDroids(): DroidState[] {
    const globalPath = path.join(os.homedir(), '.factory', 'droids')
    const droids: DroidState[] = []

    if (fs.existsSync(globalPath)) {
      const files = fs.readdirSync(globalPath).filter(f => f.endsWith('.md'))
      for (const file of files) {
        const name = file.replace('.md', '')
        const id = `global:${name}`
        const existing = this.getDroidState(id)
        
        droids.push(existing || {
          id,
          name,
          path: path.join(globalPath, file),
          scope: 'global',
          status: 'idle',
          queuedTaskIds: [],
          completedCount: 0,
          failedCount: 0
        })
      }
    }

    return droids
  }

  // ============ Scheduler Control ============
  getConfig(): SchedulerConfig {
    return this.storage.getConfig()
  }

  updateConfig(updates: Partial<SchedulerConfig>): SchedulerConfig {
    const config = { ...this.storage.getConfig(), ...updates }
    this.storage.saveConfig(config)
    return config
  }

  getStatus(): SchedulerStatus {
    const pending = this.storage.getPendingTasks()
    const history = this.storage.getHistoryTasks()

    return {
      running: pending.filter(t => t.status === 'running').length,
      pending: pending.filter(t => t.status === 'pending' || t.status === 'queued').length,
      completed: history.filter(t => t.status === 'completed').length,
      failed: history.filter(t => t.status === 'failed').length,
      paused: this.paused
    }
  }

  pause(): boolean {
    this.paused = true
    this.emit('scheduler:event:paused', true)
    return true
  }

  resume(): boolean {
    this.paused = false
    this.emit('scheduler:event:paused', false)
    this.scheduleNext()
    return true
  }

  // ============ Internal Methods ============
  private scheduleNext(): void {
    if (this.paused) return

    const config = this.storage.getConfig()
    const tasks = this.storage.getPendingTasks()
    const runningCount = this.processManager.getRunningCount()

    if (runningCount >= config.maxParallelTasks) return

    const pendingTasks = tasks
      .filter(t => t.status === 'pending' || t.status === 'queued')
      .sort((a, b) => b.priority - a.priority)

    for (const task of pendingTasks) {
      if (runningCount >= config.maxParallelTasks) break
      if (!this.canStartTask(task, config)) continue

      this.startTask(task)
    }
  }

  private canStartTask(task: Task, config: SchedulerConfig): boolean {
    const droidTasks = this.storage.getPendingTasks()
      .filter(t => t.droidId === task.droidId && t.status === 'running')

    return droidTasks.length < config.maxTasksPerDroid
  }

  private startTask(task: Task): void {
    const project = this.projectManager.getProject(task.projectId)
    if (!project) {
      this.failTask(task, 'Project not found')
      return
    }

    const config = this.storage.getConfig()
    task.status = 'running'
    task.startedAt = Date.now()
    task.pid = undefined

    const success = this.processManager.spawn(task, project.path, config.defaultModel)

    if (success) {
      task.pid = this.processManager.getPid(task.id)
      this.updateTask(task)
      this.updateDroidStatus(task.droidId, 'running', task.id)
      this.emit('scheduler:event:task-status', { taskId: task.id, status: 'running' })
    } else {
      this.failTask(task, 'Failed to start process')
    }
  }

  private handleProcessOutput(taskId: string, event: StreamJsonEvent): void {
    const task = this.getTask(taskId)
    if (!task) return

    this.storage.saveTaskJsonl(taskId, event)

    if (event.type === 'init' && event.session_id) {
      task.sessionId = event.session_id
      this.updateTask(task)
    }

    if (event.type === 'assistant' && event.text) {
      task.output.push(event.text)
      this.storage.appendTaskOutput(taskId, event.text)
    }

    if (event.type === 'result' && event.usage) {
      task.usage = {
        inputTokens: event.usage.input_tokens,
        outputTokens: event.usage.output_tokens
      }
      this.updateTask(task)
    }

    this.emit('scheduler:event:task-output', { taskId, event })
  }

  private handleProcessExit(taskId: string, code: number | null, _signal: string | null): void {
    const task = this.getTask(taskId)
    if (!task) return
    void _signal

    if (code === 0) {
      task.status = 'completed'
      task.completedAt = Date.now()
      this.incrementDroidCount(task.droidId, 'completed')
    } else {
      const config = this.storage.getConfig()
      if (config.retryOnFailure && task.retryCount < config.maxRetries) {
        task.retryCount++
        task.status = 'pending'
        this.updateTask(task)
        setTimeout(() => this.scheduleNext(), config.retryDelay)
        return
      }

      task.status = 'failed'
      task.error = `Process exited with code ${code}`
      task.completedAt = Date.now()
      this.incrementDroidCount(task.droidId, 'failed')
    }

    this.moveToHistory(task)
    this.updateDroidStatus(task.droidId, 'idle')
    this.emit('scheduler:event:task-status', { taskId, status: task.status })
    this.scheduleNext()
  }

  private updateTask(task: Task): void {
    const tasks = this.storage.getPendingTasks()
    const index = tasks.findIndex(t => t.id === task.id)
    if (index !== -1) {
      tasks[index] = task
      this.storage.savePendingTasks(tasks)
    }
  }

  private moveToHistory(task: Task): void {
    const pending = this.storage.getPendingTasks()
    const filtered = pending.filter(t => t.id !== task.id)
    this.storage.savePendingTasks(filtered)

    const history = this.storage.getHistoryTasks()
    history.push(task)
    this.storage.saveHistoryTasks(history)
  }

  private failTask(task: Task, error: string): void {
    task.status = 'failed'
    task.error = error
    task.completedAt = Date.now()
    this.moveToHistory(task)
    this.updateDroidStatus(task.droidId, 'error')
    this.emit('scheduler:event:task-status', { taskId: task.id, status: 'failed', error })
  }

  private updateDroidQueue(droidId: string, taskId: string, action: 'add' | 'remove'): void {
    const states = this.storage.getDroidStates()
    let state = states.find(d => d.id === droidId)

    if (!state) {
      state = {
        id: droidId,
        name: droidId.split(':')[1] || droidId,
        path: '',
        scope: 'global',
        status: 'idle',
        queuedTaskIds: [],
        completedCount: 0,
        failedCount: 0
      }
      states.push(state)
    }

    if (action === 'add') {
      if (!state.queuedTaskIds.includes(taskId)) {
        state.queuedTaskIds.push(taskId)
      }
    } else {
      state.queuedTaskIds = state.queuedTaskIds.filter(id => id !== taskId)
    }

    this.storage.saveDroidStates(states)
  }

  private updateDroidStatus(droidId: string, status: DroidState['status'], currentTaskId?: string): void {
    const states = this.storage.getDroidStates()
    const state = states.find(d => d.id === droidId)

    if (state) {
      state.status = status
      state.currentTaskId = currentTaskId
      if (!currentTaskId) {
        state.queuedTaskIds = state.queuedTaskIds.filter(id => id !== state.currentTaskId)
      }
      this.storage.saveDroidStates(states)
      this.emit('scheduler:event:droid-status', { droidId, status })
    }
  }

  private incrementDroidCount(droidId: string, type: 'completed' | 'failed'): void {
    const states = this.storage.getDroidStates()
    const state = states.find(d => d.id === droidId)

    if (state) {
      if (type === 'completed') state.completedCount++
      else state.failedCount++
      this.storage.saveDroidStates(states)
    }
  }

  private startWatchdog(): void {
    const config = this.storage.getConfig()
    
    this.watchdogTimer = setInterval(() => {
      const tasks = this.storage.getPendingTasks()
      const now = Date.now()

      for (const task of tasks) {
        if (task.status === 'running' && task.startedAt) {
          if (now - task.startedAt > config.taskTimeout) {
            console.warn(`Task ${task.id} timed out`)
            this.cancelTask(task.id)
          }
        }
      }
    }, config.watchdogInterval)
  }

  destroy(): void {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer)
    }
    this.processManager.killAll()
  }
}
