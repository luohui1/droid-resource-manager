import { useState, useEffect, useCallback } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useStore } from '../store'
import {
  Plus, Folder, Trash2, X, Check, FolderOpen, Play, Bot, Crown,
  ChevronLeft, Zap, Workflow, FileText
} from 'lucide-react'
import ReactFlow, { Background, Controls } from 'reactflow'
import 'reactflow/dist/style.css'
import { DroidCreator } from './DroidCreator'
import { ProjectExplorer } from './ProjectExplorer'
import type { Project, Droid, CreateDroidDto } from '../types'

export function ProjectsView() {
  const { projects, setProjects, selectedProjectId, selectProject } = useStore()
  const [showAddModal, setShowAddModal] = useState(false)

  const selectedProject = projects.find(p => p.id === selectedProjectId)

  const handleAdd = async (data: { name: string; path: string; description?: string }) => {
    const project = await window.api.projects.add(data)
    setProjects([...projects, project])
    setShowAddModal(false)
  }

  const handleDelete = async (id: string) => {
    await window.api.projects.delete(id)
    setProjects(projects.filter(p => p.id !== id))
    if (selectedProjectId === id) {
      selectProject(null)
    }
  }

  const handleSelectFolder = async () => {
    return await window.api.projects.selectFolder()
  }

  // 如果选中了项目，显示项目详情
  if (selectedProject) {
    return (
      <ProjectDetailView 
        project={selectedProject} 
        onBack={() => selectProject(null)}
        onDelete={() => handleDelete(selectedProject.id)}
      />
    )
  }

  return (
    <div className="content-panel glass" style={{ padding: 0 }}>
      <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-8)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }} className="stagger-children">
          <div className="flex-between" style={{ marginBottom: 'var(--space-8)' }}>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: 'var(--space-1)' }}>
                项目管理
              </h1>
              <p style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>选择一个项目开始工作</p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4" />
              添加项目
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-4)' }}>
            {projects.map(project => (
              <ProjectCard key={project.id} project={project} onClick={() => selectProject(project.id)} />
            ))}

            {projects.length === 0 && (
              <div className="glass-subtle" style={{ gridColumn: 'span 2', borderRadius: 'var(--radius-xl)', padding: 'var(--space-12)', textAlign: 'center' }}>
                <div className="icon-box icon-box-xl icon-box-purple" style={{ margin: '0 auto var(--space-5)' }}>
                  <FolderOpen style={{ width: 28, height: 28, color: 'var(--prism-purple)' }} />
                </div>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>尚未添加任何项目</p>
                <button className="btn btn-secondary" onClick={() => setShowAddModal(true)}>
                  <Plus className="w-4 h-4" />
                  添加第一个项目
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddModal && (
        <AddProjectModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAdd}
          onSelectFolder={handleSelectFolder}
        />
      )}
    </div>
  )
}

