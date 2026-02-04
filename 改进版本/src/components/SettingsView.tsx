import { useState, useMemo } from 'react'
import { useStore } from '../store'
import { Save, RotateCcw, Sliders } from 'lucide-react'
import type { SchedulerConfig, AutoLevel } from '../types'

export function SettingsView() {
  const { config, setConfig, models } = useStore()
  const initialConfig = useMemo(() => config ? { ...config } : null, [config])
  const [localConfig, setLocalConfig] = useState<SchedulerConfig | null>(initialConfig)
  const [saved, setSaved] = useState(false)

  if (config && !localConfig) {
    setLocalConfig({ ...config })
  }

  const handleSave = async () => {
    if (!localConfig) return
    const updated = await window.api.scheduler.updateConfig(localConfig)
    setConfig(updated)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = () => {
    if (config) setLocalConfig({ ...config })
  }

  if (!localConfig) {
    return (
      <div className="content-panel glass flex-center">
        <div style={{ color: 'var(--text-muted)' }}>加载中...</div>
      </div>
    )
  }

  return (
    <div className="content-panel glass" style={{ padding: 0 }}>
      <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-8)' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto' }} className="stagger-children">
          {/* Header */}
          <div className="flex-between" style={{ marginBottom: 'var(--space-8)' }}>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: 'var(--space-1)' }}>
                设置
              </h1>
              <p style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>
                调度器配置
              </p>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button className="btn btn-secondary" onClick={handleReset}>
                <RotateCcw className="w-4 h-4" />
                重置
              </button>
              <button className="btn btn-primary" onClick={handleSave}>
                <Save className="w-4 h-4" />
                {saved ? '已保存' : '保存'}
              </button>
            </div>
          </div>

          {/* Concurrency */}
          <SettingsSection title="并发控制" icon={Sliders}>
            <SettingsField label="最大全局并行任务数" hint="同时运行的最大任务数量">
              <input
                type="number"
                className="input"
                style={{ width: '120px' }}
                value={localConfig.maxParallelTasks}
                onChange={e => setLocalConfig({ ...localConfig, maxParallelTasks: Number(e.target.value) })}
                min={1}
                max={10}
              />
            </SettingsField>
            <SettingsField label="单 Droid 最大并行任务数" hint="每个 Droid 同时运行的最大任务数">
              <input
                type="number"
                className="input"
                style={{ width: '120px' }}
                value={localConfig.maxTasksPerDroid}
                onChange={e => setLocalConfig({ ...localConfig, maxTasksPerDroid: Number(e.target.value) })}
                min={1}
                max={5}
              />
            </SettingsField>
          </SettingsSection>

          {/* Defaults */}
          <SettingsSection title="默认配置">
            <SettingsField label="默认权限级别">
              <select
                className="input"
                style={{ width: '180px' }}
                value={localConfig.defaultAutoLevel}
                onChange={e => setLocalConfig({ ...localConfig, defaultAutoLevel: e.target.value as AutoLevel })}
              >
                <option value="low">Low - 最小权限</option>
                <option value="medium">Medium - 中等权限</option>
                <option value="high">High - 高权限</option>
                <option value="full">Full - 完全权限</option>
              </select>
            </SettingsField>
            <SettingsField label="默认模型" hint={`已加载 ${models.length} 个模型`}>
              <select
                className="input"
                value={localConfig.defaultModel}
                onChange={e => setLocalConfig({ ...localConfig, defaultModel: e.target.value })}
                style={{ width: '100%' }}
              >
                {models.length === 0 && !modelsLoading && (
                  <option value="">未找到可用模型</option>
                )}
                {models.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.displayName} ({m.provider})
                  </option>
                ))}
              </select>
            </SettingsField>
          </SettingsSection>

          {/* Timeout & Retry */}
          <SettingsSection title="超时与重试">
            <SettingsField label="任务超时时间 (分钟)">
              <input
                type="number"
                className="input"
                style={{ width: '120px' }}
                value={Math.round(localConfig.taskTimeout / 60000)}
                onChange={e => setLocalConfig({ ...localConfig, taskTimeout: Number(e.target.value) * 60000 })}
                min={1}
                max={120}
              />
            </SettingsField>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-4) 0' }}>
              <input
                type="checkbox"
                id="retryOnFailure"
                checked={localConfig.retryOnFailure}
                onChange={e => setLocalConfig({ ...localConfig, retryOnFailure: e.target.checked })}
                style={{ width: '18px', height: '18px', accentColor: 'var(--prism-blue)' }}
              />
              <label htmlFor="retryOnFailure" style={{ fontSize: '14px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                失败时自动重试
              </label>
            </div>
            {localConfig.retryOnFailure && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', paddingLeft: 'var(--space-8)' }}>
                <SettingsField label="最大重试次数">
                  <input
                    type="number"
                    className="input"
                    style={{ width: '100px' }}
                    value={localConfig.maxRetries}
                    onChange={e => setLocalConfig({ ...localConfig, maxRetries: Number(e.target.value) })}
                    min={1}
                    max={5}
                  />
                </SettingsField>
                <SettingsField label="重试延迟 (秒)">
                  <input
                    type="number"
                    className="input"
                    style={{ width: '100px' }}
                    value={Math.round(localConfig.retryDelay / 1000)}
                    onChange={e => setLocalConfig({ ...localConfig, retryDelay: Number(e.target.value) * 1000 })}
                    min={1}
                    max={60}
                  />
                </SettingsField>
              </div>
            )}
          </SettingsSection>
        </div>
      </div>
    </div>
  )
}

function SettingsSection({ title, icon: Icon, children }: { title: string; icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="glass-subtle" style={{ borderRadius: 'var(--radius-xl)', marginBottom: 'var(--space-5)', overflow: 'hidden' }}>
      <div style={{ 
        padding: 'var(--space-4) var(--space-5)', 
        borderBottom: '1px solid var(--glass-border)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)'
      }}>
        {Icon && <Icon style={{ width: 16, height: 16, color: 'var(--text-muted)' }} />}
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
        </span>
      </div>
      <div style={{ padding: 'var(--space-5)' }}>
        {children}
      </div>
    </div>
  )
}

function SettingsField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
        {label}
      </label>
      {children}
      {hint && (
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>{hint}</p>
      )}
    </div>
  )
}
