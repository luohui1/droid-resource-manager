import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'
import path from 'path'
import { Storage } from './storage'
import type { Droid, CreateDroidDto } from './types'

export class DroidManager {
  private storage: Storage

  constructor(storage: Storage) {
    this.storage = storage
  }

  // 获取项目的所有 Droid（包括 UI 创建的 + 从 .factory 导入的）
  getProjectDroids(projectId: string, projectPath: string): Droid[] {
    const createdDroids = this.storage.getDroids().filter(d => d.projectId === projectId)
    const importedDroids = this.scanProjectDroids(projectId, projectPath)
    
    // 合并，避免重复（以 sourcePath 为准）
    const allDroids = [...createdDroids]
    for (const imported of importedDroids) {
      const exists = allDroids.some(d => d.sourcePath === imported.sourcePath)
      if (!exists) {
        allDroids.push(imported)
      }
    }
    
    return allDroids
  }

  // 扫描项目 .factory/droids 目录
  private scanProjectDroids(projectId: string, projectPath: string): Droid[] {
    const droidsDir = path.join(projectPath, '.factory', 'droids')
    const droids: Droid[] = []

    if (!fs.existsSync(droidsDir)) {
      return droids
    }

    try {
      const files = fs.readdirSync(droidsDir).filter(f => f.endsWith('.md'))
      
      for (const file of files) {
        const filePath = path.join(droidsDir, file)
        const content = fs.readFileSync(filePath, 'utf-8')
        const parsed = this.parseDroidFile(content, filePath)
        
        if (parsed) {
          droids.push({
            id: `imported:${projectId}:${file}`,
            name: parsed.name || file.replace('.md', ''),
            description: parsed.description,
            role: file === 'main.md' ? 'main' : 'sub',
            systemPrompt: parsed.systemPrompt,
            model: parsed.model,
            tools: parsed.tools,
            source: 'imported',
            sourcePath: filePath,
            projectId,
            createdAt: Date.now(),
            updatedAt: Date.now()
          })
        }
      }
    } catch (e) {
      console.error('扫描项目 Droids 失败:', e)
    }

    return droids
  }

  // 解析 Droid markdown 文件
  private parseDroidFile(content: string, _filePath: string): {
    name?: string
    description?: string
    systemPrompt: string
    model?: string
    tools?: { enabled?: string[]; disabled?: string[] }
  } | null {
    try {
      // 解析 frontmatter
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
      const frontmatter: Record<string, unknown> = {}
      let body = content

      if (frontmatterMatch) {
        body = content.slice(frontmatterMatch[0].length).trim()
        const yamlContent = frontmatterMatch[1]
        
        // 简单解析 YAML
        for (const line of yamlContent.split('\n')) {
          const colonIndex = line.indexOf(':')
          if (colonIndex > 0) {
            const key = line.slice(0, colonIndex).trim()
            let value: unknown = line.slice(colonIndex + 1).trim()
            
            // 处理数组
            if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
              value = value.slice(1, -1).split(',').map(s => s.trim().replace(/['"]/g, ''))
            }
            // 处理引号
            if (typeof value === 'string') {
              value = value.replace(/^['"]|['"]$/g, '')
            }
            
            frontmatter[key] = value
          }
        }
      }

      // 解析 tools
      let tools: { enabled?: string[]; disabled?: string[] } | undefined
      const toolsValue = frontmatter.tools
      if (toolsValue) {
        if (Array.isArray(toolsValue)) {
          tools = { enabled: toolsValue as string[] }
        } else if (typeof toolsValue === 'string') {
          tools = { enabled: [toolsValue] }
        }
      }

      return {
        name: frontmatter.name as string | undefined,
        description: frontmatter.description as string | undefined,
        systemPrompt: body,
        model: frontmatter.model as string | undefined,
        tools
      }
    } catch (e) {
      console.error('解析 Droid 文件失败:', e)
      return null
    }
  }

  // 创建 Droid
  createDroid(dto: CreateDroidDto): Droid {
    const droid: Droid = {
      id: uuidv4(),
      name: dto.name,
      description: dto.description,
      role: dto.role,
      systemPrompt: dto.systemPrompt,
      model: dto.model,
      autoLevel: dto.autoLevel,
      tools: dto.tools,
      subDroidIds: dto.subDroidIds,
      source: 'created',
      projectId: dto.projectId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    const droids = this.storage.getDroids()
    droids.push(droid)
    this.storage.saveDroids(droids)

    return droid
  }

  // 更新 Droid
  updateDroid(id: string, updates: Partial<CreateDroidDto>): Droid | null {
    const droids = this.storage.getDroids()
    const index = droids.findIndex(d => d.id === id)
    
    if (index === -1) return null

    droids[index] = {
      ...droids[index],
      ...updates,
      updatedAt: Date.now()
    }

    this.storage.saveDroids(droids)
    return droids[index]
  }

  // 删除 Droid
  deleteDroid(id: string): boolean {
    const droids = this.storage.getDroids()
    const filtered = droids.filter(d => d.id !== id)
    
    if (filtered.length === droids.length) return false
    
    this.storage.saveDroids(filtered)
    return true
  }

  // 获取单个 Droid
  getDroid(id: string): Droid | undefined {
    return this.storage.getDroids().find(d => d.id === id)
  }

  // 导出 Droid 到 .factory/droids 目录
  exportDroid(droid: Droid, projectPath: string): { success: boolean; path?: string; error?: string } {
    try {
      const droidsDir = path.join(projectPath, '.factory', 'droids')
      
      if (!fs.existsSync(droidsDir)) {
        fs.mkdirSync(droidsDir, { recursive: true })
      }

      const fileName = `${droid.name.toLowerCase().replace(/\s+/g, '-')}.md`
      const filePath = path.join(droidsDir, fileName)

      // 构建 frontmatter
      const frontmatter: string[] = ['---']
      frontmatter.push(`name: ${droid.name}`)
      if (droid.description) frontmatter.push(`description: ${droid.description}`)
      if (droid.model) frontmatter.push(`model: ${droid.model}`)
      if (droid.tools?.enabled?.length) {
        frontmatter.push(`tools: [${droid.tools.enabled.join(', ')}]`)
      }
      frontmatter.push('---')

      const content = `${frontmatter.join('\n')}\n\n${droid.systemPrompt}`
      fs.writeFileSync(filePath, content, 'utf-8')

      return { success: true, path: filePath }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }

  // 生成主 Droid 的默认系统提示词
  generateMainDroidPrompt(projectName: string, subDroids: Droid[]): string {
    const subDroidList = subDroids
      .map(d => `- **${d.name}**: ${d.description || '无描述'}`)
      .join('\n')

    return `你是 ${projectName} 项目的主调度 Droid。

## 职责
1. 分析用户的任务需求
2. 将任务拆分为子任务
3. 选择合适的子 Droid 执行
4. 汇总执行结果

## 可用的子 Droids
${subDroidList || '暂无子 Droid'}

## 工作流程
1. 理解用户需求
2. 分析任务类型和复杂度
3. 选择最合适的子 Droid（可以是多个并行或串行）
4. 生成子任务的具体 prompt
5. 监控执行进度
6. 汇总结果并反馈给用户

请根据用户的输入，决定如何分配任务。`
  }
}
