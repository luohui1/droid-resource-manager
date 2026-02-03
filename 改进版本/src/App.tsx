import { useEffect } from 'react'
import { useStore } from './store'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './components/Dashboard'
import { ProjectsView } from './components/ProjectsView'
import { TasksView } from './components/TasksView'
import { DroidsView } from './components/DroidsView'
import { SettingsView } from './components/SettingsView'
import type { Task, DroidState } from './types'

export default function App() {
  const { 
    currentView, 
    setProjects, 
    setTasks, 
    setDroidStates, 
    setConfig, 
    setStatus,
    updateTask,
    updateDroidState
  } = useStore()

  useEffect(() => {
    const loadData = async () => {
      if (!window.api) return

      const [projects, tasks, droidStates, config, status] = await Promise.all([
        window.api.projects.list(),
        window.api.tasks.list(),
        window.api.droids.list(),
        window.api.scheduler.config(),
        window.api.scheduler.status()
      ])

      setProjects(projects)
      setTasks(tasks)
      setDroidStates(droidStates)
      setConfig(config)
      setStatus(status)
    }

    loadData()

    window.api?.on('scheduler:event:task-status', (data: unknown) => {
      const { taskId, status } = data as { taskId: string; status: string }
      updateTask(taskId, { status: status as Task['status'] })
    })

    window.api?.on('scheduler:event:task-output', (data: unknown) => {
      const { taskId, event } = data as { taskId: string; event: { text?: string } }
      if (event.text) {
        useStore.getState().addTaskOutput(taskId, event.text)
      }
    })

    window.api?.on('scheduler:event:droid-status', (data: unknown) => {
      const { droidId, status } = data as { droidId: string; status: string }
      updateDroidState(droidId, { status: status as DroidState['status'] })
    })

    return () => {
      window.api?.off('scheduler:event:task-status')
      window.api?.off('scheduler:event:task-output')
      window.api?.off('scheduler:event:droid-status')
    }
  }, [setProjects, setTasks, setDroidStates, setConfig, setStatus, updateTask, updateDroidState])

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />
      case 'projects':
        return <ProjectsView />
      case 'tasks':
        return <TasksView />
      case 'droids':
        return <DroidsView />
      case 'settings':
        return <SettingsView />
      default:
        return <Dashboard />
    }
  }

  return (
    <>
      {/* Aurora Background */}
      <div className="aurora-bg" />
      
      {/* App Shell */}
      <div className="app-shell">
        <Sidebar />
        <main className="main-area">
          {renderView()}
        </main>
      </div>
    </>
  )
}