function ProjectDetailView({ project, onBack, onDelete }: { project: Project; onBack: () => void; onDelete: () => void }) {
  const { setProjectDroids, projectDroids, addProjectDroid, tasks, setTasks, setView } = useStore()
  const [showCreator, setShowCreator] = useState(false)
  const [taskPrompt, setTaskPrompt] = useState('')
  const [activeTab, setActiveTab] = useState<'files' | 'scheduler'>('files')
  const [activeLogTaskId, setActiveLogTaskId] = useState<string | null>(null)

  const loadProjectDroids = useCallback(async () => {
    const droids = await window.api.droids.projectList(project.id, project.path)
    setProjectDroids(project.id, droids)
  }, [project.id, project.path, setProjectDroids])

  useEffect(() => {
    loadProjectDroids()
  }, [loadProjectDroids])

  const handleCreateDroid = async (data: CreateDroidDto) => {
    const newDroid = await window.api.droids.create(data)
    addProjectDroid(project.id, newDroid)
    setShowCreator(false)
  }

  const handleStartTask = async () => {
    if (!taskPrompt.trim() || !project.mainDroidId) return
    const created = await window.api.tasks.create({
      name: taskPrompt.trim().slice(0, 40),
      prompt: taskPrompt.trim(),
      projectId: project.id,
      droidId: project.mainDroidId
    })
    setTasks({
      pending: [...tasks.pending, created],
      history: tasks.history
    })
    setTaskPrompt('')
  }

  const mainDroid = projectDroids.find(d => d.role === 'main')
  const subDroids = projectDroids.filter(d => d.role === 'sub')
  const projectTasks = [...tasks.pending, ...tasks.history].filter(t => t.projectId === project.id)
  const runningTask = projectTasks.find(t => t.droidId === mainDroid?.id && t.status === 'running')
  const recentTasks = projectTasks
    .sort((a, b) => (b.startedAt || b.createdAt) - (a.startedAt || a.createdAt))
    .slice(0, 5)

  const effectiveLogTaskId = activeLogTaskId ?? runningTask?.id ?? recentTasks[0]?.id ?? null
  const activeLogTask = projectTasks.find(t => t.id === effectiveLogTaskId) || runningTask || recentTasks[0]

  const droidTaskCounts = projectTasks.reduce((counts, task) => {
    if (!counts[task.droidId]) counts[task.droidId] = { running: 0, total: 0 }
    counts[task.droidId].total += 1
    if (task.status === 'running') counts[task.droidId].running += 1
    return counts
  }, {} as Record<string, { running: number; total: number }>)

  const flowData = (() => {
    const nodes: { id: string; data: { label: ReactNode }; position: { x: number; y: number }; style?: CSSProperties }[] = []
    const edges: { id: string; source: string; target: string }[] = []

    if (mainDroid) {
      const count = droidTaskCounts[mainDroid.id]
      nodes.push({
        id: mainDroid.id,
        data: { label: (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 600 }}>{mainDroid.name}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>主 Droid</div>
            <div style={{ fontSize: '11px', color: 'var(--prism-cyan)' }}>运行中: {count?.running || 0}</div>
          </div>
        ) },
        position: { x: 0, y: 0 },
        style: { padding: 10, borderRadius: 12, border: '1px solid var(--glass-border)', background: 'var(--glass-bg)' }
      })
    }

    subDroids.forEach((droid, index) => {
      const count = droidTaskCounts[droid.id]
      nodes.push({
        id: droid.id,
        data: { label: (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 600 }}>{droid.name}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>子 Droid</div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>总任务: {count?.total || 0}</div>
          </div>
        ) },
        position: { x: 220, y: index * 120 },
        style: { padding: 10, borderRadius: 12, border: '1px solid var(--glass-border)', background: 'var(--glass-bg)' }
      })
      if (mainDroid) {
        edges.push({ id: `${mainDroid.id}-${droid.id}`, source: mainDroid.id, target: droid.id })
      }
    })

    return { nodes, edges }
  })()

  return (
    <div className="content-panel glass" style={{ padding: 0 }}>
      <div className="glass" style={{ padding: 'var(--space-5)', borderBottom: '1px solid var(--glass-border)' }}>
        <div className="flex-between">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <button className="btn btn-ghost" onClick={onBack} style={{ padding: 'var(--space-2)' }}>
              <ChevronLeft className="w-4 h-4" />
              返回
            </button>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>{project.name}</h1>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{project.path}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button className="btn btn-secondary" onClick={onDelete}>
              <Trash2 className="w-4 h-4" />
              删除项目
            </button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 'var(--space-3) var(--space-6)', borderBottom: '1px solid var(--glass-border)', display: 'flex', gap: 'var(--space-2)' }}>
          <button className={`btn ${activeTab === 'files' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('files')}>
            <FileText className="w-4 h-4" />
            文件预览
          </button>
          <button className={`btn ${activeTab === 'scheduler' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('scheduler')}>
            <Workflow className="w-4 h-4" />
            调度可视化
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-6)' }}>
          {activeTab === 'files' ? (
            <ProjectExplorer projectPath={project.path} />
          ) : (
            <div style={{ maxWidth: '1000px', margin: '0 auto' }} className="stagger-children">
              <div className="glass-subtle" style={{ borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                  <div className="icon-box icon-box-md icon-box-yellow">
                    <Zap style={{ width: 18, height: 18, color: 'var(--color-warning)' }} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>快速启动</h2>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>输入任务，主 Droid 将自动分发给子 Droids</p>
                  </div>
                </div>

                {mainDroid ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                      <Crown style={{ width: 14, height: 14, color: 'var(--color-warning)' }} />
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        主 Droid: <strong style={{ color: 'var(--text-primary)' }}>{mainDroid.name}</strong>
                      </span>
                    </div>
                    <textarea className="input textarea" value={taskPrompt} onChange={e => setTaskPrompt(e.target.value)} placeholder="描述你的任务..." rows={3} style={{ width: '100%' }} />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-3)' }}>
                      <button className="btn btn-primary" onClick={handleStartTask} disabled={!taskPrompt.trim()}>
                        <Play className="w-4 h-4" />
                        启动任务
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>尚未配置主 Droid</p>
                    <button className="btn btn-secondary" onClick={() => setShowCreator(true)}>
                      <Plus className="w-4 h-4" />
                      创建主 Droid
                    </button>
                  </div>
                )}
              </div>

              <div className="glass-subtle" style={{ borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
                <div className="flex-between" style={{ marginBottom: 'var(--space-4)' }}>
                  <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>调度状态</h2>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>查看 Droid 是否被触发</p>
                  </div>
                  <button className="btn btn-ghost" onClick={() => setView('tasks')}>查看任务</button>
                </div>

                <div style={{ marginBottom: 'var(--space-4)' }}>
                  {runningTask ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <span className="status-orb running" />
                      <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>主 Droid 运行中：{runningTask.name}</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <span className="status-orb idle" />
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>主 Droid 未触发</span>
                    </div>
                  )}
                </div>

                {recentTasks.length > 0 ? (
                  <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                    {recentTasks.map(task => (
                      <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', background: 'rgba(0,0,0,0.2)' }}>
                        <span className={`status-orb ${task.status}`} />
                        <button className="btn btn-ghost" onClick={() => setActiveLogTaskId(task.id)} style={{ fontSize: '12px', color: 'var(--text-secondary)', flex: 1, textAlign: 'left', padding: 0 }}>
                          {task.name}
                        </button>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{task.status}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>还没有任务记录</div>
                )}
              </div>

              <div className="glass-subtle" style={{ borderRadius: 'var(--radius-xl)', padding: 'var(--space-4)', marginBottom: 'var(--space-6)', height: '320px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                  <Workflow className="w-4 h-4" />
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>主 Droid → 子 Droid 流程</span>
                </div>
                <div style={{ height: '260px' }}>
                  <ReactFlow nodes={flowData.nodes} edges={flowData.edges} fitView>
                    <Background gap={12} size={0.6} />
                    <Controls />
                  </ReactFlow>
                </div>
              </div>

              <div className="glass-subtle" style={{ borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
                <div className="flex-between" style={{ marginBottom: 'var(--space-3)' }}>
                  <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>实时日志</h2>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>查看 Droid 输出与文件变更</p>
                  </div>
                  {activeLogTask && <span className="badge badge-blue">{activeLogTask.status}</span>}
                </div>

                {activeLogTask ? (
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>{activeLogTask.name}</div>
                    <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', maxHeight: '260px', overflow: 'auto' }}>
                      <pre style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: "'Geist Mono', monospace", whiteSpace: 'pre-wrap', margin: 0 }}>
                        {activeLogTask.output.join('\n') || '暂无输出'}
                      </pre>
                    </div>

                    {activeLogTask.error && (
                      <div style={{ marginTop: 'var(--space-3)', color: 'var(--color-error)', fontSize: '12px' }}>{activeLogTask.error}</div>
                    )}

                    {activeLogTask.changedFiles && (
                      <div style={{ marginTop: 'var(--space-4)' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>文件变更</div>
                        <div style={{ display: 'grid', gap: 'var(--space-2)', fontSize: '11px', color: 'var(--text-muted)' }}>
                          <div>新增: {activeLogTask.changedFiles.added.length}</div>
                          <div>修改: {activeLogTask.changedFiles.modified.length}</div>
                          <div>删除: {activeLogTask.changedFiles.removed.length}</div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>暂无任务日志</div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div className="glass-subtle" style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
                  <div className="flex-between" style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--glass-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <Crown style={{ width: 14, height: 14, color: 'var(--color-warning)' }} />
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>主 Droid</span>
                    </div>
                  </div>
                  <div style={{ padding: 'var(--space-4)' }}>
                    {mainDroid ? <DroidMiniCard droid={mainDroid} /> : (
                      <div style={{ textAlign: 'center', padding: 'var(--space-4)', color: 'var(--text-muted)', fontSize: '13px' }}>未配置</div>
                    )}
                  </div>
                </div>

                <div className="glass-subtle" style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
                  <div className="flex-between" style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--glass-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <Bot style={{ width: 14, height: 14, color: 'var(--prism-cyan)' }} />
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>子 Droids</span>
                    </div>
                    <span className="badge badge-cyan">{subDroids.length}</span>
                  </div>
                  <div style={{ padding: 'var(--space-4)', maxHeight: '200px', overflow: 'auto' }}>
                    {subDroids.length > 0 ? (
                      subDroids.map(droid => (
                        <DroidMiniCard key={droid.id} droid={droid} />
                      ))
                    ) : (
                      <div style={{ textAlign: 'center', padding: 'var(--space-4)', color: 'var(--text-muted)', fontSize: '13px' }}>暂无子 Droid</div>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 'var(--space-4)', textAlign: 'center' }}>
                <button className="btn btn-secondary" onClick={() => setShowCreator(true)}>
                  <Plus className="w-4 h-4" />
                  创建 Droid
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCreator && (
        <DroidCreator
          projectId={project.id}
          projectName={project.name}
          existingDroids={projectDroids}
          onClose={() => setShowCreator(false)}
          onCreate={handleCreateDroid}
        />
      )}
    </div>
  )
}

function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  return (
    <div
      className="glass-subtle hover-lift"
      onClick={onClick}
      style={{
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-5)',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)' }}>
        <div className="icon-box icon-box-md icon-box-purple">
          <Folder style={{ width: 18, height: 18, color: 'var(--prism-purple)' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>
            {project.name}
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: "'Geist Mono', monospace" }} className="truncate">
            {project.path}
          </p>
          {project.description && (
            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: 'var(--space-2)' }} className="truncate">
              {project.description}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function DroidMiniCard({ droid }: { droid: Droid }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      padding: 'var(--space-3)',
      borderRadius: 'var(--radius-md)',
      background: 'var(--glass-bg)',
      marginBottom: 'var(--space-2)'
    }}>
      <div className={`icon-box icon-box-sm ${droid.role === 'main' ? 'icon-box-yellow' : 'icon-box-cyan'}`}>
        {droid.role === 'main' ? (
          <Crown style={{ width: 12, height: 12, color: 'var(--color-warning)' }} />
        ) : (
          <Bot style={{ width: 12, height: 12, color: 'var(--prism-cyan)' }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }} className="truncate">
          {droid.name}
        </div>
        {droid.description && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }} className="truncate">
            {droid.description}
          </div>
        )}
      </div>
      <span className={`badge ${droid.source === 'imported' ? 'badge-blue' : 'badge-green'}`} style={{ fontSize: '10px' }}>
        {droid.source === 'imported' ? '导入' : '创建'}
      </span>
    </div>
  )
}

function AddProjectModal({ 
  onClose, 
  onAdd,
  onSelectFolder
}: { 
  onClose: () => void
  onAdd: (data: { name: string; path: string; description?: string }) => void
  onSelectFolder: () => Promise<string | null>
}) {
  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [description, setDescription] = useState('')

  const handleSelectFolder = async () => {
    const selected = await onSelectFolder()
    if (selected) {
      setPath(selected)
      if (!name) {
        const folderName = selected.split(/[/\\]/).pop() || ''
        setName(folderName)
      }
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name && path) {
      onAdd({ name, path, description: description || undefined })
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ width: '480px' }}>
        <div className="modal-header">
          <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>添加项目</span>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: 'var(--space-1)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
              项目名称
            </label>
            <input type="text" className="input" value={name} onChange={e => setName(e.target.value)} placeholder="我的项目" required />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
              项目路径
            </label>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <input type="text" className="input" style={{ flex: 1, fontFamily: "'Geist Mono', monospace", fontSize: '13px' }} value={path} onChange={e => setPath(e.target.value)} placeholder="D:\projects\my-project" required />
              <button type="button" className="btn btn-secondary" onClick={handleSelectFolder}>
                <Folder className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
              描述 (可选)
            </label>
            <textarea className="input textarea" value={description} onChange={e => setDescription(e.target.value)} placeholder="项目描述..." rows={3} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', paddingTop: 'var(--space-4)' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>取消</button>
            <button type="submit" className="btn btn-primary" disabled={!name || !path}>
              <Check className="w-4 h-4" />
              添加
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
