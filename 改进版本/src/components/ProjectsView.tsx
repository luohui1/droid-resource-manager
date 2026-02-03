import { useState } from 'react'
import { useStore } from '../store'
import { Plus, Folder, Trash2, X, Check, FolderOpen } from 'lucide-react'
import type { Project } from '../types'

export function ProjectsView() {
  const { projects, setProjects } = useStore()
  const [showAddModal, setShowAddModal] = useState(false)

  const handleAdd = async (data: { name: string; path: string; description?: string }) => {
    const project = await window.api.projects.add(data)
    setProjects([...projects, project])
    setShowAddModal(false)
  }

  const handleDelete = async (id: string) => {
    await window.api.projects.delete(id)
    setProjects(projects.filter(p => p.id !== id))
  }

  const handleSelectFolder = async () => {
    return await window.api.projects.selectFolder()
  }

  return (
    <div className="content-panel glass" style={{ padding: 0 }}>
      <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-8)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }} className="stagger-children">
          {/* Header */}
          <div className="flex-between" style={{ marginBottom: 'var(--space-8)' }}>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: 'var(--space-1)' }}>
                项目管理
              </h1>
              <p style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>
                管理你的工作项目目录
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4" />
              添加项目
            </button>
          </div>

          {/* Projects Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-4)' }}>
            {projects.map(project => (
              <ProjectCard key={project.id} project={project} onDelete={() => handleDelete(project.id)} />
            ))}
            
            {projects.length === 0 && (
              <div className="glass-subtle" style={{ 
                gridColumn: 'span 2', 
                borderRadius: 'var(--radius-xl)',
                padding: 'var(--space-12)',
                textAlign: 'center'
              }}>
                <div className="icon-box icon-box-xl icon-box-purple" style={{ margin: '0 auto var(--space-5)' }}>
                  <FolderOpen style={{ width: 28, height: 28, color: 'var(--prism-purple)' }} />
                </div>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
                  尚未添加任何项目
                </p>
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
        <AddProjectModal onClose={() => setShowAddModal(false)} onAdd={handleAdd} onSelectFolder={handleSelectFolder} />
      )}
    </div>
  )
}

function ProjectCard({ project, onDelete }: { project: Project; onDelete: () => void }) {
  return (
    <div className="card" style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)' }}>
        <div className="icon-box icon-box-lg icon-box-purple">
          <Folder style={{ width: 22, height: 22, color: 'var(--prism-purple)' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>
            {project.name}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: "'Geist Mono', monospace" }} className="truncate">
            {project.path}
          </div>
          {project.description && (
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: 'var(--space-3)' }}>
              {project.description}
            </div>
          )}
        </div>
        <button 
          className="btn btn-ghost" 
          onClick={onDelete}
          style={{ color: 'var(--color-error)', padding: 'var(--space-2)' }}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
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
