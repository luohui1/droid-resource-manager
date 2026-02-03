import { useState, useEffect, useCallback } from 'react'
import {
  Server,
  RefreshCw,
  Check,
  X,
  Plus,
  Trash2,
  ExternalLink,
  Terminal,
  Globe,
  AlertCircle,
  Copy,
  FolderOpen,
  Plug,
  PlugZap,
  History,
  ChevronRight,
  ChevronDown
} from 'lucide-react'

interface McpServer {
  name: string
  type: 'stdio' | 'http'
  disabled: boolean
  command?: string
  args?: string[]
  url?: string
  env?: Record<string, string>
  headers?: Record<string, string>
  connected?: boolean
  pid?: number
  startTime?: number
  logs?: string[]
  serverInfo?: { name: string; version: string }
  tools?: McpTool[]
  callHistory?: McpCallRecord[]
  lastChecked?: number
}

interface McpListResult {
  configPath: string
  servers: McpServer[]
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

interface McpUpdateInfo {
  packageName?: string
  currentVersion?: string
  latestVersion?: string
  updateAvailable?: boolean
  checkedAt?: number
  error?: string
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

function formatJson(value: unknown): string {
  if (value === undefined) return '-'
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function maskSecret(value: string): string {
  if (value.length <= 8) return '****'
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

const OFFICIAL_INFO_BY_PACKAGE: Record<string, { url: string; description: string }> = {
  '@browsermcp/mcp': {
    url: 'https://github.com/BrowserMCP/mcp',
    description: 'BrowserMCP 本地浏览器自动化 MCP，配合浏览器扩展使用。'
  },
  'chrome-devtools-mcp': {
    url: 'https://github.com/ChromeDevTools/chrome-devtools-mcp',
    description: 'Chrome DevTools MCP，支持自动化调试与性能分析。'
  },
  '@peng-shawn/mermaid-mcp-server': {
    url: 'https://github.com/peng-shawn/mermaid-mcp-server',
    description: 'Mermaid MCP，生成 PNG/SVG 等流程图与架构图。'
  }
}

const OFFICIAL_INFO_BY_NAME: Record<string, { url: string; description: string }> = {
  metaso: {
    url: 'https://metaso.cn',
    description: 'Metaso 在线 MCP 服务，提供搜索与智能问答能力。'
  }
}

const TOOL_DESC_TRANSLATIONS: Record<string, string> = {
  // Mermaid MCP
  generate: '根据 Mermaid Markdown 生成 PNG 或 SVG 图片。',
  
  // Metaso MCP
  metaso_web_search: '根据关键词搜索网页、文档、论文、图片、视频、播客等内容',
  metaso_web_reader: '读取指定URL的网页内容',
  metaso_chat: '基于RAG的智能问答服务',
  
  // Browser MCP
  browser_navigate: '导航到指定URL并在浏览器中打开',
  browser_screenshot: '对当前页面进行截图',
  browser_click: '点击页面上的元素',
  browser_fill: '填充表单输入框',
  browser_select: '选择下拉框选项',
  browser_hover: '鼠标悬停在元素上',
  browser_evaluate: '在页面上下文中执行JavaScript代码',
  browser_close: '关闭浏览器',
  
  // Chrome DevTools MCP
  chrome_get_target: '获取Chrome调试目标列表',
  chrome_connect: '连接到Chrome调试端口',
  chrome_evaluate: '在Chrome上下文中执行JavaScript',
  chrome_get_version: '获取Chrome版本信息',
  
  // Common MCP tools
  ping: '检查服务器连接状态',
  list_tools: '列出所有可用的工具',
  describe_tool: '获取工具的详细描述'
}

// AI翻译缓存
const translationCache: Record<string, string> = {}

async function getToolTranslation(tool: McpTool): Promise<string> {
  // 优先使用预设翻译
  if (TOOL_DESC_TRANSLATIONS[tool.name]) {
    return TOOL_DESC_TRANSLATIONS[tool.name]
  }
  // 检查缓存
  const cacheKey = `${tool.name}:${tool.description}`
  if (translationCache[cacheKey]) {
    return translationCache[cacheKey]
  }
  // 调用AI翻译
  try {
    const translated = await window.electronAPI.aiTranslate(tool.description)
    translationCache[cacheKey] = translated
    return translated
  } catch {
    return tool.description
  }
}

// 工具描述翻译组件
function ToolDescription({ tool }: { tool: McpTool }) {
  const [translation, setTranslation] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const loadTranslation = async () => {
      // 先检查预设翻译
      if (TOOL_DESC_TRANSLATIONS[tool.name]) {
        setTranslation(TOOL_DESC_TRANSLATIONS[tool.name])
        return
      }
      // 检查缓存
      const cacheKey = `${tool.name}:${tool.description}`
      if (translationCache[cacheKey]) {
        setTranslation(translationCache[cacheKey])
        return
      }
      // 调用AI翻译
      setLoading(true)
      try {
        const result = await getToolTranslation(tool)
        if (!cancelled) {
          setTranslation(result)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadTranslation()
    return () => { cancelled = true }
  }, [tool])

  if (loading) {
    return <span className="text-xs text-muted-foreground">翻译中...</span>
  }

  const showOriginal = translation && translation !== tool.description

  return (
    <>
      <div className="text-xs text-muted-foreground mt-1">
        {translation || tool.description}
      </div>
      {showOriginal && (
        <div className="text-[11px] text-muted-foreground/70 mt-1">{tool.description}</div>
      )}
    </>
  )
}

function extractNpmPackage(args?: string[]): string | null {
  if (!args || args.length === 0) return null
  const spec = args.find((arg) => !arg.startsWith('-'))
  if (!spec) return null
  if (spec.startsWith('@')) {
    const lastAt = spec.lastIndexOf('@')
    return lastAt > 0 ? spec.slice(0, lastAt) : spec
  }
  const atIndex = spec.lastIndexOf('@')
  return atIndex > 0 ? spec.slice(0, atIndex) : spec
}

function getOfficialInfo(server: McpServer) {
  const pkg = extractNpmPackage(server.args)
  if (pkg && OFFICIAL_INFO_BY_PACKAGE[pkg]) {
    return OFFICIAL_INFO_BY_PACKAGE[pkg]
  }
  if (OFFICIAL_INFO_BY_NAME[server.name]) {
    return OFFICIAL_INFO_BY_NAME[server.name]
  }
  return null
}

export function McpManagerPage() {
  const [servers, setServers] = useState<McpServer[]>([])
  const [configPath, setConfigPath] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedServer, setSelectedServer] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detailStatus, setDetailStatus] = useState<McpServer | null>(null)
  const [connectingServer, setConnectingServer] = useState<string | null>(null)
  const [updateInfo, setUpdateInfo] = useState<Record<string, McpUpdateInfo>>({})
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({})
  const [batchConnecting, setBatchConnecting] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)

  const loadServers = useCallback(async () => {
    try {
      const result: McpListResult = await window.electronAPI.mcpList()
      setServers(result.servers)
      setConfigPath(result.configPath)
      setError(null)
    } catch (e) {
      setError('加载 MCP 配置失败')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadServers()
    const interval = setInterval(loadServers, 5000)
    return () => clearInterval(interval)
  }, [loadServers])

  const loadDetailStatus = useCallback(async (name: string) => {
    try {
      const status = await window.electronAPI.mcpGetStatus(name)
      if (status) {
        setDetailStatus(status as McpServer)
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  const handleEnable = async (name: string) => {
    const result = await window.electronAPI.mcpEnable(name)
    if (result.success) {
      loadServers()
    } else {
      setError(result.error || '操作失败')
    }
  }

  const handleDisable = async (name: string) => {
    const result = await window.electronAPI.mcpDisable(name)
    if (result.success) {
      loadServers()
    } else {
      setError(result.error || '操作失败')
    }
  }

  const handleConnect = async (name: string) => {
    try {
      setConnectingServer(name)
      const result = await window.electronAPI.mcpConnect(name)
      if (result.success) {
        await loadServers()
        await loadDetailStatus(name)
      } else {
        setError(result.error || '连接失败')
      }
    } catch (e) {
      setError((e as Error).message || '连接失败')
    } finally {
      setConnectingServer(null)
    }
  }

  const handleDisconnect = async (name: string) => {
    try {
      const result = await window.electronAPI.mcpDisconnect(name)
      if (result.success) {
        await loadServers()
        setDetailStatus(null)
      } else {
        setError(result.error || '断开失败')
      }
    } catch (e) {
      setError((e as Error).message || '断开失败')
    }
  }

  const handleBatchConnect = async () => {
    setBatchConnecting(true)
    const failures: string[] = []

    for (const server of servers) {
      if (server.disabled) continue
      if (server.type === 'stdio' && server.connected) continue

      const result = await window.electronAPI.mcpConnect(server.name)
      if (!result.success) {
        failures.push(`${server.name}: ${result.error || '启动失败'}`)
      }
    }

    await loadServers()
    if (failures.length > 0) {
      setError(`部分启动失败：${failures.join('；')}`)
    }
    setBatchConnecting(false)
  }

  const handleCheckUpdate = async (name: string) => {
    try {
      const result = await window.electronAPI.mcpCheckUpdate(name)
      if (result.success) {
        setUpdateInfo((prev) => ({
          ...prev,
          [name]: {
            packageName: result.packageName,
            currentVersion: result.currentVersion,
            latestVersion: result.latestVersion,
            updateAvailable: result.updateAvailable,
            checkedAt: Date.now()
          }
        }))
      } else {
        setUpdateInfo((prev) => ({
          ...prev,
          [name]: { error: result.error || '检查失败', checkedAt: Date.now() }
        }))
      }
    } catch (e) {
      setUpdateInfo((prev) => ({
        ...prev,
        [name]: { error: (e as Error).message || '检查失败', checkedAt: Date.now() }
      }))
    }
  }

  const handleRemove = async (name: string) => {
    if (!confirm(`确定要删除 "${name}" 吗？`)) return
    const result = await window.electronAPI.mcpRemove(name)
    if (result.success) {
      loadServers()
      if (selectedServer === name) setSelectedServer(null)
    } else {
      setError(result.error || '删除失败')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const selectedServerData = servers.find(s => s.name === selectedServer)
  const selectedDetail = selectedServerData
    ? { ...selectedServerData, ...(detailStatus || {}) }
    : detailStatus
  const selectedOfficialInfo = selectedDetail ? getOfficialInfo(selectedDetail) : null

  useEffect(() => {
    if (selectedServer) {
      loadDetailStatus(selectedServer)
    }
  }, [selectedServer, loadDetailStatus])

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-6 h-full flex flex-col">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2 font-display">
            <span className="icon-orb icon-orb--blue icon-orb--sm">
              <Server className="w-5 h-5" />
            </span>
            本地 MCP 管理器
          </h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
            <span className="icon-orb icon-orb--sm icon-orb--purple">
              <FolderOpen className="w-4 h-4" />
            </span>
            {configPath}
            <button 
              onClick={() => copyToClipboard(configPath)}
              className="p-1 hover:bg-white/60 rounded glass-chip"
              title="复制路径"
            >
              <Copy className="w-3 h-3" />
            </button>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadServers}
            className="px-3 py-2 text-sm glass-chip hover:bg-white/70 rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
          <button
            onClick={handleBatchConnect}
            className="px-3 py-2 text-sm glass-chip hover:bg-white/70 rounded-lg transition-colors flex items-center gap-2"
            disabled={batchConnecting}
          >
            <PlugZap className={cn("w-4 h-4", batchConnecting && "animate-spin")} />
            一键启动
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 text-sm bg-primary/90 text-primary-foreground hover:bg-primary rounded-lg transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            添加服务器
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 p-3 glass-card border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive">
          <AlertCircle className="w-4 h-4" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 主内容 */}
      <div className="flex-1 overflow-hidden">
        <div className="glass-card rounded-2xl overflow-hidden flex flex-col h-full">
          <div className="px-4 py-3 glass-chip border-b border-white/40 text-sm font-medium">
            MCP 服务器 ({servers.length})
          </div>
          <div className="flex-1 overflow-auto">
            {servers.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <span className="icon-orb icon-orb--lg icon-orb--blue mx-auto mb-3">
                    <Server className="w-12 h-12" />
                  </span>
                <p>没有配置 MCP 服务器</p>
                <p className="text-sm mt-1">点击「添加服务器」开始</p>
              </div>
            ) : (
              servers.map((server) => (
                <div
                  key={server.name}
                  onClick={() => {
                    setSelectedServer(server.name)
                    setDetailOpen(true)
                  }}
                  className={cn(
                    "px-4 py-3 border-b border-white/40 cursor-pointer transition-colors",
                    selectedServer === server.name && detailOpen
                      ? "bg-white/70 border-l-2 border-l-primary"
                      : "hover:bg-white/50"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        server.disabled ? "bg-gray-400" :
                        server.type === 'http'
                          ? server.connected === true
                            ? "bg-green-500"
                            : server.connected === false
                              ? "bg-red-500"
                              : "bg-blue-500"
                          : server.connected
                            ? "bg-green-500 animate-pulse"
                            : "bg-yellow-500"
                      )} />

                      <span className={cn(
                        "icon-orb icon-orb--sm",
                        server.type === 'stdio'
                          ? "icon-orb--orange text-orange-600"
                          : "icon-orb--blue text-blue-600"
                      )}>
                        {server.type === 'stdio' ? <Terminal className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                      </span>

                      <div>
                        <p className="font-medium">{server.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {server.type === 'stdio' ? server.command : server.url}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleConnect(server.name)
                        }}
                        className="p-2 glass-chip hover:bg-white/70 rounded-lg text-muted-foreground transition-colors"
                        title={server.type === 'http' ? '检查状态' : '连接'}
                        disabled={
                          server.disabled ||
                          connectingServer === server.name ||
                          (server.type === 'stdio' && server.connected)
                        }
                      >
                        {connectingServer === server.name ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : server.type === 'http' ? (
                          <RefreshCw className="w-4 h-4" />
                        ) : (
                          <PlugZap className="w-4 h-4" />
                        )}
                      </button>
                      {server.disabled ? (
                        <span className="px-2 py-0.5 text-xs glass-chip text-gray-600 rounded-full">
                          已禁用
                        </span>
                      ) : server.type === 'http' ? (
                        server.connected === true ? (
                          <span className="px-2 py-0.5 text-xs glass-chip text-green-700 rounded-full">在线</span>
                        ) : server.connected === false ? (
                          <span className="px-2 py-0.5 text-xs glass-chip text-red-700 rounded-full">不可用</span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs glass-chip text-blue-700 rounded-full">未检查</span>
                        )
                      ) : server.connected ? (
                        <span className="px-2 py-0.5 text-xs glass-chip text-green-700 rounded-full flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                          已连接
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs glass-chip text-yellow-700 rounded-full">未连接</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

    {detailOpen && selectedDetail && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="glass-panel rounded-2xl border-white/40 w-full max-w-3xl max-h-[85vh] overflow-hidden shadow-2xl">
          <div className="px-4 py-3 glass-chip border-b border-white/40 flex items-center justify-between">
            <span className="font-medium">{selectedDetail.name}</span>
            <div className="flex gap-1">
              {selectedDetail.type === 'stdio' && (
                <button
                  onClick={() => handleCheckUpdate(selectedDetail.name)}
                  className="p-2 glass-chip hover:bg-white/70 rounded-lg text-muted-foreground transition-colors"
                  title="检查更新"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
              {selectedDetail.type === 'http' && (
                <button
                  onClick={() => handleConnect(selectedDetail.name)}
                  className="p-2 glass-chip hover:bg-white/70 rounded-lg text-muted-foreground transition-colors"
                  title="检查状态"
                  disabled={connectingServer === selectedDetail.name}
                >
                  <RefreshCw className={cn("w-4 h-4", connectingServer === selectedDetail.name && "animate-spin")} />
                </button>
              )}
              {selectedDetail.type === 'stdio' && (
                <>
                  {selectedDetail.connected ? (
                    <button
                      onClick={() => handleDisconnect(selectedDetail.name)}
                      className="p-2 glass-chip hover:bg-destructive/10 rounded-lg text-destructive transition-colors"
                      title="断开"
                    >
                      <Plug className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleConnect(selectedDetail.name)}
                      className="p-2 glass-chip hover:bg-green-500/10 rounded-lg text-green-600 transition-colors"
                      title="连接"
                      disabled={selectedDetail.disabled || connectingServer === selectedDetail.name}
                    >
                      {connectingServer === selectedDetail.name ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <PlugZap className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </>
              )}

              {selectedDetail.disabled ? (
                <button
                  onClick={() => handleEnable(selectedDetail.name)}
                  className="p-2 glass-chip hover:bg-green-500/10 rounded-lg text-green-600 transition-colors"
                  title="启用"
                >
                  <Check className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => handleDisable(selectedDetail.name)}
                  className="p-2 glass-chip hover:bg-yellow-500/10 rounded-lg text-yellow-600 transition-colors"
                  title="禁用"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={() => handleRemove(selectedDetail.name)}
                className="p-2 glass-chip hover:bg-destructive/10 rounded-lg text-destructive transition-colors"
                title="删除"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <button
                onClick={() => setDetailOpen(false)}
                className="p-2 glass-chip hover:bg-white/70 rounded-lg text-muted-foreground transition-colors"
                title="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4 overflow-auto max-h-[calc(85vh-56px)]">
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">基本信息</h4>
              <div className="glass-card rounded-lg p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">类型</span>
                  <span className="font-medium">{selectedDetail.type === 'stdio' ? 'Stdio (本地进程)' : 'HTTP (远程服务)'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">状态</span>
                  <span className={cn(
                    "font-medium",
                    selectedDetail.disabled ? "text-gray-500" :
                    selectedDetail.type === 'http'
                      ? selectedDetail.connected === true
                        ? "text-green-600"
                        : selectedDetail.connected === false
                          ? "text-red-600"
                          : "text-blue-600"
                      : selectedDetail.connected
                        ? "text-green-600"
                        : "text-yellow-600"
                  )}>
                    {selectedDetail.disabled
                      ? '已禁用'
                      : selectedDetail.type === 'http'
                        ? selectedDetail.connected === true
                          ? '在线'
                          : selectedDetail.connected === false
                            ? '不可用'
                            : '未检查'
                        : selectedDetail.connected
                          ? '已连接'
                          : '未连接'}
                  </span>
                </div>
                {selectedDetail.type === 'http' && selectedDetail.lastChecked && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">上次检测</span>
                    <span>{new Date(selectedDetail.lastChecked).toLocaleString()}</span>
                  </div>
                )}
                {selectedDetail.connected && selectedDetail.pid && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">PID</span>
                      <span className="font-mono">{selectedDetail.pid}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">运行时间</span>
                      <span>{formatUptime(Date.now() - (selectedDetail.startTime || 0))}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {selectedOfficialInfo && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">官方信息</h4>
                <div className="glass-card rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">官方地址</span>
                    <button
                      onClick={() => window.electronAPI.openExternal(selectedOfficialInfo.url)}
                      className="text-primary hover:underline text-right"
                    >
                      {selectedOfficialInfo.url}
                    </button>
                  </div>
                  <div className="text-muted-foreground">{selectedOfficialInfo.description}</div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">配置</h4>
              <div className="glass-card rounded-lg p-3 space-y-2 text-sm">
                {selectedDetail.type === 'stdio' ? (
                  <>
                    <div>
                      <span className="text-muted-foreground">命令</span>
                      <p className="font-mono mt-1 glass-chip rounded p-2 text-xs">
                        {selectedDetail.command} {selectedDetail.args?.join(' ')}
                      </p>
                    </div>
                    {selectedDetail.env && Object.keys(selectedDetail.env).length > 0 && (
                      <div>
                        <span className="text-muted-foreground">环境变量</span>
                        <div className="mt-1 space-y-1">
                          {Object.entries(selectedDetail.env).map(([key, value]) => (
                            <div key={key} className="font-mono text-xs">
                              {key}={maskSecret(value)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-2">
                    <span className="text-muted-foreground">URL</span>
                    <div className="font-mono mt-1 glass-chip rounded p-2 text-xs flex items-center gap-2">
                      <span className="flex-1 break-all">{selectedDetail.url || '-'}</span>
                      <button
                        onClick={() => selectedDetail.url && window.electronAPI.openExternal(selectedDetail.url)}
                        className="text-primary hover:underline"
                        title="打开链接"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                    {selectedDetail.headers && Object.keys(selectedDetail.headers).length > 0 && (
                      <div>
                        <span className="text-muted-foreground">Headers</span>
                        <div className="mt-1 space-y-1">
                          {Object.entries(selectedDetail.headers).map(([key, value]) => (
                            <div key={key} className="font-mono text-xs">
                              {key}: {maskSecret(value)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {selectedDetail.serverInfo && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">服务器信息</h4>
                <div className="glass-card rounded-lg p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">名称</span>
                    <span className="font-medium">{selectedDetail.serverInfo.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">版本</span>
                    <span className="font-medium">{selectedDetail.serverInfo.version}</span>
                  </div>
                </div>
              </div>
            )}

            {selectedDetail.type === 'stdio' && updateInfo[selectedDetail.name] && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">更新检查</h4>
                <div className="glass-card rounded-lg p-3 text-sm space-y-1">
                  {updateInfo[selectedDetail.name].error ? (
                    <div className="text-red-500">{updateInfo[selectedDetail.name].error}</div>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">包名</span>
                        <span className="font-medium">{updateInfo[selectedDetail.name].packageName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">当前版本</span>
                        <span className="font-medium">{updateInfo[selectedDetail.name].currentVersion}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">最新版本</span>
                        <span className="font-medium">{updateInfo[selectedDetail.name].latestVersion}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">是否可更新</span>
                        <span className={cn(
                          "font-medium",
                          updateInfo[selectedDetail.name].updateAvailable ? "text-yellow-600" : "text-green-600"
                        )}>
                          {updateInfo[selectedDetail.name].updateAvailable ? '是' : '否'}
                        </span>
                      </div>
                    </>
                  )}
                  {updateInfo[selectedDetail.name].checkedAt && (
                    <div className="text-muted-foreground text-xs pt-1">
                      上次检查：{new Date(updateInfo[selectedDetail.name].checkedAt!).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedDetail.type === 'stdio' && selectedDetail.logs && selectedDetail.logs.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Terminal className="w-4 h-4" />
                  最近日志
                </h4>
                <div className="glass-card rounded-lg p-3 font-mono text-xs max-h-48 overflow-auto">
                  {selectedDetail.logs.map((log, i) => (
                    <div key={i} className={cn(
                      "py-0.5",
                      log.includes('[stderr]') && "text-red-500",
                      log.includes('[error]') && "text-red-500",
                      log.includes('[exit]') && "text-yellow-500"
                    )}>
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Server className="w-4 h-4" />
                工具列表
              </h4>
              {selectedDetail.tools && selectedDetail.tools.length > 0 ? (
                <div className="space-y-2">
                  {selectedDetail.tools.map((tool) => (
                    <div key={tool.name} className="glass-card rounded-lg p-3 text-sm">
                      <button
                        onClick={() =>
                          setExpandedTools((prev) => ({
                            ...prev,
                            [tool.name]: !prev[tool.name]
                          }))
                        }
                        className="w-full flex items-center gap-2 text-left"
                      >
                        {expandedTools[tool.name] ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span className="font-medium">{tool.name}</span>
                      </button>
                      <ToolDescription tool={tool} />
                      {expandedTools[tool.name] && (
                        <pre className="mt-2 text-[11px] glass-chip rounded p-2 whitespace-pre-wrap break-words">
                          {formatJson(tool.inputSchema)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground glass-card rounded-lg p-3">
                  暂无工具信息，连接/检查状态后可获取。
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <History className="w-4 h-4" />
                调用记录
              </h4>
              {selectedDetail.callHistory && selectedDetail.callHistory.length > 0 ? (
                <div className="glass-card rounded-lg p-3 font-mono text-xs max-h-64 overflow-auto space-y-3">
                  {selectedDetail.callHistory.map((call) => (
                    <div key={call.id} className="border-b border-white/40 last:border-0 pb-3 last:pb-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{call.method}</span>
                        <span className="text-muted-foreground">
                          {call.duration ? `${call.duration}ms` : '-'}
                        </span>
                      </div>
                      <div className="text-muted-foreground text-[11px]">
                        {new Date(call.startTime).toLocaleString()}
                      </div>
                      <div className="mt-2">
                        <div className="text-muted-foreground mb-1">params</div>
                        <pre className="whitespace-pre-wrap break-words glass-chip rounded p-2">
                          {formatJson(call.params)}
                        </pre>
                      </div>
                      <div className="mt-2">
                        <div className="text-muted-foreground mb-1">result</div>
                        <pre className="whitespace-pre-wrap break-words glass-chip rounded p-2">
                          {formatJson(call.result)}
                        </pre>
                      </div>
                      {call.error && (
                        <div className="mt-2 text-red-500">Error: {call.error}</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground glass-card rounded-lg p-3">
                  暂无调用记录。
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )}

      {/* 添加服务器弹窗 */}
      {showAddForm && (
        <AddServerDialog 
          onClose={() => setShowAddForm(false)} 
          onSuccess={() => {
            setShowAddForm(false)
            loadServers()
          }}
        />
      )}
    </div>
  )
}

// 添加服务器弹窗
function AddServerDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState('')
  const [type, setType] = useState<'stdio' | 'http'>('http')
  const [url, setUrl] = useState('')
  const [command, setCommand] = useState('')
  const [args, setArgs] = useState('')
  const [envList, setEnvList] = useState<{key: string, value: string}[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const config: Record<string, unknown> = { type }
      
      if (type === 'http') {
        if (!url) {
          setError('请输入 URL')
          return
        }
        config.url = url
      } else {
        if (!command) {
          setError('请输入命令')
          return
        }
        config.command = command
        if (args) config.args = args.split(/\s+/).filter(Boolean)
        if (envList.length > 0) {
          config.env = envList.reduce((acc, { key, value }) => 
            key ? { ...acc, [key]: value } : acc, {})
        }
      }

      const result = await window.electronAPI.mcpAdd(name, config)
      if (result.success) {
        onSuccess()
      } else {
        setError(result.error || '添加失败')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-auto py-8 px-4">
      <div className="glass-panel rounded-2xl border-white/40 w-full max-w-lg m-4 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/40">
          <h2 className="text-lg font-semibold font-display">添加 MCP 服务器</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/60 transition-colors glass-chip">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 glass-card border border-destructive/20 rounded-lg text-destructive text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5">名称 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="my-server"
              className="w-full px-4 py-2 text-sm glass-chip rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">类型</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setType('http')}
                className={cn(
                  "flex-1 px-4 py-2 text-sm rounded-lg border transition-colors flex items-center justify-center gap-2 glass-chip",
                  type === 'http' ? "bg-primary/90 text-primary-foreground" : "hover:bg-white/60"
                )}
              >
                <Globe className="w-4 h-4" />
                HTTP
              </button>
              <button
                type="button"
                onClick={() => setType('stdio')}
                className={cn(
                  "flex-1 px-4 py-2 text-sm rounded-lg border transition-colors flex items-center justify-center gap-2 glass-chip",
                  type === 'stdio' ? "bg-primary/90 text-primary-foreground" : "hover:bg-white/60"
                )}
              >
                <Terminal className="w-4 h-4" />
                Stdio
              </button>
            </div>
          </div>

          {type === 'http' ? (
            <div>
              <label className="block text-sm font-medium mb-1.5">URL *</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://mcp.example.com/mcp"
                className="w-full px-4 py-2 text-sm glass-chip rounded-lg focus:outline-none focus:ring-2 focus:ring-ring font-mono"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium mb-1.5">命令 *</label>
                <input
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="npx"
                  className="w-full px-4 py-2 text-sm glass-chip rounded-lg focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">参数</label>
                <input
                  type="text"
                  value={args}
                  onChange={(e) => setArgs(e.target.value)}
                  placeholder="-y @playwright/mcp@latest"
                  className="w-full px-4 py-2 text-sm glass-chip rounded-lg focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">环境变量</label>
                {envList.map((env, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={env.key}
                      onChange={(e) => {
                        const newEnv = [...envList]
                        newEnv[i].key = e.target.value
                        setEnvList(newEnv)
                      }}
                      placeholder="KEY"
                      className="flex-1 px-3 py-2 text-sm glass-chip rounded-lg font-mono"
                    />
                    <input
                      type="text"
                      value={env.value}
                      onChange={(e) => {
                        const newEnv = [...envList]
                        newEnv[i].value = e.target.value
                        setEnvList(newEnv)
                      }}
                      placeholder="value"
                      className="flex-1 px-3 py-2 text-sm glass-chip rounded-lg font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setEnvList(envList.filter((_, j) => j !== i))}
                      className="p-2 glass-chip hover:bg-destructive/10 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setEnvList([...envList, { key: '', value: '' }])}
                  className="text-sm text-primary hover:underline"
                >
                  + 添加环境变量
                </button>
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm glass-chip hover:bg-white/70 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm bg-primary/90 text-primary-foreground hover:bg-primary rounded-lg transition-colors disabled:opacity-50"
            >
              {submitting ? '添加中...' : '添加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
