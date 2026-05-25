import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import './App.css'

const API_BASE_URL = 'http://13.233.143.243'

const TOOLS = [
  {
    id: 'generate',
    title: 'Text Generation',
    subtitle: 'Create completions and ideas.',
    endpoint: '/api/generate',
    model: 'gpt2',
    kind: 'single',
    placeholder: 'Write a prompt for the model...',
    examples: [
      'Write a short intro for an AI project.',
      'Explain DevOps in simple language.',
      'Create a product pitch for a React app.',
    ],
    button: 'Generate',
  },
  {
    id: 'summarize',
    title: 'Summarization',
    subtitle: 'Compress long content.',
    endpoint: '/api/summarize',
    model: 'facebook/bart-large-cnn',
    kind: 'single',
    placeholder: 'Paste a long paragraph or article...',
    examples: [
      'Summarize the importance of cloud computing.',
      'Make this article into 5 bullet points.',
      'Summarize this meeting note.',
    ],
    button: 'Summarize',
  },
  {
    id: 'sentiment',
    title: 'Sentiment',
    subtitle: 'Find tone and polarity.',
    endpoint: '/api/sentiment',
    model: 'twitter-roberta-sentiment',
    kind: 'single',
    placeholder: 'Enter a review, feedback, or sentence...',
    examples: [
      'This project is excellent and useful.',
      'I am disappointed by the slow response.',
      'The experience was okay overall.',
    ],
    button: 'Analyze',
  },
  {
    id: 'qa',
    title: 'Question Answering',
    subtitle: 'Ask questions from a context.',
    endpoint: '/api/qa',
    model: 'roberta-squad2',
    kind: 'dual',
    placeholder: 'Paste context here...',
    questionPlaceholder: 'Ask a question about the context...',
    examples: ['Use this if you have a paragraph and need an answer.'],
    button: 'Get Answer',
  },
  {
    id: 'translate',
    title: 'Translation',
    subtitle: 'English to French.',
    endpoint: '/api/translate',
    model: 'Helsinki-NLP/opus-mt-en-fr',
    kind: 'single',
    placeholder: 'Write English text to translate...',
    examples: [
      'Good morning, how are you?',
      'This project uses FastAPI and React.',
      'Please review the updated report.',
    ],
    button: 'Translate',
  },
  {
    id: 'ner',
    title: 'Named Entities',
    subtitle: 'Detect people, places, and orgs.',
    endpoint: '/api/ner',
    model: 'dslim/bert-base-NER',
    kind: 'single',
    placeholder: 'Paste text to extract named entities...',
    examples: [
      'Sundar Pichai leads Google in California.',
      'Microsoft was founded by Bill Gates.',
      'Paris is the capital of France.',
    ],
    button: 'Extract',
  },
]

