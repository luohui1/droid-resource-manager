import { useState, useEffect, useCallback } from 'react'
import { useStore } from '../store'
import { Bot, Square, Plus, Crown, Trash2, FileDown } from 'lucide-react'
import { DroidCreator } from './DroidCreator'
import type { DroidState, Droid, CreateDroidDto } from '../types'

export function DroidsView() {
  const { droidStates, projectDroids, projects, selectedProjectId, selectProject, setProjectDroids, addProjectDroid, removeProjectDroid } = useStore()
  const [showCreator, setShowCreator] = useState(false)
  const [viewMode, setViewMode] = useState<'status' | 'manage'>('manage')
  const [selectedDroid, setSelectedDroid] = useState<Droid | null>(null)

  const selectedProject = projects.find(p => p.id === selectedProjectId)

  const loadProjectDroids = useCallback(async (projectId: string, projectPath: string) => {
    const droids = await window.api.droids.projectList(projectId, projectPath)
    setProjectDroids(droids)
  }, [setProjectDroids])

  // 加载项目的 Droids
  useEffect(() => {
    if (selectedProject) {
      loadProjectDroids(selectedProject.id, selectedProject.path)
    }
  }, [selectedProject, loadProjectDroids])

  const handleCreateDroid = async (dto: CreateDroidDto) => {
    const droid = await window.api.droids.create(dto)
    addProjectDroid(droid)
    setShowCreator(false)
  }

  const handleDeleteDroid = async (droidId: string) => {
    await window.api.droids.delete(droidId)
    removeProjectDroid(droidId)
  }

  const handleExportDroid = async (droid: Droid) => {
    if (!selectedProject) return
    const result = await window.api.droids.export(droid.id, selectedProject.path)
    if (result.success) {
      alert(`已导出到: ${result.path}`)
    } else {
      alert(`导出失败: ${result.error}`)
    }
  }

  const handleStopDroid = async (droidId: string) => {
    await window.api.droids.stop(droidId)
  }

  const mainDroids = projectDroids.filter(d => d.role === 'main')
  const subDroids = projectDroids.filter(d => d.role === 'sub')

  const runningCount = droidStates.filter(d => d.status === 'running').length
  const idleCount = droidStates.filter(d => d.status === 'idle').length
  const totalQueued = droidStates.reduce((sum, d) => sum + d.queuedTaskIds.length, 0)

  return (
    <div className="content-panel glass" style={{ padding: 0, display: 'flex' }}>
      {/* Left: Project Selector + Droid List */}
      <div style={{ width: '320px', borderRight: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column' }}>
        {/* Project Selector */}
        <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--glass-border)' }}>
          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-2)' }}>
            选择项目
          </label>
          <select
            className="input"
            value={selectedProjectId || ''}
            onChange={e => selectProject(e.target.value || null)}
          >
            <option value="">-- 选择项目 --</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* View Mode Toggle */}
        <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--glass-border)', display: 'flex', gap: 'var(--space-2)' }}>
          <button
            className={`btn ${viewMode === 'manage' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setViewMode('manage')}
            style={{ flex: 1, fontSize: '12px' }}
          >
            管理
          </button>
          <button
            className={`btn ${viewMode === 'status' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setViewMode('status')}
            style={{ flex: 1, fontSize: '12px' }}
          >
            运行状态
          </button>
        </div>

        {/* Droid List */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {viewMode === 'manage' ? (
            selectedProject ? (
              <div className="stagger-children">
                {/* Main Droids */}
                <div style={{ padding: 'var(--space-3) var(--space-4)' }}>
                  <div className="flex-between" style={{ marginBottom: 'var(--space-2)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      主 Droid
                    </span>
                    <span className="badge badge-yellow">{mainDroids.length}</span>
                  </div>
                  {mainDroids.map(droid => (
                    <DroidListItem
                      key={droid.id}
                      droid={droid}
                      isSelected={selectedDroid?.id === droid.id}
                      onClick={() => setSelectedDroid(droid)}
                    />
                  ))}
                  {mainDroids.length === 0 && (
                    <div style={{ padding: 'var(--space-3)', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                      未创建主 Droid
                    </div>
                  )}
                </div>

                {/* Sub Droids */}
                <div style={{ padding: 'var(--space-3) var(--space-4)' }}>
                  <div className="flex-between" style={{ marginBottom: 'var(--space-2)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      子 Droids
                    </span>
                    <span className="badge badge-cyan">{subDroids.length}</span>
                  </div>
                  {subDroids.map(droid => (
                    <DroidListItem
                      key={droid.id}
                      droid={droid}
                      isSelected={selectedDroid?.id === droid.id}
                      onClick={() => setSelectedDroid(droid)}
                    />
                  ))}
                  {subDroids.length === 0 && (
                    <div style={{ padding: 'var(--space-3)', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                      未创建子 Droid
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
                请先选择一个项目
              </div>
            )
          ) : (
            // Status View
            <div style={{ padding: 'var(--space-3)' }}>
              {droidStates.map(state => (
                <DroidStatusItem key={state.id} state={state} onStop={() => handleStopDroid(state.id)} />
              ))}
              {droidStates.length === 0 && (
                <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
                  暂无运行中的 Droid
                </div>
              )}
            </div>
          )}
        </div>

        {/* Add Button */}
        {viewMode === 'manage' && selectedProject && (
          <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--glass-border)' }}>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setShowCreator(true)}>
              <Plus className="w-4 h-4" />
              创建 Droid
            </button>
          </div>
        )}
      </div>

      {/* Right: Detail Panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {viewMode === 'manage' && selectedDroid ? (
          <DroidDetailPanel
            droid={selectedDroid}
            onDelete={() => { handleDeleteDroid(selectedDroid.id); setSelectedDroid(null) }}
            onExport={() => handleExportDroid(selectedDroid)}
          />
        ) : viewMode === 'status' ? (
          <StatusOverview droidStates={droidStates} runningCount={runningCount} idleCount={idleCount} totalQueued={totalQueued} />
        ) : (
          <div className="flex-center" style={{ flex: 1, color: 'var(--text-muted)' }}>
            {selectedProject ? '选择一个 Droid 查看详情' : '请先选择一个项目'}
          </div>
        )}
      </div>

      {/* Creator Modal */}
      {showCreator && selectedProject && (
        <DroidCreator
          projectId={selectedProject.id}
          projectName={selectedProject.name}
          existingDroids={projectDroids}
          onClose={() => setShowCreator(false)}
          onCreate={handleCreateDroid}
        />
      )}
    </div>
  )
}

function DroidListItem({ droid, isSelected, onClick }: { droid: Droid; isSelected: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-3)',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        transition: 'all var(--duration-fast)',
        background: isSelected ? 'var(--glass-bg-active)' : 'transparent',
        border: '1px solid',
        borderColor: isSelected ? 'var(--glass-border-active)' : 'transparent',
        marginBottom: 'var(--space-1)'
      }}
    >
      <div className={`icon-box icon-box-sm ${droid.role === 'main' ? 'icon-box-yellow' : 'icon-box-cyan'}`}>
        {droid.role === 'main' ? (
          <Crown style={{ width: 14, height: 14, color: 'var(--color-warning)' }} />
        ) : (
          <Bot style={{ width: 14, height: 14, color: 'var(--prism-cyan)' }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }} className="truncate">
          {droid.name}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {droid.source === 'imported' ? '已导入' : '已创建'}
        </div>
      </div>
    </div>
  )
}

function DroidStatusItem({ state, onStop }: { state: DroidState; onStop: () => void }) {
  const isRunning = state.status === 'running'
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      padding: 'var(--space-3)',
      borderRadius: 'var(--radius-md)',
      background: isRunning ? 'var(--glass-bg-active)' : 'transparent',
      marginBottom: 'var(--space-1)'
    }}>
      <span className={`status-orb ${state.status}`} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }} className="truncate">
          {state.name}
        </div>
      </div>
      {state.queuedTaskIds.length > 0 && (
        <span className="badge badge-yellow">{state.queuedTaskIds.length}</span>
      )}
      {isRunning && (
        <button className="btn btn-ghost" onClick={onStop} style={{ padding: 'var(--space-1)', color: 'var(--color-error)' }}>
          <Square className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

function DroidDetailPanel({ droid, onDelete, onExport }: { droid: Droid; onDelete: () => void; onExport: () => void }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: 'var(--space-6)', borderBottom: '1px solid var(--glass-border)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)' }}>
          <div className={`icon-box icon-box-xl ${droid.role === 'main' ? 'icon-box-yellow' : 'icon-box-cyan'}`}>
            {droid.role === 'main' ? (
              <Crown style={{ width: 28, height: 28, color: 'var(--color-warning)' }} />
            ) : (
              <Bot style={{ width: 28, height: 28, color: 'var(--prism-cyan)' }} />
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>
              {droid.name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span className={`badge ${droid.role === 'main' ? 'badge-yellow' : 'badge-cyan'}`}>
                {droid.role === 'main' ? '主 Droid' : '子 Droid'}
              </span>
              <span className="badge badge-blue">{droid.source === 'imported' ? '已导入' : '已创建'}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {droid.source === 'created' && (
              <button className="btn btn-secondary" onClick={onExport} title="导出到项目">
                <FileDown className="w-4 h-4" />
              </button>
            )}
            {droid.source === 'created' && (
              <button className="btn btn-ghost" onClick={onDelete} style={{ color: 'var(--color-error)' }} title="删除">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        {droid.description && (
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: 'var(--space-4)' }}>
            {droid.description}
          </p>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-6)' }}>
        {/* Info Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          <InfoCard label="模型" value={droid.model || '默认'} />
          <InfoCard label="权限级别" value={droid.autoLevel || 'medium'} />
          <InfoCard label="来源" value={droid.sourcePath ? droid.sourcePath.split(/[/\\]/).pop() || '' : '用户创建'} />
        </div>

        {/* System Prompt */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-3)' }}>
            系统提示词
          </label>
          <div style={{
            background: 'rgba(0,0,0,0.2)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
            maxHeight: '400px',
            overflow: 'auto'
          }}>
            <pre style={{
              fontFamily: "'Geist Mono', monospace",
              fontSize: '13px',
              color: 'var(--text-secondary)',
              whiteSpace: 'pre-wrap',
              margin: 0,
              lineHeight: 1.6
            }}>
              {droid.systemPrompt}
            </pre>
          </div>
        </div>

        {/* Sub Droids (for main) */}
        {droid.role === 'main' && droid.subDroidIds && droid.subDroidIds.length > 0 && (
          <div style={{ marginTop: 'var(--space-6)' }}>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-3)' }}>
              可调度的子 Droids
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              {droid.subDroidIds.map(id => (
                <span key={id} className="badge badge-cyan">{id}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-subtle" style={{ borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: 'var(--space-1)' }}>{label}</div>
      <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontFamily: "'Geist Mono', monospace" }}>{value}</div>
    </div>
  )
}

function StatusOverview({ droidStates, runningCount, idleCount, totalQueued }: { droidStates: DroidState[]; runningCount: number; idleCount: number; totalQueued: number }) {
  return (
    <div style={{ flex: 1, padding: 'var(--space-8)', overflow: 'auto' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-6)' }}>
        运行状态概览
      </h2>
      
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        <StatCard label="总数" value={droidStates.length} color="blue" />
        <StatCard label="运行中" value={runningCount} color="cyan" />
        <StatCard label="空闲" value={idleCount} color="green" />
        <StatCard label="队列任务" value={totalQueued} color="yellow" />
      </div>

      {/* Droid Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-4)' }}>
        {droidStates.map(state => (
          <div key={state.id} className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <span className={`status-orb ${state.status}`} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{state.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-1)' }}>
                  <span style={{ color: 'var(--color-success)' }}>✓ {state.completedCount}</span>
                  <span style={{ color: 'var(--color-error)' }}>✗ {state.failedCount}</span>
                </div>
              </div>
              {state.queuedTaskIds.length > 0 && (
                <span className="badge badge-yellow">{state.queuedTaskIds.length}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: 'blue' | 'cyan' | 'green' | 'yellow' }) {
  return (
    <div className="glass-subtle" style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: '28px', fontWeight: 600, color: `var(--prism-${color})`, marginTop: 'var(--space-1)' }}>
        {value}
      </div>
    </div>
  )
}
