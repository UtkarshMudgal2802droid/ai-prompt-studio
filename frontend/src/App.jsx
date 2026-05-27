import React, { useEffect, useMemo, useState, useRef } from 'react'
import axios from 'axios'
import './App.css'

const API_BASE_URL = 'https://ai-prompt-studio-yr1s.onrender.com'

const TOOLS = [
  {
    id: 'generate',
    title: 'Text Generation',
    subtitle: 'Create completions and ideas.',
    endpoint: '/api/generate',
    model: 'Qwen/Qwen2.5-1.5B-Instruct',
    kind: 'single',
    placeholder: "Describe what you'd like the AI to write — e.g., a product description, email draft, or blog intro",
    examples: [
      'Write a short intro for an AI project.',
      'Explain DevOps in simple language.',
      'Create a product pitch for a React app.',
    ],
    button: 'Generate',
    loadingText: 'Generating...',
  },
  {
    id: 'summarize',
    title: 'Summarization',
    subtitle: 'Compress long content.',
    endpoint: '/api/summarize',
    model: 'facebook/bart-large-cnn',
    kind: 'single',
    placeholder: 'Paste the text you want to shorten (works best with 100+ words)',
    examples: [
      'Summarize the importance of cloud computing.',
      'Make this article into 5 bullet points.',
      'Summarize this meeting note.',
    ],
    button: 'Summarize',
    loadingText: 'Summarizing...',
  },
  {
    id: 'sentiment',
    title: 'Sentiment',
    subtitle: 'Find tone and polarity.',
    endpoint: '/api/sentiment',
    model: 'twitter-roberta-sentiment',
    kind: 'single',
    placeholder: 'Type or paste any text to detect its emotional tone — positive, negative, or neutral',
    examples: [
      'This project is excellent and useful.',
      'I am disappointed by the slow response.',
      'The experience was okay overall.',
    ],
    button: 'Analyze',
    loadingText: 'Analyzing...',
  },
  {
    id: 'qa',
    title: 'Question Answering',
    subtitle: 'Ask questions from a context.',
    endpoint: '/api/qa',
    model: 'deepset/roberta-large-squad2',
    kind: 'dual',
    placeholder: 'Paste the source paragraph that contains the answer',
    questionPlaceholder: 'What do you want to know? The AI will find the answer in your text above',
    examples: ['Use this if you have a paragraph and need an answer.'],
    button: 'Get Answer',
    loadingText: 'Searching...',
  },
  {
    id: 'translate',
    title: 'Translation',
    subtitle: 'English to French.',
    endpoint: '/api/translate',
    model: 'Helsinki-NLP/opus-mt-en-fr',
    kind: 'single',
    placeholder: 'Type English text — it will be translated to French',
    examples: [
      'Good morning, how are you?',
      'This project uses FastAPI and React.',
      'Please review the updated report.',
    ],
    button: 'Translate',
    loadingText: 'Translating...',
  },
  {
    id: 'ner',
    title: 'Named Entities',
    subtitle: 'Detect people, places, and orgs.',
    endpoint: '/api/ner',
    model: 'dslim/bert-large-NER',
    kind: 'single',
    placeholder: 'Paste any text to find names, places, organizations, and other entities',
    examples: [
      'Sundar Pichai leads Google in California.',
      'Microsoft was founded by Bill Gates.',
      'Paris is the capital of France.',
    ],
    button: 'Extract',
    loadingText: 'Extracting...',
  },
]

