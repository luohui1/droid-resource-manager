import { useStore } from '../store'
import { 
  Activity, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Plus,
  ArrowUpRight,
  Zap
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

export function Dashboard() {
  const { status, tasks, droidStates, projects, setView } = useStore()

  const recentTasks = [...tasks.pending, ...tasks.history]
    .sort((a, b) => (b.startedAt || b.createdAt) - (a.startedAt || a.createdAt))
    .slice(0, 5)

  return (
    <div className="content-panel glass" style={{ padding: 0 }}>
      <div style={{ 
        flex: 1, 
        overflow: 'auto',
        padding: 'var(--space-8)'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }} className="stagger-children">
          {/* Header */}
          <div className="flex-between" style={{ marginBottom: 'var(--space-8)' }}>
            <div>
              <h1 style={{ 
                fontSize: '28px', 
                fontWeight: 600, 
                color: 'var(--text-primary)',
                letterSpacing: '-0.03em',
                marginBottom: 'var(--space-1)'
              }}>
                控制台
              </h1>
              <p style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>
                工作流调度系统概览
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => setView('tasks')}>
              <Plus className="w-4 h-4" />
              新建任务
            </button>
          </div>

          {/* Stats Grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(4, 1fr)', 
            gap: 'var(--space-4)',
            marginBottom: 'var(--space-8)'
          }}>
            <StatCard
              icon={Activity}
              label="运行中"
              value={status?.running ?? 0}
              color="cyan"
              trend={status?.running ? '+' : undefined}
            />
            <StatCard
              icon={Clock}
              label="队列中"
              value={status?.pending ?? 0}
              color="yellow"
            />
            <StatCard
              icon={CheckCircle2}
              label="已完成"
              value={status?.completed ?? 0}
              color="green"
            />
            <StatCard
              icon={XCircle}
              label="失败"
              value={status?.failed ?? 0}
              color="red"
            />
          </div>

          {/* Main Grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '2fr 1fr', 
            gap: 'var(--space-6)'
          }}>
            {/* Recent Tasks */}
            <div className="glass-subtle" style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
              <div className="flex-between" style={{ 
                padding: 'var(--space-5) var(--space-6)',
                borderBottom: '1px solid var(--glass-border)'
              }}>
                <span style={{ 
                  fontSize: '13px', 
                  fontWeight: 600, 
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  最近任务
                </span>
                <button 
                  className="btn btn-ghost"
                  onClick={() => setView('tasks')}
                  style={{ fontSize: '12px', gap: 'var(--space-1)' }}
                >
                  查看全部
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
              <div>
                {recentTasks.length === 0 ? (
                  <div className="empty-state" style={{ padding: 'var(--space-10)' }}>
                    <Zap className="empty-state-icon" />
                    <p style={{ color: 'var(--text-muted)' }}>暂无任务</p>
                  </div>
                ) : (
                  recentTasks.map((task, i) => (
                    <TaskRow key={task.id} task={task} isLast={i === recentTasks.length - 1} />
                  ))
                )}
              </div>
            </div>

            {/* Droids & Projects */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Droids */}
              <div className="glass-subtle" style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
                <div className="flex-between" style={{ 
                  padding: 'var(--space-4) var(--space-5)',
                  borderBottom: '1px solid var(--glass-border)'
                }}>
                  <span style={{ 
                    fontSize: '12px', 
                    fontWeight: 600, 
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    Droids
                  </span>
                  <span className="badge badge-cyan">{droidStates.length}</span>
                </div>
                <div style={{ padding: 'var(--space-3)' }}>
                  {droidStates.length === 0 ? (
                    <div style={{ 
                      padding: 'var(--space-6)', 
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                      fontSize: '13px'
                    }}>
                      未发现 Droid
                    </div>
                  ) : (
                    droidStates.slice(0, 4).map(droid => (
                      <DroidMiniCard key={droid.id} droid={droid} />
                    ))
                  )}
                </div>
              </div>

              {/* Projects */}
              <div className="glass-subtle" style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden', flex: 1 }}>
                <div className="flex-between" style={{ 
                  padding: 'var(--space-4) var(--space-5)',
                  borderBottom: '1px solid var(--glass-border)'
                }}>
                  <span style={{ 
                    fontSize: '12px', 
                    fontWeight: 600, 
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    项目
                  </span>
                  <span className="badge badge-purple">{projects.length}</span>
                </div>
                <div style={{ padding: 'var(--space-3)' }}>
                  {projects.length === 0 ? (
                    <div style={{ 
                      padding: 'var(--space-6)', 
                      textAlign: 'center'
                    }}>
                      <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: 'var(--space-3)' }}>
                        尚未添加项目
                      </p>
                      <button 
                        className="btn btn-secondary"
                        onClick={() => setView('projects')}
                        style={{ fontSize: '12px' }}
                      >
                        <Plus className="w-3 h-3" />
                        添加项目
                      </button>
                    </div>
                  ) : (
                    projects.slice(0, 3).map(project => (
                      <div 
                        key={project.id}
                        style={{
                          padding: 'var(--space-3)',
                          borderRadius: 'var(--radius-md)',
                          marginBottom: 'var(--space-1)'
                        }}
                      >
                        <div style={{ 
                          fontSize: '13px', 
                          fontWeight: 500, 
                          color: 'var(--text-primary)',
                          marginBottom: '2px'
                        }}>
                          {project.name}
                        </div>
                        <div style={{ 
                          fontSize: '11px', 
                          color: 'var(--text-muted)',
                          fontFamily: "'Geist Mono', monospace"
                        }} className="truncate">
                          {project.path}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  color,
  trend
}: { 
  icon: React.ElementType
  label: string
  value: number
  color: 'cyan' | 'yellow' | 'green' | 'red'
  trend?: string
}) {
  const colorVars: Record<string, string> = {
    cyan: 'var(--prism-cyan)',
    yellow: 'var(--color-warning)',
    green: 'var(--color-success)',
    red: 'var(--color-error)'
  }

  return (
    <div className="card" style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: 'var(--space-4)'
    }}>
      <div className={`icon-box icon-box-lg icon-box-${color}`}>
        <Icon style={{ width: 22, height: 22, color: colorVars[color] }} />
      </div>
      <div>
        <div style={{ 
          fontFamily: "'Geist Mono', monospace",
          fontSize: '28px', 
          fontWeight: 600, 
          color: 'var(--text-primary)',
          lineHeight: 1,
          display: 'flex',
          alignItems: 'baseline',
          gap: 'var(--space-2)'
        }}>
          {value}
          {trend && (
            <span style={{ fontSize: '12px', color: 'var(--color-success)', fontWeight: 500 }}>
              {trend}
            </span>
          )}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
          {label}
        </div>
      </div>
    </div>
  )
}

function TaskRow({ task, isLast }: { task: import('../types').Task; isLast: boolean }) {
  const statusColors: Record<string, string> = {
    pending: 'yellow', queued: 'yellow', running: 'cyan',
    completed: 'green', failed: 'red', cancelled: 'red'
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-4)',
      padding: 'var(--space-4) var(--space-6)',
      borderBottom: isLast ? 'none' : '1px solid var(--glass-border)',
      transition: 'background var(--duration-fast)',
      cursor: 'pointer'
    }}>
      <span className={`status-orb ${task.status}`} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '2px' }} className="truncate">
          {task.name}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }} className="truncate">
          {task.prompt}
        </div>
      </div>
      <span className={`badge badge-${statusColors[task.status]}`}>{task.status}</span>
      <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontFamily: "'Geist Mono', monospace" }}>
        {formatDistanceToNow(task.startedAt || task.createdAt, { addSuffix: true, locale: zhCN })}
      </span>
    </div>
  )
}

function DroidMiniCard({ droid }: { droid: import('../types').DroidState }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      padding: 'var(--space-3)',
      borderRadius: 'var(--radius-md)',
      transition: 'background var(--duration-fast)',
      cursor: 'pointer'
    }}>
      <span className={`status-orb ${droid.status}`} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }} className="truncate">
          {droid.name}
        </div>
      </div>
      {droid.queuedTaskIds.length > 0 && (
        <span className="badge badge-yellow">{droid.queuedTaskIds.length}</span>
      )}
    </div>
  )
}
