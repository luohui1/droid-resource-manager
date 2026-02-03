import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import { spawn, ChildProcess } from 'child_process'
import os from 'os'
import net from 'net'
import * as skills from './skills'
import * as droids from './droids'
import * as prompts from './prompts'
import * as rules from './rules'

const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null

const DATA_FILE = path.join(app.getPath('userData'), 'droid-resources.json')
const MCP_CONFIG_PATH = path.join(os.homedir(), '.factory', 'mcp.json')
const RESOURCE_CENTER_PATH = 'D:\\work\\AI'
const RESOURCE_CENTER_MCP_PATH = path.join(RESOURCE_CENTER_PATH, '.factory', 'mcp.json')

const WINDOWS_DRIVE_LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))

function getWindowsDrives(): string[] {
  return WINDOWS_DRIVE_LETTERS
    .map(letter => `${letter}:\\`)
    .filter(drive => {
      try {
        return fs.existsSync(drive)
      } catch {
        return false
      }
    })
}

// MCP 连接状态
interface McpConnection {
  name: string
  process: ChildProcess
  pid: number
  startTime: number
  logs: string[]
  serverInfo?: {
    name: string
    version: string
  }
  tools: McpTool[]
  connected: boolean
  pendingRequests: Map<number, {
    resolve: (value: unknown) => void
    reject: (error: Error) => void
    method: string
    startTime: number
  }>
  requestId: number
  callHistory: McpCallRecord[]
}

interface HttpConnection {
  name: string
  connected: boolean | undefined
  lastChecked?: number
  serverInfo?: {
    name: string
    version: string
  }
  tools: McpTool[]
  callHistory: McpCallRecord[]
  requestId: number
}

interface McpTool {
  name: string
  description: string
  inputSchema: unknown
}

interface McpCallRecord {
  id: number
  method: string
  params?: unknown
  result?: unknown
  error?: string
  startTime: number
  endTime?: number
  duration?: number
}

const mcpConnections = new Map<string, McpConnection>()
const httpConnections = new Map<string, HttpConnection>()

// MCP 配置类型
interface McpServerConfig {
  type: 'stdio' | 'http'
  disabled?: boolean
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
}

interface McpConfig {
  mcpServers: Record<string, McpServerConfig>
}

function createWindow() {
  const iconPath = isDev
    ? path.join(app.getAppPath(), 'public', 'icon.ico')
    : path.join(app.getAppPath(), 'dist', 'icon.ico')
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false
    },
    frame: true,
    show: true,
    backgroundColor: '#f9fafb'
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

// ============ 资源数据操作 ============
function loadData(): unknown {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
    }
  } catch (e) {
    console.error('Failed to load data:', e)
  }
  return { resources: [], tags: [] }
}

function saveData(data: unknown): boolean {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
    return true
  } catch (e) {
    console.error('Failed to save data:', e)
    return false
  }
}

// ============ MCP 配置管理 ============
function loadMcpConfig(): McpConfig {
  try {
    if (fs.existsSync(MCP_CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(MCP_CONFIG_PATH, 'utf-8'))
    }
  } catch (e) {
    console.error('Failed to load MCP config:', e)
  }
  return { mcpServers: {} }
}

function saveMcpConfig(config: McpConfig): boolean {
  try {
    const dir = path.dirname(MCP_CONFIG_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(MCP_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
    return true
  } catch (e) {
    console.error('Failed to save MCP config:', e)
    return false
  }
}

function loadResourceCenterMcpConfig(): McpConfig {
  try {
    if (fs.existsSync(RESOURCE_CENTER_MCP_PATH)) {
      return JSON.parse(fs.readFileSync(RESOURCE_CENTER_MCP_PATH, 'utf-8'))
    }
  } catch (e) {
    console.error('Failed to load resource center MCP config:', e)
  }
  return { mcpServers: {} }
}

function saveResourceCenterMcpConfig(config: McpConfig): boolean {
  try {
    const dir = path.dirname(RESOURCE_CENTER_MCP_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(RESOURCE_CENTER_MCP_PATH, JSON.stringify(config, null, 2), 'utf-8')
    return true
  } catch (e) {
    console.error('Failed to save resource center MCP config:', e)
    return false
  }
}

function resolveMcpPort(name: string, server: McpServerConfig): number | null {
  const envPort = server.env?.BROWSERMCP_PORT || server.env?.PORT
  if (envPort) {
    const parsed = Number(envPort)
    return Number.isFinite(parsed) ? parsed : null
  }
  if (name.toLowerCase().includes('browsermcp')) {
    return 9009
  }
  return null
}

function checkPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net.createServer()
    tester.once('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') {
        resolve(false)
      } else {
        resolve(true)
      }
    })
    tester.once('listening', () => {
      tester.close(() => resolve(true))
    })
    tester.listen(port, '127.0.0.1')
  })
}

function extractNpmSpec(args?: string[]): { name: string; version?: string } | null {
  if (!args || args.length === 0) return null
  const spec = args.find((arg) => !arg.startsWith('-'))
  if (!spec) return null

  if (spec.startsWith('@')) {
    const lastAt = spec.lastIndexOf('@')
    if (lastAt > 0) {
      return { name: spec.slice(0, lastAt), version: spec.slice(lastAt + 1) }
    }
    return { name: spec }
  }

  const atIndex = spec.lastIndexOf('@')
  if (atIndex > 0) {
    return { name: spec.slice(0, atIndex), version: spec.slice(atIndex + 1) }
  }
  return { name: spec }
}

