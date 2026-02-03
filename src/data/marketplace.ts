// 热门资源市场数据 - 精选高质量来源

export interface McpResource {
  id: string
  name: string
  description: string
  category: 'official' | 'community' | 'hosted' | 'featured'
  type: 'http' | 'stdio'
  url?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  author?: string
  homepage?: string
  tags?: string[]
  mcpsoUrl?: string
}

export interface SkillResource {
  id: string
  name: string
  description: string
  category: string
  author?: string
  smitheryUrl?: string
  usageCount?: number
  tags?: string[]
}

export interface MarketplaceSource {
  id: string
  name: string
  description: string
  url: string
  type: 'mcp' | 'skills'
  icon: string
  urlPattern: RegExp
  exampleUrl: string
}

// 精选资源来源 - 只保留最高质量的两个
export const MARKETPLACE_SOURCES: MarketplaceSource[] = [
  {
    id: 'mcp-so',
    name: 'MCP.so',
    description: '最大的 MCP 服务器聚合平台，收录 17000+ MCP 服务器',
    url: 'https://mcp.so',
    type: 'mcp',
    icon: '🔌',
    urlPattern: /^https?:\/\/mcp\.so\/server\/([^/]+)(?:\/([^/]+))?/,
    exampleUrl: 'https://mcp.so/server/filesystem/modelcontextprotocol'
  },
  {
    id: 'smithery-skills',
    name: 'Smithery Skills',
    description: '最大的 Skills 市场，收录 30000+ AI Skills',
    url: 'https://smithery.ai/skills',
    type: 'skills',
    icon: '⚡',
    urlPattern: /^https?:\/\/smithery\.ai\/skills\/([^/]+)\/([^/]+)/,
    exampleUrl: 'https://smithery.ai/skills/anthropics/frontend-design'
  }
]

// 热门 MCP 服务器 (来自 mcp.so)
export const POPULAR_MCP_SERVERS: McpResource[] = [
  // Featured
  {
    id: 'edgeone-pages',
    name: 'EdgeOne Pages MCP',
    description: '部署 HTML 内容到 EdgeOne Pages 并获取公开访问 URL',
    category: 'featured',
    type: 'http',
    author: 'TencentEdgeOne',
    mcpsoUrl: 'https://mcp.so/server/edgeone-pages-mcp/TencentEdgeOne',
    tags: ['deploy', 'hosting', 'html']
  },
  {
    id: 'time',
    name: 'Time',
    description: '时间和时区转换功能，支持 IANA 时区名称',
    category: 'official',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-time'],
    author: 'modelcontextprotocol',
    mcpsoUrl: 'https://mcp.so/server/time/modelcontextprotocol',
    tags: ['time', 'timezone']
  },
  {
    id: 'zhipu-web-search',
    name: 'Zhipu Web Search',
    description: '智谱 AI 网页搜索，集成四大搜索引擎',
    category: 'featured',
    type: 'http',
    author: 'BigModel',
    mcpsoUrl: 'https://mcp.so/server/zhipu-web-search/BigModel',
    tags: ['search', 'web', 'ai']
  },
  {
    id: 'playwright-mcp',
    name: 'Playwright MCP',
    description: 'Microsoft Playwright 浏览器自动化',
    category: 'official',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@anthropic/mcp-server-playwright'],
    author: 'microsoft',
    mcpsoUrl: 'https://mcp.so/server/playwright-mcp/microsoft',
    tags: ['browser', 'automation', 'test']
  },
  {
    id: 'amap-maps',
    name: 'Amap Maps',
    description: '高德地图官方 MCP Server',
    category: 'official',
    type: 'http',
    author: 'amap',
    mcpsoUrl: 'https://mcp.so/server/amap-maps/amap',
    tags: ['map', 'location', 'navigation']
  },
  {
    id: 'baidu-map',
    name: 'Baidu Map',
    description: '百度地图 MCP，国内首家兼容 MCP 协议的地图服务',
    category: 'official',
    type: 'http',
    author: 'baidu-maps',
    mcpsoUrl: 'https://mcp.so/server/baidu-map/baidu-maps',
    tags: ['map', 'location', 'navigation']
  },
  {
    id: 'filesystem',
    name: 'Filesystem',
    description: '安全的文件系统操作，支持可配置的访问控制',
    category: 'official',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/allowed'],
    author: 'modelcontextprotocol',
    mcpsoUrl: 'https://mcp.so/server/filesystem',
    tags: ['file', 'read', 'write']
  },
  {
    id: 'puppeteer',
    name: 'Puppeteer',
    description: '浏览器自动化和网页抓取',
    category: 'official',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@anthropic/mcp-server-puppeteer'],
    author: 'modelcontextprotocol',
    mcpsoUrl: 'https://mcp.so/server/puppeteer/modelcontextprotocol',
    tags: ['browser', 'scrape', 'automation']
  },
  {
    id: 'redis',
    name: 'Redis',
    description: 'Redis 数据库访问，支持键值存储操作',
    category: 'official',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-redis'],
    author: 'modelcontextprotocol',
    mcpsoUrl: 'https://mcp.so/server/redis/modelcontextprotocol',
    tags: ['database', 'cache', 'redis']
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    description: '只读数据库访问，支持 schema 检查',
    category: 'official',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://localhost/mydb'],
    author: 'modelcontextprotocol',
    mcpsoUrl: 'https://mcp.so/server/postgres/modelcontextprotocol',
    tags: ['database', 'sql', 'query']
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    description: 'GitLab API 集成，项目管理',
    category: 'official',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-gitlab'],
    author: 'modelcontextprotocol',
    mcpsoUrl: 'https://mcp.so/server/gitlab/modelcontextprotocol',
    tags: ['git', 'gitlab', 'project']
  },
  {
    id: 'sentry',
    name: 'Sentry',
    description: '错误跟踪和性能监控',
    category: 'official',
    type: 'http',
    url: 'https://mcp.sentry.dev/mcp',
    author: 'modelcontextprotocol',
    mcpsoUrl: 'https://mcp.so/server/sentry/modelcontextprotocol',
    tags: ['error', 'monitoring', 'debug']
  },
  {
    id: 'firecrawl',
    name: 'Firecrawl',
    description: '强大的网页抓取工具，支持 Cursor、Claude 等',
    category: 'community',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@anthropic/mcp-server-firecrawl'],
    author: 'mendableai',
    mcpsoUrl: 'https://mcp.so/server/firecrawl-mcp-server/mendableai',
    tags: ['scrape', 'web', 'crawl']
  },
  {
    id: 'search1api',
    name: 'Search1API',
    description: '一站式搜索、爬取和站点地图 API',
    category: 'hosted',
    type: 'http',
    author: 'search1api',
    mcpsoUrl: 'https://mcp.so/server/search1api',
    tags: ['search', 'crawl', 'api']
  },
  {
    id: 'everart',
    name: 'EverArt',
    description: 'AI 图像生成，支持多种模型',
    category: 'official',
    type: 'http',
    author: 'modelcontextprotocol',
    mcpsoUrl: 'https://mcp.so/server/everart/modelcontextprotocol',
    tags: ['image', 'ai', 'generation']
  }
]

