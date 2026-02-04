import { useEffect, useState } from 'react'
import { useStore } from './store'
import { useFactoryStore } from './stores/factoryStore'
import { Sidebar, type PageType } from './components/Sidebar'
import { HomePage } from './components/HomePage'
import { McpManagerPage } from './components/McpManagerPage'
import { SkillsManagerPage } from './components/SkillsManagerPage'
import { DroidsManagerPage } from './components/DroidsManagerPage'
import { PromptManagerPage } from './components/PromptManagerPage'
import { RuleManagerPage } from './components/RuleManagerPage'
import { MarketplacePage } from './components/MarketplacePage'
import { SettingsPage } from './components/SettingsPage'
import type { AppData } from './types'

declare global {
  interface Window {
    electronAPI: {
      loadData: () => Promise<unknown>
      saveData: (data: unknown) => Promise<boolean>
      getDataPath: () => Promise<string>
      exportData: (data: unknown) => Promise<boolean>
      importData: () => Promise<unknown>
      openExternal: (url: string) => Promise<void>
      marketplaceFetch: (url: string) => Promise<{ success: boolean; status?: number; text?: string; error?: string }>
      marketplaceSkillImport: (url: string) => Promise<{ success: boolean; output: string; error?: string }>
      // MCP 管理
      mcpList: () => Promise<{ configPath: string; servers: unknown[] }>
      mcpEnable: (name: string) => Promise<{ success: boolean; error?: string }>
      mcpDisable: (name: string) => Promise<{ success: boolean; error?: string }>
      mcpConnect: (name: string) => Promise<{ success: boolean; error?: string; serverInfo?: unknown; tools?: unknown[] }>
      mcpDisconnect: (name: string) => Promise<{ success: boolean; error?: string }>
      mcpCallTool: (name: string, toolName: string, args: unknown) => Promise<{ success: boolean; result?: unknown; error?: string }>
      mcpGetStatus: (name: string) => Promise<unknown>
      mcpCheckUpdate: (name: string) => Promise<{ success: boolean; packageName?: string; currentVersion?: string; latestVersion?: string; updateAvailable?: boolean; error?: string }>
      mcpAdd: (name: string, config: unknown) => Promise<{ success: boolean; error?: string }>
      mcpRemove: (name: string) => Promise<{ success: boolean; error?: string }>
      mcpUpdate: (name: string, config: unknown) => Promise<{ success: boolean; error?: string }>
      mcpGetConfigPath: () => Promise<string>
      resourceCenterList: () => Promise<{ basePath: string; mcp: { configPath: string; servers: unknown[] }; skills: Skill[]; droids: Droid[] }>
      resourceCenterMcpAdd: (name: string, config: unknown) => Promise<{ success: boolean; error?: string }>
      resourceCenterSkillCreate: (name: string, content: string) => Promise<{ success: boolean; path?: string; error?: string }>
      // AI 翻译
      aiTranslate: (text: string) => Promise<string>
      aiExplainSkill: (content: string) => Promise<string>
      aiGetSettings: () => Promise<{ url: string; apiKey: string; model: string; skillsModel: string }>
      aiSaveSettings: (settings: { url: string; apiKey: string; model: string; skillsModel: string }) => Promise<boolean>
      aiFetchModels: () => Promise<{ id: string; name?: string }[]>
      // Skills 管理
      skillsGetGlobal: () => Promise<Skill[]>
      skillsDiscoverWork: () => Promise<string[]>
      skillsGetProject: (projectPath: string) => Promise<Skill[]>
      skillsGet: (skillPath: string) => Promise<Skill | null>
      skillsCreate: (name: string, content: string, scope: 'global' | 'project', projectPath?: string) => Promise<{ success: boolean; path?: string; error?: string }>
      skillsUpdate: (skillPath: string, content: string) => Promise<{ success: boolean; error?: string }>
      skillsDelete: (skillPath: string) => Promise<{ success: boolean; error?: string }>
      skillsGetGlobalPath: () => Promise<string>
      skillsReadFile: (skillPath: string, fileName: string) => Promise<string | null>
      skillsSaveFile: (skillPath: string, fileName: string, content: string) => Promise<{ success: boolean; error?: string }>
      skillsDeleteFile: (skillPath: string, fileName: string) => Promise<{ success: boolean; error?: string }>
      skillsSelectProject: () => Promise<string | null>
      skillsImportFolder: (scope: 'global' | 'project', projectPath?: string) => Promise<{ success: boolean; canceled?: boolean; path?: string; error?: string }>
      skillsImportDirectory: (scope: 'global' | 'project', projectPath?: string) => Promise<{ success: number; failed: number; errors: string[]; canceled?: boolean }>
      skillsImportZip: (scope: 'global' | 'project', projectPath?: string) => Promise<{ success: number; failed: number; errors: string[]; canceled?: boolean }>
      skillsGenerateAiSummary: (skillPath: string, content: string) => Promise<{ success: boolean; summary?: string; error?: string }>
      skillsSaveAiSummary: (skillPath: string, summary: string) => Promise<{ success: boolean; error?: string }>
      skillsCopy: (sourcePath: string, targetScope: 'global' | 'project', targetProjectPath?: string) => Promise<{ success: boolean; path?: string; error?: string }>
      skillsMove: (sourcePath: string, targetScope: 'global' | 'project', targetProjectPath?: string) => Promise<{ success: boolean; path?: string; error?: string }>
      // Droids 管理
      droidsGetGlobal: () => Promise<Droid[]>
      droidsDiscoverWork: () => Promise<string[]>
      droidsGetProject: (projectPath: string) => Promise<Droid[]>
      droidsGet: (droidPath: string) => Promise<Droid | null>
      droidsCreate: (data: {
        name: string
        description?: string
        model?: string
        reasoningEffort?: string
        tools?: string[] | string
        systemPrompt: string
      }, scope: 'global' | 'project', projectPath?: string) => Promise<{ success: boolean; path?: string; error?: string }>
      droidsUpdate: (droidPath: string, data: {
        name?: string
        description?: string
        model?: string
        reasoningEffort?: string
        tools?: string[] | string
        systemPrompt?: string
      }) => Promise<{ success: boolean; error?: string }>
      droidsDelete: (droidPath: string) => Promise<{ success: boolean; error?: string }>
      droidsGetGlobalPath: () => Promise<string>
      droidsSaveConfig: (droidName: string, config: unknown) => Promise<{ success: boolean; error?: string }>
      droidsGetTools: () => Promise<string[]>
      droidsGetToolCategories: () => Promise<Record<string, string[]>>
      droidsSelectProject: () => Promise<string | null>
      droidsGenerateAiSummary: (droidPath: string, droidName: string, content: string) => Promise<{ success: boolean; summary?: string; error?: string }>
      droidsCopy: (sourcePath: string, targetScope: 'global' | 'project', targetProjectPath?: string) => Promise<{ success: boolean; path?: string; error?: string }>
      droidsMove: (sourcePath: string, targetScope: 'global' | 'project', targetProjectPath?: string) => Promise<{ success: boolean; path?: string; error?: string }>
      // Prompts 管理
      promptsGetAll: () => Promise<Prompt[]>
      promptsGet: (promptPath: string) => Promise<Prompt | null>
      promptsCreate: (name: string, content: string, description: string, category: string, linkedResources: string[]) => Promise<{ success: boolean; path?: string; error?: string }>
      promptsUpdate: (promptPath: string, content: string, description: string, category: string, linkedResources: string[]) => Promise<{ success: boolean; error?: string }>
      promptsDelete: (promptPath: string) => Promise<{ success: boolean; error?: string }>
      promptsGetPath: () => Promise<string>
      promptsGetCount: () => Promise<number>
      // Rules 管理
      rulesGetGlobal: () => Promise<Rule[]>
      rulesGetProject: (projectPath: string) => Promise<Rule[]>
      rulesGet: (rulePath: string) => Promise<Rule | null>
      rulesCreate: (name: string, content: string, scope: 'global' | 'project', projectPath: string | undefined, description: string, category: string, priority: number, globs: string[], linkedResources: string[]) => Promise<{ success: boolean; path?: string; error?: string }>
      rulesUpdate: (rulePath: string, content: string, description: string, category: string, priority: number, globs: string[], linkedResources: string[]) => Promise<{ success: boolean; error?: string }>
      rulesDelete: (rulePath: string) => Promise<{ success: boolean; error?: string }>
      rulesGetGlobalPath: () => Promise<string>
      rulesGetGlobalCount: () => Promise<number>
      rulesSelectProject: () => Promise<string | null>
      rulesCopy: (sourcePath: string, targetScope: 'global' | 'project', targetProjectPath?: string) => Promise<{ success: boolean; path?: string; error?: string }>
    }
  }
}

