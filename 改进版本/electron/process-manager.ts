import { spawn, ChildProcess } from 'child_process'
import type { Task, StreamJsonEvent, Droid } from './types'

interface RunningProcess {
  process: ChildProcess
  taskId: string
  startTime: number
}

interface SpawnOptions {
  task: Task
  projectPath: string
  model: string
  droid?: Droid
}

type OutputCallback = (taskId: string, event: StreamJsonEvent) => void
type ExitCallback = (taskId: string, code: number | null, signal: string | null) => void

export class ProcessManager {
  private processes: Map<string, RunningProcess> = new Map()
  private onOutput?: OutputCallback
  private onExit?: ExitCallback

  setCallbacks(onOutput: OutputCallback, onExit: ExitCallback) {
    this.onOutput = onOutput
    this.onExit = onExit
  }

  spawn(options: SpawnOptions): boolean {
    const { task, projectPath, model, droid } = options

    if (this.processes.has(task.id)) {
      console.warn(`Task ${task.id} already running`)
      return false
    }

    const args = [
      'exec',
      '--output-format', 'stream-json',
      '--auto', task.autoLevel,
      '--cwd', projectPath,
      '--model', task.model || model
    ]

    // 如果是导入的 Droid，使用 --droid 参数
    if (droid?.source === 'imported' && droid.sourcePath) {
      // 从 sourcePath 提取 droid 名称 (例如 .factory/droids/my-droid.md -> my-droid)
      const droidName = droid.sourcePath.split(/[/\\]/).pop()?.replace('.md', '')
      if (droidName) {
        args.push('--droid', droidName)
      }
    }

    if (task.enabledTools?.length) {
      args.push('--enabled-tools', task.enabledTools.join(','))
    }
    if (task.disabledTools?.length) {
      args.push('--disabled-tools', task.disabledTools.join(','))
    }

    // 构建最终 prompt
    let finalPrompt = task.prompt
    
    // 如果是创建的 Droid，将 systemPrompt 注入到任务 prompt 前面
    if (droid?.source === 'created' && droid.systemPrompt) {
      finalPrompt = `[System Context]\n${droid.systemPrompt}\n\n[Task]\n${task.prompt}`
    }

    args.push(finalPrompt)

    try {
      const proc = spawn('droid', args, {
        cwd: projectPath,
        env: { ...process.env },
        shell: true,
        windowsHide: true
      })

      const running: RunningProcess = {
        process: proc,
        taskId: task.id,
        startTime: Date.now()
      }

      this.processes.set(task.id, running)

      let buffer = ''

      proc.stdout?.on('data', (data: Buffer) => {
        buffer += data.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.trim()) {
            try {
              const event = JSON.parse(line) as StreamJsonEvent
              this.onOutput?.(task.id, event)
            } catch {
              this.onOutput?.(task.id, { type: 'assistant', text: line })
            }
          }
        }
      })

      proc.stderr?.on('data', (data: Buffer) => {
        const text = data.toString().trim()
        if (text) {
          this.onOutput?.(task.id, { type: 'error', error: text })
        }
      })

      proc.on('error', (err) => {
        console.error(`Process error for task ${task.id}:`, err)
        this.onOutput?.(task.id, { type: 'error', error: err.message })
      })

      proc.on('exit', (code, signal) => {
        this.processes.delete(task.id)
        this.onExit?.(task.id, code, signal)
      })

      return true
    } catch (e) {
      console.error(`Failed to spawn process for task ${task.id}:`, e)
      return false
    }
  }

  kill(taskId: string): boolean {
    const running = this.processes.get(taskId)
    if (!running) return false

    try {
      running.process.kill('SIGTERM')
      setTimeout(() => {
        if (this.processes.has(taskId)) {
          running.process.kill('SIGKILL')
        }
      }, 5000)
      return true
    } catch (e) {
      console.error(`Failed to kill task ${taskId}:`, e)
      return false
    }
  }

  killAll(): void {
    for (const [taskId] of this.processes) {
      this.kill(taskId)
    }
  }

  isRunning(taskId: string): boolean {
    return this.processes.has(taskId)
  }

  getRunningCount(): number {
    return this.processes.size
  }

  getPid(taskId: string): number | undefined {
    return this.processes.get(taskId)?.process.pid
  }
}
