import { useEffect, useMemo, useState } from 'react'
import { Store, Search, Server, Zap, Bot, RefreshCw, ExternalLink, Link2, Upload } from 'lucide-react'

interface McpServer {
  name: string
  type: 'stdio' | 'http'
  disabled: boolean
  command?: string
  args?: string[]
  url?: string
  env?: Record<string, string>
  headers?: Record<string, string>
}

interface Skill {
  name: string
  description: string
  content: string
  path: string
  scope: 'global' | 'project'
  projectPath?: string
  files: string[]
  aiSummary?: string
}

interface Droid {
  name: string
  description: string
  model: string
  reasoningEffort?: 'low' | 'medium' | 'high'
  tools: string[] | string
  systemPrompt: string
  content: string
  path: string
  scope: 'global' | 'project'
  projectPath?: string
  config?: unknown
  aiSummary?: string
}

type TabType = 'mcp' | 'skills' | 'droids'

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

const RECOMMENDED_SITES = [
  { name: 'MCP.so', url: 'https://mcp.so' },
  { name: 'Smithery', url: 'https://smithery.ai/skills' }
]

function parseResourceUrl(url: string) {
  const mcpMatch = url.match(/^https?:\/\/mcp\.so\/server\/([^/]+)(?:\/([^/]+))?/)?.filter(Boolean)
  if (mcpMatch) {
    return { type: 'mcp' as const, params: mcpMatch.slice(1) }
  }
  const skillMatch = url.match(/^https?:\/\/smithery\.ai\/skills\/([^/]+)\/([^/]+)/)?.filter(Boolean)
  if (skillMatch) {
    return { type: 'skills' as const, params: skillMatch.slice(1) }
  }
  return null
}

function extractMcpConfigFromHtml(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const codeBlocks = Array.from(doc.querySelectorAll('pre, code'))
  const jsonBlock = codeBlocks
    .map(node => (node as HTMLElement).innerText?.trim())
    .find(text => text && (text.includes('mcpServers') || text.includes(' mcpServers')))

  if (!jsonBlock) return null
  try {
    const parsed = JSON.parse(jsonBlock)
    const servers = parsed.mcpServers ?? parsed
    const entries = Object.entries(servers)
    if (entries.length === 0) return null
    const [name, config] = entries[0]
    return { name, config: config as Record<string, unknown> }
  } catch {
    return null
  }
}