function compareVersions(a: string, b: string): number {
  const [baseA] = a.split('-')
  const [baseB] = b.split('-')
  const partsA = baseA.split('.').map((n) => Number(n))
  const partsB = baseB.split('.').map((n) => Number(n))
  const max = Math.max(partsA.length, partsB.length)
  for (let i = 0; i < max; i += 1) {
    const left = partsA[i] ?? 0
    const right = partsB[i] ?? 0
    if (left > right) return 1
    if (left < right) return -1
  }
  return 0
}

async function mcpCheckUpdate(name: string): Promise<{
  success: boolean
  packageName?: string
  currentVersion?: string
  latestVersion?: string
  updateAvailable?: boolean
  error?: string
}> {
  const config = loadMcpConfig()
  const server = config.mcpServers[name]
  if (!server) {
    return { success: false, error: `服务器 "${name}" 不存在` }
  }

  const command = server.command || ''
  if (!command.toLowerCase().includes('npx')) {
    return { success: false, error: '仅支持通过 npx 启动的 MCP 更新检查' }
  }

  const spec = extractNpmSpec(server.args)
  if (!spec) {
    return { success: false, error: '未找到 npm 包信息' }
  }

  try {
    const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(spec.name)}`)
    if (!response.ok) {
      return { success: false, error: `查询失败: ${response.status}` }
    }
    const data = await response.json()
    const latest = data?.['dist-tags']?.latest as string | undefined
    if (!latest) {
      return { success: false, error: '未获取到 latest 版本' }
    }

    const current = spec.version || 'latest'
    const updateAvailable = current !== 'latest' && compareVersions(current, latest) < 0
    return {
      success: true,
      packageName: spec.name,
      currentVersion: current,
      latestVersion: latest,
      updateAvailable
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ============ MCP 客户端功能 ============

// 发送 JSON-RPC 请求
function sendMcpRequest(conn: McpConnection, method: string, params?: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = ++conn.requestId
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params: params || {}
    }
    
    const record: McpCallRecord = {
      id,
      method,
      params,
      startTime: Date.now()
    }
    conn.callHistory.push(record)
    if (conn.callHistory.length > 100) conn.callHistory.shift()
    
    conn.pendingRequests.set(id, {
      resolve: (result) => {
        record.result = result
        record.endTime = Date.now()
        record.duration = record.endTime - record.startTime
        resolve(result)
      },
      reject: (error) => {
        record.error = error.message
        record.endTime = Date.now()
        record.duration = record.endTime - record.startTime
        reject(error)
      },
      method,
      startTime: Date.now()
    })
    
    const requestStr = JSON.stringify(request)
    conn.logs.push(`[send] ${requestStr}`)
    if (conn.logs.length > 100) conn.logs.shift()
    
    console.log(`[${conn.name}] Sending:`, requestStr)
    conn.process.stdin?.write(requestStr + '\n')
    
    // 超时处理
    setTimeout(() => {
      if (conn.pendingRequests.has(id)) {
        conn.pendingRequests.delete(id)
        record.error = 'Request timeout'
        record.endTime = Date.now()
        record.duration = record.endTime - record.startTime
        reject(new Error('Request timeout'))
      }
    }, 30000)
  })
}

async function sendHttpRequest(conn: HttpConnection, server: McpServerConfig, method: string, params?: unknown): Promise<unknown> {
  const id = ++conn.requestId
  const record: McpCallRecord = {
    id,
    method,
    params,
    startTime: Date.now()
  }
  conn.callHistory.push(record)
  if (conn.callHistory.length > 100) conn.callHistory.shift()

  try {
    const response = await fetch(server.url!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(server.headers || {})
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id,
        method,
        params: params || {}
      })
    })

    const json = await response.json()
    if (json.error) {
      throw new Error(json.error.message || 'Remote error')
    }
    record.result = json.result
    record.endTime = Date.now()
    record.duration = record.endTime - record.startTime
    return json.result
  } catch (e) {
    record.error = (e as Error).message
    record.endTime = Date.now()
    record.duration = record.endTime - record.startTime
    throw e
  }
}

// 处理 MCP 响应
function handleMcpResponse(conn: McpConnection, data: string) {
  const lines = data.split('\n').filter(line => line.trim())
  
  for (const line of lines) {
    try {
      const response = JSON.parse(line)
      conn.logs.push(`[recv] ${line}`)
      if (conn.logs.length > 100) conn.logs.shift()
      
      console.log(`[${conn.name}] Received:`, line)
      
      if (response.id !== undefined) {
        const pending = conn.pendingRequests.get(response.id)
        if (pending) {
          conn.pendingRequests.delete(response.id)
          if (response.error) {
            pending.reject(new Error(response.error.message || 'Unknown error'))
          } else {
            pending.resolve(response.result)
          }
        }
      }
    } catch {
      // 非 JSON 输出，记录到日志
      if (line.trim()) {
        conn.logs.push(`[output] ${line}`)
        if (conn.logs.length > 100) conn.logs.shift()
      }
    }
  }
}

// 连接到 MCP 服务器
async function mcpConnect(name: string): Promise<{ success: boolean; error?: string; serverInfo?: unknown; tools?: McpTool[] }> {
  const config = loadMcpConfig()
  const server = config.mcpServers[name]
  
  if (!server) {
    return { success: false, error: `服务器 "${name}" 不存在` }
  }
  
  if (server.type === 'http') {
    const conn = httpConnections.get(name) || {
      name,
      connected: undefined,
      tools: [],
      callHistory: [],
      requestId: 0
    }

    try {
      const initResult = await sendHttpRequest(conn, server, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'droid-resource-manager', version: '1.0.0' }
      }) as { serverInfo?: { name: string; version: string } }

      conn.serverInfo = initResult.serverInfo
      conn.connected = true
      conn.lastChecked = Date.now()

      const toolsResult = await sendHttpRequest(conn, server, 'tools/list', {}) as { tools: McpTool[] }
      conn.tools = toolsResult.tools || []

      httpConnections.set(name, conn)
      return { success: true, serverInfo: conn.serverInfo, tools: conn.tools }
    } catch (e) {
      conn.connected = false
      conn.lastChecked = Date.now()
      httpConnections.set(name, conn)
      return { success: false, error: `连接失败: ${(e as Error).message}` }
    }
  }

  if (!server.command) {
    return { success: false, error: `服务器 "${name}" 没有配置 command` }
  }

  const portToCheck = resolveMcpPort(name, server)
  if (portToCheck) {
    const available = await checkPortAvailable(portToCheck)
    if (!available) {
      return { success: false, error: `端口 ${portToCheck} 已被占用，请关闭占用程序或修改端口后重试` }
    }
  }
  
  // 如果已连接，先断开
  if (mcpConnections.has(name)) {
    await mcpDisconnect(name)
  }
  
  try {
    const env = { ...process.env, ...server.env }
    const proc = spawn(server.command, server.args || [], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    })
    
    const conn: McpConnection = {
      name,
      process: proc,
      pid: proc.pid!,
      startTime: Date.now(),
      logs: [],
      tools: [],
      connected: false,
      pendingRequests: new Map(),
      requestId: 0,
      callHistory: []
    }
    
    mcpConnections.set(name, conn)
    
    // 处理输出
    proc.stdout?.on('data', (data) => {
      handleMcpResponse(conn, data.toString())
    })
    
    proc.stderr?.on('data', (data) => {
      const line = `[stderr] ${data.toString().trim()}`
      conn.logs.push(line)
      if (conn.logs.length > 100) conn.logs.shift()
      console.error(`[${name}]`, line)
    })
    
    proc.on('error', (err) => {
      conn.logs.push(`[error] ${err.message}`)
      conn.connected = false
    })
    
    proc.on('exit', (code, signal) => {
      conn.logs.push(`[exit] code=${code}, signal=${signal}`)
      conn.connected = false
      mcpConnections.delete(name)
    })
    
    // 发送初始化请求
    const initResult = await sendMcpRequest(conn, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'droid-resource-manager', version: '1.0.0' }
    }) as { serverInfo?: { name: string; version: string } }
    
    conn.serverInfo = initResult.serverInfo
    conn.connected = true
    
    // 获取工具列表
    const toolsResult = await sendMcpRequest(conn, 'tools/list', {}) as { tools: McpTool[] }
    conn.tools = toolsResult.tools || []
    
    return {
      success: true,
      serverInfo: conn.serverInfo,
      tools: conn.tools
    }
  } catch (e) {
    mcpConnections.delete(name)
    return { success: false, error: `连接失败: ${(e as Error).message}` }
  }
}

// 断开 MCP 连接
async function mcpDisconnect(name: string): Promise<{ success: boolean; error?: string }> {
  const conn = mcpConnections.get(name)
  if (conn) {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', conn.pid.toString(), '/f', '/t'], { shell: true })
      } else {
        conn.process.kill('SIGTERM')
      }
      mcpConnections.delete(name)
      return { success: true }
    } catch (e) {
      return { success: false, error: `断开失败: ${(e as Error).message}` }
    }
  }

  if (httpConnections.has(name)) {
    httpConnections.delete(name)
    return { success: true }
  }

  return { success: false, error: `服务器 "${name}" 未连接` }
}

// 调用 MCP 工具
async function mcpCallTool(name: string, toolName: string, args: unknown): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const conn = mcpConnections.get(name)
  if (conn) {
    if (!conn.connected) {
      return { success: false, error: `服务器 "${name}" 未连接` }
    }
    try {
      const result = await sendMcpRequest(conn, 'tools/call', {
        name: toolName,
        arguments: args
      })
      return { success: true, result }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }

  const httpConn = httpConnections.get(name)
  const config = loadMcpConfig()
  const server = config.mcpServers[name]
  if (server?.type === 'http' && httpConn) {
    try {
      const result = await sendHttpRequest(httpConn, server, 'tools/call', {
        name: toolName,
        arguments: args
      })
      httpConn.connected = true
      httpConn.lastChecked = Date.now()
      httpConnections.set(name, httpConn)
      return { success: true, result }
    } catch (e) {
      httpConn.connected = false
      httpConn.lastChecked = Date.now()
      httpConnections.set(name, httpConn)
      return { success: false, error: (e as Error).message }
    }
  }

  return { success: false, error: `服务器 "${name}" 未连接` }
}

// 获取 MCP 连接状态
function mcpGetConnectionStatus(name: string) {
  const conn = mcpConnections.get(name)
  if (conn) {
    return {
      name: conn.name,
      pid: conn.pid,
      startTime: conn.startTime,
      uptime: Date.now() - conn.startTime,
      connected: conn.connected,
      serverInfo: conn.serverInfo,
      tools: conn.tools,
      logs: conn.logs.slice(-30),
      callHistory: conn.callHistory.slice(-20)
    }
  }

  const httpConn = httpConnections.get(name)
  if (httpConn) {
    return {
      name: httpConn.name,
      connected: httpConn.connected,
      lastChecked: httpConn.lastChecked,
      serverInfo: httpConn.serverInfo,
      tools: httpConn.tools,
      callHistory: httpConn.callHistory.slice(-20)
    }
  }

  return null
}

// 列出所有 MCP 服务器
function mcpList() {
  const config = loadMcpConfig()
  const servers = Object.entries(config.mcpServers).map(([name, server]) => {
    const conn = mcpConnections.get(name)
    const httpConn = httpConnections.get(name)
    return {
      name,
      type: server.type,
      disabled: server.disabled ?? false,
      command: server.command,
      args: server.args,
      url: server.url,
      env: server.env || {},
      headers: server.headers || {},
      // 连接状态
      connected: server.type === 'http' ? httpConn?.connected : conn?.connected ?? false,
      pid: conn?.pid,
      startTime: conn?.startTime,
      lastChecked: httpConn?.lastChecked,
      serverInfo: (server.type === 'http' ? httpConn?.serverInfo : conn?.serverInfo) || undefined,
      tools: server.type === 'http' ? httpConn?.tools || [] : conn?.tools || [],
      logs: conn?.logs.slice(-20) || [],
      callHistory: server.type === 'http' ? httpConn?.callHistory.slice(-10) || [] : conn?.callHistory.slice(-10) || []
    }
  })
  return {
    configPath: MCP_CONFIG_PATH,
    servers
  }
}

function resourceCenterMcpList() {
  const config = loadResourceCenterMcpConfig()
  const servers = Object.entries(config.mcpServers).map(([name, server]) => ({
    name,
    type: server.type,
    disabled: server.disabled ?? false,
    command: server.command,
    args: server.args,
    url: server.url,
    env: server.env || {},
    headers: server.headers || {},
    connected: false,
    tools: []
  }))
  return {
    configPath: RESOURCE_CENTER_MCP_PATH,
    servers
  }
}

function resourceCenterMcpAdd(name: string, serverConfig: McpServerConfig): { success: boolean; error?: string } {
  const config = loadResourceCenterMcpConfig()
  if (config.mcpServers[name]) {
    return { success: false, error: `服务器 "${name}" 已存在` }
  }
  config.mcpServers[name] = serverConfig
  return { success: saveResourceCenterMcpConfig(config) }
}

// 启用/禁用 MCP 服务器
function mcpEnable(name: string): { success: boolean; error?: string } {
  const config = loadMcpConfig()
  if (!config.mcpServers[name]) {
    return { success: false, error: `服务器 "${name}" 不存在` }
  }
  config.mcpServers[name].disabled = false
  return { success: saveMcpConfig(config) }
}

function mcpDisable(name: string): { success: boolean; error?: string } {
  const config = loadMcpConfig()
  if (!config.mcpServers[name]) {
    return { success: false, error: `服务器 "${name}" 不存在` }
  }
  config.mcpServers[name].disabled = true
  return { success: saveMcpConfig(config) }
}

// 添加/删除/更新 MCP 服务器
function mcpAdd(name: string, serverConfig: McpServerConfig): { success: boolean; error?: string } {
  const config = loadMcpConfig()
  if (config.mcpServers[name]) {
    return { success: false, error: `服务器 "${name}" 已存在` }
  }
  config.mcpServers[name] = serverConfig
  return { success: saveMcpConfig(config) }
}

function mcpRemove(name: string): { success: boolean; error?: string } {
  const config = loadMcpConfig()
  if (!config.mcpServers[name]) {
    return { success: false, error: `服务器 "${name}" 不存在` }
  }
  if (mcpConnections.has(name)) {
    mcpDisconnect(name)
  }
  delete config.mcpServers[name]
  return { success: saveMcpConfig(config) }
}

function mcpUpdate(name: string, serverConfig: Partial<McpServerConfig>): { success: boolean; error?: string } {
  const config = loadMcpConfig()
  if (!config.mcpServers[name]) {
    return { success: false, error: `服务器 "${name}" 不存在` }
  }
  config.mcpServers[name] = { ...config.mcpServers[name], ...serverConfig }
  return { success: saveMcpConfig(config) }
}

// ============ IPC Handlers ============

// 资源数据
ipcMain.handle('load-data', () => loadData())
ipcMain.handle('save-data', (_, data) => saveData(data))
ipcMain.handle('get-data-path', () => DATA_FILE)

ipcMain.handle('export-data', async (_, data) => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    title: '导出资源数据',
    defaultPath: 'droid-resources.json',
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf-8')
    return true
  }
  return false
})

ipcMain.handle('import-data', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: '导入资源数据',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  })
  if (!result.canceled && result.filePaths.length > 0) {
    try {
      return JSON.parse(fs.readFileSync(result.filePaths[0], 'utf-8'))
    } catch {
      return null
    }
  }
  return null
})

ipcMain.handle('open-external', (_, url: string) => shell.openExternal(url))

const MARKETPLACE_HOSTS = new Set(['mcp.so', 'www.mcp.so', 'smithery.ai'])
const MARKETPLACE_CACHE_TTL = 60 * 60 * 1000
const MARKETPLACE_MIN_INTERVAL = 5000
const marketplaceCache = new Map<string, { timestamp: number; status: number; text: string }>()
const marketplaceHostLastFetch = new Map<string, number>()
let marketplaceQueue = Promise.resolve()
const MARKETPLACE_SKILL_AGENT = 'opencode'

async function waitForMarketplaceSlot(host: string) {
  const last = marketplaceHostLastFetch.get(host) || 0
  const delta = Date.now() - last
  if (delta < MARKETPLACE_MIN_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MARKETPLACE_MIN_INTERVAL - delta))
  }
  marketplaceHostLastFetch.set(host, Date.now())
}

async function fetchMarketplaceHtml(url: string): Promise<{ status: number; text: string }> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DroidResourceManager/1.0',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  })

  const text = await response.text()
  return { status: response.status, text }
}

async function fetchMarketplaceHtmlWithRetry(url: string) {
  const cached = marketplaceCache.get(url)
  if (cached && Date.now() - cached.timestamp < MARKETPLACE_CACHE_TTL) {
    return { status: cached.status, text: cached.text }
  }

  const delays = [2000, 4000, 8000]
  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    const { status, text } = await fetchMarketplaceHtml(url)
    marketplaceCache.set(url, { timestamp: Date.now(), status, text })
    if (status !== 429) {
      return { status, text }
    }
    await new Promise(resolve => setTimeout(resolve, delays[attempt]))
  }
  const last = await fetchMarketplaceHtml(url)
  marketplaceCache.set(url, { timestamp: Date.now(), status: last.status, text: last.text })
  return last
}

function runSkillsAddCommand(url: string): Promise<{ success: boolean; output: string; error?: string }> {
  return new Promise((resolve) => {
    const args = ['--yes', 'skills', 'add', url, '--agent', MARKETPLACE_SKILL_AGENT]
    const proc = spawn('npx', args, {
      cwd: RESOURCE_CENTER_PATH,
      shell: true,
      windowsHide: true
    })

    let output = ''
    let error = ''

    const timeout = setTimeout(() => {
      proc.kill()
      resolve({ success: false, output, error: '命令执行超时' })
    }, 120000)

    proc.stdout?.on('data', (data) => {
      output += data.toString()
    })

    proc.stderr?.on('data', (data) => {
      error += data.toString()
    })

    proc.on('close', (code) => {
      clearTimeout(timeout)
      if (code === 0) {
        resolve({ success: true, output: output.trim() })
      } else {
        resolve({ success: false, output: output.trim(), error: error.trim() || `退出码 ${code}` })
      }
    })
  })
}

ipcMain.handle('marketplace-fetch', async (_, url: string) => {
  try {
    const parsed = new URL(url)
    if (!MARKETPLACE_HOSTS.has(parsed.hostname)) {
      return { success: false, error: '仅支持 mcp.so 或 smithery.ai 的链接' }
    }

    const result = await (marketplaceQueue = marketplaceQueue.then(async () => {
      await waitForMarketplaceSlot(parsed.hostname)
      const { status, text } = await fetchMarketplaceHtmlWithRetry(url)
      if (status >= 400) {
        const error = status === 429 ? '请求过于频繁，请稍后再试' : `HTTP ${status}`
        return { success: false, status, error }
      }
      return { success: true, status, text }
    }))

    return result
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
})

ipcMain.handle('marketplace-skill-import', async (_, url: string) => {
  try {
    const parsed = new URL(url)
    if (parsed.hostname !== 'smithery.ai') {
      return { success: false, error: '仅支持 smithery.ai 的 skill 链接' }
    }
    return await runSkillsAddCommand(url)
  } catch (e) {
    return { success: false, output: '', error: (e as Error).message }
  }
})

// MCP 管理
ipcMain.handle('mcp-list', () => mcpList())
ipcMain.handle('mcp-enable', (_, name: string) => mcpEnable(name))
ipcMain.handle('mcp-disable', (_, name: string) => mcpDisable(name))
ipcMain.handle('mcp-connect', (_, name: string) => mcpConnect(name))
ipcMain.handle('mcp-disconnect', (_, name: string) => mcpDisconnect(name))
ipcMain.handle('mcp-call-tool', (_, name: string, toolName: string, args: unknown) => mcpCallTool(name, toolName, args))
ipcMain.handle('mcp-get-status', (_, name: string) => mcpGetConnectionStatus(name))
ipcMain.handle('mcp-check-update', (_, name: string) => mcpCheckUpdate(name))
ipcMain.handle('mcp-add', (_, name: string, config: McpServerConfig) => mcpAdd(name, config))
ipcMain.handle('mcp-remove', (_, name: string) => mcpRemove(name))
ipcMain.handle('mcp-update', (_, name: string, config: Partial<McpServerConfig>) => mcpUpdate(name, config))
ipcMain.handle('mcp-get-config-path', () => MCP_CONFIG_PATH)
ipcMain.handle('resource-center-list', () => ({
  basePath: RESOURCE_CENTER_PATH,
  mcp: resourceCenterMcpList(),
  skills: skills.getProjectSkills(RESOURCE_CENTER_PATH),
  droids: droids.getProjectDroids(RESOURCE_CENTER_PATH)
}))
ipcMain.handle('resource-center-mcp-add', (_, name: string, config: McpServerConfig) => resourceCenterMcpAdd(name, config))
ipcMain.handle('resource-center-skill-create', (_, name: string, content: string) =>
  skills.createSkill(name, content, 'project', RESOURCE_CENTER_PATH))

// AI 设置
const AI_SETTINGS_FILE = path.join(app.getPath('userData'), 'ai-settings.json')

interface AISettings {
  url: string
  apiKey: string
  model: string
  skillsModel: string  // Skills 解读专用模型
}

const DEFAULT_AI_SETTINGS: AISettings = {
  url: 'http://43.134.190.112:3000/v1/chat/completions',
  apiKey: 'sk-0bMcBMw1fzFb0uh71WydfaE9dihEcdo97OcxigcwrzqabAZA',
  model: 'gpt-4o-mini',
  skillsModel: 'gpt-4o-mini'
}

function loadAISettings(): AISettings {
  try {
    if (fs.existsSync(AI_SETTINGS_FILE)) {
      const saved = JSON.parse(fs.readFileSync(AI_SETTINGS_FILE, 'utf-8'))
      return { ...DEFAULT_AI_SETTINGS, ...saved }
    }
  } catch (e) {
    console.error('加载AI设置失败:', e)
  }
  return DEFAULT_AI_SETTINGS
}

function saveAISettings(settings: AISettings): boolean {
  try {
    fs.writeFileSync(AI_SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8')
    return true
  } catch (e) {
    console.error('保存AI设置失败:', e)
    return false
  }
}

ipcMain.handle('ai-get-settings', () => loadAISettings())
ipcMain.handle('ai-save-settings', (_, settings: AISettings) => saveAISettings(settings))

// 获取模型列表
async function fetchModelList(settings: AISettings): Promise<{ id: string; name?: string }[]> {
  try {
    const baseUrl = settings.url.replace(/\/chat\/completions$/, '').replace(/\/v1$/, '')
    const modelsUrl = `${baseUrl}/v1/models`
    
    const response = await fetch(modelsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${settings.apiKey}`
      }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data = await response.json()
    return (data.data || []).map((m: { id: string; name?: string }) => ({
      id: m.id,
      name: m.name || m.id
    }))
  } catch (e) {
    console.error('获取模型列表失败:', e)
    return []
  }
}

