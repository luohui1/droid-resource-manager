import { X, Edit2, ExternalLink, Copy, Check, Server, Sparkles, Bot, Link2, Tag } from 'lucide-react'
import type { Resource } from '../types'
import { TYPE_LABELS } from '../types'
import { useState } from 'react'

interface ResourceDetailProps {
  resource: Resource | null
  onEdit: () => void
  onClose: () => void
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

export function ResourceDetail({ resource, onEdit, onClose }: ResourceDetailProps) {
  const [copied, setCopied] = useState<string | null>(null)

  if (!resource) return null

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopied(field)
    setTimeout(() => setCopied(null), 2000)
  }

  // 生成配置代码
  const generateConfigCode = () => {
    if (resource.type === 'mcp' && resource.mcpConfig) {
      const config = resource.mcpConfig
      if (config.serverType === 'http') {
        return JSON.stringify({
          [resource.name]: {
            type: 'http',
            url: config.url,
            ...(Object.keys(config.headers || {}).length > 0 ? { headers: config.headers } : {})
          }
        }, null, 2)
      } else {
        return JSON.stringify({
          [resource.name]: {
            type: 'stdio',
            command: config.command,
            args: config.args,
            ...(Object.keys(config.env || {}).length > 0 ? { env: config.env } : {})
          }
        }, null, 2)
      }
    } else if (resource.type === 'skill' && resource.skillConfig) {
      return `---
name: ${resource.name}
description: ${resource.description}
---

${resource.skillConfig.instructions}`
    } else if (resource.type === 'droid' && resource.droidConfig) {
      const config = resource.droidConfig
      return `---
name: ${resource.name}
description: ${resource.description}
model: ${config.model}
tools: ${typeof config.tools === 'string' ? config.tools : JSON.stringify(config.tools)}${config.reasoningEffort ? `\nreasoningEffort: ${config.reasoningEffort}` : ''}
---

${config.systemPrompt}`
    }
    return ''
  }

  const configCode = generateConfigCode()

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-auto py-8 px-4">
      <div className="glass-panel rounded-2xl border-white/40 w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col m-4 shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/40">
          <div className="flex items-center gap-3">
            <span className={cn(
              "icon-orb icon-orb--md",
              resource.type === 'mcp' && 'icon-orb--blue text-blue-600',
              resource.type === 'skill' && 'icon-orb--green text-green-600',
              resource.type === 'droid' && 'icon-orb--purple text-purple-600'
            )}>
              {resource.type === 'mcp' && <Server className="w-5 h-5" />}
              {resource.type === 'skill' && <Sparkles className="w-5 h-5" />}
              {resource.type === 'droid' && <Bot className="w-5 h-5" />}
            </span>
            <div>
              <h2 className="text-lg font-semibold font-display">{resource.name}</h2>
              <p className="text-sm text-muted-foreground">{TYPE_LABELS[resource.type]}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={onEdit}
              className="px-4 py-2 text-sm bg-primary/90 text-primary-foreground hover:bg-primary rounded-lg transition-colors flex items-center gap-2"
            >
              <Edit2 className="w-4 h-4" />
              编辑
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/60 transition-colors glass-chip">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-auto p-6 space-y-5">
          {resource.description && (
            <p className="text-muted-foreground">{resource.description}</p>
          )}

          {/* MCP 配置详情 */}
          {resource.type === 'mcp' && resource.mcpConfig && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Server className="w-4 h-4" />
                服务器配置
              </h4>
              <div className="glass-card rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">类型</span>
                  <span className="text-sm font-medium">{resource.mcpConfig.serverType === 'http' ? 'HTTP (远程)' : 'Stdio (本地)'}</span>
                </div>
                {resource.mcpConfig.serverType === 'http' ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">URL</span>
                      <span className="text-sm font-mono">{resource.mcpConfig.url}</span>
                    </div>
                    {Object.keys(resource.mcpConfig.headers || {}).length > 0 && (
                      <div>
                        <span className="text-sm text-muted-foreground">Headers</span>
                        <div className="mt-1 text-sm font-mono glass-chip rounded p-2">
                          {Object.entries(resource.mcpConfig.headers || {}).map(([k, v]) => (
                            <div key={k}>{k}: {v}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">命令</span>
                      <span className="text-sm font-mono">{resource.mcpConfig.command}</span>
                    </div>
                    {resource.mcpConfig.args && resource.mcpConfig.args.length > 0 && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">参数</span>
                        <span className="text-sm font-mono">{resource.mcpConfig.args.join(' ')}</span>
                      </div>
                    )}
                    {Object.keys(resource.mcpConfig.env || {}).length > 0 && (
                      <div>
                        <span className="text-sm text-muted-foreground">环境变量</span>
                        <div className="mt-1 text-sm font-mono glass-chip rounded p-2">
                          {Object.entries(resource.mcpConfig.env || {}).map(([k, v]) => (
                            <div key={k}>{k}={v}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Skill 配置详情 */}
          {resource.type === 'skill' && resource.skillConfig && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                技能指令
              </h4>
              <div className="glass-card rounded-lg p-4">
                <pre className="text-sm whitespace-pre-wrap">{resource.skillConfig.instructions}</pre>
              </div>
            </div>
          )}

          {/* Droid 配置详情 */}
          {resource.type === 'droid' && resource.droidConfig && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Bot className="w-4 h-4" />
                Agent 配置
              </h4>
              <div className="glass-card rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-muted-foreground">模型</span>
                    <p className="text-sm font-medium">{resource.droidConfig.model}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">工具权限</span>
                    <p className="text-sm font-medium">
                      {typeof resource.droidConfig.tools === 'string' 
                        ? resource.droidConfig.tools 
                        : resource.droidConfig.tools.join(', ')}
                    </p>
                  </div>
                  {resource.droidConfig.reasoningEffort && (
                    <div>
                      <span className="text-xs text-muted-foreground">推理强度</span>
                      <p className="text-sm font-medium">{resource.droidConfig.reasoningEffort}</p>
                    </div>
                  )}
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">系统提示词</span>
                  <pre className="mt-1 text-sm whitespace-pre-wrap glass-chip rounded p-3">{resource.droidConfig.systemPrompt}</pre>
                </div>
              </div>
            </div>
          )}

          {/* 配置代码 */}
          {configCode && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">配置代码</h4>
                <button
                  onClick={() => copyToClipboard(configCode, 'config')}
                  className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  {copied === 'config' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  复制
                </button>
              </div>
              <pre className="text-sm font-mono glass-card rounded-lg p-4 overflow-auto">{configCode}</pre>
            </div>
          )}

          {/* 标签 */}
          {resource.tags.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Tag className="w-4 h-4" />
                标签
              </h4>
              <div className="flex flex-wrap gap-2">
                {resource.tags.map((tag) => (
                  <span key={tag} className="px-2 py-1 text-xs glass-chip rounded">{tag}</span>
                ))}
              </div>
            </div>
          )}

          {/* 链接 */}
          {resource.links.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Link2 className="w-4 h-4" />
                相关链接
              </h4>
              <div className="space-y-2">
                {resource.links.map((link, i) => (
                  <button
                    key={i}
                    onClick={() => window.electronAPI.openExternal(link)}
                    className="flex items-center gap-2 text-sm text-primary hover:underline text-left"
                    title="打开链接"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {link}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-muted-foreground pt-4 border-t border-white/40 flex justify-between">
            <span>创建: {new Date(resource.createdAt).toLocaleString()}</span>
            <span>更新: {new Date(resource.updatedAt).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
