import fs from 'fs'
import path from 'path'
import os from 'os'
import { execSync } from 'child_process'

export interface Skill {
  name: string
  description: string
  content: string
  path: string
  scope: 'global' | 'project'
  projectPath?: string
  files: string[]
  aiSummary?: string  // AI 生成的永久解读
}

interface SkillFrontmatter {
  name: string
  description?: string
  [key: string]: unknown
}

const GLOBAL_SKILLS_PATH = path.join(os.homedir(), '.factory', 'skills')
const SKILL_SCAN_SKIP_DIRS = new Set(['node_modules', 'dist', 'dist-electron', 'release', '.git'])

// 解析 SKILL.md 的 YAML frontmatter
function parseFrontmatter(content: string): { frontmatter: SkillFrontmatter | null; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) return { frontmatter: null, body: content }
  
  try {
    const yamlStr = match[1]
    const body = match[2]
    const frontmatter: SkillFrontmatter = { name: '' }
    
    yamlStr.split('\n').forEach(line => {
      const colonIdx = line.indexOf(':')
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim()
        const value = line.slice(colonIdx + 1).trim()
        frontmatter[key] = value
      }
    })
    
    return { frontmatter, body }
  } catch {
    return { frontmatter: null, body: content }
  }
}

// 扫描目录下的 skills
function scanSkillsDir(skillsDir: string, scope: 'global' | 'project', projectPath?: string): Skill[] {
  const skills: Skill[] = []
  
  if (!fs.existsSync(skillsDir)) return skills
  
  try {
    const entries = fs.readdirSync(skillsDir, { withFileTypes: true })
    
    for (const entry of entries) {
      const skillDir = path.join(skillsDir, entry.name)
      if (!entry.isDirectory()) {
        if (!entry.isSymbolicLink()) continue
        try {
          const stat = fs.statSync(skillDir)
          if (!stat.isDirectory()) continue
        } catch {
          continue
        }
      }
      let resolvedSkillDir = skillDir
      let mdPath: string | null = null

      const skillMdPath = path.join(resolvedSkillDir, 'SKILL.md')
      const skillMdxPath = path.join(resolvedSkillDir, 'skill.mdx')
      mdPath = fs.existsSync(skillMdPath) ? skillMdPath :
        fs.existsSync(skillMdxPath) ? skillMdxPath : null

      if (!mdPath) {
        const subEntries = fs.readdirSync(resolvedSkillDir, { withFileTypes: true })
        const nested = subEntries
          .filter(sub => sub.isDirectory())
          .map(sub => path.join(resolvedSkillDir, sub.name))
          .map(dir => {
            const nestedMd = path.join(dir, 'SKILL.md')
            const nestedMdx = path.join(dir, 'skill.mdx')
            if (fs.existsSync(nestedMd)) return { dir, mdPath: nestedMd }
            if (fs.existsSync(nestedMdx)) return { dir, mdPath: nestedMdx }
            return null
          })
          .filter((item): item is { dir: string; mdPath: string } => Boolean(item))

        if (nested.length === 0) continue
        resolvedSkillDir = nested[0].dir
        mdPath = nested[0].mdPath
      }
      
      const content = fs.readFileSync(mdPath, 'utf-8')
      const { frontmatter } = parseFrontmatter(content)
      
      // 获取附属文件
      const files = fs.readdirSync(resolvedSkillDir)
        .filter(f => f !== 'SKILL.md' && f !== 'skill.mdx' && f !== 'AI_SUMMARY.md')
      
      // 读取 AI 解读（如果存在）
      const aiSummaryPath = path.join(resolvedSkillDir, 'AI_SUMMARY.md')
      const aiSummary = fs.existsSync(aiSummaryPath) 
        ? fs.readFileSync(aiSummaryPath, 'utf-8') 
        : undefined
      
      skills.push({
        name: frontmatter?.name || path.basename(resolvedSkillDir),
        description: (frontmatter?.description as string) || '',
        content,
        path: resolvedSkillDir,
        scope,
        projectPath,
        files,
        aiSummary
      })
    }
  } catch (e) {
    console.error('扫描 skills 目录失败:', e)
  }
  
  return skills
}

