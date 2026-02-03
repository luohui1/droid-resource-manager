import { v4 as uuidv4 } from 'uuid'
import { Storage } from './storage'
import type { Project, CreateProjectDto } from './types'

export class ProjectManager {
  private storage: Storage

  constructor(userDataPath: string) {
    this.storage = new Storage(userDataPath)
  }

  listProjects(): Project[] {
    return this.storage.getProjects()
  }

  getProject(id: string): Project | undefined {
    return this.storage.getProjects().find(p => p.id === id)
  }

  addProject(dto: CreateProjectDto): Project {
    const projects = this.storage.getProjects()
    
    const project: Project = {
      id: uuidv4(),
      name: dto.name,
      path: dto.path,
      description: dto.description,
      defaultDroidId: dto.defaultDroidId,
      defaultModel: dto.defaultModel,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    projects.push(project)
    this.storage.saveProjects(projects)
    return project
  }

  updateProject(id: string, updates: Partial<CreateProjectDto>): Project | null {
    const projects = this.storage.getProjects()
    const index = projects.findIndex(p => p.id === id)
    
    if (index === -1) return null

    projects[index] = {
      ...projects[index],
      ...updates,
      updatedAt: Date.now()
    }

    this.storage.saveProjects(projects)
    return projects[index]
  }

  deleteProject(id: string): boolean {
    const projects = this.storage.getProjects()
    const filtered = projects.filter(p => p.id !== id)
    
    if (filtered.length === projects.length) return false
    
    this.storage.saveProjects(filtered)
    return true
  }
}
