import { useStore } from '../store'
import { 
  LayoutDashboard, 
  FolderKanban, 
  ListTodo, 
  Bot, 
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from 'lucide-react'

const menuItems = [
  { id: 'dashboard', label: '控制台', icon: LayoutDashboard, color: 'blue' },
  { id: 'projects', label: '项目', icon: FolderKanban, color: 'purple' },
  { id: 'tasks', label: '任务', icon: ListTodo, color: 'cyan' },
  { id: 'droids', label: 'Droids', icon: Bot, color: 'green' },
  { id: 'settings', label: '设置', icon: Settings, color: 'yellow' },
] as const

export function Sidebar() {
  const { currentView, setView, sidebarCollapsed, toggleSidebar, status } = useStore()

  return (
    <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
      {/* Logo */}
      <div className="glass" style={{ 
        borderRadius: 'var(--radius-xl)',
        padding: sidebarCollapsed ? 'var(--space-3)' : 'var(--space-4)',
        marginBottom: 'var(--space-2)'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 'var(--space-3)',
          justifyContent: sidebarCollapsed ? 'center' : 'flex-start'
        }}>
          <div className="icon-box icon-box-md" style={{
            background: 'linear-gradient(135deg, var(--prism-blue) 0%, var(--prism-purple) 100%)',
            border: 'none',
            boxShadow: '0 4px 14px -2px rgba(96, 165, 250, 0.4)'
          }}>
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          {!sidebarCollapsed && (
            <div className="animate-fade-in">
              <div style={{ 
                fontSize: '15px', 
                fontWeight: 600, 
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em'
              }}>
                Workflow
              </div>
              <div style={{ 
                fontSize: '11px', 
                color: 'var(--text-muted)',
                fontFamily: "'Geist Mono', monospace",
                letterSpacing: '0.05em'
              }}>
                SCHEDULER
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status Card */}
      {!sidebarCollapsed && status && (
        <div className="glass animate-fade-in" style={{ 
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-3) var(--space-4)',
          marginBottom: 'var(--space-2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span className={`status-orb ${status.running > 0 ? 'running' : 'idle'}`} />
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1 }}>
              {status.running > 0 ? `${status.running} 运行中` : '空闲'}
            </span>
            {status.pending > 0 && (
              <span className="badge badge-yellow">{status.pending}</span>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        gap: 'var(--space-1)',
        overflow: 'auto',
        paddingTop: 'var(--space-2)'
      }}>
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = currentView === item.id
          
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={isActive ? 'nav-item-active' : 'nav-item'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: sidebarCollapsed ? 'var(--space-3)' : 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid',
                borderColor: isActive ? 'var(--glass-border-active)' : 'transparent',
                cursor: 'pointer',
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                transition: 'all var(--duration-fast) var(--ease-out-expo)',
                background: isActive ? 'var(--glass-bg-active)' : 'transparent',
              }}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <div className={`icon-box icon-box-sm icon-box-${item.color}`} style={{
                opacity: isActive ? 1 : 0.7
              }}>
                <Icon style={{ 
                  width: 16, 
                  height: 16,
                  color: `var(--prism-${item.color})`
                }} />
              </div>
              {!sidebarCollapsed && (
                <span style={{ 
                  fontSize: '13px', 
                  fontWeight: 500,
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)'
                }}>
                  {item.label}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Collapse Toggle */}
      <button
        onClick={toggleSidebar}
        className="btn btn-ghost"
        style={{
          width: '100%',
          justifyContent: 'center',
          marginTop: 'auto',
          color: 'var(--text-muted)'
        }}
      >
        {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  )
}
