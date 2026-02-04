import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Zap,
  RefreshCw,
  Plus,
  Trash2,
  FolderOpen,
  Globe,
  Folder,
  X,
  Save,
  FileText,
  Eye,
  Edit3,
  Sparkles,
  Download,
  FolderInput,
  ChevronRight,
  ChevronDown,
  File,
  Copy
} from 'lucide-react'
import { useFactoryStore } from '../stores/factoryStore'

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

interface ProjectNode {
  path: string
  name: string
  type: 'global' | 'project'
  skills: Skill[]
  expanded: boolean
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

export function SkillsManagerPage() {
  const {
    skillNodes,
    skillsLoaded,
    setSkillsData
  } = useFactoryStore()

  const [nodes, setNodes] = useState<ProjectNode[]>(skillNodes)
  const [loading, setLoading] = useState(!skillsLoaded)
  const [scanning, setScanning] = useState(false)
  const [hydrated, setHydrated] = useState(useFactoryStore.persist.hasHydrated())
  const [selectedNode, setSelectedNode] = useState<ProjectNode | null>(null)
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showCopyModal, setShowCopyModal] = useState(false)
  const [copyingSkill, setCopyingSkill] = useState<Skill | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generatingAi, setGeneratingAi] = useState(false)
  const [draggingSkill, setDraggingSkill] = useState<Skill | null>(null)

  // 等待 store hydration
  useEffect(() => {
    const unsubscribe = useFactoryStore.persist.onFinishHydration(() => {
      setHydrated(true)
      console.log('[Skills] store hydrated')
    })
    if (useFactoryStore.persist.hasHydrated()) {
      setHydrated(true)
    }
    return () => {
      unsubscribe?.()
    }
  }, [])

  // 从 store 初始化
  useEffect(() => {
    if (skillsLoaded && skillNodes.length > 0) {
      console.log('[Skills] load from store', { nodes: skillNodes.length })
      setNodes(skillNodes)
      setSelectedNode(skillNodes[0])
      setLoading(false)
    }
  }, [skillsLoaded, skillNodes])

  const scanData = useCallback(async (source: 'init' | 'manual') => {
    setScanning(true)

    const scanStart = performance.now()
    console.log('[Skills] scan start', { source })

    const timed = async <T,>(label: string, task: () => Promise<T>) => {
      const start = performance.now()
      const result = await task()
      console.log(`[Skills] ${label} ${(performance.now() - start).toFixed(1)}ms`)
      return result
    }

    // 并行加载基础数据
    const [globalSkills, gPath, discoveredPaths] = await Promise.all([
      timed('skillsGetGlobal', () => window.electronAPI.skillsGetGlobal()),
      timed('skillsGetGlobalPath', () => window.electronAPI.skillsGetGlobalPath()),
      timed('skillsDiscoverWork', () => window.electronAPI.skillsDiscoverWork())
    ])

    const newNodes: ProjectNode[] = [{
      path: gPath,
      name: '全局 Skills',
      type: 'global',
      skills: globalSkills,
      expanded: true
    }]

    const saved = localStorage.getItem('skillsProjectTabs')
    const savedPaths = saved ? (JSON.parse(saved) as string[]) : []
    const mergedPaths = Array.from(new Set([...savedPaths, ...discoveredPaths]))
    console.log('[Skills] projects', { count: mergedPaths.length })

    // 并行加载所有项目
    const projectResults = await Promise.all(
      mergedPaths.map(async (p) => {
        const skills = await timed(`skillsGetProject:${p}`, () => window.electronAPI.skillsGetProject(p))
        return {
          path: p,
          name: p.split(/[/\\]/).pop() || p,
          type: 'project' as const,
          skills,
          expanded: true
        }
      })
    )

    newNodes.push(...projectResults)

    // 保存到 store
    setSkillsData(newNodes)

    setNodes(newNodes)
    if (newNodes.length > 0 && !selectedNode) {
      setSelectedNode(newNodes[0])
    }
    console.log('[Skills] scan done', { durationMs: (performance.now() - scanStart).toFixed(1) })
    setScanning(false)
    setLoading(false)
  }, [selectedNode, setSkillsData])

  // 首次加载：如果 store 没数据才扫描
  useEffect(() => {
    if (!hydrated) return
    if (!skillsLoaded) {
      setLoading(false)
      return
    }
    setLoading(false)
  }, [hydrated, skillsLoaded, scanData])

  const saveProjectPaths = (projectNodes: ProjectNode[]) => {
    const paths = projectNodes.filter(n => n.type === 'project').map(n => n.path)
    localStorage.setItem('skillsProjectTabs', JSON.stringify(paths))
  }

  const handleRefresh = async () => {
    await scanData('manual')
  }

  const handleAddProject = async () => {
    const path = await window.electronAPI.skillsSelectProject()
    if (path && !nodes.find(n => n.path === path)) {
      const skills = await window.electronAPI.skillsGetProject(path)
      const newNode: ProjectNode = {
        path,
        name: path.split(/[/\\]/).pop() || path,
        type: 'project',
        skills,
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
      setSelectedSkill(null)
    }
  }

  const handleDropSkill = async (targetNode: ProjectNode) => {
    if (!draggingSkill) return
    const currentNodePath = draggingSkill.scope === 'global'
      ? nodes.find(x => x.type === 'global')?.path
      : draggingSkill.projectPath
    if (!currentNodePath || currentNodePath === targetNode.path) {
      return
    }

    const result = await window.electronAPI.skillsMove(
      draggingSkill.path,
      targetNode.type,
      targetNode.type === 'project' ? targetNode.path : undefined
    )

    if (!result.success) {
      setError(result.error || '移动失败')
      return
    }

    await handleRefresh()
  }

  const toggleExpand = (node: ProjectNode) => {
    setNodes(nodes.map(n => n.path === node.path ? { ...n, expanded: !n.expanded } : n))
  }

  const handleSelectSkill = async (skill: Skill, node: ProjectNode) => {
    setSelectedNode(node)
    setSelectedSkill(skill)
    setEditContent(skill.content)
    setEditMode(false)
    // AI 解读改为手动触发，不再自动生成
  }

  // 手动刷新 AI 解读
  const handleRefreshAiSummary = async () => {
    if (!selectedSkill) return
    setGeneratingAi(true)
    try {
      const result = await window.electronAPI.skillsGenerateAiSummary(selectedSkill.path, selectedSkill.content)
      if (result.success && result.summary) {
        setSelectedSkill({ ...selectedSkill, aiSummary: result.summary })
        setNodes(prev => prev.map(n => ({
          ...n,
          skills: n.skills.map(s => s.path === selectedSkill.path ? { ...s, aiSummary: result.summary } : s)
        })))
      } else {
        setError(result.error || '生成失败')
      }
    } catch (e) {
      setError(`生成 AI 解读失败: ${(e as Error).message}`)
    } finally {
      setGeneratingAi(false)
    }
  }

  const handleSave = async () => {
    if (!selectedSkill) return
    const result = await window.electronAPI.skillsUpdate(selectedSkill.path, editContent)
    if (result.success) {
      setSelectedSkill({ ...selectedSkill, content: editContent })
      setEditMode(false)
      await handleRefresh()
    } else {
      setError(result.error || '保存失败')
    }
  }

  const handleDelete = async (skill: Skill) => {
    if (!confirm(`确定要删除 "${skill.name}" 吗？`)) return
    const result = await window.electronAPI.skillsDelete(skill.path)
    if (result.success) {
      if (selectedSkill?.path === skill.path) setSelectedSkill(null)
      await handleRefresh()
    } else {
      setError(result.error || '删除失败')
    }
  }

  const handleImport = async (type: 'folder' | 'directory' | 'zip') => {
    if (!selectedNode) return
    const scope = selectedNode.type
    const projectPath = scope === 'project' ? selectedNode.path : undefined

    if (type === 'folder') {
      const result = await window.electronAPI.skillsImportFolder(scope, projectPath)
      if (!result.canceled && result.success) await handleRefresh()
      else if (result.error) setError(result.error)
    } else if (type === 'directory') {
      const result = await window.electronAPI.skillsImportDirectory(scope, projectPath)
      if (!result.canceled) {
        await handleRefresh()
        if (result.failed > 0) {
          setError(`导入完成：成功 ${result.success} 个，失败 ${result.failed} 个`)
        }
      }
    } else if (type === 'zip') {
      const result = await window.electronAPI.skillsImportZip(scope, projectPath)
      if (!result.canceled) {
        await handleRefresh()
        if (result.error) setError(result.error)
        else if (result.failed > 0) {
          setError(`导入完成：成功 ${result.success} 个，失败 ${result.failed} 个`)
        }
      }
    }
  }

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
            <span className="icon-orb icon-orb--sm icon-orb--pink">
              <Zap className="w-5 h-5" />
            </span>
            Skills 管理器
          </h1>
        </div>
        <div className="flex gap-2">
          <button onClick={handleRefresh} className="px-3 py-2 text-sm glass-chip hover:bg-white/70 rounded-lg flex items-center gap-2" title="刷新">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={handleRefresh} className="px-3 py-2 text-sm glass-chip hover:bg-white/70 rounded-lg flex items-center gap-2" title="扫描">
            扫描
          </button>
          <button onClick={() => handleImport('zip')} className="px-3 py-2 text-sm glass-chip hover:bg-white/70 rounded-lg flex items-center gap-2" title="导入 ZIP 压缩包">
            <Download className="w-4 h-4" />
            导入 ZIP
          </button>
          <button onClick={() => handleImport('folder')} className="px-3 py-2 text-sm glass-chip hover:bg-white/70 rounded-lg flex items-center gap-2" title="导入文件夹">
            <FolderInput className="w-4 h-4" />
            导入文件夹
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

      {scanning && (
        <div className="mb-4 px-3 py-2 glass-chip rounded-lg flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-primary/80 animate-pulse" />
          <span className="text-sm text-muted-foreground">正在扫描资源，请稍候...</span>
          <div className="flex-1 h-1.5 rounded-full bg-white/40 overflow-hidden">
            <div className="scan-progress h-full w-1/2 bg-primary/70" />
          </div>
        </div>
      )}

      {/* 主内容 */}
      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* 左侧：项目导航树 */}
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
                  void handleDropSkill(node)
                }}
              >
                <div
                  className={cn(
                    "flex items-center gap-1 px-2 py-1.5 cursor-pointer hover:bg-white/50 group",
                    selectedNode?.path === node.path && !selectedSkill && "bg-white/70"
                  )}
                  onClick={() => { setSelectedNode(node); setSelectedSkill(null) }}
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
                  <span className="text-xs text-muted-foreground">{node.skills.length}</span>
                  {node.type === 'project' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemoveProject(node) }}
                      className="p-0.5 opacity-0 group-hover:opacity-100 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {node.expanded && node.skills.map(skill => (
                  <div
                    key={skill.path}
                    onClick={() => handleSelectSkill(skill, node)}
                    className={cn(
                      "flex items-center gap-2 pl-8 pr-2 py-1.5 cursor-pointer hover:bg-white/50 group",
                      selectedSkill?.path === skill.path && "bg-white/70"
                    )}
                    draggable
                    onDragStart={() => setDraggingSkill(skill)}
                    onDragEnd={() => setDraggingSkill(null)}
                  >
                    <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="flex-1 text-sm truncate">{skill.name}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setCopyingSkill(skill); setShowCopyModal(true) }}
                      className="p-0.5 opacity-0 group-hover:opacity-100 hover:text-primary"
                      title="复制到其他位置"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(skill) }}
                      className="p-0.5 opacity-0 group-hover:opacity-100 hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {node.expanded && node.skills.length === 0 && (
                  <div className="pl-8 pr-2 py-1.5 text-xs text-muted-foreground">暂无 Skills</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 右侧：详情/编辑 */}
        <div className="flex-1 glass-card rounded-2xl overflow-hidden flex flex-col">
          {selectedSkill ? (
            <>
              <div className="px-4 py-3 glass-chip border-b border-white/40 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{selectedSkill.name}</h3>
                  <p className="text-xs text-muted-foreground truncate">{selectedSkill.description || '无描述'}</p>
                </div>
                <div className="flex gap-1 ml-2">
                  {editMode ? (
                    <>
                      <button onClick={handleSave} className="p-2 glass-chip hover:bg-green-500/10 rounded-lg text-green-600" title="保存">
                        <Save className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setEditContent(selectedSkill.content); setEditMode(false) }} className="p-2 glass-chip hover:bg-white/60 rounded-lg" title="取消">
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        onClick={handleRefreshAiSummary}
                        disabled={generatingAi}
                        className="p-2 glass-chip hover:bg-blue-500/10 rounded-lg text-blue-600 disabled:opacity-50"
                        title="重新生成 AI 解读"
                      >
                        {generatingAi ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      </button>
                      <button onClick={() => setEditMode(true)} className="p-2 glass-chip hover:bg-white/60 rounded-lg" title="编辑原文">
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                {editMode ? (
                  <div className="h-full flex">
                    <div className="flex-1 flex flex-col border-r border-white/40">
                      <div className="px-3 py-2 glass-chip border-b border-white/40 text-xs font-medium">编辑原文</div>
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="flex-1 p-3 font-mono text-sm bg-transparent resize-none focus:outline-none"
                        spellCheck={false}
                      />
                    </div>
                    <div className="flex-1 flex flex-col">
                      <div className="px-3 py-2 glass-chip border-b border-white/40 text-xs font-medium flex items-center gap-1">
                        <Eye className="w-3 h-3" />预览
                      </div>
                      <div className="flex-1 p-3 overflow-auto">
                        <MarkdownPreview content={editContent} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full p-6 overflow-auto">
                    {generatingAi ? (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <RefreshCw className="w-8 h-8 animate-spin mb-3" />
                        <span>AI 正在分析 Skill 内容...</span>
                      </div>
                    ) : selectedSkill.aiSummary ? (
                      <AiSummaryView content={selectedSkill.aiSummary} />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <Sparkles className="w-12 h-12 mb-3 opacity-30" />
                        <p className="text-lg mb-2">暂无 AI 解读</p>
                        <p className="text-sm mb-4">点击下方按钮让 AI 分析这个 Skill</p>
                        <button 
                          onClick={handleRefreshAiSummary}
                          className="px-4 py-2 bg-primary/90 text-primary-foreground rounded-lg hover:bg-primary flex items-center gap-2"
                        >
                          <Sparkles className="w-4 h-4" />
                          生成 AI 解读
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {selectedSkill.files.length > 0 && (
                <div className="px-4 py-2 border-t border-white/40">
                  <p className="text-xs text-muted-foreground mb-1">附属文件</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedSkill.files.map(f => (
                      <span key={f} className="text-xs px-2 py-0.5 glass-chip rounded flex items-center gap-1">
                        <File className="w-3 h-3" />{f}
                      </span>
                    ))}
                  </div>
                </div>
              )}
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
                  <p className="text-sm text-muted-foreground">{selectedNode.skills.length} 个 Skills</p>
                </div>
              </div>
              <div className="text-xs text-muted-foreground mb-4">
                <FolderOpen className="w-3 h-3 inline mr-1" />
                {selectedNode.path}
              </div>
              {selectedNode.skills.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {selectedNode.skills.map(skill => (
                    <div
                      key={skill.path}
                      onClick={() => handleSelectSkill(skill, selectedNode)}
                      className="p-3 glass-card rounded-lg cursor-pointer hover:bg-white/60 transition-colors"
                      draggable
                      onDragStart={() => setDraggingSkill(skill)}
                      onDragEnd={() => setDraggingSkill(null)}
                    >
                      <p className="font-medium text-sm truncate">{skill.name}</p>
                      <p className="text-xs text-muted-foreground truncate mt-1">{skill.description || '无描述'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Zap className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>暂无 Skills</p>
                  <p className="text-sm mt-1">点击上方按钮导入或创建</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Zap className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>选择一个项目或 Skill</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && selectedNode && (
        <CreateSkillModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={async () => { setShowCreateModal(false); await handleRefresh() }}
          nodes={nodes}
          defaultNode={selectedNode}
        />
      )}
      {showCopyModal && copyingSkill && (
        <CopySkillModal
          skill={copyingSkill}
          nodes={nodes}
          onClose={() => { setShowCopyModal(false); setCopyingSkill(null) }}
          onSuccess={async () => { setShowCopyModal(false); setCopyingSkill(null); await handleRefresh() }}
        />
      )}
    </div>
  )
}

// AI 解读专用渲染组件 - 结构化展示
function AiSummaryView({ content }: { content: string }) {
  const sections: { title: string; items: string[] }[] = []
  let currentSection: { title: string; items: string[] } | null = null
  
  content.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (trimmed.startsWith('## ')) {
      if (currentSection) sections.push(currentSection)
      currentSection = { title: trimmed.slice(3), items: [] }
    } else if (currentSection && trimmed) {
      currentSection.items.push(trimmed)
    }
  })
  if (currentSection) sections.push(currentSection)

  const getSectionIcon = (title: string) => {
    if (title.includes('概述') || title.includes('简介')) return '📋'
    if (title.includes('功能')) return '⚡'
    if (title.includes('场景') || title.includes('用途')) return '🎯'
    if (title.includes('方法') || title.includes('步骤') || title.includes('使用')) return '📝'
    if (title.includes('注意') || title.includes('警告')) return '⚠️'
    return '📌'
  }

  const getSectionColor = (title: string) => {
    if (title.includes('概述') || title.includes('简介')) return 'glass-card border-blue-200/60 bg-blue-500/10'
    if (title.includes('功能')) return 'glass-card border-purple-200/60 bg-purple-500/10'
    if (title.includes('场景') || title.includes('用途')) return 'glass-card border-green-200/60 bg-green-500/10'
    if (title.includes('方法') || title.includes('步骤') || title.includes('使用')) return 'glass-card border-orange-200/60 bg-orange-500/10'
    if (title.includes('注意') || title.includes('警告')) return 'glass-card border-yellow-200/60 bg-yellow-500/10'
    return 'glass-card border-white/50'
  }

  // 渲染内联 Markdown（粗体、斜体、代码）
  const renderInline = (text: string) => {
    const parts: React.ReactNode[] = []
    let remaining = text
    let key = 0
    
    while (remaining) {
      // 粗体 **text**
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/)
      // 斜体 *text*
      const italicMatch = remaining.match(/(?<!\*)\*([^*]+)\*(?!\*)/)
      // 行内代码 `code`
      const codeMatch = remaining.match(/`([^`]+)`/)
      
      const matches = [
        boldMatch && { type: 'bold', match: boldMatch },
        italicMatch && { type: 'italic', match: italicMatch },
        codeMatch && { type: 'code', match: codeMatch }
      ].filter(Boolean).sort((a, b) => (a!.match.index || 0) - (b!.match.index || 0))
      
      if (matches.length === 0) {
        parts.push(remaining)
        break
      }
      
      const first = matches[0]!
      const idx = first.match.index || 0
      
      if (idx > 0) {
        parts.push(remaining.slice(0, idx))
      }
      
      if (first.type === 'bold') {
        parts.push(<strong key={key++} className="font-semibold">{first.match[1]}</strong>)
      } else if (first.type === 'italic') {
        parts.push(<em key={key++}>{first.match[1]}</em>)
      } else if (first.type === 'code') {
        parts.push(<code key={key++} className="px-1 py-0.5 glass-chip rounded text-xs font-mono">{first.match[1]}</code>)
      }
      
      remaining = remaining.slice(idx + first.match[0].length)
    }
    
    return parts.length > 0 ? parts : text
  }

  // 渲染单个项目
  const renderItem = (item: string, i: number) => {
    // 处理列表项 - **xxx**
    if (item.startsWith('- **') && item.includes('**')) {
      const match = item.match(/^- \*\*(.+?)\*\*[：:]\s*(.*)$/)
      if (match) {
        return (
          <div key={i} className="flex items-start gap-2 text-sm">
            <span className="text-muted-foreground mt-1">•</span>
            <span><strong className="font-semibold">{match[1]}</strong>：{renderInline(match[2])}</span>
          </div>
        )
      }
    }
    
    // 普通列表项
    if (item.startsWith('- ')) {
      return (
        <div key={i} className="flex items-start gap-2 text-sm">
          <span className="text-muted-foreground mt-1">•</span>
          <span>{renderInline(item.slice(2))}</span>
        </div>
      )
    }
    
    // 数字列表
    if (item.match(/^\d+\.\s/)) {
      const num = item.match(/^(\d+)\./)?.[1]
      return (
        <div key={i} className="flex items-start gap-2 text-sm">
          <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
            {num}
          </span>
          <span>{renderInline(item.slice(item.indexOf('.') + 2))}</span>
        </div>
      )
    }
    
    // 普通段落
    return <p key={i} className="text-sm leading-relaxed">{renderInline(item)}</p>
  }

  return (
    <div className="space-y-4 max-w-3xl">
      {sections.map((section, idx) => (
        <div key={idx} className={`rounded-lg border p-4 ${getSectionColor(section.title)}`}>
          <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
            <span>{getSectionIcon(section.title)}</span>
            {renderInline(section.title)}
          </h3>
          <div className="space-y-2">
            {section.items.map((item, i) => renderItem(item, i))}
          </div>
        </div>
      ))}
      {sections.length === 0 && (
        <div className="text-muted-foreground text-sm whitespace-pre-wrap">{renderInline(content)}</div>
      )}
    </div>
  )
}

function MarkdownPreview({ content }: { content: string }) {
  const parsed = useMemo(() => {
    const lines = content.split('\n')
    const result: { type: string; text?: string; keyText?: string; valueText?: string }[] = []
    let inFrontmatter = false
    let frontmatterDone = false

    for (const line of lines) {
      if (line === '---' && !frontmatterDone) {
        if (!inFrontmatter) {
          inFrontmatter = true
          result.push({ type: 'frontmatter-start' })
        } else {
          inFrontmatter = false
          frontmatterDone = true
          result.push({ type: 'frontmatter-end' })
        }
        continue
      }
      if (inFrontmatter) {
        const [key, ...rest] = line.split(':')
        result.push({ type: 'frontmatter', keyText: key, valueText: rest.join(':') })
        continue
      }
      if (line.startsWith('# ')) { result.push({ type: 'h1', text: line.slice(2) }); continue }
      if (line.startsWith('## ')) { result.push({ type: 'h2', text: line.slice(3) }); continue }
      if (line.startsWith('### ')) { result.push({ type: 'h3', text: line.slice(4) }); continue }
      if (line.startsWith('- ')) { result.push({ type: 'li', text: line.slice(2) }); continue }
      if (line.startsWith('```')) { result.push({ type: 'code', text: line }); continue }
      if (line.trim() === '') { result.push({ type: 'blank' }); continue }
      result.push({ type: 'text', text: line })
    }

    return result
  }, [content])

  return (
    <div className="prose prose-sm max-w-none dark:prose-invert">
      {parsed.map((item, i) => {
        switch (item.type) {
          case 'frontmatter-start':
            return <div key={i} className="text-xs text-muted-foreground border-b pb-1 mb-2">--- frontmatter ---</div>
          case 'frontmatter-end':
            return <div key={i} className="text-xs text-muted-foreground border-b pb-1 mb-2">---</div>
          case 'frontmatter':
            return (
              <div key={i} className="text-xs font-mono">
                <span className="text-blue-600">{item.keyText}</span>
                {item.valueText && <span>: {item.valueText}</span>}
              </div>
            )
          case 'h1':
            return <h1 key={i} className="text-xl font-bold mt-4 mb-2">{item.text}</h1>
          case 'h2':
            return <h2 key={i} className="text-lg font-semibold mt-3 mb-2">{item.text}</h2>
          case 'h3':
            return <h3 key={i} className="text-base font-medium mt-2 mb-1">{item.text}</h3>
          case 'li':
            return <li key={i} className="ml-4">{item.text}</li>
          case 'code':
            return <div key={i} className="text-xs text-muted-foreground font-mono glass-chip px-2 py-0.5 rounded">{item.text}</div>
          case 'blank':
            return <div key={i} className="h-2" />
          default:
            return <p key={i} className="text-sm">{item.text}</p>
        }
      })}
    </div>
  )
}

function CopySkillModal({ skill, nodes, onClose, onSuccess }: {
  skill: Skill
  nodes: ProjectNode[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [targetPath, setTargetPath] = useState('')
  const [copying, setCopying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 过滤掉当前 Skill 所在的节点
  const availableTargets = nodes.filter(n => n.path !== (skill.scope === 'global' ? nodes.find(x => x.type === 'global')?.path : skill.projectPath))

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

    const result = await window.electronAPI.skillsCopy(
      skill.path,
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
            复制 Skill
          </h2>
          <button onClick={onClose} className="p-1 glass-chip hover:bg-white/60 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">源 Skill</label>
            <div className="px-3 py-2 glass-chip rounded-lg text-sm">
              <div className="font-medium">{skill.name}</div>
              <div className="text-xs text-muted-foreground truncate">{skill.path}</div>
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

function CreateSkillModal({ onClose, onSuccess, nodes, defaultNode }: {
  onClose: () => void; onSuccess: () => void; nodes: ProjectNode[]; defaultNode: ProjectNode
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedPath, setSelectedPath] = useState(defaultNode.path)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  const selectedNode = nodes.find(n => n.path === selectedPath)

  const generateContent = () => {
    setContent(`---
name: ${name || 'my-skill'}
description: ${description || '描述这个 Skill 的用途'}
---

# ${name || 'My Skill'}

## 说明

${description || '在这里描述 Skill 的功能和使用场景。'}

## 指令

1. 第一步操作
2. 第二步操作
3. 第三步操作

## 验证

- 检查点 1
- 检查点 2
`)
  }

  const handleAIGenerate = async () => {
    if (!description) { setError('请先填写描述'); return }
    setGenerating(true)
    try {
      const prompt = `请为以下需求生成一个 SKILL.md 文件内容，使用 YAML frontmatter 格式：
需求描述：${description}
Skill 名称：${name || '根据描述自动命名'}
要求：包含 name 和 description 的 frontmatter，包含清晰的说明、指令步骤和验证检查点，使用中文`
      const result = await window.electronAPI.aiTranslate(prompt)
      if (result && result !== prompt) setContent(result)
      else generateContent()
    } catch { generateContent() }
    finally { setGenerating(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('请输入名称'); return }
    if (!content.trim()) { setError('请输入内容'); return }
    if (!selectedNode) { setError('请选择存储位置'); return }

    setSubmitting(true)
    setError(null)
    const scope = selectedNode.type
    const projectPath = scope === 'project' ? selectedNode.path : undefined
    const result = await window.electronAPI.skillsCreate(name, content, scope, projectPath)
    if (result.success) onSuccess()
    else setError(result.error || '创建失败')
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-auto py-8 px-4">
      <div className="glass-panel rounded-2xl border-white/40 w-full max-w-4xl max-h-[90vh] m-4 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/40">
          <h2 className="text-lg font-semibold font-display">创建 Skill</h2>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              form="skill-create-form"
              disabled={submitting}
              className="px-4 py-2 text-sm bg-primary/90 text-primary-foreground hover:bg-primary rounded-lg disabled:opacity-50"
            >
              {submitting ? '保存中...' : '保存'}
            </button>
            <button onClick={onClose} className="p-2 rounded-lg glass-chip hover:bg-white/60"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <form id="skill-create-form" onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          {error && (
            <div className="mx-6 mt-4 p-3 glass-card border border-destructive/20 rounded-lg text-destructive text-sm">{error}</div>
          )}

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">名称 *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="my-skill"
                  className="w-full px-3 py-2 text-sm glass-chip rounded-lg focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">存储位置</label>
                <select value={selectedPath} onChange={(e) => setSelectedPath(e.target.value)}
                  className="w-full px-3 py-2 text-sm glass-chip rounded-lg focus:outline-none focus:ring-2 focus:ring-ring">
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
                placeholder="描述这个 Skill 的用途和使用场景"
                className="w-full px-3 py-2 text-sm glass-chip rounded-lg focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={generateContent} className="px-3 py-1.5 text-sm glass-chip hover:bg-white/70 rounded-lg flex items-center gap-1">
                <FileText className="w-4 h-4" />生成模板
              </button>
              <button type="button" onClick={handleAIGenerate} disabled={generating} className="px-3 py-1.5 text-sm glass-chip hover:bg-white/70 rounded-lg flex items-center gap-1">
                {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                AI 生成
              </button>
            </div>
          </div>

          <div className="flex-1 px-6 pb-4 overflow-hidden flex gap-4 min-h-0">
            <div className="flex-1 flex flex-col border border-white/40 rounded-lg overflow-hidden">
              <div className="px-3 py-2 glass-chip border-b border-white/40 text-xs font-medium">SKILL.md 内容</div>
              <textarea value={content} onChange={(e) => setContent(e.target.value)}
                placeholder="---&#10;name: my-skill&#10;description: 描述&#10;---&#10;&#10;# My Skill&#10;..."
                className="flex-1 p-3 font-mono text-sm bg-transparent resize-none focus:outline-none" spellCheck={false} />
            </div>
            <div className="flex-1 flex flex-col border border-white/40 rounded-lg overflow-hidden">
              <div className="px-3 py-2 glass-chip border-b border-white/40 text-xs font-medium flex items-center gap-1">
                <Eye className="w-3 h-3" />预览
              </div>
              <div className="flex-1 p-3 overflow-auto">
                <MarkdownPreview content={content} />
              </div>
            </div>
          </div>

        </form>
      </div>
    </div>
  )
}
