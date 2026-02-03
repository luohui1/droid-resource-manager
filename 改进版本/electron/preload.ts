import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // 项目管理
  projects: {
    list: () => ipcRenderer.invoke('projects:list'),
    add: (project: unknown) => ipcRenderer.invoke('projects:add', project),
    update: (id: string, updates: unknown) => ipcRenderer.invoke('projects:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('projects:delete', id),
    selectFolder: () => ipcRenderer.invoke('projects:select-folder')
  },

  // 任务管理
  tasks: {
    create: (task: unknown) => ipcRenderer.invoke('tasks:create', task),
    cancel: (taskId: string) => ipcRenderer.invoke('tasks:cancel', taskId),
    retry: (taskId: string) => ipcRenderer.invoke('tasks:retry', taskId),
    get: (taskId: string) => ipcRenderer.invoke('tasks:get', taskId),
    list: () => ipcRenderer.invoke('tasks:list'),
    output: (taskId: string) => ipcRenderer.invoke('tasks:output', taskId),
    priority: (taskId: string, priority: number) => ipcRenderer.invoke('tasks:priority', taskId, priority)
  },

  // Droid 管理
  droids: {
    // 运行状态
    states: () => ipcRenderer.invoke('droids:states'),
    state: (droidId: string) => ipcRenderer.invoke('droids:state', droidId),
    queue: (droidId: string) => ipcRenderer.invoke('droids:queue', droidId),
    stop: (droidId: string) => ipcRenderer.invoke('droids:stop', droidId),
    list: () => ipcRenderer.invoke('droids:list'),
    // Droid CRUD
    projectList: (projectId: string, projectPath: string) => 
      ipcRenderer.invoke('droids:project-list', projectId, projectPath),
    create: (dto: unknown) => ipcRenderer.invoke('droids:create', dto),
    update: (id: string, updates: unknown) => ipcRenderer.invoke('droids:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('droids:delete', id),
    get: (id: string) => ipcRenderer.invoke('droids:get', id),
    export: (droidId: string, projectPath: string) => 
      ipcRenderer.invoke('droids:export', droidId, projectPath),
    generateMainPrompt: (projectName: string, subDroids: unknown[]) => 
      ipcRenderer.invoke('droids:generate-main-prompt', projectName, subDroids)
  },

  // 调度器控制
  scheduler: {
    config: () => ipcRenderer.invoke('scheduler:config'),
    updateConfig: (config: unknown) => ipcRenderer.invoke('scheduler:config:update', config),
    status: () => ipcRenderer.invoke('scheduler:status'),
    pause: () => ipcRenderer.invoke('scheduler:pause'),
    resume: () => ipcRenderer.invoke('scheduler:resume')
  },

  // 系统
  system: {
    getUserDataPath: () => ipcRenderer.invoke('system:get-user-data-path')
  },

  // 事件监听
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const validChannels = [
      'scheduler:event:task-created',
      'scheduler:event:task-status',
      'scheduler:event:task-output',
      'scheduler:event:droid-status',
      'scheduler:event:paused'
    ]
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args))
    }
  },

  off: (channel: string) => {
    ipcRenderer.removeAllListeners(channel)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
