import { useState } from 'react'
import { X, Plus, Trash2, Server, Sparkles, Bot } from 'lucide-react'
import { useStore } from '../store'
import type { Resource, ResourceType, McpConfig, SkillConfig, DroidConfig, McpServerType } from '../types'
import { TYPE_LABELS, TYPE_DESCRIPTIONS, COMMON_MODELS, POPULAR_MCP_SERVERS } from '../types'

interface ResourceFormProps {
  resource: Resource | null
  onClose: () => void
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

export function ResourceForm({ resource, onClose }: ResourceFormProps) {
  const { addResource, updateResource, addTag, tags: allTags } = useStore()

  const initialMcpConfig = resource?.mcpConfig
  const initialSkillConfig = resource?.skillConfig
  const initialDroidConfig = resource?.droidConfig
  const initialDroidToolsIsCategory = initialDroidConfig ? typeof initialDroidConfig.tools === 'string' : true
  
  // 基础字段
  const [name, setName] = useState(resource?.name || '')
  const [type, setType] = useState<ResourceType>(resource?.type || 'mcp')
  const [description, setDescription] = useState(resource?.description || '')
  const [links, setLinks] = useState<string[]>(resource?.links || [])
  const [tags, setTags] = useState<string[]>(resource?.tags || [])
  const [newTag, setNewTag] = useState('')
  const [newLink, setNewLink] = useState('')

  // MCP 配置
  const [mcpServerType, setMcpServerType] = useState<McpServerType>(initialMcpConfig?.serverType || 'http')
  const [mcpUrl, setMcpUrl] = useState(initialMcpConfig?.url || '')
  const [mcpHeaders, setMcpHeaders] = useState<{key: string, value: string}[]>(
    initialMcpConfig?.headers ? Object.entries(initialMcpConfig.headers).map(([key, value]) => ({ key, value })) : []
  )
  const [mcpCommand, setMcpCommand] = useState(initialMcpConfig?.command || '')
  const [mcpArgs, setMcpArgs] = useState(initialMcpConfig?.args ? initialMcpConfig.args.join(' ') : '')
  const [mcpEnv, setMcpEnv] = useState<{key: string, value: string}[]>(
    initialMcpConfig?.env ? Object.entries(initialMcpConfig.env).map(([key, value]) => ({ key, value })) : []
  )

  // Skill 配置
  const [skillInstructions, setSkillInstructions] = useState(initialSkillConfig?.instructions || '')

  // Droid 配置
  const [droidSystemPrompt, setDroidSystemPrompt] = useState(initialDroidConfig?.systemPrompt || '')
  const [droidModel, setDroidModel] = useState(initialDroidConfig?.model || 'inherit')
  const [droidToolsType, setDroidToolsType] = useState<'category' | 'custom'>(initialDroidToolsIsCategory ? 'category' : 'custom')
  const [droidToolCategory, setDroidToolCategory] = useState(
    initialDroidConfig && typeof initialDroidConfig.tools === 'string' ? initialDroidConfig.tools : 'read-only'
  )
  const [droidCustomTools, setDroidCustomTools] = useState(
    initialDroidConfig && Array.isArray(initialDroidConfig.tools) ? initialDroidConfig.tools.join(', ') : ''
  )
  const [droidReasoningEffort, setDroidReasoningEffort] = useState<'low' | 'medium' | 'high' | ''>(
    initialDroidConfig?.reasoningEffort || ''
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const baseData = {
      name,
      type,
      description,
      links: links.filter(Boolean),
      tags
    }

    let mcpConfig: McpConfig | undefined
    let skillConfig: SkillConfig | undefined
    let droidConfig: DroidConfig | undefined

    if (type === 'mcp') {
      mcpConfig = {
        serverType: mcpServerType,
        ...(mcpServerType === 'http' ? {
          url: mcpUrl,
          headers: mcpHeaders.reduce((acc, { key, value }) => key ? { ...acc, [key]: value } : acc, {})
        } : {
          command: mcpCommand,
          args: mcpArgs.split(/\s+/).filter(Boolean),
          env: mcpEnv.reduce((acc, { key, value }) => key ? { ...acc, [key]: value } : acc, {})
        })
      }
    } else if (type === 'skill') {
      skillConfig = {
        instructions: skillInstructions
      }
    } else if (type === 'droid') {
      droidConfig = {
        systemPrompt: droidSystemPrompt,
        model: droidModel,
        tools: droidToolsType === 'category' ? droidToolCategory : droidCustomTools.split(',').map(t => t.trim()).filter(Boolean),
        ...(droidReasoningEffort ? { reasoningEffort: droidReasoningEffort } : {})
      }
    }

    const data = {
      ...baseData,
      mcpConfig,
      skillConfig,
      droidConfig
    }

    if (resource) {
      updateResource(resource.id, data)
    } else {
      addResource(data)
    }

    tags.forEach((tag) => addTag(tag))
    onClose()
  }

  const handleAddTag = () => {
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag])
      setNewTag('')
    }
  }

  const handleAddLink = () => {
    if (newLink) {
      setLinks([...links, newLink])
      setNewLink('')
    }
  }

  const handleSelectPopularMcp = (server: typeof POPULAR_MCP_SERVERS[0]) => {
    setName(server.name)
    setDescription(server.description)
    setMcpServerType('http')
    setMcpUrl(server.url)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-auto py-8 px-4">
      <div className="glass-panel rounded-2xl border-white/40 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col m-4 shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/40">
          <h2 className="text-lg font-semibold font-display">
            {resource ? '编辑资源' : '添加资源'}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              form="resource-form"
              className="px-4 py-2 text-sm bg-primary/90 text-primary-foreground hover:bg-primary rounded-lg transition-colors"
            >
              保存
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/60 transition-colors glass-chip">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 表单 */}
        <form id="resource-form" onSubmit={handleSubmit} className="flex-1 overflow-auto p-6 space-y-6">
          {/* 类型选择 */}
          <div>
            <label className="block text-sm font-medium mb-2">资源类型</label>
            <div className="grid grid-cols-3 gap-3">
              {(['mcp', 'skill', 'droid'] as ResourceType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn(
                    "p-4 rounded-xl border-2 text-left transition-all glass-card",
                    type === t 
                      ? "border-primary bg-white/70" 
                      : "border-transparent hover:border-white/60"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {t === 'mcp' && (
                      <span className="icon-orb icon-orb--blue icon-orb--sm">
                        <Server className="w-4 h-4" />
                      </span>
                    )}
                    {t === 'skill' && (
                      <span className="icon-orb icon-orb--green icon-orb--sm">
                        <Sparkles className="w-4 h-4" />
                      </span>
                    )}
                    {t === 'droid' && (
                      <span className="icon-orb icon-orb--purple icon-orb--sm">
                        <Bot className="w-4 h-4" />
                      </span>
                    )}
                    <span className="font-medium">{TYPE_LABELS[t]}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{TYPE_DESCRIPTIONS[t]}</p>
                </button>
              ))}
            </div>
          </div>

          {/* 基础信息 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">名称 *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder={type === 'mcp' ? 'linear' : type === 'skill' ? 'frontend-ui' : 'code-reviewer'}
                className="w-full px-4 py-2 text-sm glass-chip rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground mt-1">小写字母、数字、连字符</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">描述</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="简短描述这个资源的用途"
                className="w-full px-4 py-2 text-sm glass-chip rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* MCP 配置 */}
          {type === 'mcp' && (
            <div className="space-y-4 p-4 glass-card rounded-lg">
              <h3 className="font-medium flex items-center gap-2">
                <span className="icon-orb icon-orb--blue icon-orb--sm">
                  <Server className="w-4 h-4" />
                </span>
                MCP 服务器配置
              </h3>

              {/* 快速选择 */}
              {!resource && (
                <div>
                  <label className="block text-xs text-muted-foreground mb-2">快速添加常用服务</label>
                  <div className="flex flex-wrap gap-2">
                    {POPULAR_MCP_SERVERS.map((server) => (
                      <button
                        key={server.name}
                        type="button"
                        onClick={() => handleSelectPopularMcp(server)}
                        className="px-3 py-1 text-xs glass-chip rounded-full hover:border-primary transition-colors"
                      >
                        {server.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 服务器类型 */}
              <div>
                <label className="block text-sm font-medium mb-1.5">服务器类型</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMcpServerType('http')}
                    className={cn(
                      "px-4 py-2 text-sm rounded-lg border transition-colors glass-chip",
                      mcpServerType === 'http' ? "bg-primary/90 text-primary-foreground" : "hover:bg-white/60"
                    )}
                  >
                    HTTP (远程服务)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMcpServerType('stdio')}
                    className={cn(
                      "px-4 py-2 text-sm rounded-lg border transition-colors glass-chip",
                      mcpServerType === 'stdio' ? "bg-primary/90 text-primary-foreground" : "hover:bg-white/60"
                    )}
                  >
                    Stdio (本地进程)
                  </button>
                </div>
              </div>

              {mcpServerType === 'http' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">URL *</label>
                    <input
                      type="url"
                      value={mcpUrl}
                      onChange={(e) => setMcpUrl(e.target.value)}
                      placeholder="https://mcp.example.com/mcp"
                      className="w-full px-4 py-2 text-sm glass-chip rounded-lg focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Headers (可选)</label>
                    {mcpHeaders.map((header, i) => (
                      <div key={i} className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={header.key}
                          onChange={(e) => {
                            const newHeaders = [...mcpHeaders]
                            newHeaders[i].key = e.target.value
                            setMcpHeaders(newHeaders)
                          }}
                          placeholder="Header 名称"
                          className="flex-1 px-3 py-2 text-sm glass-chip rounded-lg"
                        />
                        <input
                          type="text"
                          value={header.value}
                          onChange={(e) => {
                            const newHeaders = [...mcpHeaders]
                            newHeaders[i].value = e.target.value
                            setMcpHeaders(newHeaders)
                          }}
                          placeholder="值"
                          className="flex-1 px-3 py-2 text-sm glass-chip rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => setMcpHeaders(mcpHeaders.filter((_, j) => j !== i))}
                          className="p-2 hover:bg-destructive/10 rounded-lg glass-chip"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setMcpHeaders([...mcpHeaders, { key: '', value: '' }])}
                      className="text-sm text-primary hover:underline"
                    >
                      + 添加 Header
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">命令 *</label>
                    <input
                      type="text"
                      value={mcpCommand}
                      onChange={(e) => setMcpCommand(e.target.value)}
                      placeholder="npx"
                      className="w-full px-4 py-2 text-sm glass-chip rounded-lg focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">参数</label>
                    <input
                      type="text"
                      value={mcpArgs}
                      onChange={(e) => setMcpArgs(e.target.value)}
                      placeholder="-y @playwright/mcp@latest"
                      className="w-full px-4 py-2 text-sm glass-chip rounded-lg focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                    />
                    <p className="text-xs text-muted-foreground mt-1">空格分隔多个参数</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">环境变量</label>
                    {mcpEnv.map((env, i) => (
                      <div key={i} className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={env.key}
                          onChange={(e) => {
                            const newEnv = [...mcpEnv]
                            newEnv[i].key = e.target.value
                            setMcpEnv(newEnv)
                          }}
                          placeholder="变量名"
                          className="flex-1 px-3 py-2 text-sm glass-chip rounded-lg font-mono"
                        />
                        <input
                          type="text"
                          value={env.value}
                          onChange={(e) => {
                            const newEnv = [...mcpEnv]
                            newEnv[i].value = e.target.value
                            setMcpEnv(newEnv)
                          }}
                          placeholder="值"
                          className="flex-1 px-3 py-2 text-sm glass-chip rounded-lg font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setMcpEnv(mcpEnv.filter((_, j) => j !== i))}
                          className="p-2 hover:bg-destructive/10 rounded-lg glass-chip"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setMcpEnv([...mcpEnv, { key: '', value: '' }])}
                      className="text-sm text-primary hover:underline"
                    >
                      + 添加环境变量
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Skill 配置 */}
          {type === 'skill' && (
            <div className="space-y-4 p-4 glass-card rounded-lg">
              <h3 className="font-medium flex items-center gap-2">
                <span className="icon-orb icon-orb--green icon-orb--sm">
                  <Sparkles className="w-4 h-4" />
                </span>
                Skill 配置
              </h3>
              <div>
                <label className="block text-sm font-medium mb-1.5">指令内容 (Markdown)</label>
                <textarea
                  value={skillInstructions}
                  onChange={(e) => setSkillInstructions(e.target.value)}
                  rows={10}
                  placeholder={`# 技能名称

## Instructions

1. 第一步操作
2. 第二步操作
3. 验证结果

## Success Criteria

- 完成条件 1
- 完成条件 2`}
                  className="w-full px-4 py-2 text-sm glass-chip rounded-lg focus:outline-none focus:ring-2 focus:ring-ring font-mono resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">使用 Markdown 格式编写技能指令</p>
              </div>
            </div>
          )}

          {/* Droid 配置 */}
          {type === 'droid' && (
            <div className="space-y-4 p-4 glass-card rounded-lg">
              <h3 className="font-medium flex items-center gap-2">
                <span className="icon-orb icon-orb--purple icon-orb--sm">
                  <Bot className="w-4 h-4" />
                </span>
                Droid/Agent 配置
              </h3>

              <div>
                <label className="block text-sm font-medium mb-1.5">系统提示词 *</label>
                <textarea
                  value={droidSystemPrompt}
                  onChange={(e) => setDroidSystemPrompt(e.target.value)}
                  rows={6}
                  placeholder={`You are a code reviewer. Examine the diff and:

- Flag correctness, security, and migration risks
- List targeted follow-up tasks if changes are required
- Confirm tests or manual validation needed before merge

Respond with:
Summary: <one-line finding>
Findings:
- <bullet>`}
                  className="w-full px-4 py-2 text-sm glass-chip rounded-lg focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">模型</label>
                  <select
                    value={droidModel}
                    onChange={(e) => setDroidModel(e.target.value)}
                    className="w-full px-4 py-2 text-sm glass-chip rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {COMMON_MODELS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">推理强度</label>
                  <select
                    value={droidReasoningEffort}
                    onChange={(e) => setDroidReasoningEffort(e.target.value as typeof droidReasoningEffort)}
                    className="w-full px-4 py-2 text-sm glass-chip rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">默认</option>
                    <option value="low">低 (Low)</option>
                    <option value="medium">中 (Medium)</option>
                    <option value="high">高 (High)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">工具权限</label>
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setDroidToolsType('category')}
                    className={cn(
                      "px-3 py-1.5 text-sm rounded-lg border transition-colors glass-chip",
                      droidToolsType === 'category' ? "bg-primary/90 text-primary-foreground" : "hover:bg-white/60"
                    )}
                  >
                    预设类别
                  </button>
                  <button
                    type="button"
                    onClick={() => setDroidToolsType('custom')}
                    className={cn(
                      "px-3 py-1.5 text-sm rounded-lg border transition-colors glass-chip",
                      droidToolsType === 'custom' ? "bg-primary/90 text-primary-foreground" : "hover:bg-white/60"
                    )}
                  >
                    自定义工具
                  </button>
                </div>
                {droidToolsType === 'category' ? (
                  <select
                    value={droidToolCategory}
                    onChange={(e) => setDroidToolCategory(e.target.value)}
                    className="w-full px-4 py-2 text-sm glass-chip rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="read-only">只读 (Read, LS, Grep, Glob)</option>
                    <option value="edit">编辑 (Create, Edit, ApplyPatch)</option>
                    <option value="execute">执行 (Execute)</option>
                    <option value="web">网络 (WebSearch, FetchUrl)</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={droidCustomTools}
                    onChange={(e) => setDroidCustomTools(e.target.value)}
                    placeholder="Read, Grep, Glob, WebSearch"
                    className="w-full px-4 py-2 text-sm glass-chip rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {droidToolsType === 'category' 
                    ? '选择预设的工具类别' 
                    : '逗号分隔的工具名称，如: Read, Edit, Execute'}
                </p>
              </div>
            </div>
          )}

          {/* 标签 */}
          <div>
            <label className="block text-sm font-medium mb-1.5">标签</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <span key={tag} className="px-2 py-1 text-xs glass-chip rounded flex items-center gap-1">
                  {tag}
                  <button type="button" onClick={() => setTags(tags.filter((t) => t !== tag))} className="hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                placeholder="添加标签..."
                list="existing-tags"
                className="flex-1 px-4 py-2 text-sm glass-chip rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <datalist id="existing-tags">
                {allTags.filter((t) => !tags.includes(t)).map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
              <button type="button" onClick={handleAddTag} className="px-4 py-2 glass-chip hover:bg-white/70 rounded-lg transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 链接 */}
          <div>
            <label className="block text-sm font-medium mb-1.5">相关链接</label>
            <div className="space-y-2 mb-2">
              {links.map((link, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="url"
                    value={link}
                    onChange={(e) => {
                      const newLinks = [...links]
                      newLinks[i] = e.target.value
                      setLinks(newLinks)
                    }}
                    className="flex-1 px-4 py-2 text-sm glass-chip rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button type="button" onClick={() => setLinks(links.filter((_, j) => j !== i))} className="p-2 rounded-lg hover:bg-destructive/10 transition-colors glass-chip">
                    <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="url"
                value={newLink}
                onChange={(e) => setNewLink(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddLink())}
                placeholder="https://..."
                className="flex-1 px-4 py-2 text-sm glass-chip rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button type="button" onClick={handleAddLink} className="px-4 py-2 glass-chip hover:bg-white/70 rounded-lg transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>
  )
}