// 获取全局 skills
export function getGlobalSkills(): Skill[] {
  return scanSkillsDir(GLOBAL_SKILLS_PATH, 'global')
}

export function discoverSkillProjects(rootPath: string, maxDepth = 4): string[] {
  const results = new Set<string>()

  const walk = (dir: string, depth: number) => {
    if (depth > maxDepth) return
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }

    const factorySkillsPath = path.join(dir, '.factory', 'skills')
    try {
      if (fs.existsSync(factorySkillsPath) && fs.statSync(factorySkillsPath).isDirectory()) {
        results.add(dir)
      }
    } catch {
      return
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (SKILL_SCAN_SKIP_DIRS.has(entry.name)) continue
      if (entry.name === '.factory') continue
      walk(path.join(dir, entry.name), depth + 1)
    }
  }

  walk(rootPath, 0)
  return Array.from(results)
}

// 获取项目 skills
export function getProjectSkills(projectPath: string): Skill[] {
  const skillsDir = path.join(projectPath, '.factory', 'skills')
  return scanSkillsDir(skillsDir, 'project', projectPath)
}

// 获取单个 skill 详情
export function getSkill(skillPath: string): Skill | null {
  const skillMdPath = path.join(skillPath, 'SKILL.md')
  const skillMdxPath = path.join(skillPath, 'skill.mdx')
  
  const mdPath = fs.existsSync(skillMdPath) ? skillMdPath : 
                 fs.existsSync(skillMdxPath) ? skillMdxPath : null
  
  if (!mdPath) return null
  
  const content = fs.readFileSync(mdPath, 'utf-8')
  const { frontmatter } = parseFrontmatter(content)
  const files = fs.readdirSync(skillPath).filter(f => f !== 'SKILL.md' && f !== 'skill.mdx' && f !== 'AI_SUMMARY.md')
  
  const isGlobal = skillPath.startsWith(GLOBAL_SKILLS_PATH)
  
  // 读取 AI 解读
  const aiSummaryPath = path.join(skillPath, 'AI_SUMMARY.md')
  const aiSummary = fs.existsSync(aiSummaryPath) 
    ? fs.readFileSync(aiSummaryPath, 'utf-8') 
    : undefined
  
  return {
    name: frontmatter?.name || path.basename(skillPath),
    description: (frontmatter?.description as string) || '',
    content,
    path: skillPath,
    scope: isGlobal ? 'global' : 'project',
    files,
    aiSummary
  }
}

// 创建 skill
export function createSkill(
  name: string, 
  content: string, 
  scope: 'global' | 'project',
  projectPath?: string
): { success: boolean; path?: string; error?: string } {
  try {
    const dirName = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '')
    const baseDir = scope === 'global' 
      ? GLOBAL_SKILLS_PATH 
      : path.join(projectPath!, '.factory', 'skills')
    
    const skillDir = path.join(baseDir, dirName)
    
    if (fs.existsSync(skillDir)) {
      return { success: false, error: '同名 Skill 已存在' }
    }
    
    fs.mkdirSync(skillDir, { recursive: true })
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content, 'utf-8')
    
    return { success: true, path: skillDir }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// 更新 skill
