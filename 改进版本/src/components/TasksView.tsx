import { useState } from 'react'
import { useStore } from '../store'
import { Plus, Play, Square, RotateCcw, Clock, CheckCircle2, XCircle, Loader2, X, Zap } from 'lucide-react'
import type { Task, AutoLevel } from '../types'

export function TasksView() {
  const { tasks, projects, droids, setTasks } = useStore()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'running' | 'completed' | 'failed'>('all')

  const allTasks = [...tasks.pending, ...tasks.history]
  const filteredTasks = filter === 'all' ? allTasks : allTasks.filter(t => {
    if (filter === 'pending') return t.status === 'pending' || t.status === 'queued'
    if (filter === 'running') return t.status === 'running'
    if (filter === 'completed') return t.status === 'completed'
    if (filter === 'failed') return t.status === 'failed' || t.status === 'cancelled'
    return true
  })

  const handleCreate = async (data: { name: string; prompt: string; projectId: string; droidId: string; autoLevel: AutoLevel; priority: number }) => {
    const task = await window.api.tasks.create(data)
    setTasks({ pending: [...tasks.pending, task], history: tasks.history })
    setShowCreateModal(false)
  }

  const handleCancel = async (taskId: string) => {
    await window.api.tasks.cancel(taskId)
    const updatedPending = tasks.pending.map(t => t.id === taskId ? { ...t, status: 'cancelled' as const } : t)
    setTasks({ pending: updatedPending, history: tasks.history })
  }

  const handleRetry = async (taskId: string) => {
    const newTask = await window.api.tasks.retry(taskId)
    if (newTask) setTasks({ pending: [...tasks.pending, newTask], history: tasks.history })
  }

  return (
    <div className="content-panel glass" style={{ padding: 0, display: 'flex' }}>
      {/* Task List */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--glass-border)' }}>
        {/* Header */}
        <div className="flex-between" style={{ padding: 'var(--space-5) var(--space-6)', borderBottom: '1px solid var(--glass-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>任务队列</h2>
            <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
              {(['all', 'pending', 'running', 'completed', 'failed'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: 'var(--space-1) var(--space-3)',
                    fontSize: '12px',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all var(--duration-fast)',
                    background: filter === f ? 'var(--glass-bg-active)' : 'transparent',
                    color: filter === f ? 'var(--prism-cyan)' : 'var(--text-muted)'
                  }}
                >
                  {f === 'all' ? '全部' : f === 'pending' ? '等待' : f === 'running' ? '运行' : f === 'completed' ? '完成' : '失败'}
                </button>
              ))}
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4" />
            新建任务
          </button>
        </div>

        {/* Task List */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {filteredTasks.length === 0 ? (
            <div className="empty-state">
              <Zap className="empty-state-icon" />
              <p style={{ color: 'var(--text-muted)' }}>暂无任务</p>
            </div>
          ) : (
            filteredTasks.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                isSelected={selectedTask?.id === task.id}
                onClick={() => setSelectedTask(task)}
                onCancel={() => handleCancel(task.id)}
                onRetry={() => handleRetry(task.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Task Detail Panel */}
      {selectedTask && <TaskDetailPanel task={selectedTask} onClose={() => setSelectedTask(null)} />}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateTaskModal projects={projects} droids={droids} onClose={() => setShowCreateModal(false)} onCreate={handleCreate} />
      )}
    </div>
  )
}

function TaskRow({ task, isSelected, onClick, onCancel, onRetry }: { task: Task; isSelected: boolean; onClick: () => void; onCancel: () => void; onRetry: () => void }) {
  const statusIcons = { pending: Clock, queued: Clock, running: Loader2, completed: CheckCircle2, failed: XCircle, cancelled: XCircle }
  const StatusIcon = statusIcons[task.status]
  const statusColors: Record<string, string> = { pending: 'var(--color-warning)', queued: 'var(--color-warning)', running: 'var(--prism-cyan)', completed: 'var(--color-success)', failed: 'var(--color-error)', cancelled: 'var(--text-muted)' }

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
        padding: 'var(--space-4) var(--space-6)',
        borderBottom: '1px solid var(--glass-border)',
        cursor: 'pointer',
        transition: 'background var(--duration-fast)',
        background: isSelected ? 'var(--glass-bg-active)' : 'transparent'
      }}
    >
      <StatusIcon style={{ width: 16, height: 16, color: statusColors[task.status], flexShrink: 0 }} className={task.status === 'running' ? 'animate-spin' : ''} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }} className="truncate">{task.name}</div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }} className="truncate">{task.prompt}</div>
      </div>
      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: "'Geist Mono', monospace" }}>P{task.priority}</span>
      {task.status === 'running' && (
        <button className="btn btn-ghost" onClick={(e) => { e.stopPropagation(); onCancel() }} style={{ padding: 'var(--space-1)', color: 'var(--color-error)' }}>
          <Square className="w-3.5 h-3.5" />
        </button>
      )}
      {task.status === 'failed' && (
        <button className="btn btn-ghost" onClick={(e) => { e.stopPropagation(); onRetry() }} style={{ padding: 'var(--space-1)' }}>
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

function TaskDetailPanel({ task, onClose }: { task: Task; onClose: () => void }) {
  return (
    <div style={{ width: '380px', display: 'flex', flexDirection: 'column', background: 'var(--glass-bg)' }} className="animate-slide-in">
      <div className="flex-between" style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--glass-border)' }}>
        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>任务详情</span>
        <button className="btn btn-ghost" onClick={onClose} style={{ padding: 'var(--space-1)' }}><X className="w-4 h-4" /></button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-5)' }}>
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>名称</label>
          <div style={{ fontSize: '14px', color: 'var(--text-primary)', marginTop: 'var(--space-1)' }}>{task.name}</div>
        </div>
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prompt</label>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: "'Geist Mono', monospace", background: 'rgba(0,0,0,0.2)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', marginTop: 'var(--space-2)' }}>
            {task.prompt}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>状态</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
              <span className={`status-orb ${task.status}`} />
              <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{task.status}</span>
            </div>
          </div>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>优先级</label>
            <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: 'var(--space-1)' }}>{task.priority}</div>
          </div>
        </div>
        {task.usage && (
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Token 使用</label>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: "'Geist Mono', monospace", marginTop: 'var(--space-1)' }}>
              输入: {task.usage.inputTokens.toLocaleString()} / 输出: {task.usage.outputTokens.toLocaleString()}
            </div>
          </div>
        )}
        {task.output.length > 0 && (
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>输出</label>
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', maxHeight: '250px', overflow: 'auto', marginTop: 'var(--space-2)' }}>
              <pre style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: "'Geist Mono', monospace", whiteSpace: 'pre-wrap', margin: 0 }}>
                {task.output.join('\n')}
              </pre>
            </div>
          </div>
        )}
        {task.error && (
          <div style={{ marginTop: 'var(--space-4)' }}>
            <label style={{ fontSize: '11px', color: 'var(--color-error)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>错误</label>
            <div style={{ fontSize: '13px', color: 'var(--color-error)', marginTop: 'var(--space-1)' }}>{task.error}</div>
          </div>
        )}
      </div>
    </div>
  )
}

