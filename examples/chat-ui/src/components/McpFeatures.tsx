import React, { useState } from 'react'
import { type Resource, type Prompt } from 'use-mcp/react'
import { FileText, MessageSquare, X } from 'lucide-react'

interface McpFeaturesProps {
  resources: Resource[]
  prompts: Prompt[]
  onPromptSelect: (prompt: Prompt) => void
  onResourceSelect: (resource: Resource) => void
}

export const McpFeatures: React.FC<McpFeaturesProps> = ({ resources, prompts, onPromptSelect, onResourceSelect }) => {
  const [activeTab, setActiveTab] = useState<'prompts' | 'resources'>('prompts')
  const [isOpen, setIsOpen] = useState(false)

  if (!isOpen && (resources.length > 0 || prompts.length > 0)) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 shadow-lg"
        title="MCP Features"
      >
        <MessageSquare size={24} />
      </button>
    )
  }

  if (!isOpen) return null

  return (
    <div className="fixed bottom-24 right-4 w-80 bg-white rounded-lg shadow-xl border border-zinc-200 overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-zinc-200">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('prompts')}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              activeTab === 'prompts' ? 'bg-blue-100 text-blue-700' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Prompts ({prompts.length})
          </button>
          <button
            onClick={() => setActiveTab('resources')}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              activeTab === 'resources' ? 'bg-blue-100 text-blue-700' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Resources ({resources.length})
          </button>
        </div>
        <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-zinc-100 rounded">
          <X size={18} className="text-zinc-600" />
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto p-3">
        {activeTab === 'prompts' && (
          <div className="space-y-2">
            {prompts.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-4">No prompts available</p>
            ) : (
              prompts.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => {
                    onPromptSelect(prompt)
                    setIsOpen(false)
                  }}
                  className="w-full text-left p-3 rounded-lg border border-zinc-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <MessageSquare size={16} className="text-blue-600 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{prompt.name}</h4>
                      {prompt.description && <p className="text-xs text-zinc-500 mt-1">{prompt.description}</p>}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {activeTab === 'resources' && (
          <div className="space-y-2">
            {resources.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-4">No resources available</p>
            ) : (
              resources.map((resource, index) => (
                <button
                  key={index}
                  onClick={() => {
                    onResourceSelect(resource)
                    setIsOpen(false)
                  }}
                  className="w-full text-left p-3 rounded-lg border border-zinc-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <FileText size={16} className="text-green-600 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{resource.name}</h4>
                      <p className="text-xs text-zinc-400 font-mono truncate">{resource.uri}</p>
                      {resource.description && <p className="text-xs text-zinc-500 mt-1">{resource.description}</p>}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}