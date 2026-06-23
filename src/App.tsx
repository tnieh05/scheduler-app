import { useState } from 'react'
import { AppProvider } from './store/AppContext'
import { AppShell } from './components/layout/AppShell'

const PASSWORD = 'starfish26'
const STORAGE_KEY = 'scheduler_auth'

function PasswordGate({ onAuth }: { onAuth: () => void }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (value === PASSWORD) {
      localStorage.setItem(STORAGE_KEY, '1')
      onAuth()
    } else {
      setError(true)
      setValue('')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md p-8 w-80 space-y-4">
        <h1 className="text-lg font-semibold text-slate-800">On-Call Scheduler</h1>
        <p className="text-sm text-slate-500">Enter the password to continue.</p>
        <input
          type="password"
          autoFocus
          value={value}
          onChange={e => { setValue(e.target.value); setError(false) }}
          placeholder="Password"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        {error && <p className="text-xs text-red-500">Incorrect password.</p>}
        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-4 py-2"
        >
          Enter
        </button>
      </form>
    </div>
  )
}

function App() {
  const [authed, setAuthed] = useState(() => localStorage.getItem(STORAGE_KEY) === '1')

  if (!authed) return <PasswordGate onAuth={() => setAuthed(true)} />

  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  )
}

export default App
