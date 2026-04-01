import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Layout({ session, children }) {
  const [locations, setLocations] = useState([])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newLocationName, setNewLocationName] = useState('')
  const [adding, setAdding] = useState(false)
  const location = useLocation()

  const fetchLocations = () => {
    supabase.from('locations').select('*').order('id').then(({ data }) => {
      if (data) setLocations(data)
    })
  }

  useEffect(() => {
    fetchLocations()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const handleAddLocation = async () => {
    const name = newLocationName.trim()
    if (!name) return
    setAdding(true)
    const { error } = await supabase.from('locations').insert({ name })
    if (error) {
      alert('拠点の追加に失敗しました: ' + error.message)
    } else {
      setNewLocationName('')
      setShowAddForm(false)
      fetchLocations()
    }
    setAdding(false)
  }

  const sorted = [...locations].sort((a, b) => {
    const aOld = a.name.includes('旧') ? 1 : 0
    const bOld = b.name.includes('旧') ? 1 : 0
    return aOld - bOld
  })
  const normalLocs = sorted.filter((l) => !l.name.includes('旧'))
  const legacyLocs = sorted.filter((l) => l.name.includes('旧'))

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-0'} bg-white border-r border-slate-200 flex-shrink-0 transition-all duration-300 overflow-hidden flex flex-col`}>
        <div className="p-4 border-b border-slate-200">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">📦</span>
            <span className="font-bold text-slate-800">在庫管理データシート</span>
          </Link>
        </div>
        <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
          <Link
            to="/"
            className={`block px-3 py-2 rounded-lg text-sm font-medium transition ${
              location.pathname === '/' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            ダッシュボード
          </Link>
          <div className="pt-2 pb-1 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            拠点一覧
          </div>          {normalLocs.map((loc) => (
            <Link
              key={loc.id}
              to={`/location/${loc.id}`}
              className={`block px-3 py-2 rounded-lg text-sm transition ${
                location.pathname === `/location/${loc.id}`
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {loc.name}
            </Link>
          ))}
          {legacyLocs.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-200">
              {legacyLocs.map((loc) => (
                <Link
                  key={loc.id}
                  to={`/location/${loc.id}`}
                  className={`block px-3 py-2 rounded-lg text-sm transition ${
                    location.pathname === `/location/${loc.id}`
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-500'
                  }`}
                >
                  {loc.name}
                </Link>
              ))}
            </div>
          )}
        </nav>        <div className="p-3 border-t border-slate-200">
          {showAddForm ? (
            <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
              <input
                type="text"
                value={newLocationName}
                onChange={(e) => setNewLocationName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddLocation() }}
                placeholder="拠点名を入力"
                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                autoFocus
                disabled={adding}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleAddLocation}
                  disabled={adding || !newLocationName.trim()}
                  className="flex-1 px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {adding ? '追加中...' : '追加'}
                </button>
                <button
                  onClick={() => { setShowAddForm(false); setNewLocationName('') }}
                  className="flex-1 px-2 py-1 text-xs font-medium text-slate-600 bg-slate-200 rounded hover:bg-slate-300 transition"
                  disabled={adding}
                >
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full flex items-center justify-center gap-1 px-3 py-2 text-sm text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-dashed border-slate-300 hover:border-blue-400 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              拠点追加
            </button>
          )}
        </div>
      </aside>
      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">{session.user.email}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-slate-500 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition"
            >
              ログアウト
            </button>
          </div>
        </header>
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
