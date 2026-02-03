import { create } from 'zustand'
import type { Resource, AppData, ResourceType } from './types'
import { v4 as uuidv4 } from 'uuid'

interface AppState extends AppData {
  searchQuery: string
  filterType: ResourceType | 'all'
  filterTags: string[]
  
  setSearchQuery: (query: string) => void
  setFilterType: (type: ResourceType | 'all') => void
  setFilterTags: (tags: string[]) => void
  
  addResource: (resource: Omit<Resource, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateResource: (id: string, resource: Partial<Resource>) => void
  deleteResource: (id: string) => void
  
  addTag: (tag: string) => void
  removeTag: (tag: string) => void
  
  loadData: (data: AppData) => void
  getData: () => AppData
  
  getFilteredResources: () => Resource[]
}

export const useStore = create<AppState>((set, get) => ({
  resources: [],
  tags: [],
  searchQuery: '',
  filterType: 'all',
  filterTags: [],
  
  setSearchQuery: (query) => set({ searchQuery: query }),
  setFilterType: (type) => set({ filterType: type }),
  setFilterTags: (tags) => set({ filterTags: tags }),
  
  addResource: (resource) => {
    const now = Date.now()
    const newResource: Resource = {
      ...resource,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now
    }
    set((state) => ({
      resources: [...state.resources, newResource]
    }))
  },
  
  updateResource: (id, updates) => {
    set((state) => ({
      resources: state.resources.map((r) =>
        r.id === id ? { ...r, ...updates, updatedAt: Date.now() } : r
      )
    }))
  },
  
  deleteResource: (id) => {
    set((state) => ({
      resources: state.resources.filter((r) => r.id !== id)
    }))
  },
  
  addTag: (tag) => {
    set((state) => ({
      tags: state.tags.includes(tag) ? state.tags : [...state.tags, tag]
    }))
  },
  
  removeTag: (tag) => {
    set((state) => ({
      tags: state.tags.filter((t) => t !== tag)
    }))
  },
  
  loadData: (data) => {
    set({
      resources: data.resources || [],
      tags: data.tags || []
    })
  },
  
  getData: () => {
    const { resources, tags } = get()
    return { resources, tags }
  },
  
  getFilteredResources: () => {
    const { resources, searchQuery, filterType, filterTags } = get()
    
    return resources.filter((r) => {
      if (filterType !== 'all' && r.type !== filterType) return false
      if (filterTags.length > 0 && !filterTags.some((t) => r.tags.includes(t))) return false
      
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return (
          r.name.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q)
        )
      }
      
      return true
    })
  }
}))
