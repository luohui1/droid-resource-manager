import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
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
