"use client"

import { useState, useEffect, useRef } from "react"
import { useAuth } from "@clerk/nextjs"
import { toast } from "sonner"
import { apiService, type ChatMessage, type ChatSession } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { 
  MessageSquare, 
  Send, 
  Bot, 
  User, 
  Plus,
  History,
  Loader2,
  Leaf
} from "lucide-react"

export default function ChatPage() {
  const { isSignedIn, getToken } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null)
  const [inputMessage, setInputMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [loadingSessions, setLoadingSessions] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Initialize auth token
  useEffect(() => {
    const initToken = async () => {
      if (isSignedIn) {
        const token = await getToken()
        apiService.setAuthToken(token || null)
        await loadChatSessions()
      }
    }
    void initToken()
  }, [isSignedIn])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Load chat sessions
  const loadChatSessions = async () => {
    try {
      setLoadingSessions(true)
      const response = await apiService.getChatSessions()
      if (response.success && response.data) {
        setSessions(response.data.sessions)
        // Auto-select the most recent session if available
        if (response.data.sessions.length > 0) {
          const mostRecent = response.data.sessions[0]
          setCurrentSessionId(mostRecent.id)
          await loadChatMessages(mostRecent.id)
        }
      }
    } catch (error) {
      console.error('Failed to load chat sessions:', error)
      toast.error('Failed to load chat history')
    } finally {
      setLoadingSessions(false)
    }
  }

  // Load messages for a specific session
  const loadChatMessages = async (sessionId: number) => {
    try {
      const response = await apiService.getChatMessages(sessionId)
      if (response.success && response.data) {
        setMessages(response.data.messages)
      }
    } catch (error) {
      console.error('Failed to load chat messages:', error)
      toast.error('Failed to load chat messages')
    }
  }

  // Send a new message
  const sendMessage = async () => {
    if (!inputMessage.trim()) return

    const userMessage = inputMessage.trim()
    setInputMessage("")
    setLoading(true)

    // Add user message to UI immediately
    const tempUserMessage: ChatMessage = {
      id: Date.now(),
      session_id: currentSessionId || 0,
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    }
    setMessages(prev => [...prev, tempUserMessage])

    try {
      const response = await apiService.sendChatMessage(userMessage, currentSessionId || undefined)
      
      if (response.success && response.data) {
        // Update session ID if this was a new session
        if (!currentSessionId) {
          setCurrentSessionId(response.data.session_id)
          await loadChatSessions() // Refresh sessions list
        }

        // Add assistant response
        const assistantMessage: ChatMessage = {
          id: response.data.message_id,
          session_id: response.data.session_id,
          role: 'assistant',
          content: response.data.response,
          timestamp: response.data.timestamp
        }

        // Replace temp message with actual messages from server
        setMessages(prev => {
          const withoutTemp = prev.filter(msg => msg.id !== tempUserMessage.id)
          return [...withoutTemp, 
            { ...tempUserMessage, id: Date.now() - 1 }, // Actual user message
            assistantMessage
          ]
        })
      } else {
        throw new Error(response.error || 'Failed to send message')
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      toast.error('Failed to send message. Please try again.')
      // Remove the temporary message on error
      setMessages(prev => prev.filter(msg => msg.id !== tempUserMessage.id))
    } finally {
      setLoading(false)
    }
  }

  // Start a new chat session
  const startNewSession = () => {
    setCurrentSessionId(null)
    setMessages([])
  }

  // Select a different session
  const selectSession = async (sessionId: number) => {
    setCurrentSessionId(sessionId)
    await loadChatMessages(sessionId)
  }

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-8rem)]">
        
        {/* Chat Sessions Sidebar */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Chat History
            </CardTitle>
            <Button 
              onClick={startNewSession}
              className="w-full"
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Chat
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[400px] overflow-y-auto">
              {loadingSessions ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : sessions.length > 0 ? (
                <div className="space-y-2 p-4">
                  {sessions.map((session) => (
                    <Button
                      key={session.id}
                      variant={currentSessionId === session.id ? "default" : "ghost"}
                      className="w-full justify-start text-left h-auto p-3"
                      onClick={() => selectSession(session.id)}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium truncate max-w-full">
                          {session.session_title}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {session.message_count} messages
                        </span>
                      </div>
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="text-center p-4 text-muted-foreground">
                  No chat history yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Main Chat Area */}
        <Card className="lg:col-span-3 flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Leaf className="h-5 w-5 text-green-600" />
              AgriTech AI Assistant
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Get personalized farming advice, crop recommendations, and agricultural insights
            </p>
          </CardHeader>
          
          <CardContent className="flex-1 flex flex-col p-0">
            {/* Messages Area */}
            <div className="flex-1 p-4 overflow-y-auto">
              <div className="space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center py-12">
                    <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium mb-2">Welcome to AgriTech AI</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      Ask me anything about farming, crops, soil management, pest control, 
                      weather patterns, or any agricultural topic. I&apos;m here to help!
                    </p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {message.role === 'assistant' && (
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-green-100">
                            <Bot className="h-4 w-4 text-green-600" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                      
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{message.content}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                      
                      {message.role === 'user' && (
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            <User className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input Area */}
            <div className="border-t p-4">
              <div className="flex gap-2">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask about farming, crops, soil, weather, or any agricultural topic..."
                  disabled={loading}
                  className="flex-1"
                />
                <Button 
                  onClick={sendMessage}
                  disabled={loading || !inputMessage.trim()}
                  size="icon"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Press Enter to send, Shift+Enter for new line
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}