ipcMain.handle('ai-fetch-models', async () => {
  const settings = loadAISettings()
  return fetchModelList(settings)
})

// AI 翻译
async function translateToolDescription(description: string): Promise<string> {
  const settings = loadAISettings()
  try {
    const response = await fetch(settings.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          {
            role: 'system',
            content: '你是一个翻译助手。将用户提供的MCP工具描述翻译成简洁的中文，只返回翻译结果，不要添加任何解释。'
          },
          {
            role: 'user',
            content: description
          }
        ],
        max_tokens: 200,
        temperature: 0.3
      })
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data = await response.json()
    return data.choices?.[0]?.message?.content?.trim() || description
  } catch (e) {
    console.error('AI翻译失败:', e)
    return description
  }
}

// AI 理解 Skill
async function explainSkill(skillContent: string): Promise<string> {
  const settings = loadAISettings()
  try {
    const response = await fetch(settings.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: settings.skillsModel || settings.model,  // 优先使用 skillsModel
        messages: [
          {
            role: 'system',
            content: `你是一个专业的技术文档分析师。请分析用户提供的 Skill 文件，用中文生成结构化的解读。

请严格按照以下格式输出（使用 Markdown）：

## 概述
用1-2句话简要说明这个 Skill 是什么、做什么用的。

## 核心功能
- 功能点1
- 功能点2
- 功能点3

## 使用场景
描述在什么情况下应该使用这个 Skill。

## 使用方法
1. 第一步
2. 第二步
3. 第三步

## 注意事项
- 注意点1
- 注意点2

要求：
- 语言简洁专业
- 每个部分都要有内容
- 功能点和步骤要具体明确
- 不要添加额外的标题或格式`
          },
          {
            role: 'user',
            content: skillContent
          }
        ],
        max_tokens: 1500,
        temperature: 0.3
      })
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data = await response.json()
    return data.choices?.[0]?.message?.content?.trim() || '无法生成解释'
  } catch (e) {
    console.error('AI解释失败:', e)
    return `解释生成失败: ${(e as Error).message}`
  }
}

