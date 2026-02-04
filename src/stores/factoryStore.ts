import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface DroidConfig {
  linkedSkills?: { required?: string[]; allowed?: string[] }
  linkedMcp?: { required?: string[]; allowed?: string[] }
  toolPermissions?: { required?: string[]; denied?: string[] }
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
  config?: DroidConfig
  aiSummary?: string
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

interface DroidNode {
  path: string
  name: string
  type: 'global' | 'project'
  droids: Droid[]
  skills: string[]
  expanded: boolean
}

interface SkillNode {
  path: string
  name: string
  type: 'global' | 'project'
  skills: Skill[]
  expanded: boolean
}

interface FactoryState {
  // Droids 数据
  droidNodes: DroidNode[]
  globalSkillNames: string[]
  tools: string[]
  toolCategories: Record<string, string[]>
  mcpServers: string[]
  droidsLoaded: boolean
  droidsLastUpdate: number

  // Skills 数据
  skillNodes: SkillNode[]
  skillsLoaded: boolean
  skillsLastUpdate: number

  // Actions
  setDroidsData: (data: {
    nodes: DroidNode[]
    globalSkills: string[]
    tools: string[]
    toolCategories: Record<string, string[]>
    mcpServers: string[]
  }) => void
  setSkillsData: (nodes: SkillNode[]) => void
  clearDroidsCache: () => void
  clearSkillsCache: () => void
  updateDroidNode: (path: string, droids: Droid[]) => void
  updateSkillNode: (path: string, skills: Skill[]) => void
}

export const useFactoryStore = create<FactoryState>()(
  persist(
    (set) => ({
      droidNodes: [],
      globalSkillNames: [],
      tools: [],
      toolCategories: {},
      mcpServers: [],
      droidsLoaded: false,
      droidsLastUpdate: 0,

      skillNodes: [],
      skillsLoaded: false,
      skillsLastUpdate: 0,

      setDroidsData: (data) => set({
        droidNodes: data.nodes,
        globalSkillNames: data.globalSkills,
        tools: data.tools,
        toolCategories: data.toolCategories,
        mcpServers: data.mcpServers,
        droidsLoaded: true,
        droidsLastUpdate: Date.now()
      }),

      setSkillsData: (nodes) => set({
        skillNodes: nodes,
        skillsLoaded: true,
        skillsLastUpdate: Date.now()
      }),

      clearDroidsCache: () => set({
        droidNodes: [],
        droidsLoaded: false,
        droidsLastUpdate: 0
      }),

      clearSkillsCache: () => set({
        skillNodes: [],
        skillsLoaded: false,
        skillsLastUpdate: 0
      }),

      updateDroidNode: (path, droids) => set((state) => ({
        droidNodes: state.droidNodes.map(n => 
          n.path === path ? { ...n, droids } : n
        )
      })),

      updateSkillNode: (path, skills) => set((state) => ({
        skillNodes: state.skillNodes.map(n => 
          n.path === path ? { ...n, skills } : n
        )
      }))
    }),
    {
      name: 'factory-store',
      partialize: (state) => ({
        droidNodes: state.droidNodes,
        globalSkillNames: state.globalSkillNames,
        tools: state.tools,
        toolCategories: state.toolCategories,
        mcpServers: state.mcpServers,
        droidsLoaded: state.droidsLoaded,
        droidsLastUpdate: state.droidsLastUpdate,
        skillNodes: state.skillNodes,
        skillsLoaded: state.skillsLoaded,
        skillsLastUpdate: state.skillsLastUpdate
      })
    }
  )
)
