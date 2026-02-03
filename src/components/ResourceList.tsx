import { Search, Plus, Trash2, Edit2, Server, Sparkles, Bot } from 'lucide-react'
import { useStore } from '../store'
import type { Resource } from '../types'
import { TYPE_LABELS } from '../types'

interface ResourceListProps {
  onSelect: (resource: Resource) => void
  onEdit: (resource: Resource) => void
  onAdd: () => void
  selectedId?: string
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

export function ResourceList({ onSelect, onEdit, onAdd, selectedId }: ResourceListProps) {
  const { searchQuery, setSearchQuery, getFilteredResources, deleteResource } = useStore()
  const resources = getFilteredResources()

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (confirm('确定要删除这个资源吗？')) {
      deleteResource(id)
    }
  }

  const getTypeIcon = (type: Resource['type']) => {
    switch (type) {
      case 'mcp': return <Server className="w-4 h-4" />
      case 'skill': return <Sparkles className="w-4 h-4" />
      case 'droid': return <Bot className="w-4 h-4" />
    }
  }

  const getTypeColor = (type: Resource['type']) => {
    switch (type) {
      case 'mcp': return 'bg-blue-500/10 text-blue-600 border-blue-200/60'
      case 'skill': return 'bg-green-500/10 text-green-600 border-green-200/60'
      case 'droid': return 'bg-purple-500/10 text-purple-600 border-purple-200/60'
    }
  }

  const getTypeOrb = (type: Resource['type']) => {
    switch (type) {
      case 'mcp': return 'icon-orb--blue'
      case 'skill': return 'icon-orb--green'
      case 'droid': return 'icon-orb--purple'
    }
  }

  return (
    <div className="p-6 h-full flex flex-col">
      {/* 顶部操作栏 */}
      <div className="glass-card rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="搜索资源名称/描述..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm glass-chip rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button 
            onClick={onAdd}
            className="px-4 py-2 text-sm bg-primary/90 text-primary-foreground hover:bg-primary rounded-lg transition-colors flex items-center gap-2 shadow-md"
          >
            <Plus className="w-4 h-4" />
            添加资源
          </button>
        </div>
      </div>

      {/* 表格 */}
      <div className="glass-card rounded-2xl flex-1 overflow-hidden flex flex-col">
        {/* 表头 */}
        <div className="flex items-center px-4 py-3 glass-chip border-b border-white/40 text-sm font-medium text-muted-foreground">
          <div className="flex-1">名称</div>
          <div className="w-28 text-center">类型</div>
          <div className="w-40">更新时间</div>
          <div className="w-24 text-center">操作</div>
        </div>

        {/* 列表 */}
        <div className="flex-1 overflow-auto">
          {resources.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <p>暂无资源</p>
              <p className="text-sm mt-1">点击「添加资源」开始</p>
            </div>
          ) : (
            resources.map((resource) => (
              <div
                key={resource.id}
                onClick={() => onSelect(resource)}
                className={cn(
                  "flex items-center px-4 py-3 cursor-pointer border-b border-white/40 transition-colors hover:bg-white/50",
                  selectedId === resource.id && "bg-white/70 border-l-2 border-l-primary"
                )}
              >
                <div className="flex-1 min-w-0 flex items-center gap-3">
                  <span className={cn("icon-orb icon-orb--sm", getTypeOrb(resource.type), getTypeColor(resource.type))}>
                    {getTypeIcon(resource.type)}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{resource.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{resource.description || '暂无描述'}</p>
                  </div>
                </div>
                <div className="w-28 text-center">
                  <span className={cn(
                    "px-2 py-1 text-xs rounded-full border glass-chip",
                    getTypeColor(resource.type)
                  )}>
                    {TYPE_LABELS[resource.type]}
                  </span>
                </div>
                <div className="w-40 text-sm text-muted-foreground">
                  {new Date(resource.updatedAt).toLocaleString()}
                </div>
                <div className="w-24 flex justify-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onEdit(resource)
                    }}
                    className="p-2 rounded-lg hover:bg-white/60 transition-colors glass-chip"
                    title="编辑"
                  >
                    <Edit2 className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, resource.id)}
                    className="p-2 rounded-lg hover:bg-destructive/10 transition-colors glass-chip"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
