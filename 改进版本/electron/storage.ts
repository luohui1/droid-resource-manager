import fs from 'fs'
import path from 'path'
import type { Project, Task, SchedulerConfig, DroidState, Droid, Workflow } from './types'

// Repository Pattern - 数据访问抽象层
export class Storage {
  private basePath: string
  private schedulerPath: string

  constructor(userDataPath: string) {
    this.basePath = userDataPath
    this.schedulerPath = path.join(userDataPath, 'scheduler')
    this.ensureDirectories()
  }

  private ensureDirectories() {
    const dirs = [
      this.schedulerPath,
      path.join(this.schedulerPath, 'tasks'),
      path.join(this.schedulerPath, 'tasks', 'outputs')
    ]
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    }
  }

  private readJson<T>(filePath: string, defaultValue: T): T {
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      }
    } catch (e) {
      console.error(`Failed to read ${filePath}:`, e)
    }
    return defaultValue
  }

  private writeJson(filePath: string, data: unknown): boolean {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
      return true
    } catch (e) {
      console.error(`Failed to write ${filePath}:`, e)
      return false
    }
  }

  // ============ Projects ============
  getProjects(): Project[] {
    return this.readJson(path.join(this.schedulerPath, 'projects.json'), [])
  }

  saveProjects(projects: Project[]): boolean {
    return this.writeJson(path.join(this.schedulerPath, 'projects.json'), projects)
  }

  // ============ Droids ============
  getDroids(): Droid[] {
    return this.readJson(path.join(this.schedulerPath, 'droids.json'), [])
  }

  saveDroids(droids: Droid[]): boolean {
    return this.writeJson(path.join(this.schedulerPath, 'droids.json'), droids)
  }

  // ============ Workflows ============
  getWorkflows(): Workflow[] {
    return this.readJson(path.join(this.schedulerPath, 'workflows.json'), [])
  }

  saveWorkflows(workflows: Workflow[]): boolean {
    return this.writeJson(path.join(this.schedulerPath, 'workflows.json'), workflows)
  }

  // ============ Tasks ============
  getPendingTasks(): Task[] {
    return this.readJson(path.join(this.schedulerPath, 'tasks', 'pending.json'), [])
  }

  savePendingTasks(tasks: Task[]): boolean {
    return this.writeJson(path.join(this.schedulerPath, 'tasks', 'pending.json'), tasks)
  }

  getHistoryTasks(): Task[] {
    return this.readJson(path.join(this.schedulerPath, 'tasks', 'history.json'), [])
  }

  saveHistoryTasks(tasks: Task[]): boolean {
    const maxHistory = 1000
    const trimmed = tasks.slice(-maxHistory)
    return this.writeJson(path.join(this.schedulerPath, 'tasks', 'history.json'), trimmed)
  }

  // ============ Task Output ============
  appendTaskOutput(taskId: string, line: string): void {
    const outputPath = path.join(this.schedulerPath, 'tasks', 'outputs', `${taskId}.log`)
    fs.appendFileSync(outputPath, line + '\n', 'utf-8')
  }

  getTaskOutput(taskId: string): string[] {
    const outputPath = path.join(this.schedulerPath, 'tasks', 'outputs', `${taskId}.log`)
    try {
      if (fs.existsSync(outputPath)) {
        return fs.readFileSync(outputPath, 'utf-8').split('\n').filter(Boolean)
      }
    } catch (e) {
      console.error(`Failed to read task output ${taskId}:`, e)
    }
    return []
  }

  saveTaskJsonl(taskId: string, event: unknown): void {
    const jsonlPath = path.join(this.schedulerPath, 'tasks', 'outputs', `${taskId}.jsonl`)
    fs.appendFileSync(jsonlPath, JSON.stringify(event) + '\n', 'utf-8')
  }

  // ============ Droid States ============
  getDroidStates(): DroidState[] {
    return this.readJson(path.join(this.schedulerPath, 'droid-states.json'), [])
  }

  saveDroidStates(states: DroidState[]): boolean {
    return this.writeJson(path.join(this.schedulerPath, 'droid-states.json'), states)
  }

  // ============ Config ============
  getConfig(): SchedulerConfig {
    return this.readJson(path.join(this.schedulerPath, 'config.json'), {
      maxParallelTasks: 4,
      maxTasksPerDroid: 1,
      defaultAutoLevel: 'medium',
      defaultModel: 'claude-sonnet-4-20250514',
      taskTimeout: 30 * 60 * 1000,
      watchdogInterval: 5000,
      retryOnFailure: true,
      maxRetries: 2,
      retryDelay: 5000
    })
  }

  saveConfig(config: SchedulerConfig): boolean {
    return this.writeJson(path.join(this.schedulerPath, 'config.json'), config)
  }
}