// 热门 Skills (来自 smithery.ai/skills)
export const POPULAR_SKILLS: SkillResource[] = [
  {
    id: 'frontend-design',
    name: 'frontend-design',
    description: '创建独特的生产级前端界面，高设计质量。用于构建 Web 组件、页面或应用程序',
    category: 'Design',
    author: 'anthropics',
    smitheryUrl: 'https://smithery.ai/skills/anthropics/frontend-design',
    usageCount: 47860,
    tags: ['frontend', 'design', 'ui']
  },
  {
    id: 'mcp-integration',
    name: 'mcp-integration',
    description: '集成 MCP 服务器到 Claude Code 插件，支持 SSE、stdio、HTTP、WebSocket',
    category: 'Coding',
    author: 'anthropics',
    smitheryUrl: 'https://smithery.ai/skills/anthropics/mcp-integration',
    usageCount: 47860,
    tags: ['mcp', 'integration', 'plugin']
  },
  {
    id: 'skill-writer',
    name: 'skill-writer',
    description: '指导用户创建 Agent Skills，帮助编写 SKILL.md 文件',
    category: 'Writing',
    author: 'pytorch',
    smitheryUrl: 'https://smithery.ai/skills/pytorch/skill-writer',
    usageCount: 95362,
    tags: ['skill', 'writing', 'guide']
  },
  {
    id: 'skill-development',
    name: 'skill-development',
    description: '创建、改进 Skill，组织 Skill 内容的最佳实践指南',
    category: 'Coding',
    author: 'anthropics',
    smitheryUrl: 'https://smithery.ai/skills/anthropics/skill-development',
    usageCount: 47860,
    tags: ['skill', 'development', 'best-practices']
  },
  {
    id: 'skill-creator',
    name: 'skill-creator',
    description: '创建有效 Skills 的指南，扩展 Claude 能力',
    category: 'Planning',
    author: 'anthropics',
    smitheryUrl: 'https://smithery.ai/skills/anthropics/skill-creator',
    usageCount: 24530,
    tags: ['skill', 'creator', 'guide']
  },
  {
    id: 'prompt-engineering-patterns',
    name: 'prompt-engineering-patterns',
    description: '掌握高级提示工程技术，最大化 LLM 性能和可靠性',
    category: 'Coding',
    author: 'wshobson',
    smitheryUrl: 'https://smithery.ai/skills/wshobson/prompt-engineering-patterns',
    usageCount: 23399,
    tags: ['prompt', 'engineering', 'llm']
  },
  {
    id: 'pptx',
    name: 'pptx',
    description: '演示文稿创建、编辑和分析，支持布局、注释和演讲者备注',
    category: 'Design',
    author: 'anthropics',
    smitheryUrl: 'https://smithery.ai/skills/anthropics/pptx',
    usageCount: 24530,
    tags: ['pptx', 'presentation', 'slides']
  },
  {
    id: 'typescript-write',
    name: 'typescript-write',
    description: '按照 Metabase 编码标准编写 TypeScript 和 JavaScript 代码',
    category: 'Coding',
    author: 'metabase',
    smitheryUrl: 'https://smithery.ai/skills/metabase/typescript-write',
    usageCount: 44733,
    tags: ['typescript', 'javascript', 'coding']
  },
  {
    id: 'pdf',
    name: 'pdf',
    description: '全面的 PDF 操作工具包：提取文本、创建 PDF、合并拆分、处理表单',
    category: 'Coding',
    author: 'anthropics',
    smitheryUrl: 'https://smithery.ai/skills/anthropics/pdf',
    usageCount: 24530,
    tags: ['pdf', 'document', 'extract']
  },
  {
    id: 'docx',
    name: 'docx',
    description: '全面的文档创建、编辑和分析，支持修订、批注、格式保留',
    category: 'Writing',
    author: 'anthropics',
    smitheryUrl: 'https://smithery.ai/skills/anthropics/docx',
    usageCount: 24530,
    tags: ['docx', 'document', 'word']
  },
  {
    id: 'agent-identifier',
    name: 'agent-identifier',
    description: '创建 Agent、子代理的指南，包括系统提示、触发条件等',
    category: 'Coding',
    author: 'anthropics',
    smitheryUrl: 'https://smithery.ai/skills/anthropics/agent-identifier',
    usageCount: 47860,
    tags: ['agent', 'subagent', 'automation']
  },
  {
    id: 'mcp-builder',
    name: 'mcp-builder',
    description: '创建高质量 MCP 服务器的指南，支持 Python (FastMCP) 和 Node/TypeScript',
    category: 'Coding',
    author: 'anthropics',
    smitheryUrl: 'https://smithery.ai/skills/anthropics/mcp-builder',
    usageCount: 24530,
    tags: ['mcp', 'server', 'builder']
  },
  {
    id: 'hook-development',
    name: 'hook-development',
    description: '创建 Claude Code 插件钩子：PreToolUse、PostToolUse、Stop 等事件',
    category: 'Coding',
    author: 'anthropics',
    smitheryUrl: 'https://smithery.ai/skills/anthropics/hook-development',
    usageCount: 47860,
    tags: ['hook', 'plugin', 'event']
  },
  {
    id: 'analyzing-financial-statements',
    name: 'analyzing-financial-statements',
    description: '计算关键财务比率和指标，用于投资分析',
    category: 'Data & Analytics',
    author: 'anthropics',
    smitheryUrl: 'https://smithery.ai/skills/anthropics/analyzing-financial-statements',
    usageCount: 28337,
    tags: ['finance', 'analysis', 'investment']
  },
  {
    id: 'docs-write',
    name: 'docs-write',
    description: '按照 Metabase 风格编写文档：对话式、清晰、以用户为中心',
    category: 'Writing',
    author: 'metabase',
    smitheryUrl: 'https://smithery.ai/skills/metabase/docs-write',
    usageCount: 44733,
    tags: ['docs', 'documentation', 'writing']
  }
]

// Skills 分类
export const SKILL_CATEGORIES = [
  { value: 'all', label: '全部' },
  { value: 'Coding', label: '编程' },
  { value: 'Design', label: '设计' },
  { value: 'Writing', label: '写作' },
  { value: 'Planning', label: '规划' },
  { value: 'Data & Analytics', label: '数据分析' }
]

// MCP 分类
export const MCP_CATEGORIES = [
  { value: 'all', label: '全部' },
  { value: 'featured', label: '精选' },
  { value: 'official', label: '官方' },
  { value: 'community', label: '社区' },
  { value: 'hosted', label: '托管' }
]

// URL 解析函数
export function parseResourceUrl(url: string): { source: MarketplaceSource; params: string[] } | null {
  for (const source of MARKETPLACE_SOURCES) {
    const match = url.match(source.urlPattern)
    if (match) {
      return {
        source,
        params: match.slice(1).filter(Boolean)
      }
    }
  }
  return null
}
