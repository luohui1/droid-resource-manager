import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, ScrollText, Edit2, Trash2, Link2, Copy, RefreshCw, Globe, FolderOpen, ChevronRight, ChevronDown, X } from 'lucide-react'
import { RULE_CATEGORIES } from '../types'

interface Rule {
  name: string
  description: string
  content: string
  path: string
  scope: 'global' | 'project'
  projectPath?: string
  category?: string
  priority?: number
  globs?: string[]
  linkedResources?: string[]
}

interface ProjectNode {
  path: string
  name: string
  type: 'global' | 'project'
  rules: Rule[]
  expanded: boolean
}

export function RuleManagerPage() {
  const [nodes, setNodes] = useState<ProjectNode[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<Rule | null>(null)
  const [createScope, setCreateScope] = useState<'global' | 'project'>('global')
  const [createProjectPath, setCreateProjectPath] = useState<string>('')
  const [showCopyModal, setShowCopyModal] = useState(false)
  const [copyingRule, setCopyingRule] = useState<Rule | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const globalRules = await window.electronAPI.rulesGetGlobal()
      const gPath = await window.electronAPI.rulesGetGlobalPath()

      const newNodes: ProjectNode[] = [{
        path: gPath,
        name: '全局 Rules',
        type: 'global',
        rules: globalRules,
        expanded: true
      }]

      const saved = localStorage.getItem('rulesProjectTabs')
      if (saved) {
        const paths = JSON.parse(saved) as string[]
        for (const p of paths) {
          const rules = await window.electronAPI.rulesGetProject(p)
          newNodes.push({
            path: p,
            name: p.split(/[/\\]/).pop() || p,
            type: 'project',
            rules,
            expanded: true
          })
        }
      }

      setNodes(newNodes)
    } catch (e) {
      setError('加载 Rules 失败: ' + (e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const saveProjectPaths = (projectNodes: ProjectNode[]) => {
    const paths = projectNodes.filter(n => n.type === 'project').map(n => n.path)
    localStorage.setItem('rulesProjectTabs', JSON.stringify(paths))
  }

  const handleAddProject = async () => {
    const path = await window.electronAPI.rulesSelectProject()
    if (path && !nodes.find(n => n.path === path)) {
      const rules = await window.electronAPI.rulesGetProject(path)
      const newNodes = [...nodes, {
        path,
        name: path.split(/[/\\]/).pop() || path,
        type: 'project' as const,
        rules,
        expanded: true
      }]
      setNodes(newNodes)
      saveProjectPaths(newNodes)
    }
  }

  const handleRemoveProject = (nodePath: string) => {
    const newNodes = nodes.filter(n => n.path !== nodePath)
    setNodes(newNodes)
    saveProjectPaths(newNodes)
  }

  const toggleNode = (nodePath: string) => {
    setNodes(nodes.map(n => 
      n.path === nodePath ? { ...n, expanded: !n.expanded } : n
    ))
  }

  const handleAdd = (scope: 'global' | 'project', projectPath?: string) => {
    setEditingRule(null)
    setCreateScope(scope)
    setCreateProjectPath(projectPath || '')
    setIsFormOpen(true)
  }

  const handleEdit = (rule: Rule) => {
    setEditingRule(rule)
    setCreateScope(rule.scope)
    setCreateProjectPath(rule.projectPath || '')
    setIsFormOpen(true)
  }

  const handleDelete = async (rule: Rule) => {
    if (confirm(`确定要删除 "${rule.name}" 吗？`)) {
      const result = await window.electronAPI.rulesDelete(rule.path)
      if (result.success) {
        loadData()
      } else {
        setError('删除失败: ' + result.error)
      }
    }
  }

  const handleCopy = async (content: string) => {
    await navigator.clipboard.writeText(content)
  }

  const handleSave = async (data: {
    name: string
    description: string
    content: string
    category: string
    priority: number
    globs: string[]
    linkedResources: string[]
  }) => {
    let result
    if (editingRule) {
      result = await window.electronAPI.rulesUpdate(
        editingRule.path,
        data.content,
        data.description,
        data.category,
        data.priority,
        data.globs,
        data.linkedResources
      )
    } else {
      result = await window.electronAPI.rulesCreate(
        data.name,
        data.content,
        createScope,
        createScope === 'project' ? createProjectPath : undefined,
        data.description,
        data.category,
        data.priority,
        data.globs,
        data.linkedResources
      )
    }

    if (result.success) {
      setIsFormOpen(false)
      setEditingRule(null)
      loadData()
    } else {
      setError('保存失败: ' + result.error)
    }
  }

  const handleOpenFolder = async (folderPath: string) => {
    await window.electronAPI.openExternal('file://' + folderPath)
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-white/40 glass-panel">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold font-display">Rules 管理</h1>
            <p className="text-muted-foreground text-sm mt-1">管理项目和全局编码规则</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadData}
              className="flex items-center gap-2 px-4 py-2 glass-chip rounded-lg hover:bg-white/70 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              刷新
            </button>
            <button
              onClick={handleAddProject}
              className="flex items-center gap-2 px-4 py-2 glass-chip rounded-lg hover:bg-white/70 transition-colors"
            >
              <FolderOpen className="w-4 h-4" />
              添加项目
            </button>
            <button
              onClick={() => handleAdd('global')}
              className="flex items-center gap-2 px-4 py-2 bg-primary/90 text-primary-foreground rounded-lg hover:bg-primary transition-colors"
            >
              <Plus className="w-4 h-4" />
              新建全局 Rule
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 glass-card text-destructive rounded-lg text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">关闭</button>
          </div>
        )}

        {/* Search & Filter */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="搜索 Rule..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 glass-chip rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 glass-chip rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">全部分类</option>
            {RULE_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto p-6">
        {nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <ScrollText className="w-12 h-12 mb-4 opacity-50" />
            <p>暂无 Rule</p>
          </div>
        ) : (
          <div className="space-y-4">
            {nodes.map((node) => (
              <div key={node.path} className="glass-card border-white/40 rounded-2xl overflow-hidden">
                {/* Node Header */}
                <div 
                  className="flex items-center justify-between p-3 glass-chip cursor-pointer hover:bg-white/60"
                  onClick={() => toggleNode(node.path)}
                >
                  <div className="flex items-center gap-2">
                    {node.expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    {node.type === 'global' ? (
                      <span className="icon-orb icon-orb--sm icon-orb--blue">
                        <Globe className="w-4 h-4" />
                      </span>
                    ) : (
                      <span className="icon-orb icon-orb--sm icon-orb--green">
                        <FolderOpen className="w-4 h-4" />
                      </span>
                    )}
                    <span className="font-medium">{node.name}</span>
                    <span className="text-xs text-muted-foreground">({node.rules.length})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleOpenFolder(node.path) }}
                      className="p-1 glass-chip hover:bg-white/60 rounded"
                      title="打开文件夹"
                    >
                      <FolderOpen className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleAdd(node.type, node.type === 'project' ? node.path : undefined) }}
                      className="p-1 glass-chip hover:bg-white/60 rounded"
                      title="新建 Rule"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    {node.type === 'project' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveProject(node.path) }}
                        className="p-1 glass-chip hover:bg-destructive/10 text-destructive rounded"
                        title="移除项目"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>

                {/* Node Content */}
                {node.expanded && (
                  <div className="p-3 space-y-3">
                    {node.rules.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">暂无 Rule</p>
                    ) : (
                      node.rules
                        .filter(r => {
                          const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            r.description.toLowerCase().includes(searchQuery.toLowerCase())
                          const matchesCategory = selectedCategory === 'all' || r.category === selectedCategory
                          return matchesSearch && matchesCategory
                        })
                        .map((rule) => (
                          <RuleCard
                            key={rule.path}
                            rule={rule}
                            onEdit={() => handleEdit(rule)}
                            onDelete={() => handleDelete(rule)}
                            onCopy={() => handleCopy(rule.content)}
                            onCopyTo={() => { setCopyingRule(rule); setShowCopyModal(true) }}
                          />
                        ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {isFormOpen && (
        <RuleForm
          rule={editingRule}
          scope={createScope}
          onSave={handleSave}
          onClose={() => {
            setIsFormOpen(false)
            setEditingRule(null)
          }}
        />
      )}
      {showCopyModal && copyingRule && (
        <CopyRuleModal
          rule={copyingRule}
          nodes={nodes}
          onClose={() => { setShowCopyModal(false); setCopyingRule(null) }}
          onSuccess={async () => { setShowCopyModal(false); setCopyingRule(null); await loadData() }}
        />
      )}
    </div>
  )
}

function CopyRuleModal({ rule, nodes, onClose, onSuccess }: {
  rule: Rule
  nodes: ProjectNode[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [targetPath, setTargetPath] = useState('')
  const [copying, setCopying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentNodePath = rule.scope === 'global' 
    ? nodes.find(x => x.type === 'global')?.path 
    : rule.projectPath
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

    const result = await window.electronAPI.rulesCopy(
      rule.path,
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
            复制 Rule
          </h2>
          <button onClick={onClose} className="p-1 glass-chip hover:bg-white/60 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">源 Rule</label>
            <div className="px-3 py-2 glass-chip rounded-lg text-sm">
              <div className="font-medium">{rule.name}</div>
              <div className="text-xs text-muted-foreground truncate">{rule.path}</div>
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

interface RuleCardProps {
  rule: Rule
  onEdit: () => void
  onDelete: () => void
  onCopy: () => void
  onCopyTo: () => void
}

function RuleCard({ rule, onEdit, onDelete, onCopy, onCopyTo }: RuleCardProps) {
  const linkedCount = rule.linkedResources?.length || 0
  const category = RULE_CATEGORIES.find((c) => c.value === rule.category)

  return (
    <div className="glass-card border-white/40 rounded-2xl p-4 hover:shadow-xl transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="icon-orb icon-orb--sm icon-orb--blue">
              <ScrollText className="w-4 h-4" />
            </span>
            <h3 className="font-semibold truncate">{rule.name}</h3>
            {category && (
              <span className="text-xs px-2 py-0.5 glass-chip rounded-full">
                {category.label}
              </span>
            )}
            {rule.priority !== undefined && rule.priority > 0 && (
              <span className="text-xs px-2 py-0.5 glass-chip text-orange-700 rounded-full">
                优先级: {rule.priority}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-2">{rule.description}</p>
          
          {/* Preview */}
          <div className="glass-card rounded-lg p-3 text-sm font-mono text-muted-foreground max-h-24 overflow-hidden">
            {rule.content?.slice(0, 200)}
            {(rule.content?.length || 0) > 200 && '...'}
          </div>

          {/* Globs */}
          {rule.globs && rule.globs.length > 0 && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-xs text-muted-foreground">适用文件:</span>
              {rule.globs.map((g) => (
                <span key={g} className="text-xs px-2 py-0.5 glass-chip rounded font-mono">
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* Linked Resources */}
          {linkedCount > 0 && (
            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
              <Link2 className="w-3 h-3" />
              <span>关联 {linkedCount} 个资源</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 ml-4">
          <button
            onClick={onCopy}
            className="p-2 glass-chip hover:bg-white/60 rounded-lg transition-colors"
            title="复制内容"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={onCopyTo}
            className="p-2 glass-chip hover:bg-white/60 rounded-lg transition-colors"
            title="复制到其他位置"
          >
            <FolderOpen className="w-4 h-4" />
          </button>
          <button
            onClick={onEdit}
            className="p-2 glass-chip hover:bg-white/60 rounded-lg transition-colors"
            title="编辑"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 glass-chip hover:bg-destructive/10 text-destructive rounded-lg transition-colors"
            title="删除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

interface RuleFormProps {
  rule: Rule | null
  scope: 'global' | 'project'
  onSave: (data: {
    name: string
    description: string
    content: string
    category: string
    priority: number
    globs: string[]
    linkedResources: string[]
  }) => void
  onClose: () => void
}

function RuleForm({ rule, scope, onSave, onClose }: RuleFormProps) {
  const [name, setName] = useState(rule?.name || '')
  const [description, setDescription] = useState(rule?.description || '')
  const [content, setContent] = useState(rule?.content || '')
  const [category, setCategory] = useState<string>(rule?.category || 'coding-style')
  const [priority, setPriority] = useState<number>(rule?.priority ?? 0)
  const [globsText, setGlobsText] = useState((rule?.globs || []).join(', '))
  const [linkedResources] = useState<string[]>(rule?.linkedResources || [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const globs = globsText.split(',').map((g) => g.trim()).filter(Boolean)
    onSave({
      name,
      description,
      content,
      category,
      priority,
      globs,
      linkedResources
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-auto py-8 px-4">
      <div className="glass-panel rounded-2xl border-white/40 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <div className="p-6 border-b border-white/40 flex items-center justify-between">
            <h2 className="text-xl font-semibold font-display">
              {rule ? '编辑 Rule' : `新建${scope === 'global' ? '全局' : '项目'} Rule`}
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-primary/90 text-primary-foreground rounded-lg hover:bg-primary transition-colors"
              >
                保存
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg glass-chip hover:bg-white/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">名称</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 glass-chip rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                required
                disabled={!!rule}
              />
              {rule && (
                <p className="text-xs text-muted-foreground mt-1">编辑时不可修改名称（文件夹名）</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">描述</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 glass-chip rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">分类</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 glass-chip rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {RULE_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">优先级</label>
                <input
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 glass-chip rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  min={0}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                适用文件 <span className="text-muted-foreground font-normal">(逗号分隔 glob 模式)</span>
              </label>
              <input
                type="text"
                value={globsText}
                onChange={(e) => setGlobsText(e.target.value)}
                className="w-full px-3 py-2 glass-chip rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="*.ts, src/**/*.tsx"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">规则内容 (Markdown)</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={12}
                className="w-full px-3 py-2 glass-chip rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="输入规则内容..."
                required
              />
            </div>
          </div>

        </form>
      </div>
    </div>
  )
}