interface Skill {
  name: string
  description: string
  content: string
  path: string
  scope: 'global' | 'project'
  projectPath?: string
  files: string[]
  aiSummary?: string
}

interface Droid {
  name: string
  description: string
  model: string
  reasoningEffort?: 'low' | 'medium' | 'high'
  tools: string[] | string
  systemPrompt: string
  content: string
  path: string
  scope: 'global' | 'project'
  projectPath?: string
  config?: unknown
  aiSummary?: string
}

interface Prompt {
  name: string
  description: string
  content: string
  path: string
  category?: string
  variables?: string[]
  linkedResources?: string[]
}

interface Rule {
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

function App() {
  const { loadData, getData } = useStore()
  const { droidsLoaded, skillsLoaded, setDroidsData, setSkillsData } = useFactoryStore()
  const [currentPage, setCurrentPage] = useState<PageType>('home')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    const load = async () => {
      if (window.electronAPI) {
        const data = await window.electronAPI.loadData()
        loadData(data as AppData)
      }
    }
    load()
  }, [loadData])

  const handleInitResources = async () => {
    if (!window.electronAPI) return

    const [globalDroids, gPath, globalSkillsList, toolsList, categories, mcpList, discoveredPaths] = await Promise.all([
      window.electronAPI.droidsGetGlobal(),
      window.electronAPI.droidsGetGlobalPath(),
      window.electronAPI.skillsGetGlobal(),
      window.electronAPI.droidsGetTools(),
      window.electronAPI.droidsGetToolCategories(),
      window.electronAPI.mcpList(),
      window.electronAPI.droidsDiscoverWork()
    ])

    const globalSkillNames = globalSkillsList.map((s) => s.name)
    const mcpServerNames = (mcpList.servers || []).map((s: { name: string }) => s.name)

    const droidNodes = [{
      path: gPath,
      name: '全局 Droids',
      type: 'global' as const,
      droids: globalDroids,
      skills: globalSkillNames,
      expanded: true
    }]

    const savedDroids = localStorage.getItem('droidsProjectTabs')
    const savedDroidPaths = savedDroids ? (JSON.parse(savedDroids) as string[]) : []
    const mergedDroidPaths = Array.from(new Set([...savedDroidPaths, ...discoveredPaths]))

    const projectResults = await Promise.all(
      mergedDroidPaths.map(async (p) => {
        const [droidsList, skillsList] = await Promise.all([
          window.electronAPI.droidsGetProject(p),
          window.electronAPI.skillsGetProject(p)
        ])
        return {
          path: p,
          name: p.split(/[/\\]/).pop() || p,
          type: 'project' as const,
          droids: droidsList,
          skills: skillsList.map((s) => s.name),
          expanded: true
        }
      })
    )

    droidNodes.push(...projectResults)

    setDroidsData({
      nodes: droidNodes,
      globalSkills: globalSkillNames,
      tools: toolsList,
      toolCategories: categories,
      mcpServers: mcpServerNames
    })

    const [globalSkills, gSkillsPath, discoveredSkillPaths] = await Promise.all([
      window.electronAPI.skillsGetGlobal(),
      window.electronAPI.skillsGetGlobalPath(),
      window.electronAPI.skillsDiscoverWork()
    ])

    const skillNodes = [{
      path: gSkillsPath,
      name: '全局 Skills',
      type: 'global' as const,
      skills: globalSkills,
      expanded: true
    }]

    const savedSkills = localStorage.getItem('skillsProjectTabs')
    const savedSkillPaths = savedSkills ? (JSON.parse(savedSkills) as string[]) : []
    const mergedSkillPaths = Array.from(new Set([...savedSkillPaths, ...discoveredSkillPaths]))

    const skillProjectResults = await Promise.all(
      mergedSkillPaths.map(async (p) => {
        const skills = await window.electronAPI.skillsGetProject(p)
        return {
          path: p,
          name: p.split(/[/\\]/).pop() || p,
          type: 'project' as const,
          skills,
          expanded: true
        }
      })
    )

    skillNodes.push(...skillProjectResults)
    setSkillsData(skillNodes)
  }

  const resources = useStore((s) => s.resources)
  const tags = useStore((s) => s.tags)
  
  useEffect(() => {
    const save = async () => {
      if (window.electronAPI) {
        await window.electronAPI.saveData(getData())
      }
    }
    const timer = setTimeout(save, 500)
    return () => clearTimeout(timer)
  }, [resources, tags, getData])

  const handleOpenMarketplace = () => {
    setCurrentPage('marketplace')
  }

  const handleExport = async () => {
    if (window.electronAPI) {
      await window.electronAPI.exportData(getData())
    }
  }

  const handleImport = async () => {
    if (window.electronAPI) {
      const data = await window.electronAPI.importData()
      if (data) {
        loadData(data as AppData)
      }
    }
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage onOpenMarketplace={handleOpenMarketplace} onInitResources={handleInitResources} />
      case 'mcp':
        return <McpManagerPage />
      case 'skills':
        return <SkillsManagerPage />
      case 'droids':
        return <DroidsManagerPage />
      case 'prompts':
        return <PromptManagerPage />
      case 'rules':
        return <RuleManagerPage />
      case 'marketplace':
        return <MarketplacePage />
      case 'settings':
        return <SettingsPage onExport={handleExport} onImport={handleImport} />
      case 'about':
        return (
          <div className="p-6">
            <div className="bg-card rounded-xl border p-6 max-w-2xl">
              <h1 className="text-xl font-semibold mb-4">关于</h1>
              <p className="text-muted-foreground mb-2">Droid 资源管理器 v1.0.0</p>
              <p className="text-muted-foreground">管理你的 MCP、Skills 和 Droids 资源</p>
            </div>
          </div>
        )
      default:
        return <HomePage onOpenMarketplace={handleOpenMarketplace} />
    }
  }

  return (
    <div className="app-shell h-screen bg-background flex">
      <Sidebar
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <main className="flex-1 overflow-auto">
        {renderPage()}
      </main>

    </div>
  )
}

export default App
