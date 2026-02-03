import fs from 'fs'
import path from 'path'

export interface Prompt {
  name: string
  description: string
  content: string
  path: string
  category?: string
  variables?: string[]
  linkedResources?: string[]
}

interface PromptFrontmatter {
  name: string
  description?: string
  category?: string
  variables?: string[]
  linkedResources?: string[]
  [key: string]: unknown
}

const PROMPTS_PATH = 'D:\\work\\AI\\prompt'

function parseFrontmatter(content: string): { frontmatter: PromptFrontmatter | null; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) return { frontmatter: null, body: content }
  
  try {
    const yamlStr = match[1]
    const body = match[2]
    const frontmatter: PromptFrontmatter = { name: '' }
    
    yamlStr.split('\n').forEach(line => {
      const colonIdx = line.indexOf(':')
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim()
        let value: unknown = line.slice(colonIdx + 1).trim()
        
        if (key === 'variables' || key === 'linkedResources') {
          value = (value as string).split(',').map(v => v.trim()).filter(Boolean)
        }
        frontmatter[key] = value
      }
    })
    
    return { frontmatter, body }
  } catch {
    return { frontmatter: null, body: content }
  }
}

function extractVariables(content: string): string[] {
  const matches = content.match(/\{\{(\w+)\}\}/g) || []
  return [...new Set(matches.map(m => m.slice(2, -2)))]
}

function scanPromptsDir(): Prompt[] {
  const prompts: Prompt[] = []
  
  if (!fs.existsSync(PROMPTS_PATH)) {
    fs.mkdirSync(PROMPTS_PATH, { recursive: true })
    return prompts
  }
  
  try {
    const entries = fs.readdirSync(PROMPTS_PATH, { withFileTypes: true })
    
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      
      const promptDir = path.join(PROMPTS_PATH, entry.name)
      const promptMdPath = path.join(promptDir, 'PROMPT.md')
      
      if (!fs.existsSync(promptMdPath)) continue
      
      const content = fs.readFileSync(promptMdPath, 'utf-8')
      const { frontmatter, body } = parseFrontmatter(content)
      
      prompts.push({
        name: frontmatter?.name || entry.name,
        description: (frontmatter?.description as string) || '',
        content: body,
        path: promptDir,
        category: frontmatter?.category as string,
        variables: frontmatter?.variables as string[] || extractVariables(body),
        linkedResources: frontmatter?.linkedResources as string[]
      })
    }
  } catch (e) {
    console.error('扫描 prompts 目录失败:', e)
  }
  
  return prompts
}

export function getPrompts(): Prompt[] {
  return scanPromptsDir()
}

export function getPrompt(promptPath: string): Prompt | null {
  const promptMdPath = path.join(promptPath, 'PROMPT.md')
  
  if (!fs.existsSync(promptMdPath)) return null
  
  const content = fs.readFileSync(promptMdPath, 'utf-8')
  const { frontmatter, body } = parseFrontmatter(content)
  
  return {
    name: frontmatter?.name || path.basename(promptPath),
    description: (frontmatter?.description as string) || '',
    content: body,
    path: promptPath,
    category: frontmatter?.category as string,
    variables: frontmatter?.variables as string[] || extractVariables(body),
    linkedResources: frontmatter?.linkedResources as string[]
  }
}

export function createPrompt(
  name: string,
  content: string,
  description: string = '',
  category: string = 'template',
  linkedResources: string[] = []
): { success: boolean; path?: string; error?: string } {
  try {
    const safeName = name.replace(/[<>:"/\\|?*]/g, '-')
    const promptDir = path.join(PROMPTS_PATH, safeName)
    
    if (fs.existsSync(promptDir)) {
      return { success: false, error: '同名 Prompt 已存在' }
    }
    
    fs.mkdirSync(promptDir, { recursive: true })
    
    const variables = extractVariables(content)
    const frontmatter = [
      '---',
      `name: ${name}`,
      `description: ${description}`,
      `category: ${category}`,
      variables.length > 0 ? `variables: ${variables.join(', ')}` : null,
      linkedResources.length > 0 ? `linkedResources: ${linkedResources.join(', ')}` : null,
      '---'
    ].filter(Boolean).join('\n')
    
    const fullContent = `${frontmatter}\n${content}`
    fs.writeFileSync(path.join(promptDir, 'PROMPT.md'), fullContent, 'utf-8')
    
    return { success: true, path: promptDir }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export function updatePrompt(
  promptPath: string,
  content: string,
  description: string = '',
  category: string = 'template',
  linkedResources: string[] = []
): { success: boolean; error?: string } {
  try {
    const promptMdPath = path.join(promptPath, 'PROMPT.md')
    if (!fs.existsSync(promptMdPath)) {
      return { success: false, error: 'Prompt 不存在' }
    }
    
    const name = path.basename(promptPath)
    const variables = extractVariables(content)
    const frontmatter = [
      '---',
      `name: ${name}`,
      `description: ${description}`,
      `category: ${category}`,
      variables.length > 0 ? `variables: ${variables.join(', ')}` : null,
      linkedResources.length > 0 ? `linkedResources: ${linkedResources.join(', ')}` : null,
      '---'
    ].filter(Boolean).join('\n')
    
    const fullContent = `${frontmatter}\n${content}`
    fs.writeFileSync(promptMdPath, fullContent, 'utf-8')
    
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export function deletePrompt(promptPath: string): { success: boolean; error?: string } {
  try {
    if (!fs.existsSync(promptPath)) {
      return { success: false, error: 'Prompt 不存在' }
    }
    
    fs.rmSync(promptPath, { recursive: true })
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export function getPromptsPath(): string {
  return PROMPTS_PATH
}

export function getPromptsCount(): number {
  return scanPromptsDir().length
}
