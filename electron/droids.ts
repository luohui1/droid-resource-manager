import fs from 'fs'
import path from 'path'
import os from 'os'

// Droid 工具类别
export const TOOL_CATEGORIES = {
  'read-only': ['Read', 'LS', 'Grep', 'Glob'],
  'all': [
    'Read', 'LS', 'Grep', 'Glob',
    'Create', 'Edit', 'ApplyPatch',
    'Execute',
    'WebSearch', 'FetchUrl',
    'TodoWrite'
  ],
  'edit': ['Create', 'Edit', 'ApplyPatch'],
  'execute': ['Execute'],
  'web': ['WebSearch', 'FetchUrl'],
} as const

export type ToolCategory = keyof typeof TOOL_CATEGORIES

// 所有可用工具
export const ALL_TOOLS = [
  'Read', 'LS', 'Grep', 'Glob',
  'Create', 'Edit', 'ApplyPatch',
  'Execute',
  'WebSearch', 'FetchUrl',
  'TodoWrite'
] as const

export type ToolName = typeof ALL_TOOLS[number]

export interface Droid {
  name: string
  description: string
  model: string  // 'inherit' 或具体模型ID
  reasoningEffort?: 'low' | 'medium' | 'high'
  tools: string[] | ToolCategory  // 工具数组或类别
  systemPrompt: string  // 系统提示词（body 部分）
  content: string  // 完整文件内容
  path: string  // 文件路径
  scope: 'global' | 'project'
  projectPath?: string
  // 扩展配置（存储在单独的 JSON 文件中）
  config?: DroidConfig
  aiSummary?: string
}

// 扩展配置 - 与 Skills/MCP 的关联
export interface DroidConfig {
  // 关联的 Skills
  linkedSkills?: {
    required?: string[]  // 必须使用的 Skills
    allowed?: string[]   // 允许使用的 Skills
  }
  // 关联的 MCP 服务器
  linkedMcp?: {
    required?: string[]  // 必须使用的 MCP
    allowed?: string[]   // 允许使用的 MCP
  }
  // 工具权限细化
  toolPermissions?: {
    required?: string[]  // 必须使用的工具
    denied?: string[]    // 禁止使用的工具
  }
}

interface DroidFrontmatter {
  name: string
  description?: string
  model?: string
  reasoningEffort?: string
  tools?: string | string[]
  [key: string]: unknown
}

const GLOBAL_DROIDS_PATH = path.join(os.homedir(), '.factory', 'droids')
const CONFIG_DIR = path.join(os.homedir(), '.factory', 'droid-configs')
const DROID_SCAN_SKIP_DIRS = new Set(['node_modules', 'dist', 'dist-electron', 'release', '.git'])

// 解析 YAML frontmatter
function parseFrontmatter(content: string): { frontmatter: DroidFrontmatter | null; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) return { frontmatter: null, body: content }
  
  try {
    const yamlStr = match[1]
    const body = match[2]
    const frontmatter: DroidFrontmatter = { name: '' }
    
    let currentKey = ''
    let inArray = false
    const arrayItems: string[] = []
    
    yamlStr.split('\n').forEach(line => {
      const trimmed = line.trim()
      
      // 处理数组项
      if (inArray && trimmed.startsWith('- ')) {
        arrayItems.push(trimmed.slice(2).trim().replace(/^["']|["']$/g, ''))
        return
      } else if (inArray && !trimmed.startsWith('- ') && trimmed) {
        frontmatter[currentKey] = arrayItems.length > 0 ? [...arrayItems] : []
        inArray = false
        arrayItems.length = 0
      }
      
      const colonIdx = line.indexOf(':')
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim()
        const value = line.slice(colonIdx + 1).trim()
        
        if (!value) {
          // 可能是数组开始
          currentKey = key
          inArray = true
          arrayItems.length = 0
        } else if (value.startsWith('[') && value.endsWith(']')) {
          // 内联数组 ["a", "b"]
          const items = value.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''))
          frontmatter[key] = items.filter(Boolean)
        } else {
          frontmatter[key] = value.replace(/^["']|["']$/g, '')
        }
      }
    })
    
    // 处理最后的数组
    if (inArray && arrayItems.length > 0) {
      frontmatter[currentKey] = [...arrayItems]
    }
    
    return { frontmatter, body }
  } catch {
    return { frontmatter: null, body: content }
  }
}

// 生成 frontmatter YAML
function generateFrontmatter(droid: Partial<Droid>): string {
  const lines = ['---']
  
  if (droid.name) lines.push(`name: ${droid.name}`)
  if (droid.description) lines.push(`description: ${droid.description}`)
  if (droid.model) lines.push(`model: ${droid.model}`)
  if (droid.reasoningEffort) lines.push(`reasoningEffort: ${droid.reasoningEffort}`)
  
  if (droid.tools) {
    if (typeof droid.tools === 'string') {
      lines.push(`tools: ${droid.tools}`)
    } else if (Array.isArray(droid.tools)) {
      lines.push(`tools: [${droid.tools.map(t => `"${t}"`).join(', ')}]`)
    }
  }
  
  lines.push('---')
  return lines.join('\n')
}

// 加载 Droid 扩展配置
function loadDroidConfig(droidName: string): DroidConfig | undefined {
  try {
    const configPath = path.join(CONFIG_DIR, `${droidName}.json`)
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    }
  } catch (e) {
    console.error(`加载 Droid 配置失败 [${droidName}]:`, e)
  }
  return undefined
}