function App() {
  const [activeTool, setActiveTool] = useState('generate')
  
  // Backend status: 'checking' | 'connected' | 'error'
  const [backendState, setBackendState] = useState('checking')
  const [statusMsg, setStatusMsg] = useState('Checking backend...')
  
  const [loading, setLoading] = useState(false)
  const [isError, setIsError] = useState(false)
  
  const [output, setOutput] = useState(null)
  const [meta, setMeta] = useState(null)
  
  const [inputText, setInputText] = useState('')
  const [question, setQuestion] = useState('')
  
  // Validation states
  const [inputError, setInputError] = useState('')
  const [questionError, setQuestionError] = useState('')
  
  const [history, setHistory] = useState([])
  const [copied, setCopied] = useState(false)

  const tool = useMemo(() => TOOLS.find((item) => item.id === activeTool), [activeTool])
  const workspaceRef = useRef(null)

  useEffect(() => {
    const check = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/health`)
        setBackendState('connected')
        setStatusMsg(`${res.data.model_tasks.length} endpoints ready`)
      } catch {
        setBackendState('error')
        setStatusMsg('Backend not reachable')
      }
    }
    check()
  }, [])

  const runTool = async () => {
    let isValid = true
    setInputError('')
    setQuestionError('')

    if (tool.kind === 'dual') {
      if (!inputText.trim()) {
        setInputError('Context is required to extract an answer.')
        isValid = false
      }
      if (!question.trim()) {
        setQuestionError('A question is required.')
        isValid = false
      }
    } else {
      if (!inputText.trim()) {
        setInputError('Please provide input text before running the model.')
        isValid = false
      }
    }

    if (!isValid) return

    setLoading(true)
    setIsError(false)
    setOutput(null)
    setMeta(null)
    setCopied(false)

    const started = performance.now()

    try {
      let res
      if (activeTool === 'qa') {
        res = await axios.post(`${API_BASE_URL}${tool.endpoint}`, { context: inputText, question })
      } else if (activeTool === 'generate') {
        res = await axios.post(`${API_BASE_URL}${tool.endpoint}`, { text: inputText, max_length: 140 })
      } else {
        res = await axios.post(`${API_BASE_URL}${tool.endpoint}`, { text: inputText })
      }

      const elapsed = Math.max(1, Math.round(performance.now() - started))

      setHistory((prev) => [
        { id: Date.now(), tool: tool.title, preview: inputText.slice(0, 90) + (inputText.length > 90 ? '...' : ''), time: new Date().toLocaleTimeString() },
        ...prev.slice(0, 4),
      ])

      if (activeTool === 'sentiment') {
        setOutput({ type: 'sentiment', data: res.data })
      } else if (activeTool === 'qa') {
        setOutput({ type: 'qa', data: res.data })
      } else if (activeTool === 'ner') {
        setOutput({ type: 'ner', data: res.data.entities || [] })
      } else if (activeTool === 'translate') {
        setOutput({ type: 'translate', data: res.data.result || '', source: inputText })
      } else {
        setOutput({ type: 'text', data: res.data.result || '' })
      }

      setMeta({
        model: res.data.model || tool.model,
        endpoint: tool.endpoint,
        latency: `${elapsed} ms`,
        task: res.data.task || tool.id,
      })
    } catch (err) {
      setIsError(true)
      setOutput({ type: 'error', data: err.response?.data?.detail || err.message || 'The request failed to process.' })
      setMeta({ model: tool.model, endpoint: tool.endpoint, latency: 'failed', task: tool.id })
    } finally {
      setLoading(false)
    }
  }

  const loadExample = (value) => {
    setInputError('')
    setQuestionError('')
    if (tool.kind === 'dual') {
      setInputText(value)
      setQuestion('What is this text about?')
    } else {
      setInputText(value)
    }
  }

  const clearAll = () => {
    setInputText('')
    setQuestion('')
    setOutput(null)
    setMeta(null)
    setInputError('')
    setQuestionError('')
    setIsError(false)
    setCopied(false)
  }

  const copyToClipboard = () => {
    if (!output) return
    let textToCopy = ''
    if (output.type === 'text') textToCopy = output.data
    else if (output.type === 'translate') textToCopy = output.data
    else if (output.type === 'qa') textToCopy = output.data.answer || 'No answer'
    else if (output.type === 'sentiment') textToCopy = `${output.data.label} (confidence: ${(output.data.score * 100).toFixed(1)}%)`
    else if (output.type === 'ner') textToCopy = JSON.stringify(output.data, null, 2)
    
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      runTool()
    }
  }

  const renderOutput = () => {
    if (loading) {
      return (
        <div className="skeleton-wrap">
          <div className="skeleton-line title" />
          <div className="skeleton-line" />
          <div className="skeleton-line" />
          <div className="skeleton-line short" />
        </div>
      )
    }

    if (isError) {
      return (
        <div className="error-panel" role="alert">
          <svg className="error-icon" aria-label="Error" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <strong>Processing Error</strong>
            <p>{output?.data}</p>
          </div>
        </div>
      )
    }

    if (!output) {
      return (
        <div className="empty-state">
          <svg aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
          </svg>
          <p>Ready when you are. Type or paste text above, then hit <strong>{tool.button}</strong>.</p>
        </div>
      )
    }

    if (output.type === 'sentiment') {
      const label = output.data.label?.toLowerCase() || ''
      const isPos = label.includes('pos')
      const isNeg = label.includes('neg')
      const isNeu = label.includes('neu')
      
      let variantClass = 'neutral'
      if (isPos) variantClass = 'positive'
      if (isNeg) variantClass = 'negative'
      
      const confidencePercent = (output.data.score * 100).toFixed(1)

      return (
        <div className="structured-output sentiment">
          <div className={`sentiment-badge ${variantClass}`}>
            {output.data.label}
          </div>
          <div className="confidence-bar-container">
            <div className="confidence-label">
              <span>Confidence</span>
              <span>{confidencePercent}%</span>
            </div>
            <div className="confidence-track">
              <div className={`confidence-fill ${variantClass}`} style={{ width: `${confidencePercent}%` }} />
            </div>
          </div>
        </div>
      )
    }

    if (output.type === 'qa') {
      const confidencePercent = (output.data.score * 100).toFixed(1)
      const answer = output.data.answer || 'No answer found.'
      return (
        <div className="generation-result">
          <div className="generation-result-content">
            <p className="output-text">{answer}</p>
          </div>
          {output.data.answer && (
            <div className="confidence-bar-container">
              <div className="confidence-label">
                <span>Extraction Confidence</span>
                <span>{confidencePercent}%</span>
              </div>
              <div className="confidence-track">
                <div className="confidence-fill qa" style={{ width: `${confidencePercent}%` }} />
              </div>
            </div>
          )}
        </div>
      )
    }

    if (output.type === 'ner') {
      if (output.data.length === 0) {
        return <p className="placeholder">No named entities detected in the text.</p>
      }
      return (
        <div className="structured-output ner">
          {output.data.map((ent, idx) => (
            <div key={idx} className="ner-chip">
              <span className="ner-word">{ent.text || ent.word}</span>
              <span className="ner-group" data-type={ent.label || ent.entity_group}>{ent.label || ent.entity_group}</span>
            </div>
          ))}
        </div>
      )
    }

    if (output.type === 'translate') {
      return (
        <div className="translation-split">
          <div className="translation-col">
            <h4>English</h4>
            <div className="output-text">{output.source}</div>
          </div>
          <div className="translation-divider" />
          <div className="translation-col">
            <h4>French</h4>
            <div className="output-text">{output.data}</div>
          </div>
        </div>
      )
    }

    // Default text output (Generate, Summarize)
    const wordCount = output.data.split(/\s+/).filter(w => w.length > 0).length
    return (
      <div className="generation-result">
        <div className="generation-result-content">
          <p className="output-text">{output.data}</p>
        </div>
        <div className="generation-meta">
          <span className="generation-meta-pill">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
            {wordCount} words
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      
      <aside className="side-rail">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">AI</div>
          <div>
            <div className="brand-text">Model Studio</div>
            <p>FastAPI · Hugging Face</p>
          </div>
        </div>

        <div className="status-card">
          <div className="status-indicator">
            <span className={`status-dot ${backendState}`} aria-hidden="true" />
            <div>
              <strong>
                {backendState === 'connected' && '● Connected'}
                {backendState === 'checking' && '◌ Checking...'}
                {backendState === 'error' && '✕ Offline'}
              </strong>
              <p>{statusMsg}</p>
            </div>
          </div>
        </div>

        <div className="tool-list" role="tablist" aria-label="AI Tools">
          {TOOLS.map((item) => (
            <button
              key={item.id}
              role="tab"
              id={`tab-${item.id}`}
              aria-selected={activeTool === item.id}
              aria-controls="main-content"
              type="button"
              className={`tool-item ${activeTool === item.id ? 'active' : ''}`}
              onClick={() => {
                setActiveTool(item.id)
                clearAll()
                // Move focus for accessibility
                if (workspaceRef.current) {
                  workspaceRef.current.focus()
                }
              }}
            >
              <span>{item.title}</span>
              <small>{item.subtitle}</small>
            </button>
          ))}
        </div>

        <div className="history-card">
          <div className="history-head">
            <h3>Recent runs</h3>
          </div>
          {history.length === 0 ? (
            <p className="history-empty">No activity yet.</p>
          ) : (
            history.map((item) => (
              <div key={item.id} className="history-item">
                <strong>{item.tool}</strong>
                <p>{item.preview}</p>
                <span>{item.time}</span>
              </div>
            ))
          )}
        </div>
      </aside>

      <main 
        className="workspace"
        id="main-content"
        role="tabpanel"
        aria-labelledby={`tab-${activeTool}`}
        tabIndex="-1"
        ref={workspaceRef}
      >
        <section className="hero-card">
          <div className="hero-content">
            <p className="eyebrow">Task Configuration</p>
            <h1>{tool.title}</h1>
            <p className="hero-copy">{tool.subtitle}</p>
          </div>

          <div className="hero-stats">
            <div className="stat-box">
              <span>Model Pipeline</span>
              <strong>{tool.model}</strong>
            </div>
          </div>
        </section>

        <section className="panel form-panel">
          <div className="examples-area">
            <span className="examples-label">Try an example:</span>
            <div className="chip-row">
              {tool.examples.map((item) => (
                <button key={item} type="button" className="chip" onClick={() => loadExample(item)}>
                  {item}
                </button>
              ))}
            </div>
          </div>

          {tool.kind === 'dual' ? (
            <div className="form-grid">
              <label className="field" htmlFor="input-context">
                <span>Context</span>
                <textarea
                  id="input-context"
                  aria-describedby={inputError ? 'input-error' : undefined}
                  aria-invalid={!!inputError}
                  className={`input-box ${inputError ? 'error-border' : ''}`}
                  placeholder={tool.placeholder}
                  value={inputText}
                  onKeyDown={handleKeyDown}
                  onChange={(e) => {
                    setInputText(e.target.value)
                    if (inputError) setInputError('')
                  }}
                />
                {inputError && <span className="error-text" id="input-error" role="alert">{inputError}</span>}
              </label>

              <label className="field" htmlFor="input-question">
                <span>Question</span>
                <textarea
                  id="input-question"
                  aria-describedby={questionError ? 'question-error' : undefined}
                  aria-invalid={!!questionError}
                  className={`input-box ${questionError ? 'error-border' : ''}`}
                  placeholder={tool.questionPlaceholder}
                  value={question}
                  onKeyDown={handleKeyDown}
                  onChange={(e) => {
                    setQuestion(e.target.value)
                    if (questionError) setQuestionError('')
                  }}
                />
                {questionError && <span className="error-text" id="question-error" role="alert">{questionError}</span>}
              </label>
            </div>
          ) : (
            <label className="field" htmlFor="input-data">
              <span>Input Data</span>
              <textarea
                id="input-data"
                aria-describedby={inputError ? 'input-error' : undefined}
                aria-invalid={!!inputError}
                className={`input-box large ${inputError ? 'error-border' : ''}`}
                placeholder={tool.placeholder}
                value={inputText}
                onKeyDown={handleKeyDown}
                onChange={(e) => {
                  setInputText(e.target.value)
                  if (inputError) setInputError('')
                }}
              />
              {inputError && <span className="error-text" id="input-error" role="alert">{inputError}</span>}
            </label>
          )}

          <div className="actions">
            <button type="button" className="primary-btn" onClick={runTool} disabled={loading}>
              {loading ? (
                <span className="btn-content">
                  <svg className="spinner" aria-label="Loading" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {tool.loadingText}
                </span>
              ) : (
                tool.button
              )}
            </button>
            <button type="button" className="secondary-btn" onClick={clearAll} disabled={loading}>
              Clear fields
            </button>
            <span className="shortcut-hint" aria-hidden="true">Ctrl + Enter to submit</span>
          </div>
        </section>

        <section className="output-grid">
          <article className="output-card main-output">
            <div className="output-head">
              <div className="output-title">
                <h3>{tool.title} Result</h3>
                {meta && <span className="mini-pill">{meta.latency}</span>}
              </div>
              {output && !isError && (
                <button type="button" className="action-badge" onClick={copyToClipboard} aria-live="polite">
                  {copied ? 'Copied to clipboard ✓' : 'Copy result'}
                </button>
              )}
            </div>
            <div 
              className="output-body" 
              aria-live="polite" 
              aria-atomic="true"
              aria-busy={loading}
            >
              {renderOutput()}
            </div>
          </article>

          <article className="output-card details-card">
            <div className="output-head">
              <h3>Run Details</h3>
            </div>
            <div className="details">
              <div>
                <span>Task</span>
                <strong>{meta?.task || tool.id}</strong>
              </div>
              <div>
                <span>Model</span>
                <strong>{meta?.model || tool.model}</strong>
              </div>
              <div>
                <span>Endpoint</span>
                <strong>{meta?.endpoint || tool.endpoint}</strong>
              </div>
            </div>
          </article>
        </section>
      </main>
    </div>
  )
}

export default App