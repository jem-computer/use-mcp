import React, { useState, useEffect, FormEvent } from 'react'
import { storeName } from '../consts'
import '../styles/scrollbar.css'
import '../styles/github.css'
import '../styles/markdown.css'
import { type Conversation, type Message } from '../types'
import { type Model } from '../types/models'
import { type IDBPDatabase } from 'idb'
import { type Tool } from 'use-mcp/react'
import type { PromptWithServer, ResourceWithServer } from './McpFeatures'
import ChatMessage from './messages/ChatMessage.tsx'
import ChatInput from './ChatInput'
import ModelSelectionModal from './ModelSelectionModal'
import McpServerModal from './McpServerModal'
import { useAutoscroll } from '../hooks/useAutoscroll'
import { useStreamResponse } from '../hooks/useStreamResponse'
import { useConversationUpdater } from '../hooks/useConversationUpdater'
import { setApiKey } from '../utils/apiKeys'
import { hasApiKey } from '../utils/apiKeys'
import ApiKeyModal from './ApiKeyModal'
import { McpFeatures } from './McpFeatures'

interface ConversationThreadProps {
  conversations: Conversation[]
  conversationId?: number
  setConversationId: (id: number) => void
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>
  db: IDBPDatabase
  selectedModel: Model
  onApiKeyUpdate: () => void
  onModelChange: (model: Model) => void
  apiKeyUpdateTrigger: number
  mcpTools: Tool[]
  onMcpToolsUpdate: (tools: Tool[]) => void
  mcpResources: ResourceWithServer[]
  onMcpResourcesUpdate: (resources: ResourceWithServer[]) => void
  mcpPrompts: PromptWithServer[]
  onMcpPromptsUpdate: (prompts: PromptWithServer[]) => void
}