// 保存 Droid 扩展配置
export function saveDroidConfig(droidName: string, config: DroidConfig): { success: boolean; error?: string } {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true })
    }
    const configPath = path.join(CONFIG_DIR, `${droidName}.json`)
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// 移动 Droid 到目标位置（文件）
export function moveDroid(
  sourcePath: string,
  targetScope: 'global' | 'project',
  targetProjectPath?: string
): { success: boolean; path?: string; error?: string } {
  try {
    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: '源 Droid 不存在' }
    }

    const targetBaseDir = targetScope === 'global'
      ? GLOBAL_DROIDS_PATH
      : path.join(targetProjectPath!, '.factory', 'droids')
    const fileName = path.basename(sourcePath)
    const targetPath = path.join(targetBaseDir, fileName)

    if (fs.existsSync(targetPath)) {
      return { success: false, error: `目标位置已存在同名 Droid: ${fileName}` }
    }

    fs.mkdirSync(targetBaseDir, { recursive: true })

    let droidName: string | null = null
    try {
      const content = fs.readFileSync(sourcePath, 'utf-8')
      const { frontmatter } = parseFrontmatter(content)
      droidName = frontmatter?.name || null
    } catch {
      droidName = null
    }

    try {
      fs.renameSync(sourcePath, targetPath)
    } catch (e) {
      const err = e as NodeJS.ErrnoException
      if (err.code !== 'EXDEV') {
        throw e
      }
      fs.copyFileSync(sourcePath, targetPath)
      fs.rmSync(sourcePath, { force: true })
    }

    if (droidName) {
      const sourceSummary = path.join(path.dirname(sourcePath), `${droidName}.summary.md`)
      const targetSummary = path.join(targetBaseDir, `${droidName}.summary.md`)
      if (fs.existsSync(sourceSummary)) {
        fs.rmSync(targetSummary, { force: true })
        try {
          fs.renameSync(sourceSummary, targetSummary)
        } catch (e) {
          const err = e as NodeJS.ErrnoException
          if (err.code === 'EXDEV') {
            fs.copyFileSync(sourceSummary, targetSummary)
            fs.rmSync(sourceSummary, { force: true })
          } else {
            throw e
          }
        }
      }
    }

    return { success: true, path: targetPath }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// 扫描目录下的 Droids
