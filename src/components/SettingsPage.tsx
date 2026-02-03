import { useState, useEffect } from 'react'
import { Save, RefreshCw, Eye, EyeOff, ChevronDown } from 'lucide-react'

interface AISettings {
  url: string
  apiKey: string
  model: string
  skillsModel: string
}

interface ModelInfo {
  id: string
  name?: string
}

interface SettingsPageProps {
  onExport: () => void
  onImport: () => void
}

export function SettingsPage({ onExport, onImport }: SettingsPageProps) {
  const [aiSettings, setAiSettings] = useState<AISettings>({
    url: '',
    apiKey: '',
    model: '',
    skillsModel: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [loadingModels, setLoadingModels] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const settings = await window.electronAPI.aiGetSettings()
      setAiSettings(settings)
    } catch (e) {
      console.error('加载设置失败:', e)
    } finally {
      setLoading(false)
    }
  }

  const fetchModels = async () => {
    setLoadingModels(true)
    try {
      const list = await window.electronAPI.aiFetchModels()
      setModels(list)
      if (list.length === 0) {
        setMessage({ type: 'error', text: '未获取到模型列表，请检查 API 配置' })
        setTimeout(() => setMessage(null), 3000)
      }
    } catch {
      setMessage({ type: 'error', text: '获取模型列表失败' })
      setTimeout(() => setMessage(null), 3000)
    } finally {
      setLoadingModels(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const success = await window.electronAPI.aiSaveSettings(aiSettings)
      if (success) {
        setMessage({ type: 'success', text: '设置已保存' })
      } else {
        setMessage({ type: 'error', text: '保存失败' })
      }
    } catch (e) {
      setMessage({ type: 'error', text: '保存失败: ' + (e as Error).message })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="glass-card rounded-2xl border-white/40 p-6 max-w-2xl space-y-6">
        <h1 className="text-xl font-semibold font-display">设置</h1>

        {message && (
          <div className={`p-3 rounded-lg text-sm glass-card ${
            message.type === 'success' 
              ? 'text-green-700' 
              : 'text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        {/* AI 设置 */}
        <div className="p-4 glass-card rounded-lg space-y-4">
          <div>
            <h3 className="font-medium mb-1">AI 接口配置</h3>
            <p className="text-sm text-muted-foreground">配置 AI 服务的接口地址和密钥</p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">API URL</label>
              <input
                type="text"
                value={aiSettings.url}
                onChange={(e) => setAiSettings({ ...aiSettings, url: e.target.value })}
                placeholder="https://api.openai.com/v1/chat/completions"
                className="w-full px-3 py-2 text-sm glass-chip rounded-lg focus:outline-none focus:ring-2 focus:ring-ring font-mono"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">API Key</label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={aiSettings.apiKey}
                  onChange={(e) => setAiSettings({ ...aiSettings, apiKey: e.target.value })}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 pr-10 text-sm glass-chip rounded-lg focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">可用模型</label>
                <p className="text-xs text-muted-foreground mb-2">点击刷新从 API 获取模型列表</p>
              </div>
              <button
                type="button"
                onClick={fetchModels}
                disabled={loadingModels}
                className="px-3 py-2 text-sm glass-chip hover:bg-white/70 rounded-lg transition-colors flex items-center gap-1"
                title="刷新模型列表"
              >
                <RefreshCw className={`w-4 h-4 ${loadingModels ? 'animate-spin' : ''}`} />
                刷新模型
              </button>
            </div>
          </div>
        </div>

        {/* 模型选择 */}
        <div className="p-4 glass-card rounded-lg space-y-4">
          <div>
            <h3 className="font-medium mb-1">模型配置</h3>
            <p className="text-sm text-muted-foreground">为不同功能选择合适的模型</p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">翻译模型</label>
              <p className="text-xs text-muted-foreground mb-1">用于 MCP 工具描述翻译</p>
              <div className="relative">
                <select
                  value={aiSettings.model}
                  onChange={(e) => setAiSettings({ ...aiSettings, model: e.target.value })}
                  className="w-full px-3 py-2 text-sm glass-chip rounded-lg focus:outline-none focus:ring-2 focus:ring-ring font-mono appearance-none pr-8"
                >
                  {aiSettings.model && !models.find(m => m.id === aiSettings.model) && (
                    <option value={aiSettings.model}>{aiSettings.model}</option>
                  )}
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>{m.name || m.id}</option>
                  ))}
                  {models.length === 0 && !aiSettings.model && (
                    <option value="">请先刷新模型列表</option>
                  )}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Skills 解读模型</label>
              <p className="text-xs text-muted-foreground mb-1">用于 Skills 内容分析和解读生成</p>
              <div className="relative">
                <select
                  value={aiSettings.skillsModel}
                  onChange={(e) => setAiSettings({ ...aiSettings, skillsModel: e.target.value })}
                  className="w-full px-3 py-2 text-sm glass-chip rounded-lg focus:outline-none focus:ring-2 focus:ring-ring font-mono appearance-none pr-8"
                >
                  {aiSettings.skillsModel && !models.find(m => m.id === aiSettings.skillsModel) && (
                    <option value={aiSettings.skillsModel}>{aiSettings.skillsModel}</option>
                  )}
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>{m.name || m.id}</option>
                  ))}
                  {models.length === 0 && !aiSettings.skillsModel && (
                    <option value="">请先刷新模型列表</option>
                  )}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-primary/90 text-primary-foreground hover:bg-primary rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            保存设置
          </button>
        </div>

        {/* 数据管理 */}
        <div className="p-4 glass-card rounded-lg">
          <h3 className="font-medium mb-2">数据管理</h3>
          <p className="text-sm text-muted-foreground mb-3">导入或导出你的资源数据</p>
          <div className="flex gap-2">
            <button 
              onClick={onExport} 
              className="px-4 py-2 text-sm glass-chip hover:bg-white/70 rounded-lg transition-colors"
            >
              导出数据
            </button>
            <button 
              onClick={onImport} 
              className="px-4 py-2 text-sm glass-chip hover:bg-white/70 rounded-lg transition-colors"
            >
              导入数据
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