export function updateSkill(skillPath: string, content: string): { success: boolean; error?: string } {
  try {
    const mdPath = path.join(skillPath, 'SKILL.md')
    fs.writeFileSync(mdPath, content, 'utf-8')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// 删除 skill
export function deleteSkill(skillPath: string): { success: boolean; error?: string } {
  try {
    fs.rmSync(skillPath, { recursive: true, force: true })
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// 获取全局 skills 路径
export function getGlobalSkillsPath(): string {
  return GLOBAL_SKILLS_PATH
}

// 读取 skill 附属文件
export function readSkillFile(skillPath: string, fileName: string): string | null {
  try {
    const filePath = path.join(skillPath, fileName)
    if (!fs.existsSync(filePath)) return null
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
}

// 保存 skill 附属文件
export function saveSkillFile(skillPath: string, fileName: string, content: string): { success: boolean; error?: string } {
  try {
    const filePath = path.join(skillPath, fileName)
    fs.writeFileSync(filePath, content, 'utf-8')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// 删除 skill 附属文件
export function deleteSkillFile(skillPath: string, fileName: string): { success: boolean; error?: string } {
  try {
    const filePath = path.join(skillPath, fileName)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// 保存 AI 解读到 Skill 目录
export function saveAiSummary(skillPath: string, summary: string): { success: boolean; error?: string } {
  try {
    const summaryPath = path.join(skillPath, 'AI_SUMMARY.md')
    fs.writeFileSync(summaryPath, summary, 'utf-8')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// 获取 AI 解读
export function getAiSummary(skillPath: string): string | null {
  try {
    const summaryPath = path.join(skillPath, 'AI_SUMMARY.md')
    if (fs.existsSync(summaryPath)) {
      return fs.readFileSync(summaryPath, 'utf-8')
    }
    return null
  } catch {
    return null
  }
}

// 复制目录（递归）
function copyDir(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true })
  const entries = fs.readdirSync(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

// 导入 skill 文件夹
export function importSkillFolder(
  sourcePath: string,
  scope: 'global' | 'project',
  projectPath?: string
): { success: boolean; path?: string; error?: string } {
  try {
    if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isDirectory()) {
      return { success: false, error: '无效的文件夹路径' }
    }

    // 检查是否有 SKILL.md
    const skillMdPath = path.join(sourcePath, 'SKILL.md')
    const skillMdxPath = path.join(sourcePath, 'skill.mdx')
    if (!fs.existsSync(skillMdPath) && !fs.existsSync(skillMdxPath)) {
      return { success: false, error: '文件夹中没有 SKILL.md 或 skill.mdx 文件' }
    }

    const folderName = path.basename(sourcePath)
    const baseDir = scope === 'global'
      ? GLOBAL_SKILLS_PATH
      : path.join(projectPath!, '.factory', 'skills')

    const destPath = path.join(baseDir, folderName)

    if (fs.existsSync(destPath)) {
      return { success: false, error: `同名 Skill "${folderName}" 已存在` }
    }

    copyDir(sourcePath, destPath)
    return { success: true, path: destPath }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// 批量导入多个 skill 文件夹
export function importSkillFolders(
  sourcePaths: string[],
  scope: 'global' | 'project',
  projectPath?: string
): { success: number; failed: number; errors: string[] } {
  const errors: string[] = []
  let success = 0
  let failed = 0

  for (const sourcePath of sourcePaths) {
    const result = importSkillFolder(sourcePath, scope, projectPath)
    if (result.success) {
      success++
    } else {
      failed++
      errors.push(`${path.basename(sourcePath)}: ${result.error}`)
    }
  }

  return { success, failed, errors }
}

// 从包含多个 skill 的目录导入（如解压后的目录）
export function importSkillsFromDirectory(
  dirPath: string,
  scope: 'global' | 'project',
  projectPath?: string
): { success: number; failed: number; errors: string[] } {
  try {
    if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
      return { success: 0, failed: 0, errors: ['无效的目录路径'] }
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    const skillFolders: string[] = []

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const folderPath = path.join(dirPath, entry.name)
      const hasSkillMd = fs.existsSync(path.join(folderPath, 'SKILL.md')) ||
                         fs.existsSync(path.join(folderPath, 'skill.mdx'))
      if (hasSkillMd) {
        skillFolders.push(folderPath)
      }
    }

    if (skillFolders.length === 0) {
      // 可能目录本身就是一个 skill
      const hasSkillMd = fs.existsSync(path.join(dirPath, 'SKILL.md')) ||
                         fs.existsSync(path.join(dirPath, 'skill.mdx'))
      if (hasSkillMd) {
        const result = importSkillFolder(dirPath, scope, projectPath)
        return {
          success: result.success ? 1 : 0,
          failed: result.success ? 0 : 1,
          errors: result.error ? [result.error] : []
        }
      }
      return { success: 0, failed: 0, errors: ['目录中没有找到有效的 Skill'] }
    }

    return importSkillFolders(skillFolders, scope, projectPath)
  } catch (e) {
    return { success: 0, failed: 0, errors: [(e as Error).message] }
  }
}

// 解压 ZIP 文件到临时目录
function extractZip(zipPath: string): string | null {
  try {
    const tempDir = path.join(os.tmpdir(), `skills-import-${Date.now()}`)
    fs.mkdirSync(tempDir, { recursive: true })

    // Windows 使用 PowerShell 解压
    if (process.platform === 'win32') {
      execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tempDir}' -Force"`, {
        windowsHide: true
      })
    } else {
      // macOS/Linux 使用 unzip
      execSync(`unzip -q "${zipPath}" -d "${tempDir}"`)
    }

    return tempDir
  } catch (e) {
    console.error('解压失败:', e)
    return null
  }
}

// 清理临时目录
function cleanupTempDir(tempDir: string) {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true })
  } catch {
    // 忽略清理错误
  }
}

// 从 ZIP 文件导入 skills
export function importSkillsFromZip(
  zipPath: string,
  scope: 'global' | 'project',
  projectPath?: string
): { success: number; failed: number; errors: string[] } {
  const tempDir = extractZip(zipPath)
  if (!tempDir) {
    return { success: 0, failed: 0, errors: ['解压 ZIP 文件失败'] }
  }

  try {
    const result = importSkillsFromDirectory(tempDir, scope, projectPath)
    return result
  } finally {
    cleanupTempDir(tempDir)
  }
}

// 复制 Skill 到目标位置（整个文件夹）
export function copySkill(
  sourcePath: string,
  targetScope: 'global' | 'project',
  targetProjectPath?: string
): { success: boolean; path?: string; error?: string } {
  try {
    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: '源 Skill 不存在' }
    }

    const skillName = path.basename(sourcePath)
    const targetBaseDir = targetScope === 'global'
      ? GLOBAL_SKILLS_PATH
      : path.join(targetProjectPath!, '.factory', 'skills')
    
    const targetPath = path.join(targetBaseDir, skillName)

    if (fs.existsSync(targetPath)) {
      return { success: false, error: `目标位置已存在同名 Skill: ${skillName}` }
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

// 移动 Skill 到目标位置（整个文件夹）
export function moveSkill(
  sourcePath: string,
  targetScope: 'global' | 'project',
  targetProjectPath?: string
): { success: boolean; path?: string; error?: string } {
  try {
    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: '源 Skill 不存在' }
    }

    const skillName = path.basename(sourcePath)
    const targetBaseDir = targetScope === 'global'
      ? GLOBAL_SKILLS_PATH
      : path.join(targetProjectPath!, '.factory', 'skills')

    const targetPath = path.join(targetBaseDir, skillName)

    if (fs.existsSync(targetPath)) {
      return { success: false, error: `目标位置已存在同名 Skill: ${skillName}` }
    }

    fs.mkdirSync(targetBaseDir, { recursive: true })

    try {
      fs.renameSync(sourcePath, targetPath)
    } catch (e) {
      const err = e as NodeJS.ErrnoException
      if (err.code !== 'EXDEV') {
        throw e
      }
      copyDirRecursive(sourcePath, targetPath)
      fs.rmSync(sourcePath, { recursive: true, force: true })
    }

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