ipcMain.handle('ai-translate', (_, text: string) => translateToolDescription(text))
ipcMain.handle('ai-explain-skill', (_, content: string) => explainSkill(content))

// 生成并保存 AI 解读到 Skill 目录
ipcMain.handle('skills-generate-ai-summary', async (_, skillPath: string, content: string) => {
  try {
    const summary = await explainSkill(content)
    if (summary && !summary.startsWith('解释生成失败')) {
      skills.saveAiSummary(skillPath, summary)
      return { success: true, summary }
    }
    return { success: false, error: summary }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
})

// 保存 AI 解读
ipcMain.handle('skills-save-ai-summary', (_, skillPath: string, summary: string) => 
  skills.saveAiSummary(skillPath, summary))

// Skills 管理
ipcMain.handle('skills-get-global', () => skills.getGlobalSkills())
ipcMain.handle('skills-discover-work', () => {
  const drives = getWindowsDrives()
  const projects = drives.flatMap((drive) => skills.discoverSkillProjects(drive))
  return Array.from(new Set(projects))
})
ipcMain.handle('skills-get-project', (_, projectPath: string) => skills.getProjectSkills(projectPath))
ipcMain.handle('skills-get', (_, skillPath: string) => skills.getSkill(skillPath))
ipcMain.handle('skills-create', (_, name: string, content: string, scope: 'global' | 'project', projectPath?: string) => 
  skills.createSkill(name, content, scope, projectPath))
ipcMain.handle('skills-update', (_, skillPath: string, content: string) => skills.updateSkill(skillPath, content))
ipcMain.handle('skills-delete', (_, skillPath: string) => skills.deleteSkill(skillPath))
ipcMain.handle('skills-get-global-path', () => skills.getGlobalSkillsPath())
ipcMain.handle('skills-read-file', (_, skillPath: string, fileName: string) => skills.readSkillFile(skillPath, fileName))
ipcMain.handle('skills-save-file', (_, skillPath: string, fileName: string, content: string) => 
  skills.saveSkillFile(skillPath, fileName, content))
ipcMain.handle('skills-delete-file', (_, skillPath: string, fileName: string) => skills.deleteSkillFile(skillPath, fileName))
ipcMain.handle('skills-select-project', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: '选择项目目录',
    properties: ['openDirectory']
  })
  return result.canceled ? null : result.filePaths[0]
})