function scanDroidsDir(droidsDir: string, scope: 'global' | 'project', projectPath?: string): Droid[] {
  const droids: Droid[] = []
  
  if (!fs.existsSync(droidsDir)) return droids
  
  try {
    const entries = fs.readdirSync(droidsDir, { withFileTypes: true })
    const droidFiles: string[] = []

    for (const entry of entries) {
      const entryPath = path.join(droidsDir, entry.name)
      if (entry.isFile() && entry.name.endsWith('.md')) {
        droidFiles.push(entryPath)
        continue
      }
      if (entry.isDirectory()) {
        const nestedEntries = fs.readdirSync(entryPath, { withFileTypes: true })
        for (const nested of nestedEntries) {
          if (nested.isFile() && nested.name.endsWith('.md')) {
            droidFiles.push(path.join(entryPath, nested.name))
          }
        }
      }
    }

    for (const filePath of droidFiles) {
      const content = fs.readFileSync(filePath, 'utf-8')
      const { frontmatter, body } = parseFrontmatter(content)
      
      if (!frontmatter?.name) continue
      
      // 解析 tools
      let tools: string[] | ToolCategory = []
      if (frontmatter.tools) {
        if (typeof frontmatter.tools === 'string') {
          if (frontmatter.tools in TOOL_CATEGORIES) {
            tools = frontmatter.tools as ToolCategory
          } else {
            tools = [frontmatter.tools]
          }
        } else if (Array.isArray(frontmatter.tools)) {
          tools = frontmatter.tools as string[]
        }
      }
      
      // 加载扩展配置
      const config = loadDroidConfig(frontmatter.name)
      
      // 加载 AI 解读
      const summaryPath = path.join(path.dirname(filePath), `${frontmatter.name}.summary.md`)
      const aiSummary = fs.existsSync(summaryPath) 
        ? fs.readFileSync(summaryPath, 'utf-8') 
        : undefined
      
      droids.push({
        name: frontmatter.name,
        description: (frontmatter.description as string) || '',
        model: (frontmatter.model as string) || 'inherit',
        reasoningEffort: frontmatter.reasoningEffort as Droid['reasoningEffort'],
        tools,
        systemPrompt: body.trim(),
        content,
        path: filePath,
        scope,
        projectPath,
        config,
        aiSummary
      })
    }
  } catch (e) {
    console.error('扫描 droids 目录失败:', e)
  }
  
  return droids
}

// 获取全局 Droids
export function getGlobalDroids(): Droid[] {
  return scanDroidsDir(GLOBAL_DROIDS_PATH, 'global')
}

// 获取项目 Droids
export function getProjectDroids(projectPath: string): Droid[] {
  const droidsDir = path.join(projectPath, '.factory', 'droids')
  return scanDroidsDir(droidsDir, 'project', projectPath)
}

export function discoverDroidProjects(rootPath: string, maxDepth = 4): string[] {
  const results = new Set<string>()

  const walk = (dir: string, depth: number) => {
    if (depth > maxDepth) return
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }

    const factoryDroidsPath = path.join(dir, '.factory', 'droids')
    try {
      if (fs.existsSync(factoryDroidsPath) && fs.statSync(factoryDroidsPath).isDirectory()) {
        results.add(dir)
      }
    } catch {
      return
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (DROID_SCAN_SKIP_DIRS.has(entry.name)) continue
      if (entry.name === '.factory') continue
      walk(path.join(dir, entry.name), depth + 1)
    }
  }

  walk(rootPath, 0)
  return Array.from(results)
}

// 获取单个 Droid
export function getDroid(droidPath: string): Droid | null {
  if (!fs.existsSync(droidPath)) return null
  
  const content = fs.readFileSync(droidPath, 'utf-8')
  const { frontmatter, body } = parseFrontmatter(content)
  
  if (!frontmatter?.name) return null
  
  let tools: string[] | ToolCategory = []
  if (frontmatter.tools) {
    if (typeof frontmatter.tools === 'string') {
      if (frontmatter.tools in TOOL_CATEGORIES) {
        tools = frontmatter.tools as ToolCategory
      } else {
        tools = [frontmatter.tools]
      }
    } else if (Array.isArray(frontmatter.tools)) {
      tools = frontmatter.tools as string[]
    }
  }
  
  const isGlobal = droidPath.startsWith(GLOBAL_DROIDS_PATH)
  const config = loadDroidConfig(frontmatter.name)
  
  const dir = path.dirname(droidPath)
  const summaryPath = path.join(dir, `${frontmatter.name}.summary.md`)
  const aiSummary = fs.existsSync(summaryPath) 
    ? fs.readFileSync(summaryPath, 'utf-8') 
    : undefined
  
  return {
    name: frontmatter.name,
    description: (frontmatter.description as string) || '',
    model: (frontmatter.model as string) || 'inherit',
    reasoningEffort: frontmatter.reasoningEffort as Droid['reasoningEffort'],
    tools,
    systemPrompt: body.trim(),
    content,
    path: droidPath,
    scope: isGlobal ? 'global' : 'project',
    config,
    aiSummary
  }
}