export function MarketplacePage() {
  const [activeTab, setActiveTab] = useState<TabType>('mcp')
  const [searchQuery, setSearchQuery] = useState('')
  const [basePath, setBasePath] = useState('')
  const [mcpConfigPath, setMcpConfigPath] = useState('')
  const [mcpServers, setMcpServers] = useState<McpServer[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [droids, setDroids] = useState<Droid[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState<string | null>(null)

  const loadData = async () => {
    if (!window.electronAPI) {
      setError('未检测到 Electron API')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)

    try {
      const result = await window.electronAPI.resourceCenterList()
      setBasePath(result.basePath)
      setMcpConfigPath(result.mcp.configPath)
      setMcpServers(result.mcp.servers as McpServer[])
      setSkills(result.skills)
      setDroids(result.droids)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载资源失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const filteredMcps = useMemo(() => {
    return mcpServers.filter((mcp) =>
      mcp.name.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [mcpServers, searchQuery])

  const filteredSkills = useMemo(() => {
    return skills.filter((skill) => {
      const q = searchQuery.toLowerCase()
      return skill.name.toLowerCase().includes(q) || skill.description?.toLowerCase().includes(q)
    })
  }, [skills, searchQuery])

  const filteredDroids = useMemo(() => {
    return droids.filter((droid) => {
      const q = searchQuery.toLowerCase()
      return droid.name.toLowerCase().includes(q) || droid.description?.toLowerCase().includes(q)
    })
  }, [droids, searchQuery])

  const handleOpenExternal = async (url: string) => {
    if (window.electronAPI?.openExternal) {
      await window.electronAPI.openExternal(url)
    } else {
      window.open(url, '_blank')
    }
  }

  const handleImportUrl = async () => {
    const url = importUrl.trim()
    if (!url || !window.electronAPI) return

    setImporting(true)
    setImportMessage(null)
    try {
      const parsed = parseResourceUrl(url)
      if (!parsed) {
        setImportMessage('仅支持 mcp.so / smithery.ai 的资源链接')
        return
      }

      if (parsed.type === 'mcp') {
        const response = await window.electronAPI.marketplaceFetch(url)
        if (!response.success || !response.text) {
          setImportMessage(response.error || '无法获取资源页面')
          return
        }
        const extracted = extractMcpConfigFromHtml(response.text)
        if (!extracted) {
          setImportMessage('未能解析 MCP 配置')
          return
        }

        const result = await window.electronAPI.resourceCenterMcpAdd(
          extracted.name || parsed.params[0] || 'mcp-server',
          extracted.config
        )
        if (!result.success) {
          setImportMessage(result.error || '添加 MCP 失败')
          return
        }
        setImportMessage('MCP 已导入到资源中心')
      } else {
        const result = await window.electronAPI.marketplaceSkillImport(url)
        if (!result.success) {
          setImportMessage(result.error || '导入 Skill 失败')
          return
        }
        setImportMessage(result.output ? `Skill 已导入：${result.output}` : 'Skill 已导入到资源中心')
      }

      setImportUrl('')
      await loadData()
    } finally {
      setImporting(false)
    }
  }


  return (
    <div className='p-6 h-full flex flex-col gap-6'>
      <div className='flex flex-wrap items-center justify-between gap-4'>
        <div>
          <div className='flex items-center gap-3'>
            <span className='icon-orb icon-orb--amber icon-orb--md'>
              <Store className='w-5 h-5 text-amber-500' />
            </span>
            <div>
              <h1 className='text-xl font-semibold font-display'>资源中心</h1>
              <p className='text-sm text-muted-foreground'>MCP · Skills · 子 Agent</p>
            </div>
          </div>
          {basePath && (
            <p className='text-xs text-muted-foreground mt-2'>资源路径：{basePath}</p>
          )}
          {mcpConfigPath && (
            <p className='text-xs text-muted-foreground mt-1'>MCP 配置：{mcpConfigPath}</p>
          )}
        </div>
        <button
          onClick={loadData}
          className='px-4 py-2 text-sm glass-chip hover:bg-white/70 rounded-lg transition-colors flex items-center gap-2'
        >
          <RefreshCw className='w-4 h-4' />
          刷新
        </button>
      </div>

      {error && (
        <div className='glass-card rounded-2xl p-4 text-sm text-destructive border border-destructive/30'>
          {error}
        </div>
      )}

      <div className='grid gap-4 lg:grid-cols-[1.1fr_1fr]'>
        <div className='glass-card rounded-2xl p-4 space-y-3'>
          <div className='flex items-center gap-2 text-sm font-medium'>
            <Link2 className='w-4 h-4' />
            推荐网站
          </div>
          <div className='flex flex-wrap gap-2'>
            {RECOMMENDED_SITES.map((site) => (
              <button
                key={site.url}
                onClick={() => handleOpenExternal(site.url)}
                className='px-3 py-2 text-sm glass-chip rounded-lg hover:bg-white/70 transition-colors flex items-center gap-2'
              >
                <ExternalLink className='w-4 h-4' />
                {site.name}
              </button>
            ))}
          </div>
        </div>

        <div className='glass-card rounded-2xl p-4 space-y-3'>
          <div className='flex items-center gap-2 text-sm font-medium'>
            <Upload className='w-4 h-4' />
            通过 URL 导入
          </div>
          <div className='flex gap-2'>
            <input
              value={importUrl}
              onChange={(event) => setImportUrl(event.target.value)}
              placeholder='粘贴 mcp.so 或 smithery.ai 链接'
              className='flex-1 px-3 py-2 text-sm rounded-lg glass-input'
            />
            <button
              onClick={handleImportUrl}
              disabled={importing}
              className={cn(
                'px-4 py-2 text-sm rounded-lg transition-colors',
                importing ? 'bg-muted text-muted-foreground' : 'bg-primary/90 text-primary-foreground hover:bg-primary'
              )}
            >
              导入
            </button>
          </div>
          {importMessage && (
            <p className='text-xs text-muted-foreground'>{importMessage}</p>
          )}
        </div>
      </div>

      <div className='glass-card rounded-2xl p-4'>
        <div className='flex flex-wrap items-center gap-2 mb-4'>
          <button
            onClick={() => setActiveTab('mcp')}
            className={cn(
              'px-3 py-2 text-sm rounded-lg transition-colors',
              activeTab === 'mcp' ? 'bg-white/70 text-foreground' : 'glass-chip text-muted-foreground hover:text-foreground'
            )}
          >
            MCP ({mcpServers.length})
          </button>
          <button
            onClick={() => setActiveTab('skills')}
            className={cn(
              'px-3 py-2 text-sm rounded-lg transition-colors',
              activeTab === 'skills' ? 'bg-white/70 text-foreground' : 'glass-chip text-muted-foreground hover:text-foreground'
            )}
          >
            Skills ({skills.length})
          </button>
          <button
            onClick={() => setActiveTab('droids')}
            className={cn(
              'px-3 py-2 text-sm rounded-lg transition-colors',
              activeTab === 'droids' ? 'bg-white/70 text-foreground' : 'glass-chip text-muted-foreground hover:text-foreground'
            )}
          >
            子 Agent ({droids.length})
          </button>
          <div className='relative flex-1 min-w-[220px]'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground' />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder='搜索名称或描述'
              className='w-full pl-9 pr-3 py-2 text-sm rounded-lg glass-input'
            />
          </div>
        </div>

        {loading ? (
          <div className='py-12 text-center text-muted-foreground'>加载中...</div>
        ) : activeTab === 'mcp' ? (
          filteredMcps.length === 0 ? (
            <div className='py-12 text-center text-muted-foreground'>暂无 MCP</div>
          ) : (
            <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
              {filteredMcps.map((mcp) => (
                <div key={mcp.name} className='glass-chip rounded-xl p-3'>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                      <span className='icon-orb icon-orb--sm icon-orb--blue'>
                        <Server className='w-4 h-4 text-blue-500' />
                      </span>
                      <p className='text-sm font-medium'>{mcp.name}</p>
                    </div>
                    <span className='text-[11px] px-2 py-0.5 rounded-full border border-white/50'>
                      {mcp.type.toUpperCase()}
                    </span>
                  </div>
                  <p className='mt-2 text-xs text-muted-foreground break-all'>
                    {mcp.type === 'http'
                      ? (mcp.url || '未配置 URL')
                      : (mcp.command ? [mcp.command, ...(mcp.args || [])].join(' ') : '未配置命令')}
                  </p>
                </div>
              ))}
            </div>
          )
        ) : activeTab === 'skills' ? (
          filteredSkills.length === 0 ? (
            <div className='py-12 text-center text-muted-foreground'>暂无 Skills</div>
          ) : (
            <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
              {filteredSkills.map((skill) => (
                <div key={skill.path} className='glass-chip rounded-xl p-3'>
                  <div className='flex items-center gap-2'>
                    <span className='icon-orb icon-orb--sm icon-orb--green'>
                      <Zap className='w-4 h-4 text-green-500' />
                    </span>
                    <p className='text-sm font-medium'>{skill.name}</p>
                  </div>
                  <p className='mt-2 text-xs text-muted-foreground'>{skill.description || '暂无描述'}</p>
                  <p className='mt-2 text-[11px] text-muted-foreground break-all'>{skill.path}</p>
                </div>
              ))}
            </div>
          )
        ) : (
          filteredDroids.length === 0 ? (
            <div className='py-12 text-center text-muted-foreground'>暂无子 Agent</div>
          ) : (
            <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
              {filteredDroids.map((droid) => (
                <div key={droid.path} className='glass-chip rounded-xl p-3'>
                  <div className='flex items-center gap-2'>
                    <span className='icon-orb icon-orb--sm icon-orb--purple'>
                      <Bot className='w-4 h-4 text-purple-500' />
                    </span>
                    <p className='text-sm font-medium'>{droid.name}</p>
                  </div>
                  <p className='mt-2 text-xs text-muted-foreground'>{droid.description || '暂无描述'}</p>
                  <p className='mt-2 text-[11px] text-muted-foreground break-all'>{droid.path}</p>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}
