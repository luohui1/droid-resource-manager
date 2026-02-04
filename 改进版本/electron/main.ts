import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { Scheduler } from './scheduler'
import { ProjectManager } from './project-manager'
import { ProcessManager } from './process-manager'
import { DroidManager } from './droid-manager'
import { Storage } from './storage'
import type { CreateDroidDto } from './types'

const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null
let scheduler: Scheduler
let projectManager: ProjectManager
let processManager: ProcessManager
let droidManager: DroidManager
let storage: Storage

function createWindow() {
  const iconPath = isDev 
    ? path.join(app.getAppPath(), 'public', 'icon.ico') 
    : path.join(app.getAppPath(), 'dist', 'icon.ico')

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false
    },
    frame: true,
    show: true,
    backgroundColor: '#0a0a0f'
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function initializeServices() {
  const userDataPath = app.getPath('userData')
  
  storage = new Storage(userDataPath)
  projectManager = new ProjectManager(userDataPath)
  processManager = new ProcessManager()
  droidManager = new DroidManager(storage)
  scheduler = new Scheduler(projectManager, processManager, (event, data) => {
    mainWindow?.webContents.send(event, data)
  })
}

app.whenReady().then(() => {
  initializeServices()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  processManager?.killAll()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// ============ IPC Handlers ============

// 项目管理
ipcMain.handle('projects:list', () => projectManager.listProjects())
ipcMain.handle('projects:add', (_, project) => projectManager.addProject(project))
ipcMain.handle('projects:update', (_, id, updates) => projectManager.updateProject(id, updates))
ipcMain.handle('projects:delete', (_, id) => projectManager.deleteProject(id))
ipcMain.handle('projects:select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
    title: '选择项目目录'
  })
  return result.canceled ? null : result.filePaths[0]
})
ipcMain.handle('projects:tree', (_, projectPath: string) => buildFileTree(projectPath, projectPath, 4))
ipcMain.handle('projects:read-file', (_, projectPath: string, relativePath: string) => readProjectFile(projectPath, relativePath))

// Droid 管理（新增）
ipcMain.handle('droids:project-list', (_, projectId: string, projectPath: string) => 
  droidManager.getProjectDroids(projectId, projectPath))
ipcMain.handle('droids:create', (_, dto: CreateDroidDto) => droidManager.createDroid(dto))
ipcMain.handle('droids:update', (_, id: string, updates: Partial<CreateDroidDto>) => 
  droidManager.updateDroid(id, updates))
ipcMain.handle('droids:delete', (_, id: string) => droidManager.deleteDroid(id))
ipcMain.handle('droids:get', (_, id: string) => droidManager.getDroid(id))
ipcMain.handle('droids:export', (_, droidId: string, projectPath: string) => {
  const droid = droidManager.getDroid(droidId)
  if (!droid) return { success: false, error: 'Droid not found' }
  return droidManager.exportDroid(droid, projectPath)
})
ipcMain.handle('droids:generate-main-prompt', (_, projectName: string, subDroids: unknown[]) => 
  droidManager.generateMainDroidPrompt(projectName, subDroids as Parameters<typeof droidManager.generateMainDroidPrompt>[1]))

// 任务管理
ipcMain.handle('tasks:create', (_, task) => scheduler.createTask(task))
ipcMain.handle('tasks:cancel', (_, taskId) => scheduler.cancelTask(taskId))
ipcMain.handle('tasks:retry', (_, taskId) => scheduler.retryTask(taskId))
ipcMain.handle('tasks:get', (_, taskId) => scheduler.getTask(taskId))
ipcMain.handle('tasks:list', () => scheduler.listTasks())
ipcMain.handle('tasks:output', (_, taskId) => scheduler.getTaskOutput(taskId))
ipcMain.handle('tasks:priority', (_, taskId, priority) => scheduler.updateTaskPriority(taskId, priority))

// Droid 运行状态
ipcMain.handle('droids:states', () => scheduler.getDroidStates())
ipcMain.handle('droids:state', (_, droidId) => scheduler.getDroidState(droidId))
ipcMain.handle('droids:queue', (_, droidId) => scheduler.getDroidQueue(droidId))
ipcMain.handle('droids:stop', (_, droidId) => scheduler.stopDroid(droidId))
ipcMain.handle('droids:list', () => scheduler.listAvailableDroids())

// 调度器控制
ipcMain.handle('scheduler:config', () => scheduler.getConfig())
ipcMain.handle('scheduler:config:update', (_, config) => scheduler.updateConfig(config))
ipcMain.handle('scheduler:status', () => scheduler.getStatus())
ipcMain.handle('scheduler:pause', () => scheduler.pause())
ipcMain.handle('scheduler:resume', () => scheduler.resume())

// 系统
ipcMain.handle('system:get-user-data-path', () => app.getPath('userData'))
ipcMain.handle('system:get-factory-settings', async () => {
  const settingsPath = path.join(os.homedir(), '.factory', 'settings.json')
  try {
    if (fs.existsSync(settingsPath)) {
      const content = fs.readFileSync(settingsPath, 'utf-8')
      return JSON.parse(content)
    }
  } catch (e) {
    console.error('Failed to read factory settings:', e)
  }
  return null
})

type FileNode = {
  name: string
  path: string
  type: 'file' | 'dir'
  children?: FileNode[]
}

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'dist-electron', 'release', '.factory'])
const MAX_TREE_FILES = 2000

function buildFileTree(root: string, current: string, depth: number, counter = { value: 0 }): FileNode[] {
  if (depth < 0) return []
  let entries: string[] = []
  try {
    entries = fs.readdirSync(current)
  } catch {
    return []
  }

  const nodes: FileNode[] = []
  for (const entry of entries) {
    if (counter.value >= MAX_TREE_FILES) break
    if (IGNORED_DIRS.has(entry)) continue

    const fullPath = path.join(current, entry)
    let stat: fs.Stats
    try {
      stat = fs.statSync(fullPath)
    } catch {
      continue
    }
    const relPath = path.relative(root, fullPath)

    if (stat.isDirectory()) {
      nodes.push({
        name: entry,
        path: relPath,
        type: 'dir',
        children: buildFileTree(root, fullPath, depth - 1, counter)
      })
    } else {
      counter.value += 1
      nodes.push({ name: entry, path: relPath, type: 'file' })
    }
  }

  return nodes
}

function readProjectFile(projectPath: string, relativePath: string): { content?: string; error?: string } {
  const resolved = path.resolve(projectPath, relativePath)
  const normalizedRoot = path.resolve(projectPath)
  if (!resolved.startsWith(normalizedRoot)) {
    return { error: '非法路径访问' }
  }

  try {
    const stat = fs.statSync(resolved)
    if (!stat.isFile()) return { error: '不是文件' }
    if (stat.size > 200_000) return { error: '文件过大' }
    const content = fs.readFileSync(resolved, 'utf-8')
    return { content }
  } catch {
    return { error: '读取失败' }
  }
}
