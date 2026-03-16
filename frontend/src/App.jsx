import { useEffect, useRef, useState } from 'react'

const WELCOME_MESSAGE =
  'Hi! Tell me what happened, and I’ll help fill in the incident form.'

export default function App() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: WELCOME_MESSAGE },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [formState, setFormState] = useState({})
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (!textareaRef.current) return
    textareaRef.current.style.height = '24px'
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`
  }, [input])

  const sendMessage = async () => {
    const messageToSend = input.trim()
    if (!messageToSend || loading) return

    setMessages((prev) => [...prev, { role: 'user', content: messageToSend }])
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('http://localhost:3000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageToSend }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Request failed')
      }

      setFormState(data.form_state || {})
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.next_question || 'Got it.',
        },
      ])
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'Error connecting to backend. Check that your backend is running on port 3000.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleNewChat = () => {
    setMessages([{ role: 'assistant', content: WELCOME_MESSAGE }])
    setFormState({})
    setInput('')
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <button className="new-chat-btn" onClick={handleNewChat}>
          + New chat
        </button>

        <div className="sidebar-section">
          <div className="sidebar-title">Incident form state</div>

          {Object.keys(formState).length === 0 ? (
            <div className="empty-box">No fields filled yet</div>
          ) : (
            <div className="field-list">
              {Object.entries(formState).map(([key, value]) => (
                <div className="field-item" key={key}>
                  <div className="field-key">{key}</div>
                  <div className="field-value">{String(value)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-title">GIROC Incident Assistant</div>
        </header>

        <section className="chat-scroll">
          <div className="chat-content">
            {messages.length === 1 && (
              <div className="hero">
                <h1>How can I help with your incident report?</h1>
              </div>
            )}

            {messages.map((msg, index) => (
              <div key={index} className="message-row">
                <div className={`avatar ${msg.role}`}>
                  {msg.role === 'user' ? 'U' : 'AI'}
                </div>
                <div className="message-text">{msg.content}</div>
              </div>
            ))}

            {loading && (
              <div className="message-row">
                <div className="avatar assistant">AI</div>
                <div className="message-text">Thinking...</div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </section>

        <footer className="composer-shell">
          <div className="composer-wrap">
            <div className="composer">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message GIROC Incident Assistant"
                rows={1}
              />
              <button
                className="send-btn"
                onClick={sendMessage}
                disabled={!input.trim() || loading}
              >
                ↑
              </button>
            </div>
            <div className="composer-footer">Incident chatbot prototype</div>
          </div>
        </footer>
      </main>
    </div>
  )
}