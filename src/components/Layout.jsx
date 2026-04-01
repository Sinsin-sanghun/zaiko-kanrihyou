import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Layout({ session, children }) {
  const [locations, setLocations] = useState([])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const location = useLocation()

  useEffect(() => {
    supabase.from('locations').select('*').order('id').then(({ data }) => {
      if (data) setLocations(data)
    })
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-0'} bg-white border-r border-slate-200 flex-shrink-0 transition-all duration-300 overflow-hidden`}>
        <div className="p-4 border-b border-slate-200">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">📦</span>
            <span className="font-bold text-slate-800">在庫管理</span>
          </Link>
        </div>
        <nav className="p-3 space-y-1">
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
          </div>
          {[...locations].sort((a, b) => {
              const aOld = a.name.includes('旧') ? 1 : 0
              const bOld = b.name.includes('旧') ? 1 : 0
              return aOld - bOld
            }).map((loc) => (
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
        </nav>
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
