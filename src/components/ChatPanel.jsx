import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function ChatPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const chatHistory = useRef([])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const buildContext = async () => {
    try {
      const { data: locations } = await supabase.from('locations').select('id,name')
      const { data: items } = await supabase.from('inventory_items').select('*').limit(100)
      let ctx = '[Inventory Data]\n'
      if (locations) ctx += 'Locations: ' + locations.map(l => l.name).join(', ') + '\n'
      if (items) ctx += 'Items(' + items.length + '): ' + JSON.stringify(items.slice(0, 30)) + '\n'
      return ctx
    } catch (e) {
      return '(Failed to load inventory data)'
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)

    try {
      const context = await buildContext()
      const fullMsg = context + '\n\nQuestion: ' + userMsg

      const res = await fetch('/.netlify/functions/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: fullMsg, history: chatHistory.current.slice(-8) }),
      })

      if (!res.ok) throw new Error('API error: ' + res.status)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let assistantMsg = ''
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.type === 'content_block_delta' && data.delta?.text) {
                assistantMsg += data.delta.text
                setMessages(prev => {
                  const updated = [...prev]
                  updated[updated.length - 1] = { role: 'assistant', content: assistantMsg }
                  return updated
                })
              }
            } catch (e) { /* skip */ }
          }
        }
      }

      chatHistory.current.push({ role: 'user', content: userMsg })
      chatHistory.current.push({ role: 'assistant', content: assistantMsg })
    } catch (err) {
      console.error('Chat error:', err)
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error occurred. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 bg-blue-600 hover:bg-blue-700 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg"
        title="AI Chat"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 h-[32rem] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
      <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">\u{1F916}</span>
          <span className="font-bold text-sm">AI Assistant</span>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-white hover:text-gray-200 text-xl leading-none">&times;</button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm mt-8">
            <p>Ask about inventory data</p>
            <p className="mt-2 text-xs">Example: Current stock at Noda warehouse?</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={"flex " + (msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={"max-w-[80%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap " +
              (msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-800')}>
              {msg.content || (loading && i === messages.length - 1 ? 'Thinking...' : '')}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-200 p-3 bg-white">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Type your question..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
        }