// Skills 导入
ipcMain.handle('skills-import-folder', async (_, scope: 'global' | 'project', projectPath?: string) => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: '选择要导入的 Skill 文件夹',
    properties: ['openDirectory']
  })
  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, canceled: true }
  }
  return skills.importSkillFolder(result.filePaths[0], scope, projectPath)
})

ipcMain.handle('skills-import-directory', async (_, scope: 'global' | 'project', projectPath?: string) => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: '选择包含多个 Skills 的目录（如解压后的文件夹）',
    properties: ['openDirectory']
  })
  if (result.canceled || result.filePaths.length === 0) {
    return { success: 0, failed: 0, errors: [], canceled: true }
  }
  return { ...skills.importSkillsFromDirectory(result.filePaths[0], scope, projectPath), canceled: false }
})

ipcMain.handle('skills-import-zip', async (_, scope: 'global' | 'project', projectPath?: string) => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: '选择 Skills ZIP 压缩包',
    filters: [{ name: 'ZIP 文件', extensions: ['zip'] }],
    properties: ['openFile']
  })
  if (result.canceled || result.filePaths.length === 0) {
    return { success: 0, failed: 0, errors: [], canceled: true }
  }
  return { ...skills.importSkillsFromZip(result.filePaths[0], scope, projectPath), canceled: false }
})

