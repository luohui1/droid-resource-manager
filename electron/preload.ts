import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // 资源数据
  loadData: () => ipcRenderer.invoke('load-data'),
  saveData: (data: unknown) => ipcRenderer.invoke('save-data', data),
  getDataPath: () => ipcRenderer.invoke('get-data-path'),
  exportData: (data: unknown) => ipcRenderer.invoke('export-data', data),
  importData: () => ipcRenderer.invoke('import-data'),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  marketplaceFetch: (url: string) => ipcRenderer.invoke('marketplace-fetch', url),
  marketplaceSkillImport: (url: string) => ipcRenderer.invoke('marketplace-skill-import', url),
  
  // MCP 管理
  mcpList: () => ipcRenderer.invoke('mcp-list'),
  mcpEnable: (name: string) => ipcRenderer.invoke('mcp-enable', name),
  mcpDisable: (name: string) => ipcRenderer.invoke('mcp-disable', name),
  mcpConnect: (name: string) => ipcRenderer.invoke('mcp-connect', name),
  mcpDisconnect: (name: string) => ipcRenderer.invoke('mcp-disconnect', name),
  mcpCallTool: (name: string, toolName: string, args: unknown) => ipcRenderer.invoke('mcp-call-tool', name, toolName, args),
  mcpGetStatus: (name: string) => ipcRenderer.invoke('mcp-get-status', name),
  mcpCheckUpdate: (name: string) => ipcRenderer.invoke('mcp-check-update', name),
  mcpAdd: (name: string, config: unknown) => ipcRenderer.invoke('mcp-add', name, config),
  mcpRemove: (name: string) => ipcRenderer.invoke('mcp-remove', name),
  mcpUpdate: (name: string, config: unknown) => ipcRenderer.invoke('mcp-update', name, config),
  mcpGetConfigPath: () => ipcRenderer.invoke('mcp-get-config-path'),
  resourceCenterList: () => ipcRenderer.invoke('resource-center-list'),
  resourceCenterMcpAdd: (name: string, config: unknown) => ipcRenderer.invoke('resource-center-mcp-add', name, config),
  resourceCenterSkillCreate: (name: string, content: string) => ipcRenderer.invoke('resource-center-skill-create', name, content),
  
  // AI 翻译
  aiTranslate: (text: string) => ipcRenderer.invoke('ai-translate', text),
  aiExplainSkill: (content: string) => ipcRenderer.invoke('ai-explain-skill', content),
  aiGetSettings: () => ipcRenderer.invoke('ai-get-settings'),
  aiSaveSettings: (settings: { url: string; apiKey: string; model: string; skillsModel: string }) => ipcRenderer.invoke('ai-save-settings', settings),
  aiFetchModels: () => ipcRenderer.invoke('ai-fetch-models'),
  
  // Skills 管理
  skillsGetGlobal: () => ipcRenderer.invoke('skills-get-global'),
  skillsDiscoverWork: () => ipcRenderer.invoke('skills-discover-work'),
  skillsGetProject: (projectPath: string) => ipcRenderer.invoke('skills-get-project', projectPath),
  skillsGet: (skillPath: string) => ipcRenderer.invoke('skills-get', skillPath),
  skillsCreate: (name: string, content: string, scope: 'global' | 'project', projectPath?: string) => 
    ipcRenderer.invoke('skills-create', name, content, scope, projectPath),
  skillsUpdate: (skillPath: string, content: string) => ipcRenderer.invoke('skills-update', skillPath, content),
  skillsDelete: (skillPath: string) => ipcRenderer.invoke('skills-delete', skillPath),
  skillsGetGlobalPath: () => ipcRenderer.invoke('skills-get-global-path'),
  skillsReadFile: (skillPath: string, fileName: string) => ipcRenderer.invoke('skills-read-file', skillPath, fileName),
  skillsSaveFile: (skillPath: string, fileName: string, content: string) => 
    ipcRenderer.invoke('skills-save-file', skillPath, fileName, content),
  skillsDeleteFile: (skillPath: string, fileName: string) => ipcRenderer.invoke('skills-delete-file', skillPath, fileName),
  skillsSelectProject: () => ipcRenderer.invoke('skills-select-project'),
  skillsImportFolder: (scope: 'global' | 'project', projectPath?: string) => 
    ipcRenderer.invoke('skills-import-folder', scope, projectPath),
  skillsImportDirectory: (scope: 'global' | 'project', projectPath?: string) => 
    ipcRenderer.invoke('skills-import-directory', scope, projectPath),
  skillsImportZip: (scope: 'global' | 'project', projectPath?: string) => 
    ipcRenderer.invoke('skills-import-zip', scope, projectPath),
  skillsGenerateAiSummary: (skillPath: string, content: string) => 
    ipcRenderer.invoke('skills-generate-ai-summary', skillPath, content),
  skillsSaveAiSummary: (skillPath: string, summary: string) => 
    ipcRenderer.invoke('skills-save-ai-summary', skillPath, summary),
  skillsCopy: (sourcePath: string, targetScope: 'global' | 'project', targetProjectPath?: string) => 
    ipcRenderer.invoke('skills-copy', sourcePath, targetScope, targetProjectPath),
  skillsMove: (sourcePath: string, targetScope: 'global' | 'project', targetProjectPath?: string) => 
    ipcRenderer.invoke('skills-move', sourcePath, targetScope, targetProjectPath),
  
  // Droids 管理
  droidsGetGlobal: () => ipcRenderer.invoke('droids-get-global'),
  droidsDiscoverWork: () => ipcRenderer.invoke('droids-discover-work'),
  droidsGetProject: (projectPath: string) => ipcRenderer.invoke('droids-get-project', projectPath),
  droidsGet: (droidPath: string) => ipcRenderer.invoke('droids-get', droidPath),
  droidsCreate: (data: {
    name: string
    description?: string
    model?: string
    reasoningEffort?: string
    tools?: string[] | string
    systemPrompt: string
  }, scope: 'global' | 'project', projectPath?: string) => 
    ipcRenderer.invoke('droids-create', data, scope, projectPath),
  droidsUpdate: (droidPath: string, data: {
    name?: string
    description?: string
    model?: string
    reasoningEffort?: string
    tools?: string[] | string
    systemPrompt?: string
  }) => ipcRenderer.invoke('droids-update', droidPath, data),
  droidsDelete: (droidPath: string) => ipcRenderer.invoke('droids-delete', droidPath),
  droidsGetGlobalPath: () => ipcRenderer.invoke('droids-get-global-path'),
  droidsSaveConfig: (droidName: string, config: unknown) => 
    ipcRenderer.invoke('droids-save-config', droidName, config),
  droidsGetTools: () => ipcRenderer.invoke('droids-get-tools'),
  droidsGetToolCategories: () => ipcRenderer.invoke('droids-get-tool-categories'),
  droidsSelectProject: () => ipcRenderer.invoke('droids-select-project'),
  droidsGenerateAiSummary: (droidPath: string, droidName: string, content: string) => 
    ipcRenderer.invoke('droids-generate-ai-summary', droidPath, droidName, content),
  droidsCopy: (sourcePath: string, targetScope: 'global' | 'project', targetProjectPath?: string) => 
    ipcRenderer.invoke('droids-copy', sourcePath, targetScope, targetProjectPath),
  droidsMove: (sourcePath: string, targetScope: 'global' | 'project', targetProjectPath?: string) =>
    ipcRenderer.invoke('droids-move', sourcePath, targetScope, targetProjectPath),
  
  // Prompts 管理
  promptsGetAll: () => ipcRenderer.invoke('prompts-get-all'),
  promptsGet: (promptPath: string) => ipcRenderer.invoke('prompts-get', promptPath),
  promptsCreate: (name: string, content: string, description: string, category: string, linkedResources: string[]) => 
    ipcRenderer.invoke('prompts-create', name, content, description, category, linkedResources),
  promptsUpdate: (promptPath: string, content: string, description: string, category: string, linkedResources: string[]) => 
    ipcRenderer.invoke('prompts-update', promptPath, content, description, category, linkedResources),
  promptsDelete: (promptPath: string) => ipcRenderer.invoke('prompts-delete', promptPath),
  promptsGetPath: () => ipcRenderer.invoke('prompts-get-path'),
  promptsGetCount: () => ipcRenderer.invoke('prompts-get-count'),
  
  // Rules 管理
  rulesGetGlobal: () => ipcRenderer.invoke('rules-get-global'),
  rulesGetProject: (projectPath: string) => ipcRenderer.invoke('rules-get-project', projectPath),
  rulesGet: (rulePath: string) => ipcRenderer.invoke('rules-get', rulePath),
  rulesCreate: (name: string, content: string, scope: 'global' | 'project', projectPath: string | undefined, description: string, category: string, priority: number, globs: string[], linkedResources: string[]) => 
    ipcRenderer.invoke('rules-create', name, content, scope, projectPath, description, category, priority, globs, linkedResources),
  rulesUpdate: (rulePath: string, content: string, description: string, category: string, priority: number, globs: string[], linkedResources: string[]) => 
    ipcRenderer.invoke('rules-update', rulePath, content, description, category, priority, globs, linkedResources),
  rulesDelete: (rulePath: string) => ipcRenderer.invoke('rules-delete', rulePath),
  rulesGetGlobalPath: () => ipcRenderer.invoke('rules-get-global-path'),
  rulesGetGlobalCount: () => ipcRenderer.invoke('rules-get-global-count'),
  rulesSelectProject: () => ipcRenderer.invoke('skills-select-project'),
  rulesCopy: (sourcePath: string, targetScope: 'global' | 'project', targetProjectPath?: string) => 
    ipcRenderer.invoke('rules-copy', sourcePath, targetScope, targetProjectPath),
})
