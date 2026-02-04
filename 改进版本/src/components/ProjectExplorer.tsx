import { useEffect, useState } from 'react'
import { ChevronRight, ChevronDown, FileText, Folder } from 'lucide-react'

interface FileNode {
  name: string
  path: string
  type: 'file' | 'dir'
  children?: FileNode[]
}

interface FilePreview {
  content?: string
  error?: string
}

export function ProjectExplorer({ projectPath }: { projectPath: string }) {
  const [tree, setTree] = useState<FileNode[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedFile, setSelectedFile] = useState<string>('')
  const [preview, setPreview] = useState<FilePreview | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!projectPath) return
    window.api.projects.tree(projectPath).then(setTree)
  }, [projectPath])

  const toggleDir = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const openFile = async (path: string) => {
    setSelectedFile(path)
    setLoading(true)
    const result = await window.api.projects.readFile(projectPath, path)
    setPreview(result)
    setLoading(false)
  }

  const renderNode = (node: FileNode, depth = 0) => {
    const paddingLeft = depth * 16
    if (node.type === 'dir') {
      const isOpen = expanded.has(node.path)
      return (
        <div key={node.path}>
          <div
            onClick={() => toggleDir(node.path)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-2)',
              paddingLeft: `calc(var(--space-3) + ${paddingLeft}px)`,
              cursor: 'pointer',
              borderRadius: 'var(--radius-md)'
            }}
          >
            {isOpen ? (
              <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
            )}
            <Folder className="w-3.5 h-3.5" style={{ color: 'var(--prism-purple)' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{node.name}</span>
          </div>
          {isOpen && node.children?.map(child => renderNode(child, depth + 1))}
        </div>
      )
    }

    return (
      <div
        key={node.path}
        onClick={() => openFile(node.path)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: 'var(--space-2)',
          paddingLeft: `calc(var(--space-4) + ${paddingLeft}px)`,
          cursor: 'pointer',
          borderRadius: 'var(--radius-md)',
          background: selectedFile === node.path ? 'var(--glass-bg-active)' : 'transparent'
        }}
      >
        <FileText className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }} className="truncate">{node.name}</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100%', gap: 'var(--space-4)' }}>
      {/* Tree */}
      <div style={{ width: '280px', borderRight: '1px solid var(--glass-border)', overflow: 'auto' }}>
        <div style={{ padding: 'var(--space-3)', fontSize: '12px', color: 'var(--text-muted)' }}>项目文件</div>
        <div style={{ padding: 'var(--space-2)' }}>
          {tree.map(node => renderNode(node))}
          {tree.length === 0 && (
            <div style={{ padding: 'var(--space-4)', fontSize: '12px', color: 'var(--text-muted)' }}>无文件</div>
          )}
        </div>
      </div>

      {/* Preview */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ padding: 'var(--space-3)', borderBottom: '1px solid var(--glass-border)' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{selectedFile || '请选择文件'}</div>
        </div>
        <div style={{ padding: 'var(--space-4)' }}>
          {loading && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>读取中...</div>}
          {!loading && preview?.error && (
            <div style={{ fontSize: '12px', color: 'var(--color-error)' }}>{preview.error}</div>
          )}
          {!loading && preview?.content && (
            <pre style={{
              fontSize: '12px',
              color: 'var(--text-secondary)',
              fontFamily: "'Geist Mono', monospace",
              whiteSpace: 'pre-wrap',
              lineHeight: 1.6,
              margin: 0
            }}>
              {preview.content}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}
