import { useEffect, useState } from 'react'
import { Store, RefreshCw, Server, Sparkles, Bot, MessageSquare, ScrollText } from 'lucide-react'

interface HomePageProps {
  onOpenMarketplace: () => void
}

export function HomePage({ onOpenMarketplace }: HomePageProps) {
  const [counts, setCounts] = useState({
    mcp: 0,
    skill: 0,
    droid: 0,
    prompt: 0,
    rule: 0
  })

  useEffect(() => {
    const loadCounts = async () => {
      if (!window.electronAPI) return

      const [mcpResult, globalSkills, globalDroids, prompts, rules] = await Promise.all([
        window.electronAPI.mcpList(),
        window.electronAPI.skillsGetGlobal(),
        window.electronAPI.droidsGetGlobal(),
        window.electronAPI.promptsGetCount(),
        window.electronAPI.rulesGetGlobalCount()
      ])

      const skillsProjectTabs = localStorage.getItem('skillsProjectTabs')
      const skillsProjectPaths = skillsProjectTabs ? (JSON.parse(skillsProjectTabs) as string[]) : []
      const projectSkills = await Promise.all(
        skillsProjectPaths.map((path) => window.electronAPI.skillsGetProject(path))
      )

      const droidsProjectTabs = localStorage.getItem('droidsProjectTabs')
      const droidsProjectPaths = droidsProjectTabs ? (JSON.parse(droidsProjectTabs) as string[]) : []
      const projectDroids = await Promise.all(
        droidsProjectPaths.map((path) => window.electronAPI.droidsGetProject(path))
      )

      setCounts({
        mcp: mcpResult.servers.length,
        skill: globalSkills.length + projectSkills.reduce((sum, list) => sum + list.length, 0),
        droid: globalDroids.length + projectDroids.reduce((sum, list) => sum + list.length, 0),
        prompt: prompts,
        rule: rules
      })
    }

    void loadCounts()
  }, [])

  const stats = {
    total: counts.mcp + counts.skill + counts.droid + counts.prompt + counts.rule,
    mcp: counts.mcp,
    skill: counts.skill,
    droid: counts.droid,
    prompt: counts.prompt,
    rule: counts.rule,
  }

  const handleRefresh = async () => {
    if (!window.electronAPI) return
    const [mcpResult, globalSkills, globalDroids, prompts, rules] = await Promise.all([
      window.electronAPI.mcpList(),
      window.electronAPI.skillsGetGlobal(),
      window.electronAPI.droidsGetGlobal(),
      window.electronAPI.promptsGetCount(),
      window.electronAPI.rulesGetGlobalCount()
    ])

    const skillsProjectTabs = localStorage.getItem('skillsProjectTabs')
    const skillsProjectPaths = skillsProjectTabs ? (JSON.parse(skillsProjectTabs) as string[]) : []
    const projectSkills = await Promise.all(
      skillsProjectPaths.map((path) => window.electronAPI.skillsGetProject(path))
    )

    const droidsProjectTabs = localStorage.getItem('droidsProjectTabs')
    const droidsProjectPaths = droidsProjectTabs ? (JSON.parse(droidsProjectTabs) as string[]) : []
    const projectDroids = await Promise.all(
      droidsProjectPaths.map((path) => window.electronAPI.droidsGetProject(path))
    )

    setCounts({
      mcp: mcpResult.servers.length,
      skill: globalSkills.length + projectSkills.reduce((sum, list) => sum + list.length, 0),
      droid: globalDroids.length + projectDroids.reduce((sum, list) => sum + list.length, 0),
      prompt: prompts,
      rule: rules
    })
  }

  return (
    <div className="p-6 space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 2xl:grid-cols-6">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-sm text-muted-foreground mb-1">总资源</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="icon-orb icon-orb--blue icon-orb--sm">
              <Server className="w-4 h-4 text-blue-500" />
            </span>
            <p className="text-sm text-muted-foreground">MCP</p>
          </div>
          <p className="text-2xl font-bold text-blue-600 font-display">{stats.mcp}</p>
          <p className="text-xs text-muted-foreground mt-1">外部工具连接器</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="icon-orb icon-orb--green icon-orb--sm">
              <Sparkles className="w-4 h-4 text-green-500" />
            </span>
            <p className="text-sm text-muted-foreground">Skills</p>
          </div>
          <p className="text-2xl font-bold text-green-600 font-display">{stats.skill}</p>
          <p className="text-xs text-muted-foreground mt-1">可复用工作流</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="icon-orb icon-orb--purple icon-orb--sm">
              <Bot className="w-4 h-4 text-purple-500" />
            </span>
            <p className="text-sm text-muted-foreground">Droids</p>
          </div>
          <p className="text-2xl font-bold text-purple-600 font-display">{stats.droid}</p>
          <p className="text-xs text-muted-foreground mt-1">专门子代理</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="icon-orb icon-orb--orange icon-orb--sm">
              <MessageSquare className="w-4 h-4 text-orange-500" />
            </span>
            <p className="text-sm text-muted-foreground">Prompts</p>
          </div>
          <p className="text-2xl font-bold text-orange-600 font-display">{stats.prompt}</p>
          <p className="text-xs text-muted-foreground mt-1">提示词模板</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="icon-orb icon-orb--cyan icon-orb--sm">
              <ScrollText className="w-4 h-4 text-cyan-500" />
            </span>
            <p className="text-sm text-muted-foreground">Rules</p>
          </div>
          <p className="text-2xl font-bold text-cyan-600 font-display">{stats.rule}</p>
          <p className="text-xs text-muted-foreground mt-1">编码规则</p>
        </div>
      </div>

      {/* 主卡片 */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h2 className="text-lg font-semibold font-display">资源概览</h2>
          <div className="flex gap-2">
            <button 
              onClick={handleRefresh}
              className="px-4 py-2 text-sm glass-chip hover:bg-white/70 rounded-lg transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              刷新
            </button>
            <button 
              onClick={onOpenMarketplace}
              className="px-4 py-2 text-sm bg-primary/90 text-primary-foreground hover:bg-primary rounded-lg transition-colors flex items-center gap-2 shadow-md"
            >
              <Store className="w-4 h-4" />
              打开资源市场
            </button>
          </div>
        </div>

        {/* 饼图和图例 */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_1fr] items-center gap-8">
          <div className="relative w-40 h-40 mx-auto">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="12" className="text-muted" />
              {stats.total > 0 && (
                <>
                  <circle 
                    cx="50" cy="50" r="40" fill="none" 
                    stroke="#3b82f6" strokeWidth="12"
                    strokeDasharray={`${(stats.mcp / stats.total) * 251.2} 251.2`}
                  />
                  <circle 
                    cx="50" cy="50" r="40" fill="none" 
                    stroke="#22c55e" strokeWidth="12"
                    strokeDasharray={`${(stats.skill / stats.total) * 251.2} 251.2`}
                    strokeDashoffset={`${-(stats.mcp / stats.total) * 251.2}`}
                  />
                  <circle 
                    cx="50" cy="50" r="40" fill="none" 
                    stroke="#a855f7" strokeWidth="12"
                    strokeDasharray={`${(stats.droid / stats.total) * 251.2} 251.2`}
                    strokeDashoffset={`${-((stats.mcp + stats.skill) / stats.total) * 251.2}`}
                  />
                  <circle 
                    cx="50" cy="50" r="40" fill="none" 
                    stroke="#f97316" strokeWidth="12"
                    strokeDasharray={`${(stats.prompt / stats.total) * 251.2} 251.2`}
                    strokeDashoffset={`${-((stats.mcp + stats.skill + stats.droid) / stats.total) * 251.2}`}
                  />
                  <circle 
                    cx="50" cy="50" r="40" fill="none" 
                    stroke="#06b6d4" strokeWidth="12"
                    strokeDasharray={`${(stats.rule / stats.total) * 251.2} 251.2`}
                    strokeDashoffset={`${-((stats.mcp + stats.skill + stats.droid + stats.prompt) / stats.total) * 251.2}`}
                  />
                </>
              )}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-sm text-muted-foreground">总数</span>
              <span className="text-2xl font-bold">{stats.total}</span>
            </div>
          </div>

          <div className="space-y-3 justify-self-center lg:justify-self-start">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <Server className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-muted-foreground w-16">MCP</span>
              <span className="text-sm font-medium">{stats.mcp}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <Sparkles className="w-4 h-4 text-green-500" />
              <span className="text-sm text-muted-foreground w-16">Skills</span>
              <span className="text-sm font-medium">{stats.skill}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              <Bot className="w-4 h-4 text-purple-500" />
              <span className="text-sm text-muted-foreground w-16">Droids</span>
              <span className="text-sm font-medium">{stats.droid}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <MessageSquare className="w-4 h-4 text-orange-500" />
              <span className="text-sm text-muted-foreground w-16">Prompts</span>
              <span className="text-sm font-medium">{stats.prompt}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-cyan-500" />
              <ScrollText className="w-4 h-4 text-cyan-500" />
              <span className="text-sm text-muted-foreground w-16">Rules</span>
              <span className="text-sm font-medium">{stats.rule}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 空状态 */}
      {stats.total === 0 && (
        <div className="glass-card rounded-2xl p-12 text-center">
          <div className="flex justify-center gap-4 mb-4">
            <span className="icon-orb icon-orb--blue icon-orb--lg"><Server className="w-6 h-6 text-blue-400" /></span>
            <span className="icon-orb icon-orb--green icon-orb--lg"><Sparkles className="w-6 h-6 text-green-400" /></span>
            <span className="icon-orb icon-orb--purple icon-orb--lg"><Bot className="w-6 h-6 text-purple-400" /></span>
            <span className="icon-orb icon-orb--orange icon-orb--lg"><MessageSquare className="w-6 h-6 text-orange-400" /></span>
            <span className="icon-orb icon-orb--cyan icon-orb--lg"><ScrollText className="w-6 h-6 text-cyan-400" /></span>
          </div>
          <h3 className="text-lg font-medium mb-2 font-display">还没有资源</h3>
          <p className="text-muted-foreground mb-4">先从资源市场导入 MCP 和 Skills</p>
          <button 
            onClick={onOpenMarketplace}
            className="px-6 py-2 bg-primary/90 text-primary-foreground hover:bg-primary rounded-lg transition-colors shadow-md"
          >
            前往资源市场
          </button>
        </div>
      )}
    </div>
  )
}