// 复制 Skill 到目标位置
ipcMain.handle('skills-copy', (_, sourcePath: string, targetScope: 'global' | 'project', targetProjectPath?: string) => 
  skills.copySkill(sourcePath, targetScope, targetProjectPath))
ipcMain.handle('skills-move', (_, sourcePath: string, targetScope: 'global' | 'project', targetProjectPath?: string) =>
  skills.moveSkill(sourcePath, targetScope, targetProjectPath))

// ============ Droids 管理 ============
ipcMain.handle('droids-get-global', () => droids.getGlobalDroids())
ipcMain.handle('droids-discover-work', () => {
  const drives = getWindowsDrives()
  const projects = drives.flatMap((drive) => droids.discoverDroidProjects(drive))
  return Array.from(new Set(projects))
})
ipcMain.handle('droids-get-project', (_, projectPath: string) => droids.getProjectDroids(projectPath))
ipcMain.handle('droids-get', (_, droidPath: string) => droids.getDroid(droidPath))
ipcMain.handle('droids-create', (_, data: Parameters<typeof droids.createDroid>[0], scope: 'global' | 'project', projectPath?: string) => 
  droids.createDroid(data, scope, projectPath))
ipcMain.handle('droids-update', (_, droidPath: string, data: Parameters<typeof droids.updateDroid>[1]) => 
  droids.updateDroid(droidPath, data))