const ConversationThread: React.FC<ConversationThreadProps> = ({
  conversations,
  conversationId,
  setConversationId,
  setConversations,
  db,
  selectedModel,
  onApiKeyUpdate,
  onModelChange,
  apiKeyUpdateTrigger,
  mcpTools,
  onMcpToolsUpdate,
  mcpResources,
  onMcpResourcesUpdate,
  mcpPrompts,
  onMcpPromptsUpdate,
}) => {
  const [input, setInput] = useState<string>('')
  const [apiKeyModal, setApiKeyModal] = useState<{ isOpen: boolean; model: Model | null }>({
    isOpen: false,
    model: null,
  })
  const [modelSelectionModal, setModelSelectionModal] = useState(false)
  const [mcpServerModal, setMcpServerModal] = useState(false)

  const { messagesEndRef, messagesContainerRef, scrollToBottom } = useAutoscroll()

  const handleApiKeyRequired = async (model: Model): Promise<boolean> => {
    return new Promise((resolve) => {
      setApiKeyModal({
        isOpen: true,
        model,
      })

      // Store the resolve function to call when modal is closed
      window.apiKeyModalResolve = resolve
    })
  }

  const handleApiKeySave = (apiKey: string) => {
    if (apiKeyModal.model) {
      setApiKey(apiKeyModal.model.provider.id, apiKey)
      setApiKeyModal({ isOpen: false, model: null })
      // Notify parent that API key was updated
      onApiKeyUpdate()
      // Resolve the promise to continue with the request
      if (window.apiKeyModalResolve) {
        window.apiKeyModalResolve(true)
        delete window.apiKeyModalResolve
      }
    }
  }

  const handleApiKeyCancel = () => {
    setApiKeyModal({ isOpen: false, model: null })
    // Resolve the promise with false to cancel the request
    if (window.apiKeyModalResolve) {
      window.apiKeyModalResolve(false)
      delete window.apiKeyModalResolve
    }
  }

  const handlePromptSelect = async (prompt: PromptWithServer) => {
    if (!prompt.getPrompt) {
      console.error('No getPrompt function available for this prompt')
      return
    }

    try {
      // For now, we'll call the prompt without arguments
      // In a complete implementation, you would show a dialog to collect arguments
      // based on prompt.arguments schema
      const args: Record<string, string> = {}
      
      // If the prompt has required arguments, we should provide them
      // For the demo, let's provide some default values for known prompts
      if (prompt.name === 'party_invitation') {
        args.name = 'User'
        args.destination = 'Ibiza'
      } else if (prompt.name === 'party_announcement') {
        args.event = 'Demo'
        args.details = 'Testing MCP prompts integration'
      }
      
      console.log('Getting prompt:', prompt.name, 'with args:', args)
      
      // Call the getPrompt function
      const result = await prompt.getPrompt(prompt.name, args)
      
      // Add the returned messages to the conversation
      if (result && result.messages) {
        result.messages.forEach(msg => {
          const message: Message = msg.role === 'user' 
            ? {
                role: 'user',
                content: msg.content.text || JSON.stringify(msg.content)
              }
            : {
                role: 'assistant',
                type: 'content' as const,
                content: msg.content.text || JSON.stringify(msg.content)
              }
          
          updateConversation((conv) => ({
            ...conv,
            messages: [...conv.messages, message],
          }))
        })
      }
    } catch (error) {
      console.error('Error using prompt:', error)
      // Add error message to conversation
      const errorMessage: Message = {
        role: 'error',
        content: `Error using prompt: ${error}`,
        timestamp: Date.now()
      }
      updateConversation((conv) => ({
        ...conv,
        messages: [...conv.messages, errorMessage],
      }))
    }
  }

  const handleResourceSelect = async (resource: ResourceWithServer) => {
    if (!resource.readResource) {
      console.error('No readResource function available for this resource')
      setInput(`Read resource: ${resource.uri}`)
      return
    }

    try {
      console.log('Reading resource:', resource.uri)
      
      // Call the readResource function
      const result = await resource.readResource(resource.uri)
      
      // Add the resource content to the conversation
      if (result && result.contents) {
        result.contents.forEach(content => {
          const message: Message = {
            role: 'assistant',
            type: 'content' as const,
            content: `Resource: ${content.uri}\n\n${content.text || content.blob || 'No content'}`
          }
          
          updateConversation((conv) => ({
            ...conv,
            messages: [...conv.messages, message],
          }))
        })
      }
    } catch (error) {
      console.error('Error reading resource:', error)
      // Add error message to conversation
      const errorMessage: Message = {
        role: 'error',
        content: `Error reading resource: ${error}`,
        timestamp: Date.now()
      }
      updateConversation((conv) => ({
        ...conv,
        messages: [...conv.messages, errorMessage],
      }))
    }
  }

  const { updateConversation } = useConversationUpdater({
    conversationId,
    setConversations,
  })

  const { isLoading, setIsLoading, streamStarted, controller, streamResponse, aiResponseRef } = useStreamResponse({
    conversationId,
    setConversations,
    scrollToBottom,
    selectedModel,
    onApiKeyRequired: handleApiKeyRequired,
    mcpTools,
  })

  const currentConversation = conversations.find((conv) => conv.id === conversationId) || { messages: [], title: '' }

  //when new message chunks are streamed in, scroll to bottom
  useEffect(() => {
    scrollToBottom(isLoading && streamStarted)
  }, [aiResponseRef.current])

  //when conversation changes, scroll to bottom
  useEffect(scrollToBottom, [conversationId])

  //when conversation changes, reset input
  useEffect(() => {
    setInput('')
  }, [conversationId])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    if (currentConversation.messages.length === 0) {
      setConversations((prev) => {
        const updated = [...prev]
        updated.unshift({
          id: conversationId,
          title: 'New conversation',
          messages: [],
        })
        return updated
      })
    }

    const userMessage: Message = { role: 'user', content: input }

    setInput('')
    setIsLoading(true)

    updateConversation((conv) => ({
      ...conv,
      messages: [...conv.messages, userMessage],
    }))

    await streamResponse([...currentConversation.messages, userMessage])

    setIsLoading(false)
  }

  const storeMessages = async () => {
    if (!currentConversation.messages || currentConversation.messages.length === 0) {
      return
    }

    const store = db.transaction(storeName, 'readwrite').objectStore(storeName)
    const objectData = {
      id: conversationId,
      title: currentConversation.title,
      messages: currentConversation.messages,
    }
    const value = await store.put(objectData)
    setConversationId(Number(value))
  }

  useEffect(() => {
    if (db && conversationId) {
      storeMessages()
    }
  }, [conversations])

  // console.log({ currentConversation })

  return (
    <div className={`flex flex-col min-h-screen py-12 w-full ${currentConversation.messages.length === 0 ? 'justify-center' : ''}`}>
      <div
        ref={messagesContainerRef}
        className={`
        overflow-x-hidden
        ${currentConversation.messages.length === 0 ? 'flex items-center justify-center pb-6' : 'flex-1 overflow-y-scroll'}`}
      >
        <div className="max-w-2xl mx-auto w-full px-4">
          {currentConversation.messages.length === 0 ? (
            <div className="text-center">{/*<h1 className="text-9xl font-semibold text-zinc-800 h-20 overflow-auto">use-mcp</h1>*/}</div>
          ) : (
            <div className="py-4 px-4 space-y-4">
              {currentConversation.messages.map((message, index) => (
                <ChatMessage key={index} message={message} />
              ))}
              {isLoading && !streamStarted && <div className="text-center text-sm text-zinc-600">Thinking...</div>}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      <div className={`p-4 ${currentConversation.messages.length === 0 ? 'pb-20' : ''}`}>
        <div className="max-w-2xl mx-auto">
          <ChatInput
            input={input}
            setInput={setInput}
            handleSubmit={handleSubmit}
            isLoading={isLoading}
            streamStarted={streamStarted}
            controller={controller}
            messagesCount={currentConversation.messages.length}
          />

          {/* Model selector and MCP server indicators */}
          <div className="flex items-center justify-between mt-2">
            <button
              onClick={() => setModelSelectionModal(true)}
              className="flex items-center gap-2 text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer"
            >
              <span className="text-lg">🧠</span>
              <span className="text-sm text-zinc-500">
                {hasApiKey(selectedModel.provider.id) ? selectedModel.name + ' (' + selectedModel.provider.name + ')' : 'none'}
              </span>
            </button>

            <button
              onClick={() => setMcpServerModal(true)}
              className="flex items-center gap-2 text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer"
            >
              <span className="text-sm text-zinc-500">
                {(() => {
                  try {
                    const servers = JSON.parse(localStorage.getItem('mcpServers') || '[]') as Array<{ id: string; enabled: boolean }>
                    const toolCounts = JSON.parse(localStorage.getItem('mcpServerToolCounts') || '{}') as Record<string, number>

                    const enabledServers = servers.filter((s) => s.enabled).length
                    const totalServers = servers.length
                    const enabledTools = mcpTools.length

                    // Calculate total tools across all servers (including disabled ones that were previously connected)
                    const totalTools = servers.reduce((sum, server) => {
                      return sum + (toolCounts[server.id] || 0)
                    }, 0)

                    if (totalServers === 0) {
                      return '0/0 servers, 0/0 tools'
                    }

                    return `${enabledServers}/${totalServers} servers, ${enabledTools}/${totalTools} tools`
                  } catch {
                    return mcpTools.length > 0 ? `1/1 servers, ${mcpTools.length}/${mcpTools.length} tools` : '0/0 servers, 0/0 tools'
                  }
                })()}
              </span>
              <span className="text-lg">🔌</span>
            </button>
          </div>
        </div>
      </div>

      <ApiKeyModal
        isOpen={apiKeyModal.isOpen}
        onClose={handleApiKeyCancel}
        provider={apiKeyModal.model?.provider ?? { id: '', name: '', baseUrl: '', apiKeyHeader: '', documentationUrl: '' }}
        onSave={handleApiKeySave}
      />

      <ModelSelectionModal
        isOpen={modelSelectionModal}
        onClose={() => setModelSelectionModal(false)}
        selectedModel={selectedModel}
        onModelChange={onModelChange}
        apiKeyUpdateTrigger={apiKeyUpdateTrigger}
      />

      <McpServerModal 
        isOpen={mcpServerModal} 
        onClose={() => setMcpServerModal(false)} 
        onToolsUpdate={onMcpToolsUpdate}
        onResourcesUpdate={onMcpResourcesUpdate}
        onPromptsUpdate={onMcpPromptsUpdate}
      />

      <McpFeatures
        resources={mcpResources}
        prompts={mcpPrompts}
        onPromptSelect={handlePromptSelect}
        onResourceSelect={handleResourceSelect}
      />
    </div>
  )
}

export default ConversationThread
