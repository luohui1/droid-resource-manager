import { Home, Settings, Info, ChevronLeft, ChevronRight, Server, Bot, Zap, MessageSquare, ScrollText, Store } from 'lucide-react'

export type PageType = 'home' | 'mcp' | 'skills' | 'droids' | 'prompts' | 'rules' | 'marketplace' | 'settings' | 'about'

interface SidebarProps {
  currentPage: PageType
  onPageChange: (page: PageType) => void
  collapsed: boolean
  onToggleCollapse: () => void
}

const menuItems: { id: PageType; label: string; icon: React.ElementType }[] = [
  { id: 'home', label: '首页', icon: Home },
  { id: 'mcp', label: 'MCP 管理', icon: Server },
  { id: 'skills', label: 'Skills 管理', icon: Zap },
  { id: 'droids', label: 'Droids 管理', icon: Bot },
  { id: 'prompts', label: 'Prompts 管理', icon: MessageSquare },
  { id: 'rules', label: 'Rules 管理', icon: ScrollText },
  { id: 'marketplace', label: '资源市场', icon: Store },
  { id: 'settings', label: '设置', icon: Settings },
  { id: 'about', label: '关于', icon: Info },
]

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

export function Sidebar({ currentPage, onPageChange, collapsed, onToggleCollapse }: SidebarProps) {
  return (
    <div className={cn(
      "h-screen glass-panel border-r border-white/40 flex flex-col transition-all duration-300",
      collapsed ? "w-16" : "w-52"
    )}>
      {/* Logo */}
      <div className="h-12 flex items-center justify-center border-b border-white/40 px-2 gap-2 overflow-hidden">
        {collapsed ? (
          <span className="icon-orb icon-orb--amber icon-orb--md">
            <img src="/icon.png" alt="Droid" className="h-5 w-5" />
          </span>
        ) : (
          <>
            <span className="icon-orb icon-orb--amber icon-orb--md shrink-0">
              <img src="/icon.png" alt="Droid" className="h-5 w-5" />
            </span>
            <span className="font-semibold text-foreground whitespace-nowrap font-display">Droid 管理器</span>
          </>
        )}
      </div>

      {/* Menu Items */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-auto">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = currentPage === item.id
          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={cn(
                "w-full flex items-center rounded-xl text-sm font-medium transition-all overflow-hidden",
                isActive 
                  ? "bg-white/70 text-foreground shadow-lg ring-1 ring-white/60 backdrop-blur-xl" 
                  : "text-muted-foreground hover:text-foreground hover:bg-white/50",
                collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
              )}
              title={collapsed ? item.label : undefined}
            >
              <span className={cn(
                "icon-orb icon-orb--sm",
                isActive ? "icon-orb--blue" : "icon-orb--slate"
              )}>
                <Icon className="h-4 w-4" />
              </span>
              {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
            </button>
          )
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="p-2 border-t border-white/40">
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/50 transition-colors overflow-hidden"
          title={collapsed ? '展开侧边栏' : '收起侧边栏'}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">收起</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