ipcMain.handle('droids-delete', (_, droidPath: string) => droids.deleteDroid(droidPath))
ipcMain.handle('droids-get-global-path', () => droids.getGlobalDroidsPath())
ipcMain.handle('droids-save-config', (_, droidName: string, config: droids.DroidConfig) => 
  droids.saveDroidConfig(droidName, config))
ipcMain.handle('droids-get-tools', () => droids.getAllTools())
ipcMain.handle('droids-get-tool-categories', () => droids.getToolCategories())
ipcMain.handle('droids-move', (_, sourcePath: string, targetScope: 'global' | 'project', targetProjectPath?: string) =>
  droids.moveDroid(sourcePath, targetScope, targetProjectPath))
ipcMain.handle('droids-select-project', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: '选择项目目录',
    properties: ['openDirectory']
  })
  return result.canceled ? null : result.filePaths[0]
})

// AI 解读 Droid
async function explainDroid(droidContent: string): Promise<string> {
  const settings = loadAISettings()
  try {
    const response = await fetch(settings.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: settings.skillsModel || settings.model,
        messages: [
          {
            role: 'system',
            content: `你是一个专业的 AI Agent 分析师。请分析用户提供的 Droid（子代理）配置文件，用中文生成结构化的解读。

请严格按照以下格式输出（使用 Markdown）：

## 概述
用1-2句话简要说明这个 Droid 是什么、做什么用的。

## 核心能力
- 能力点1
- 能力点2
- 能力点3

## 使用场景
描述在什么情况下应该调用这个 Droid。

## 工具权限
说明这个 Droid 可以使用哪些工具，有什么限制。

## 调用示例
给出1-2个调用这个 Droid 的示例指令。

## 注意事项
- 注意点1
- 注意点2

要求：
- 语言简洁专业
- 每个部分都要有内容
- 重点说明这个 Droid 的独特价值`
          },
          {
            role: 'user',
            content: droidContent
          }
        ],
        max_tokens: 1500,
        temperature: 0.3
      })
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data = await response.json()
    return data.choices?.[0]?.message?.content?.trim() || '无法生成解释'
  } catch (e) {
    console.error('AI解释Droid失败:', e)
    return `解释生成失败: ${(e as Error).message}`
  }
}