function CreateTaskModal({ projects, droids, onClose, onCreate }: { projects: import('../types').Project[]; droids: import('../types').DroidState[]; onClose: () => void; onCreate: (data: { name: string; prompt: string; projectId: string; droidId: string; autoLevel: AutoLevel; priority: number }) => void }) {
  const [name, setName] = useState('')
  const [prompt, setPrompt] = useState('')
  const [projectId, setProjectId] = useState(projects[0]?.id || '')
  const [droidId, setDroidId] = useState(droids[0]?.id || '')
  const [autoLevel, setAutoLevel] = useState<AutoLevel>('medium')
  const [priority, setPriority] = useState(5)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name && prompt && projectId && droidId) onCreate({ name, prompt, projectId, droidId, autoLevel, priority })
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ width: '520px' }}>
        <div className="modal-header">
          <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>新建任务</span>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: 'var(--space-1)' }}><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>任务名称</label>
            <input type="text" className="input" value={name} onChange={e => setName(e.target.value)} placeholder="修复登录页面 Bug" required />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>Prompt</label>
            <textarea className="input textarea" value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="请修复登录页面的表单验证问题..." rows={4} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>项目</label>
              <select className="input" value={projectId} onChange={e => setProjectId(e.target.value)} required>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>Droid</label>
              <select className="input" value={droidId} onChange={e => setDroidId(e.target.value)} required>
                {droids.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>权限级别</label>
              <select className="input" value={autoLevel} onChange={e => setAutoLevel(e.target.value as AutoLevel)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="full">Full</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>优先级 (1-10)</label>
              <input type="number" className="input" value={priority} onChange={e => setPriority(Number(e.target.value))} min={1} max={10} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', paddingTop: 'var(--space-4)' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>取消</button>
            <button type="submit" className="btn btn-primary" disabled={!name || !prompt || !projectId || !droidId}>
              <Play className="w-4 h-4" />
              创建任务
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
