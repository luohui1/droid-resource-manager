import { useState } from 'react'
import { X, Sparkles, Bot, Crown, Wand2 } from 'lucide-react'
import type { CreateDroidDto, DroidRole, AutoLevel, Droid } from '../types'

interface DroidCreatorProps {
  projectId: string
  projectName: string
  existingDroids: Droid[]
  onClose: () => void
  onCreate: (dto: CreateDroidDto) => void
}

export function DroidCreator({ projectId, projectName, existingDroids, onClose, onCreate }: DroidCreatorProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [role, setRole] = useState<DroidRole>('sub')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [model, setModel] = useState('')
  const [autoLevel, setAutoLevel] = useState<AutoLevel>('medium')
  const [selectedSubDroids, setSelectedSubDroids] = useState<string[]>([])
  const [isGenerating, setIsGenerating] = useState(false)

  const subDroids = existingDroids.filter(d => d.role === 'sub')

  const handleGenerateMainPrompt = async () => {
    if (role !== 'main') return
    setIsGenerating(true)
    try {
      const prompt = await window.api.droids.generateMainPrompt(
        projectName,
        subDroids.filter(d => selectedSubDroids.includes(d.id))
      )
      setSystemPrompt(prompt)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !systemPrompt) return

    onCreate({
      name,
      description: description || undefined,
      role,
      systemPrompt,
      model: model || undefined,
      autoLevel,
      subDroidIds: role === 'main' ? selectedSubDroids : undefined,
      projectId
    })
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ width: '600px', maxHeight: '90vh' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div className="icon-box icon-box-md icon-box-cyan">
              <Bot style={{ width: 18, height: 18, color: 'var(--prism-cyan)' }} />
            </div>
            <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
              创建 Droid
            </span>
          </div>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: 'var(--space-1)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {/* Role Selection */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
              角色类型
            </label>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <RoleCard
                icon={Crown}
                title="主 Droid"
                description="负责分析任务并分发给子 Droid"
                selected={role === 'main'}
                onClick={() => setRole('main')}
                color="yellow"
              />
              <RoleCard
                icon={Bot}
                title="子 Droid"
                description="执行具体任务的专业化 Droid"
                selected={role === 'sub'}
                onClick={() => setRole('sub')}
                color="cyan"
              />
            </div>
          </div>

          {/* Basic Info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                名称 *
              </label>
              <input
                type="text"
                className="input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={role === 'main' ? '项目调度器' : 'frontend-droid'}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                模型 (可选)
              </label>
              <input
                type="text"
                className="input"
                value={model}
                onChange={e => setModel(e.target.value)}
                placeholder="默认使用全局配置"
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
              描述
            </label>
            <input
              type="text"
              className="input"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="简要描述这个 Droid 的职责"
            />
          </div>

          {/* Sub Droid Selection (for main droid) */}
          {role === 'main' && subDroids.length > 0 && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
                可调度的子 Droids
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {subDroids.map(droid => (
                  <button
                    key={droid.id}
                    type="button"
                    onClick={() => {
                      setSelectedSubDroids(prev =>
                        prev.includes(droid.id)
                          ? prev.filter(id => id !== droid.id)
                          : [...prev, droid.id]
                      )
                    }}
                    style={{
                      padding: 'var(--space-2) var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid',
                      borderColor: selectedSubDroids.includes(droid.id) ? 'var(--prism-cyan)' : 'var(--glass-border)',
                      background: selectedSubDroids.includes(droid.id) ? 'rgba(34, 211, 238, 0.1)' : 'transparent',
                      color: selectedSubDroids.includes(droid.id) ? 'var(--prism-cyan)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '13px',
                      transition: 'all var(--duration-fast)'
                    }}
                  >
                    {droid.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* System Prompt */}
          <div>
            <div className="flex-between" style={{ marginBottom: 'var(--space-2)' }}>
              <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                系统提示词 *
              </label>
              {role === 'main' && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleGenerateMainPrompt}
                  disabled={isGenerating}
                  style={{ fontSize: '12px', gap: 'var(--space-1)' }}
                >
                  <Wand2 className="w-3 h-3" />
                  {isGenerating ? '生成中...' : '自动生成'}
                </button>
              )}
            </div>
            <textarea
              className="input textarea"
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              placeholder={role === 'main' 
                ? '定义主 Droid 如何分析任务并分发给子 Droid...'
                : '定义这个 Droid 的专业能力和工作方式...'
              }
              rows={8}
              required
              style={{ fontFamily: "'Geist Mono', monospace", fontSize: '13px' }}
            />
          </div>

          {/* Auto Level */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
              权限级别
            </label>
            <select
              className="input"
              value={autoLevel}
              onChange={e => setAutoLevel(e.target.value as AutoLevel)}
              style={{ width: '200px' }}
            >
              <option value="low">Low - 最小权限</option>
              <option value="medium">Medium - 中等权限</option>
              <option value="high">High - 高权限</option>
              <option value="full">Full - 完全权限</option>
            </select>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--glass-border)' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn btn-primary" disabled={!name || !systemPrompt}>
              <Sparkles className="w-4 h-4" />
              创建 Droid
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function RoleCard({ 
  icon: Icon, 
  title, 
  description, 
  selected, 
  onClick,
  color
}: { 
  icon: React.ElementType
  title: string
  description: string
  selected: boolean
  onClick: () => void
  color: 'yellow' | 'cyan'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: 'var(--space-4)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid',
        borderColor: selected ? `var(--prism-${color})` : 'var(--glass-border)',
        background: selected ? `rgba(${color === 'yellow' ? '251, 191, 36' : '34, 211, 238'}, 0.1)` : 'var(--glass-bg)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all var(--duration-fast)'
      }}
    >
      <div className={`icon-box icon-box-md icon-box-${color}`} style={{ marginBottom: 'var(--space-3)' }}>
        <Icon style={{ width: 18, height: 18, color: `var(--prism-${color})` }} />
      </div>
      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>
        {title}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
        {description}
      </div>
    </button>
  )
}
