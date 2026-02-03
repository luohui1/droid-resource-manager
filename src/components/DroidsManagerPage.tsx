import { useState, useEffect, useCallback } from 'react'
import {
  Bot,
  RefreshCw,
  Plus,
  Globe,
  Folder,
  ChevronDown,
  ChevronRight,
  Trash2,
  Save,
  X,
  Copy
} from 'lucide-react'

interface DroidConfig {
  linkedSkills?: {
    required?: string[]
    allowed?: string[]
  }
  linkedMcp?: {
    required?: string[]
    allowed?: string[]
  }
  toolPermissions?: {
    required?: string[]
    denied?: string[]
  }
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
  config?: DroidConfig
  aiSummary?: string
}

interface ProjectNode {
  path: string
  name: string
  type: 'global' | 'project'
  droids: Droid[]
  skills: string[]
  expanded: boolean
}

interface ToolCategoryMap {
  [key: string]: string[]
}

const TOOL_CATEGORY_OPTIONS = [
  {
    value: 'read-only',
    label: '只读',
    description: '仅 Read / LS / Grep / Glob'
  },
  {
    value: 'all',
    label: '全权限',
    description: '允许所有内置工具'
  }
]

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

export function DroidsManagerPage() {
  const [nodes, setNodes] = useState<ProjectNode[]>([])
  const [globalSkills, setGlobalSkills] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedNode, setSelectedNode] = useState<ProjectNode | null>(null)
  const [selectedDroid, setSelectedDroid] = useState<Droid | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showCopyModal, setShowCopyModal] = useState(false)
  const [copyingDroid, setCopyingDroid] = useState<Droid | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tools, setTools] = useState<string[]>([])
  const [toolCategories, setToolCategories] = useState<ToolCategoryMap>({})
  const [mcpServers, setMcpServers] = useState<string[]>([])
  const [permissionsOpen, setPermissionsOpen] = useState(true)
  const [linksOpen, setLinksOpen] = useState(true)
  const [draggingDroid, setDraggingDroid] = useState<Droid | null>(null)

  const [editData, setEditData] = useState({
    toolsCategory: 'read-only',
    toolsSummary: 'read-only'
  })

  const [configData, setConfigData] = useState<DroidConfig>({})

  const loadData = useCallback(async () => {
    if (!window.electronAPI?.droidsGetGlobal) {
      setError('Droids API 未加载，请重启应用以更新 preload')
      setLoading(false)
      return
    }
    const globalDroids = await window.electronAPI.droidsGetGlobal()
    const gPath = await window.electronAPI.droidsGetGlobalPath()
    const globalSkillsList = await window.electronAPI.skillsGetGlobal()
    const toolsList = await window.electronAPI.droidsGetTools()
    const categories = await window.electronAPI.droidsGetToolCategories()
    const mcpList = await window.electronAPI.mcpList()

    setGlobalSkills(globalSkillsList.map((s) => s.name))
    setTools(toolsList)
    setToolCategories(categories)
    setMcpServers((mcpList.servers || []).map((s: { name: string }) => s.name))

    const newNodes: ProjectNode[] = [{
      path: gPath,
      name: '全局 Droids',
      type: 'global',
      droids: globalDroids,
      skills: globalSkillsList.map((s) => s.name),
      expanded: true
    }]

    const discoveredPaths = await window.electronAPI.droidsDiscoverWork()

    const saved = localStorage.getItem('droidsProjectTabs')
    const savedPaths = saved ? (JSON.parse(saved) as string[]) : []
    const mergedPaths = Array.from(new Set([...savedPaths, ...discoveredPaths]))

    for (const p of mergedPaths) {
      const droidsList = await window.electronAPI.droidsGetProject(p)
      const skillsList = await window.electronAPI.skillsGetProject(p)
      newNodes.push({
        path: p,
        name: p.split(/[/\\]/).pop() || p,
        type: 'project',
        droids: droidsList,
        skills: skillsList.map((s) => s.name),
        expanded: true
      })
    }

    setNodes(newNodes)
    if (newNodes.length > 0 && !selectedNode) {
      setSelectedNode(newNodes[0])
    }
    setLoading(false)
  }, [selectedNode])

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData()
    }, 0)
    return () => clearTimeout(timer)
  }, [loadData])

  const saveProjectPaths = (projectNodes: ProjectNode[]) => {
    const paths = projectNodes.filter(n => n.type === 'project').map(n => n.path)
    localStorage.setItem('droidsProjectTabs', JSON.stringify(paths))
  }

  const handleAddProject = async () => {
    const path = await window.electronAPI.droidsSelectProject()
    if (path && !nodes.find(n => n.path === path)) {
      const droidsList = await window.electronAPI.droidsGetProject(path)
      const skillsList = await window.electronAPI.skillsGetProject(path)
      const newNode: ProjectNode = {
        path,
        name: path.split(/[/\\]/).pop() || path,
        type: 'project',
        droids: droidsList,
        skills: skillsList.map((s) => s.name),
        expanded: true
      }
      const updated = [...nodes, newNode]
      setNodes(updated)
      saveProjectPaths(updated)
      setSelectedNode(newNode)
    }
  }

  const handleRemoveProject = (node: ProjectNode) => {
    if (node.type === 'global') return
    const updated = nodes.filter(n => n.path !== node.path)
    setNodes(updated)
    saveProjectPaths(updated)
    if (selectedNode?.path === node.path) {
      setSelectedNode(updated[0] || null)
      setSelectedDroid(null)
    }
  }

  const handleRefresh = async () => {
    setLoading(true)
    await loadData()
    setLoading(false)
  }

  const handleDropDroid = async (targetNode: ProjectNode) => {
    if (!draggingDroid) return
    const currentNodePath = draggingDroid.scope === 'global'
      ? nodes.find(x => x.type === 'global')?.path
      : draggingDroid.projectPath
    if (!currentNodePath || currentNodePath === targetNode.path) {
      return
    }

    const result = await window.electronAPI.droidsMove(
      draggingDroid.path,
      targetNode.type,
      targetNode.type === 'project' ? targetNode.path : undefined
    )

    if (!result.success) {
      setError(result.error || '移动失败')
      return
    }

    await handleRefresh()
    setDraggingDroid(null)
  }

  const toggleExpand = (node: ProjectNode) => {
    setNodes(nodes.map(n => n.path === node.path ? { ...n, expanded: !n.expanded } : n))
  }

  const getToolsCategory = (toolsValue: string[] | string) => {
    if (typeof toolsValue === 'string' && TOOL_CATEGORY_OPTIONS.some(option => option.value === toolsValue)) {
      return toolsValue
    }
    if (Array.isArray(toolsValue)) {
      const allTools = toolCategories.all || tools
      const readOnlyTools = toolCategories['read-only'] || ['Read', 'LS', 'Grep', 'Glob']
      if (toolsValue.length === allTools.length && allTools.every(t => toolsValue.includes(t))) return 'all'
      if (readOnlyTools.every(t => toolsValue.includes(t))) return 'read-only'
    }
    return 'read-only'
  }

  const handleSelectDroid = (droid: Droid, node: ProjectNode) => {
    setSelectedNode(node)
    setSelectedDroid(droid)
    setEditData({
      toolsCategory: getToolsCategory(droid.tools),
      toolsSummary: getToolsCategory(droid.tools)
    })
    setConfigData(droid.config || {})
  }

  const handleSave = async () => {
    if (!selectedDroid) return
    const result = await window.electronAPI.droidsUpdate(selectedDroid.path, {
      tools: editData.toolsCategory
    })
    if (result.success) {
      await handleRefresh()
    } else {
      setError(result.error || '保存失败')
    }
  }

  const handleSaveConfig = async () => {
    if (!selectedDroid) return
    const result = await window.electronAPI.droidsSaveConfig(selectedDroid.name, configData)
    if (result.success) {
      await handleRefresh()
    } else {
      setError(result.error || '保存配置失败')
    }
  }

  const handleDelete = async (droid: Droid) => {
    if (!confirm(`确定要删除 "${droid.name}" 吗？`)) return
    const result = await window.electronAPI.droidsDelete(droid.path)
    if (result.success) {
      if (selectedDroid?.path === droid.path) setSelectedDroid(null)
      await handleRefresh()
    } else {
      setError(result.error || '删除失败')
    }
  }

  const toggleArrayValue = (list: string[] | undefined, value: string) => {
    const arr = list ? [...list] : []
    const idx = arr.indexOf(value)
    if (idx >= 0) arr.splice(idx, 1)
    else arr.push(value)
    return arr
  }

  const availableSkills = selectedNode?.type === 'project'
    ? [...globalSkills, ...(selectedNode.skills || [])]
    : [...globalSkills]

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2 font-display">
            <span className="icon-orb icon-orb--sm icon-orb--purple">
              <Bot className="w-5 h-5" />
            </span>
            Droids 管理器
          </h1>
        </div>
        <div className="flex gap-2">
          <button onClick={handleRefresh} className="px-3 py-2 text-sm glass-chip hover:bg-white/70 rounded-lg flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            扫描
          </button>
          <button onClick={() => setShowCreateModal(true)} className="px-4 py-2 text-sm bg-primary/90 text-primary-foreground hover:bg-primary rounded-lg flex items-center gap-2">
            <Plus className="w-4 h-4" />
            创建
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 glass-card border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive text-sm">
          <span className="flex-1 whitespace-pre-wrap">{error}</span>
          <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="flex-1 flex gap-4 overflow-hidden">
        <div className="w-64 glass-card rounded-2xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 glass-chip border-b border-white/40 flex items-center justify-between">
            <span className="text-sm font-medium">项目导航</span>
            <button onClick={handleAddProject} className="p-1 glass-chip hover:bg-white/60 rounded" title="添加项目">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-auto py-2">
            {nodes.map(node => (
              <div
                key={node.path}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  void handleDropDroid(node)
                }}
              >
                <div
                  className={cn(
                    "flex items-center gap-1 px-2 py-1.5 cursor-pointer hover:bg-white/50 group",
                    selectedNode?.path === node.path && !selectedDroid && "bg-white/70"
                  )}
                  onClick={() => { setSelectedNode(node); setSelectedDroid(null) }}
                >
                  <button onClick={(e) => { e.stopPropagation(); toggleExpand(node) }} className="p-0.5">
                    {node.expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  {node.type === 'global' ? (
                    <span className="icon-orb icon-orb--sm icon-orb--blue">
                      <Globe className="w-4 h-4" />
                    </span>
                  ) : (
                    <span className="icon-orb icon-orb--sm icon-orb--orange">
                      <Folder className="w-4 h-4" />
                    </span>
                  )}
                  <span className="flex-1 text-sm truncate">{node.name}</span>
                  <span className="text-xs text-muted-foreground">{node.droids.length}</span>
                  {node.type === 'project' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemoveProject(node) }}
                      className="p-0.5 opacity-0 group-hover:opacity-100 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {node.expanded && node.droids.map(droid => (
                  <div
                    key={droid.path}
                    onClick={() => handleSelectDroid(droid, node)}
                    className={cn(
                      "flex items-center gap-2 pl-8 pr-2 py-1.5 cursor-pointer hover:bg-white/50 group",
                      selectedDroid?.path === droid.path && "bg-white/70"
                    )}
                    draggable
                    onDragStart={() => setDraggingDroid(droid)}
                    onDragEnd={() => setDraggingDroid(null)}
                  >
                    <Bot className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="flex-1 text-sm truncate">{droid.name}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setCopyingDroid(droid); setShowCopyModal(true) }}
                      className="p-0.5 opacity-0 group-hover:opacity-100 hover:text-primary"
                      title="复制到其他位置"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(droid) }}
                      className="p-0.5 opacity-0 group-hover:opacity-100 hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {node.expanded && node.droids.length === 0 && (
                  <div className="pl-8 pr-2 py-1.5 text-xs text-muted-foreground">暂无 Droids</div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 glass-card rounded-2xl overflow-hidden flex flex-col">
          {selectedDroid ? (
            <>
              <div className="px-4 py-3 glass-chip border-b border-white/40 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{selectedDroid.name}</h3>
                  <p className="text-xs text-muted-foreground truncate">{selectedDroid.description || '无描述'}</p>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-4 space-y-4">
                <div className="glass-card rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">模型</p>
                      <p className="text-sm font-mono">{selectedDroid.model}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Reasoning Effort</p>
                      <p className="text-sm">{selectedDroid.reasoningEffort || '未设置'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">系统权限</p>
                      <p className="text-sm">{editData.toolsSummary === 'all' ? '全权限' : '只读'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">范围</p>
                      <p className="text-sm">{selectedDroid.scope === 'global' ? '全局' : '项目'}</p>
                    </div>
                  </div>
                </div>

                <div className="border border-white/40 rounded-lg glass-card">
                  <button
                    onClick={() => setPermissionsOpen(!permissionsOpen)}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium"
                  >
                    <span>系统权限</span>
                    {permissionsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  {permissionsOpen && (
                    <div className="px-4 pb-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        {TOOL_CATEGORY_OPTIONS.map(option => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setEditData({ ...editData, toolsCategory: option.value, toolsSummary: option.value })}
                            className={cn(
                              "p-3 rounded-lg border text-left glass-card",
                              editData.toolsCategory === option.value ? "border-primary bg-white/70" : "border-white/40"
                            )}
                          >
                            <div className="text-sm font-medium">{option.label}</div>
                            <div className="text-xs text-muted-foreground mt-1">{option.description}</div>
                          </button>
                        ))}
                      </div>
                      <button onClick={handleSave} className="inline-flex items-center gap-2 px-3 py-1.5 text-sm glass-chip hover:bg-white/70 rounded-lg">
                        <Save className="w-4 h-4" />
                        保存权限
                      </button>
                    </div>
                  )}
                </div>

                <div className="border border-white/40 rounded-lg glass-card">
                  <button
                    onClick={() => setLinksOpen(!linksOpen)}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium"
                  >
                    <span>Skills & MCP 关联</span>
                    {linksOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  {linksOpen && (
                    <div className="px-4 pb-4 space-y-4">
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <p className="text-sm font-medium mb-2">必须使用的 Skills</p>
                          <div className="space-y-1">
                            {availableSkills.map((skill) => (
                              <label key={skill} className="flex items-center gap-2 text-xs">
                                <input
                                  type="checkbox"
                                  checked={(configData.linkedSkills?.required || []).includes(skill)}
                                  onChange={() => setConfigData({
                                    ...configData,
                                    linkedSkills: {
                                      ...configData.linkedSkills,
                                      required: toggleArrayValue(configData.linkedSkills?.required, skill)
                                    }
                                  })}
                                />
                                {skill}
                              </label>
                            ))}
                            {availableSkills.length === 0 && (
                              <p className="text-xs text-muted-foreground">暂无 Skills</p>
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-2">必须使用的 MCP</p>
                          <div className="space-y-1">
                            {mcpServers.map((server) => (
                              <label key={server} className="flex items-center gap-2 text-xs">
                                <input
                                  type="checkbox"
                                  checked={(configData.linkedMcp?.required || []).includes(server)}
                                  onChange={() => setConfigData({
                                    ...configData,
                                    linkedMcp: {
                                      ...configData.linkedMcp,
                                      required: toggleArrayValue(configData.linkedMcp?.required, server)
                                    }
                                  })}
                                />
                                {server}
                              </label>
                            ))}
                            {mcpServers.length === 0 && (
                              <p className="text-xs text-muted-foreground">暂无 MCP</p>
                            )}
                          </div>
                        </div>
                      </div>
                      <button onClick={handleSaveConfig} className="inline-flex items-center gap-2 px-3 py-1.5 text-sm glass-chip hover:bg-white/70 rounded-lg">
                        <Save className="w-4 h-4" />
                        保存关联
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : selectedNode ? (
            <div className="flex-1 p-6">
              <div className="flex items-center gap-3 mb-4">
                {selectedNode.type === 'global' ? (
                  <span className="icon-orb icon-orb--blue icon-orb--sm">
                    <Globe className="w-6 h-6" />
                  </span>
                ) : (
                  <span className="icon-orb icon-orb--orange icon-orb--sm">
                    <Folder className="w-6 h-6" />
                  </span>
                )}
                <div>
                  <h2 className="text-lg font-semibold font-display">{selectedNode.name}</h2>
                  <p className="text-sm text-muted-foreground">{selectedNode.droids.length} 个 Droids</p>
                </div>
              </div>
              <div className="text-xs text-muted-foreground mb-4">
                {selectedNode.path}
              </div>
              {selectedNode.droids.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {selectedNode.droids.map(droid => (
                    <div
                      key={droid.path}
                      onClick={() => handleSelectDroid(droid, selectedNode)}
                        className="p-3 glass-card rounded-lg cursor-pointer hover:bg-white/60 transition-colors"
                        draggable
                        onDragStart={() => setDraggingDroid(droid)}
                        onDragEnd={() => setDraggingDroid(null)}
                    >
                      <p className="font-medium text-sm truncate">{droid.name}</p>
                      <p className="text-xs text-muted-foreground truncate mt-1">{droid.description || '无描述'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Bot className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>暂无 Droids</p>
                  <p className="text-sm mt-1">点击上方按钮创建</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>选择一个项目或 Droid</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <CreateDroidModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={async () => { setShowCreateModal(false); await handleRefresh() }}
          nodes={nodes}
          tools={tools}
          categories={toolCategories}
          defaultNode={selectedNode || nodes[0]}
        />
      )}
      {showCopyModal && copyingDroid && (
        <CopyDroidModal
          droid={copyingDroid}
          nodes={nodes}
          onClose={() => { setShowCopyModal(false); setCopyingDroid(null) }}
          onSuccess={async () => { setShowCopyModal(false); setCopyingDroid(null); await handleRefresh() }}
        />
      )}
    </div>
  )
}

function CopyDroidModal({ droid, nodes, onClose, onSuccess }: {
  droid: Droid
  nodes: ProjectNode[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [targetPath, setTargetPath] = useState('')
  const [copying, setCopying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentNodePath = droid.scope === 'global' 
    ? nodes.find(x => x.type === 'global')?.path 
    : droid.projectPath
  const availableTargets = nodes.filter(n => n.path !== currentNodePath)

  const handleCopy = async () => {
    if (!targetPath) {
      setError('请选择目标位置')
      return
    }

    setCopying(true)
    setError(null)

    const targetNode = nodes.find(n => n.path === targetPath)
    if (!targetNode) {
      setError('目标位置无效')
      setCopying(false)
      return
    }

    const result = await window.electronAPI.droidsCopy(
      droid.path,
      targetNode.type,
      targetNode.type === 'project' ? targetNode.path : undefined
    )

    setCopying(false)

    if (result.success) {
      onSuccess()
    } else {
      setError(result.error || '复制失败')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-auto py-8 px-4">
      <div className="glass-panel rounded-2xl border-white/40 shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-white/40 flex items-center justify-between">
          <h2 className="text-lg font-semibold font-display flex items-center gap-2">
            <Copy className="w-5 h-5" />
            复制 Droid
          </h2>
          <button onClick={onClose} className="p-1 glass-chip hover:bg-white/60 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">源 Droid</label>
            <div className="px-3 py-2 glass-chip rounded-lg text-sm">
              <div className="font-medium">{droid.name}</div>
              <div className="text-xs text-muted-foreground truncate">{droid.path}</div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">复制到</label>
            {availableTargets.length === 0 ? (
              <div className="px-3 py-2 glass-chip rounded-lg text-sm text-muted-foreground">
                没有可用的目标位置，请先添加项目
              </div>
            ) : (
              <select
                value={targetPath}
                onChange={(e) => setTargetPath(e.target.value)}
                className="w-full px-3 py-2 glass-chip rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">选择目标位置...</option>
                {availableTargets.map(node => (
                  <option key={node.path} value={node.path}>
                    {node.type === 'global' ? '🌐 ' : '📁 '}{node.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {error && (
            <div className="p-3 glass-card text-destructive rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-white/40 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm glass-chip hover:bg-white/70 rounded-lg"
          >
            取消
          </button>
          <button
            onClick={handleCopy}
            disabled={copying || !targetPath}
            className="px-4 py-2 text-sm bg-primary/90 text-primary-foreground hover:bg-primary rounded-lg disabled:opacity-50 flex items-center gap-2"
          >
            {copying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
            {copying ? '复制中...' : '复制'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CreateDroidModal({
  onClose,
  onSuccess,
  nodes,
  tools,
  categories,
  defaultNode
}: {
  onClose: () => void
  onSuccess: () => void
  nodes: ProjectNode[]
  tools: string[]
  categories: ToolCategoryMap
  defaultNode: ProjectNode
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [model, setModel] = useState('inherit')
  const [reasoningEffort, setReasoningEffort] = useState('')
  const [toolsMode, setToolsMode] = useState<'category' | 'custom'>('category')
  const [toolsCategory, setToolsCategory] = useState('read-only')
  const [toolsList, setToolsList] = useState<string[]>([])
  const [systemPrompt, setSystemPrompt] = useState('')
  const [selectedPath, setSelectedPath] = useState(defaultNode.path)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedNode = nodes.find(n => n.path === selectedPath)

  const toggleTool = (tool: string) => {
    setToolsList(prev => prev.includes(tool) ? prev.filter(t => t !== tool) : [...prev, tool])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('请输入名称'); return }
    if (!systemPrompt.trim()) { setError('请输入系统提示词'); return }
    if (!selectedNode) { setError('请选择存储位置'); return }

    setSubmitting(true)
    setError(null)
    const scope = selectedNode.type
    const projectPath = scope === 'project' ? selectedNode.path : undefined
    const toolsValue = toolsMode === 'category' ? toolsCategory : toolsList
    const result = await window.electronAPI.droidsCreate({
      name,
      description,
      model,
      reasoningEffort: reasoningEffort || undefined,
      tools: toolsValue,
      systemPrompt
    }, scope, projectPath)

    if (result.success) onSuccess()
    else setError(result.error || '创建失败')
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-auto py-8 px-4">
      <div className="glass-panel rounded-2xl border-white/40 w-full max-w-4xl max-h-[90vh] m-4 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/40">
          <h2 className="text-lg font-semibold font-display">创建 Droid</h2>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              form="droid-create-form"
              disabled={submitting}
              className="px-4 py-2 text-sm bg-primary/90 text-primary-foreground hover:bg-primary rounded-lg disabled:opacity-50"
            >
              {submitting ? '保存中...' : '保存'}
            </button>
            <button onClick={onClose} className="p-2 rounded-lg glass-chip hover:bg-white/60"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <form id="droid-create-form" onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          {error && (
            <div className="mx-6 mt-4 p-3 glass-card border border-destructive/20 rounded-lg text-destructive text-sm">{error}</div>
          )}

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">名称 *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="code-reviewer"
                  className="w-full px-3 py-2 text-sm glass-chip rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">存储位置</label>
                <select value={selectedPath} onChange={(e) => setSelectedPath(e.target.value)}
                  className="w-full px-3 py-2 text-sm glass-chip rounded-lg">
                  {nodes.map(n => (
                    <option key={n.path} value={n.path}>
                      {n.type === 'global' ? '🌐 ' : '📁 '}{n.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">描述</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="描述这个 Droid 的用途"
                className="w-full px-3 py-2 text-sm glass-chip rounded-lg" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">模型</label>
                <input type="text" value={model} onChange={(e) => setModel(e.target.value)}
                  className="w-full px-3 py-2 text-sm glass-chip rounded-lg font-mono" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reasoning Effort</label>
                <select value={reasoningEffort} onChange={(e) => setReasoningEffort(e.target.value)}
                  className="w-full px-3 py-2 text-sm glass-chip rounded-lg">
                  <option value="">未设置</option>
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">工具权限</label>
              <div className="flex gap-3 mb-3">
                <button
                  type="button"
                  onClick={() => setToolsMode('category')}
                  className={cn("px-3 py-1.5 text-sm rounded-lg glass-chip", toolsMode === 'category' ? "bg-primary/90 text-primary-foreground" : "hover:bg-white/70")}
                >
                  简单模式
                </button>
                <button
                  type="button"
                  onClick={() => setToolsMode('custom')}
                  className={cn("px-3 py-1.5 text-sm rounded-lg glass-chip", toolsMode === 'custom' ? "bg-primary/90 text-primary-foreground" : "hover:bg-white/70")}
                >
                  自定义工具
                </button>
              </div>
              {toolsMode === 'category' ? (
                <div className="grid grid-cols-2 gap-3">
                  {TOOL_CATEGORY_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setToolsCategory(option.value)}
                      className={cn(
                        "p-3 rounded-lg border text-left glass-card",
                        toolsCategory === option.value ? "border-primary bg-white/70" : "border-white/40"
                      )}
                    >
                      <div className="text-sm font-medium">{option.label}</div>
                      <div className="text-xs text-muted-foreground mt-1">{option.description}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">自定义工具（Droid 内置工具列表）</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setToolsList(tools)}
                        className="px-2 py-1 text-xs glass-chip rounded"
                      >
                        全选
                      </button>
                      <button
                        type="button"
                        onClick={() => setToolsList([])}
                        className="px-2 py-1 text-xs glass-chip rounded"
                      >
                        清空
                      </button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {Object.entries(categories)
                      .filter(([key, values]) => key !== 'all' && values.length > 0)
                      .map(([category, categoryTools]) => (
                        <div key={category} className="border border-white/40 rounded-lg p-3 glass-card">
                          <p className="text-xs font-semibold mb-2 text-muted-foreground">{category}</p>
                          <div className="grid grid-cols-3 gap-2">
                            {categoryTools.map((tool) => (
                              <label key={tool} className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={toolsList.includes(tool)} onChange={() => toggleTool(tool)} />
                                {tool}
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">系统提示词 *</label>
              <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="描述这个 Droid 应该如何工作..."
                className="w-full h-48 p-3 text-sm glass-chip rounded-lg font-mono resize-none" />
            </div>
          </div>

        </form>
      </div>
    </div>
  )
}
