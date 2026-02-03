export type ResourceType = 'mcp' | 'skill' | 'droid' | 'prompt' | 'rule'
export type McpServerType = 'http' | 'stdio'

// MCP 服务器配置
export interface McpConfig {
  serverType: McpServerType
  // HTTP 类型
  url?: string
  headers?: Record<string, string>
  // Stdio 类型
  command?: string
  args?: string[]
  env?: Record<string, string>
  // 通用
  disabled?: boolean
}

// Skill 配置
export interface SkillConfig {
  instructions: string      // Markdown 指令内容
  allowedTools?: string[]   // 允许的工具列表
}

// Droid/Agent 配置
export interface DroidConfig {
  systemPrompt: string      // 系统提示词
  model: string             // 模型: 'inherit' 或具体模型名
  tools: string[] | string  // 工具列表或类别 ('read-only', 'edit', 'execute', 'web', 'mcp')
  reasoningEffort?: 'low' | 'medium' | 'high'
}

// Prompt 配置
export interface PromptConfig {
  content: string           // Prompt 内容（支持变量占位符如 {{variable}}）
  variables?: string[]      // 可替换变量列表
  category?: 'system' | 'user' | 'assistant' | 'template'  // 分类
}

// Rule 配置
export interface RuleConfig {
  content: string              // 规则内容（Markdown）
  scope: 'global' | 'project'  // 作用域
  projectPath?: string         // 项目路径（scope=project 时）
  priority?: number            // 优先级（多规则时的应用顺序）
  category?: string            // 分类：coding-style/security/naming/testing 等
  globs?: string[]             // 适用的文件匹配模式
}

export interface Resource {
  id: string
  name: string
  type: ResourceType
  description: string       // 简短描述
  
  // MCP 专用
  mcpConfig?: McpConfig
  
  // Skill 专用
  skillConfig?: SkillConfig
  
  // Droid 专用
  droidConfig?: DroidConfig
  
  // Prompt 专用
  promptConfig?: PromptConfig
  
  // Rule 专用
  ruleConfig?: RuleConfig
  
  // 关联资源
  linkedResources?: string[]  // 关联的资源 ID 列表
  
  // 通用字段
  links: string[]           // 相关链接
  tags: string[]            // 标签
  createdAt: number
  updatedAt: number
}

export interface AppData {
  resources: Resource[]
  tags: string[]
}

export const TYPE_LABELS: Record<ResourceType, string> = {
  mcp: 'MCP',
  skill: 'Skill',
  droid: 'Droid/Agent',
  prompt: 'Prompt',
  rule: 'Rule'
}

export const TYPE_DESCRIPTIONS: Record<ResourceType, string> = {
  mcp: '外部工具/服务连接器',
  skill: '可复用的工作流/专业知识',
  droid: '专门的子代理',
  prompt: '可复用的提示词模板',
  rule: '项目/全局编码规则'
}

// Droid 工具类别
export const DROID_TOOL_CATEGORIES = {
  'read-only': ['Read', 'LS', 'Grep', 'Glob'],
  'edit': ['Create', 'Edit', 'ApplyPatch'],
  'execute': ['Execute'],
  'web': ['WebSearch', 'FetchUrl'],
  'mcp': [] // 动态填充
}

// 常用模型列表
export const COMMON_MODELS = [
  { value: 'inherit', label: '继承父会话模型' },
  { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5' },
  { value: 'claude-opus-4-5-20251101', label: 'Claude Opus 4.5' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
]

// 常用 MCP 服务器
export const POPULAR_MCP_SERVERS = [
  { name: 'linear', url: 'https://mcp.linear.app/mcp', description: '问题跟踪和项目管理' },
  { name: 'notion', url: 'https://mcp.notion.com/mcp', description: '笔记、文档和项目管理' },
  { name: 'sentry', url: 'https://mcp.sentry.dev/mcp', description: '错误跟踪和性能监控' },
  { name: 'stripe', url: 'https://mcp.stripe.com', description: '支付处理 API' },
  { name: 'figma', url: 'https://mcp.figma.com/mcp', description: 'Figma 设计上下文' },
  { name: 'vercel', url: 'https://mcp.vercel.com/', description: '项目和部署管理' },
]

// Prompt 分类
export const PROMPT_CATEGORIES = [
  { value: 'system', label: '系统提示词' },
  { value: 'user', label: '用户提示词' },
  { value: 'assistant', label: '助手提示词' },
  { value: 'template', label: '模板' },
]

// Rule 分类
export const RULE_CATEGORIES = [
  { value: 'coding-style', label: '编码风格' },
  { value: 'security', label: '安全规范' },
  { value: 'naming', label: '命名规范' },
  { value: 'testing', label: '测试规范' },
  { value: 'documentation', label: '文档规范' },
  { value: 'architecture', label: '架构规范' },
  { value: 'other', label: '其他' },
]
