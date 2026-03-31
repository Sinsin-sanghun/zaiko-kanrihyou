import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import InventoryPage from './pages/InventoryPage'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!session) {
    return (
      <>
        <Auth />
        <Toaster position="top-right" />
      </>
    )
  }

  return (
    <>
      <Layout session={session}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/location/:id" element={<InventoryPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
      <Toaster position="top-right" />
    </>
  )
}
