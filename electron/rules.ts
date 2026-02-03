import fs from 'fs'
import path from 'path'
import os from 'os'

export interface Rule {
  name: string
  description: string
  content: string
  path: string
  scope: 'global' | 'project'
  projectPath?: string
  category?: string
  priority?: number
  globs?: string[]
  linkedResources?: string[]
}

interface RuleFrontmatter {
  name: string
  description?: string
  category?: string
  priority?: number
  globs?: string[]
  linkedResources?: string[]
  [key: string]: unknown
}

const GLOBAL_RULES_PATH = path.join(os.homedir(), '.factory', 'rules')

function parseFrontmatter(content: string): { frontmatter: RuleFrontmatter | null; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) return { frontmatter: null, body: content }
  
  try {
    const yamlStr = match[1]
    const body = match[2]
    const frontmatter: RuleFrontmatter = { name: '' }
    
    yamlStr.split('\n').forEach(line => {
      const colonIdx = line.indexOf(':')
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim()
        let value: unknown = line.slice(colonIdx + 1).trim()
        
        if (key === 'globs' || key === 'linkedResources') {
          value = (value as string).split(',').map(v => v.trim()).filter(Boolean)
        } else if (key === 'priority') {
          value = parseInt(value as string) || 0
        }
        frontmatter[key] = value
      }
    })
    
    return { frontmatter, body }
  } catch {
    return { frontmatter: null, body: content }
  }
}

function scanRulesDir(rulesDir: string, scope: 'global' | 'project', projectPath?: string): Rule[] {
  const rules: Rule[] = []
  
  if (!fs.existsSync(rulesDir)) {
    if (scope === 'global') {
      fs.mkdirSync(rulesDir, { recursive: true })
    }
    return rules
  }
  
  try {
    const entries = fs.readdirSync(rulesDir, { withFileTypes: true })
    
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      
      const ruleDir = path.join(rulesDir, entry.name)
      const ruleMdPath = path.join(ruleDir, 'RULE.md')
      
      if (!fs.existsSync(ruleMdPath)) continue
      
      const content = fs.readFileSync(ruleMdPath, 'utf-8')
      const { frontmatter, body } = parseFrontmatter(content)
      
      rules.push({
        name: frontmatter?.name || entry.name,
        description: (frontmatter?.description as string) || '',
        content: body,
        path: ruleDir,
        scope,
        projectPath,
        category: frontmatter?.category as string,
        priority: frontmatter?.priority as number,
        globs: frontmatter?.globs as string[],
        linkedResources: frontmatter?.linkedResources as string[]
      })
    }
  } catch (e) {
    console.error('扫描 rules 目录失败:', e)
  }
  
  return rules
}

export function getGlobalRules(): Rule[] {
  return scanRulesDir(GLOBAL_RULES_PATH, 'global')
}

export function getProjectRules(projectPath: string): Rule[] {
  const rulesDir = path.join(projectPath, '.factory', 'rules')
  return scanRulesDir(rulesDir, 'project', projectPath)
}

export function getRule(rulePath: string): Rule | null {
  const ruleMdPath = path.join(rulePath, 'RULE.md')
  
  if (!fs.existsSync(ruleMdPath)) return null
  
  const content = fs.readFileSync(ruleMdPath, 'utf-8')
  const { frontmatter, body } = parseFrontmatter(content)
  
  const isGlobal = rulePath.startsWith(GLOBAL_RULES_PATH)
  
  return {
    name: frontmatter?.name || path.basename(rulePath),
    description: (frontmatter?.description as string) || '',
    content: body,
    path: rulePath,
    scope: isGlobal ? 'global' : 'project',
    category: frontmatter?.category as string,
    priority: frontmatter?.priority as number,
    globs: frontmatter?.globs as string[],
    linkedResources: frontmatter?.linkedResources as string[]
  }
}

export function createRule(
  name: string,
  content: string,
  scope: 'global' | 'project',
  projectPath?: string,
  description: string = '',
  category: string = 'coding-style',
  priority: number = 0,
  globs: string[] = [],
  linkedResources: string[] = []
): { success: boolean; path?: string; error?: string } {
  try {
    const safeName = name.replace(/[<>:"/\\|?*]/g, '-')
    const baseDir = scope === 'global' 
      ? GLOBAL_RULES_PATH 
      : path.join(projectPath!, '.factory', 'rules')
    const ruleDir = path.join(baseDir, safeName)
    
    if (fs.existsSync(ruleDir)) {
      return { success: false, error: '同名 Rule 已存在' }
    }
    
    fs.mkdirSync(ruleDir, { recursive: true })
    
    const frontmatter = [
      '---',
      `name: ${name}`,
      `description: ${description}`,
      `category: ${category}`,
      `priority: ${priority}`,
      globs.length > 0 ? `globs: ${globs.join(', ')}` : null,
      linkedResources.length > 0 ? `linkedResources: ${linkedResources.join(', ')}` : null,
      '---'
    ].filter(Boolean).join('\n')
    
    const fullContent = `${frontmatter}\n${content}`
    fs.writeFileSync(path.join(ruleDir, 'RULE.md'), fullContent, 'utf-8')
    
    return { success: true, path: ruleDir }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export function updateRule(
  rulePath: string,
  content: string,
  description: string = '',
  category: string = 'coding-style',
  priority: number = 0,
  globs: string[] = [],
  linkedResources: string[] = []
): { success: boolean; error?: string } {
  try {
    const ruleMdPath = path.join(rulePath, 'RULE.md')
    if (!fs.existsSync(ruleMdPath)) {
      return { success: false, error: 'Rule 不存在' }
    }
    
    const name = path.basename(rulePath)
    const frontmatter = [
      '---',
      `name: ${name}`,
      `description: ${description}`,
      `category: ${category}`,
      `priority: ${priority}`,
      globs.length > 0 ? `globs: ${globs.join(', ')}` : null,
      linkedResources.length > 0 ? `linkedResources: ${linkedResources.join(', ')}` : null,
      '---'
    ].filter(Boolean).join('\n')
    
    const fullContent = `${frontmatter}\n${content}`
    fs.writeFileSync(ruleMdPath, fullContent, 'utf-8')
    
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export function deleteRule(rulePath: string): { success: boolean; error?: string } {
  try {
    if (!fs.existsSync(rulePath)) {
      return { success: false, error: 'Rule 不存在' }
    }
    
    fs.rmSync(rulePath, { recursive: true })
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export function getGlobalRulesPath(): string {
  return GLOBAL_RULES_PATH
}

export function getGlobalRulesCount(): number {
  return getGlobalRules().length
}

// 复制 Rule 到目标位置（整个文件夹）
export function copyRule(
  sourcePath: string,
  targetScope: 'global' | 'project',
  targetProjectPath?: string
): { success: boolean; path?: string; error?: string } {
  try {
    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: '源 Rule 不存在' }
    }

    const ruleName = path.basename(sourcePath)
    const targetBaseDir = targetScope === 'global'
      ? GLOBAL_RULES_PATH
      : path.join(targetProjectPath!, '.factory', 'rules')
    
    const targetPath = path.join(targetBaseDir, ruleName)

    if (fs.existsSync(targetPath)) {
      return { success: false, error: `目标位置已存在同名 Rule: ${ruleName}` }
    }

    // 确保目标目录存在
    fs.mkdirSync(targetBaseDir, { recursive: true })

    // 递归复制整个文件夹
    copyDirRecursive(sourcePath, targetPath)

    return { success: true, path: targetPath }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// 递归复制目录
function copyDirRecursive(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true })
  const entries = fs.readdirSync(src, { withFileTypes: true })
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}
