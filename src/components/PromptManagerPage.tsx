import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, MessageSquare, Edit2, Trash2, Link2, Copy, RefreshCw, FolderOpen, X } from 'lucide-react'
import { PROMPT_CATEGORIES } from '../types'

interface Prompt {
  name: string
  description: string
  content: string
  path: string
  category?: string
  variables?: string[]
  linkedResources?: string[]
}

export function PromptManagerPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [promptsPath, setPromptsPath] = useState('')
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [allPrompts, path] = await Promise.all([
        window.electronAPI.promptsGetAll(),
        window.electronAPI.promptsGetPath()
      ])
      setPrompts(allPrompts)
      setPromptsPath(path)
    } catch (e) {
      setError('加载 Prompts 失败: ' + (e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredPrompts = prompts.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const handleAdd = () => {
    setEditingPrompt(null)
    setIsFormOpen(true)
  }

  const handleEdit = (prompt: Prompt) => {
    setEditingPrompt(prompt)
    setIsFormOpen(true)
  }

  const handleDelete = async (prompt: Prompt) => {
    if (confirm(`确定要删除 "${prompt.name}" 吗？`)) {
      const result = await window.electronAPI.promptsDelete(prompt.path)
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
    linkedResources: string[]
  }) => {
    let result
    if (editingPrompt) {
      result = await window.electronAPI.promptsUpdate(
        editingPrompt.path,
        data.content,
        data.description,
        data.category,
        data.linkedResources
      )
    } else {
      result = await window.electronAPI.promptsCreate(
        data.name,
        data.content,
        data.description,
        data.category,
        data.linkedResources
      )
    }

    if (result.success) {
      setIsFormOpen(false)
      setEditingPrompt(null)
      loadData()
    } else {
      setError('保存失败: ' + result.error)
    }
  }

  const handleOpenFolder = async () => {
    if (promptsPath) {
      await window.electronAPI.openExternal('file://' + promptsPath)
    }
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
            <h1 className="text-2xl font-bold font-display">Prompts 管理</h1>
            <p className="text-muted-foreground text-sm mt-1">
              管理可复用的提示词模板
              {promptsPath && (
                <button
                  onClick={handleOpenFolder}
                  className="ml-2 inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <FolderOpen className="w-3 h-3" />
                  {promptsPath}
                </button>
              )}
            </p>
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
              onClick={handleAdd}
              className="flex items-center gap-2 px-4 py-2 bg-primary/90 text-primary-foreground rounded-lg hover:bg-primary transition-colors"
            >
              <Plus className="w-4 h-4" />
              新建 Prompt
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
              placeholder="搜索 Prompt..."
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
            {PROMPT_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto p-6">
        {filteredPrompts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
            <p>暂无 Prompt</p>
            <button
              onClick={handleAdd}
              className="mt-4 text-primary hover:underline"
            >
              创建第一个 Prompt
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredPrompts.map((prompt) => (
              <PromptCard
                key={prompt.path}
                prompt={prompt}
                onEdit={() => handleEdit(prompt)}
                onDelete={() => handleDelete(prompt)}
                onCopy={() => handleCopy(prompt.content)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {isFormOpen && (
        <PromptForm
          prompt={editingPrompt}
          onSave={handleSave}
          onClose={() => {
            setIsFormOpen(false)
            setEditingPrompt(null)
          }}
        />
      )}
    </div>
  )
}

interface PromptCardProps {
  prompt: Prompt
  onEdit: () => void
  onDelete: () => void
  onCopy: () => void
}

function PromptCard({ prompt, onEdit, onDelete, onCopy }: PromptCardProps) {
  const linkedCount = prompt.linkedResources?.length || 0
  const category = PROMPT_CATEGORIES.find((c) => c.value === prompt.category)

  return (
    <div className="glass-card border-white/40 rounded-2xl p-4 hover:shadow-xl transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="icon-orb icon-orb--sm icon-orb--orange">
              <MessageSquare className="w-4 h-4" />
            </span>
            <h3 className="font-semibold truncate">{prompt.name}</h3>
            {category && (
              <span className="text-xs px-2 py-0.5 glass-chip rounded-full">
                {category.label}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-2">{prompt.description}</p>
          
          {/* Preview */}
          <div className="glass-card rounded-lg p-3 text-sm font-mono text-muted-foreground max-h-24 overflow-hidden">
            {prompt.content?.slice(0, 200)}
            {(prompt.content?.length || 0) > 200 && '...'}
          </div>

          {/* Variables */}
          {prompt.variables && prompt.variables.length > 0 && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-xs text-muted-foreground">变量:</span>
              {prompt.variables.map((v) => (
                <span key={v} className="text-xs px-2 py-0.5 glass-chip text-primary rounded">
                  {`{{${v}}}`}
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

interface PromptFormProps {
  prompt: Prompt | null
  onSave: (data: {
    name: string
    description: string
    content: string
    category: string
    linkedResources: string[]
  }) => void
  onClose: () => void
}

function PromptForm({ prompt, onSave, onClose }: PromptFormProps) {
  const [name, setName] = useState(prompt?.name || '')
  const [description, setDescription] = useState(prompt?.description || '')
  const [content, setContent] = useState(prompt?.content || '')
  const [category, setCategory] = useState<string>(prompt?.category || 'template')
  const [linkedResources] = useState<string[]>(prompt?.linkedResources || [])

  const extractVariables = (text: string): string[] => {
    const matches = text.match(/\{\{(\w+)\}\}/g) || []
    return [...new Set(matches.map((m) => m.slice(2, -2)))]
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      name,
      description,
      content,
      category,
      linkedResources
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-auto py-8 px-4">
      <div className="glass-panel rounded-2xl border-white/40 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <div className="p-6 border-b border-white/40 flex items-center justify-between">
            <h2 className="text-xl font-semibold font-display">
              {prompt ? '编辑 Prompt' : '新建 Prompt'}
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
                disabled={!!prompt}
              />
              {prompt && (
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

            <div>
              <label className="block text-sm font-medium mb-1">分类</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 glass-chip rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {PROMPT_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                内容 <span className="text-muted-foreground font-normal">(支持 {'{{variable}}'} 变量)</span>
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={12}
                className="w-full px-3 py-2 glass-chip rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="输入 Prompt 内容..."
                required
              />
              {extractVariables(content).length > 0 && (
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">检测到变量:</span>
                  {extractVariables(content).map((v) => (
                    <span key={v} className="text-xs px-2 py-0.5 glass-chip text-primary rounded">
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

        </form>
      </div>
    </div>
  )
}