// 创建 Droid
export function createDroid(
  data: {
    name: string
    description?: string
    model?: string
    reasoningEffort?: string
    tools?: string[] | string
    systemPrompt: string
  },
  scope: 'global' | 'project',
  projectPath?: string
): { success: boolean; path?: string; error?: string } {
  try {
    // 规范化名称
    const normalizedName = data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '')
    
    const baseDir = scope === 'global' 
      ? GLOBAL_DROIDS_PATH 
      : path.join(projectPath!, '.factory', 'droids')
    
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true })
    }
    
    const filePath = path.join(baseDir, `${normalizedName}.md`)
    
    if (fs.existsSync(filePath)) {
      return { success: false, error: '同名 Droid 已存在' }
    }
    
    // 生成文件内容
    const frontmatter = generateFrontmatter({
      name: normalizedName,
      description: data.description,
      model: data.model || 'inherit',
      reasoningEffort: data.reasoningEffort as Droid['reasoningEffort'],
      tools: data.tools
    })
    
    const content = `${frontmatter}\n\n${data.systemPrompt}`
    fs.writeFileSync(filePath, content, 'utf-8')
    
    return { success: true, path: filePath }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// 更新 Droid
export function updateDroid(
  droidPath: string,
  data: {
    name?: string
    description?: string
    model?: string
    reasoningEffort?: string
    tools?: string[] | string
    systemPrompt?: string
  }
): { success: boolean; error?: string } {
  try {
    const existing = getDroid(droidPath)
    if (!existing) {
      return { success: false, error: 'Droid 不存在' }
    }
    
    const updated = {
      name: data.name || existing.name,
      description: data.description ?? existing.description,
      model: data.model || existing.model,
      reasoningEffort: (data.reasoningEffort as Droid['reasoningEffort']) || existing.reasoningEffort,
      tools: data.tools ?? existing.tools,
      systemPrompt: data.systemPrompt ?? existing.systemPrompt
    }
    
    const frontmatter = generateFrontmatter(updated)
    const content = `${frontmatter}\n\n${updated.systemPrompt}`
    
    fs.writeFileSync(droidPath, content, 'utf-8')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// 删除 Droid
export function deleteDroid(droidPath: string): { success: boolean; error?: string } {
  try {
    if (fs.existsSync(droidPath)) {
      // 获取 droid 名称以删除相关配置
      const droid = getDroid(droidPath)
      fs.unlinkSync(droidPath)
      
      // 删除扩展配置
      if (droid?.name) {
        const configPath = path.join(CONFIG_DIR, `${droid.name}.json`)
        if (fs.existsSync(configPath)) {
          fs.unlinkSync(configPath)
        }
        // 删除 AI 解读
        const summaryPath = path.join(path.dirname(droidPath), `${droid.name}.summary.md`)
        if (fs.existsSync(summaryPath)) {
          fs.unlinkSync(summaryPath)
        }
      }
    }
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// 获取全局 Droids 路径
export function getGlobalDroidsPath(): string {
  return GLOBAL_DROIDS_PATH
}

// 保存 AI 解读
export function saveAiSummary(droidPath: string, droidName: string, summary: string): { success: boolean; error?: string } {
  try {
    const dir = path.dirname(droidPath)
    const summaryPath = path.join(dir, `${droidName}.summary.md`)
    fs.writeFileSync(summaryPath, summary, 'utf-8')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// 获取工具类别展开后的工具列表
export function expandToolCategory(category: ToolCategory): string[] {
  return [...TOOL_CATEGORIES[category]]
}

// 获取所有工具列表
export function getAllTools(): string[] {
  return [...ALL_TOOLS]
}

// 获取工具类别
export function getToolCategories(): Record<string, string[]> {
  return { ...TOOL_CATEGORIES }
}

// 复制 Droid 到目标位置
export function copyDroid(
  sourcePath: string,
  targetScope: 'global' | 'project',
  targetProjectPath?: string
): { success: boolean; path?: string; error?: string } {
  try {
    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: '源 Droid 不存在' }
    }

    const fileName = path.basename(sourcePath)
    const droidName = fileName.replace('.md', '')
    const targetBaseDir = targetScope === 'global'
      ? GLOBAL_DROIDS_PATH
      : path.join(targetProjectPath!, '.factory', 'droids')
    
    const targetPath = path.join(targetBaseDir, fileName)

    if (fs.existsSync(targetPath)) {
      return { success: false, error: `目标位置已存在同名 Droid: ${droidName}` }
    }

    // 确保目标目录存在
    fs.mkdirSync(targetBaseDir, { recursive: true })

    // 复制 Droid 文件
    fs.copyFileSync(sourcePath, targetPath)

    // 复制 AI 解读文件（如果存在）
    const sourceDir = path.dirname(sourcePath)
    const summaryPath = path.join(sourceDir, `${droidName}.summary.md`)
    if (fs.existsSync(summaryPath)) {
      fs.copyFileSync(summaryPath, path.join(targetBaseDir, `${droidName}.summary.md`))
    }

    return { success: true, path: targetPath }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