function App() {
  const [activeTool, setActiveTool] = useState('generate')
  const [status, setStatus] = useState('Checking backend...')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [output, setOutput] = useState('')
  const [meta, setMeta] = useState(null)
  const [inputText, setInputText] = useState('')
  const [question, setQuestion] = useState('')
  const [history, setHistory] = useState([])

  const tool = useMemo(() => TOOLS.find((item) => item.id === activeTool), [activeTool])

  useEffect(() => {
    const check = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/health`)
        setStatus(`Connected · ${res.data.model_tasks.length} endpoints ready`)
      } catch {
        setStatus('Backend not reachable')
      }
    }

    check()
  }, [])

  useEffect(() => {
    let timer
    if (loading) {
      setProgress(10)
      timer = setInterval(() => {
        setProgress((prev) => (prev >= 92 ? prev : prev + 7))
      }, 160)
    } else {
      setProgress(0)
    }
    return () => clearInterval(timer)
  }, [loading])

  const runTool = async () => {
    if (tool.kind === 'dual' && (!inputText.trim() || !question.trim())) return
    if (tool.kind === 'single' && !inputText.trim()) return

    setLoading(true)
    setOutput('')
    setMeta(null)
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
      setProgress(100)

      setHistory((prev) => [
        { id: Date.now(), tool: tool.title, preview: inputText.slice(0, 90), time: new Date().toLocaleTimeString() },
        ...prev.slice(0, 4),
      ])

      if (activeTool === 'sentiment') {
        setOutput(`${res.data.label} · confidence ${res.data.score}`)
      } else if (activeTool === 'qa') {
        setOutput(res.data.answer || '')
      } else if (activeTool === 'ner') {
        setOutput(JSON.stringify(res.data.entities || [], null, 2))
      } else {
        setOutput(res.data.result || '')
      }

      setMeta({
        model: res.data.model || tool.model,
        endpoint: tool.endpoint,
        latency: `${elapsed} ms`,
        task: res.data.task || tool.id,
      })
    } catch (err) {
      setOutput(err.response?.data?.detail || err.message || 'Request failed')
      setMeta({ model: tool.model, endpoint: tool.endpoint, latency: 'failed', task: tool.id })
    } finally {
      setLoading(false)
    }
  }

  const loadExample = (value) => {
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
    setOutput('')
    setMeta(null)
  }

  return (
    <div className="app-shell">
      <aside className="side-rail">
        <div className="brand">
          <div className="brand-mark">AI</div>
          <div>
            <h1>Model Studio</h1>
            <p>FastAPI · Hugging Face · React</p>
          </div>
        </div>

        <div className="status-card">
          <span className="status-dot" />
          <div>
            <strong>Backend</strong>
            <p>{status}</p>
          </div>
        </div>

        <div className="tool-list">
          {TOOLS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`tool-item ${activeTool === item.id ? 'active' : ''}`}
              onClick={() => {
                setActiveTool(item.id)
                setInputText('')
                setQuestion('')
                setOutput('')
                setMeta(null)
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
            <p className="history-empty">No runs yet.</p>
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

      <main className="workspace">
        <section className="hero-card">
          <div>
            <p className="eyebrow">AI Utility Dashboard</p>
            <h2>{tool.title}</h2>
            <p className="hero-copy">{tool.subtitle}</p>
          </div>

          <div className="hero-stats">
            <div>
              <span>Active tool</span>
              <strong>{tool.title}</strong>
            </div>
            <div>
              <span>Model</span>
              <strong>{tool.model}</strong>
            </div>
          </div>
        </section>

        <section className="panel">
          {loading && (
            <div className="progress-wrap">
              <div className="progress-head">
                <span>Processing request</span>
                <span>{progress}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          <div className="chip-row">
            {tool.examples.map((item) => (
              <button key={item} type="button" className="chip" onClick={() => loadExample(item)}>
                {item}
              </button>
            ))}
          </div>

          {tool.kind === 'dual' ? (
            <div className="form-grid">
              <label className="field">
                <span>Context</span>
                <textarea
                  className="input-box large"
                  placeholder={tool.placeholder}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                />
              </label>

              <label className="field">
                <span>Question</span>
                <textarea
                  className="input-box"
                  placeholder={tool.questionPlaceholder}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                />
              </label>
            </div>
          ) : (
            <label className="field">
              <span>Input</span>
              <textarea
                className="input-box large"
                placeholder={tool.placeholder}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
            </label>
          )}

          <div className="actions">
            <button type="button" className="primary-btn" onClick={runTool} disabled={loading}>
              {loading ? 'Running...' : tool.button}
            </button>
            <button type="button" className="secondary-btn" onClick={clearAll}>
              Clear
            </button>
          </div>
        </section>

        <section className="output-grid">
          <article className="output-card">
            <div className="output-head">
              <h3>Result</h3>
              {meta && <span className="mini-pill">{meta.latency}</span>}
            </div>
            <div className="output-body">
              {output ? <pre>{output}</pre> : <p className="placeholder">Your result will appear here.</p>}
            </div>
          </article>

          <article className="output-card">
            <div className="output-head">
              <h3>Run details</h3>
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