ipcMain.handle('droids-generate-ai-summary', async (_, droidPath: string, droidName: string, content: string) => {
  try {
    const summary = await explainDroid(content)
    if (summary && !summary.startsWith('解释生成失败')) {
      droids.saveAiSummary(droidPath, droidName, summary)
      return { success: true, summary }
    }
    return { success: false, error: summary }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
})

// 复制 Droid 到目标位置
ipcMain.handle('droids-copy', (_, sourcePath: string, targetScope: 'global' | 'project', targetProjectPath?: string) => 
  droids.copyDroid(sourcePath, targetScope, targetProjectPath))

// ============ Prompts 管理 ============
ipcMain.handle('prompts-get-all', () => prompts.getPrompts())
ipcMain.handle('prompts-get', (_, promptPath: string) => prompts.getPrompt(promptPath))
ipcMain.handle('prompts-create', (_, name: string, content: string, description: string, category: string, linkedResources: string[]) => 
  prompts.createPrompt(name, content, description, category, linkedResources))
ipcMain.handle('prompts-update', (_, promptPath: string, content: string, description: string, category: string, linkedResources: string[]) => 
  prompts.updatePrompt(promptPath, content, description, category, linkedResources))
ipcMain.handle('prompts-delete', (_, promptPath: string) => prompts.deletePrompt(promptPath))
ipcMain.handle('prompts-get-path', () => prompts.getPromptsPath())
ipcMain.handle('prompts-get-count', () => prompts.getPromptsCount())

// ============ Rules 管理 ============
ipcMain.handle('rules-get-global', () => rules.getGlobalRules())
ipcMain.handle('rules-get-project', (_, projectPath: string) => rules.getProjectRules(projectPath))
ipcMain.handle('rules-get', (_, rulePath: string) => rules.getRule(rulePath))
ipcMain.handle('rules-create', (_, name: string, content: string, scope: 'global' | 'project', projectPath: string | undefined, description: string, category: string, priority: number, globs: string[], linkedResources: string[]) => 
  rules.createRule(name, content, scope, projectPath, description, category, priority, globs, linkedResources))
ipcMain.handle('rules-update', (_, rulePath: string, content: string, description: string, category: string, priority: number, globs: string[], linkedResources: string[]) => 
  rules.updateRule(rulePath, content, description, category, priority, globs, linkedResources))
ipcMain.handle('rules-delete', (_, rulePath: string) => rules.deleteRule(rulePath))
ipcMain.handle('rules-get-global-path', () => rules.getGlobalRulesPath())
ipcMain.handle('rules-get-global-count', () => rules.getGlobalRulesCount())
ipcMain.handle('rules-copy', (_, sourcePath: string, targetScope: 'global' | 'project', targetProjectPath?: string) => 
  rules.copyRule(sourcePath, targetScope, targetProjectPath))

// ============ App Lifecycle ============

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  for (const [name] of mcpConnections) {
    mcpDisconnect(name)
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

app.on('before-quit', () => {
  for (const [name] of mcpConnections) {
    mcpDisconnect(name)
  }
})
