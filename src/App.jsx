import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import toast from 'react-hot-toast'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import InventoryPage from './pages/InventoryPage'
import UserManagementPage from './pages/UserManagementPage'
import TodoPage from './pages/TodoPage'

const ALLOWED_DOMAIN = 'shirokumapower.com'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState('viewer')

  const checkDomain = (session) => {
    if (!session?.user?.email) return false
    const domain = session.user.email.split('@')[1]
    return domain === ALLOWED_DOMAIN
  }

  const fetchUserRole = async (email) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('email', email)
      .single()
    if (data && !error) {
      setUserRole(data.role)
    } else {
      setUserRole('viewer')
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && !checkDomain(session)) {
        supabase.auth.signOut()
        toast.error('@shirokumapower.com のアカウントのみ利用できます')
        setSession(null)
      } else {
        setSession(session)
        if (session?.user?.email) {
          fetchUserRole(session.user.email)
        }
      }
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && !checkDomain(session)) {
        supabase.auth.signOut()
        toast.error('@shirokumapower.com のアカウントのみ利用できます')
        setSession(null)
      } else {
        setSession(session)
        if (session?.user?.email) {
          fetchUserRole(session.user.email)
        }
      }
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
      <Layout session={session} userRole={userRole}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/location/:id" element={<InventoryPage userRole={userRole} />} />
          <Route path="/todo" element={<TodoPage session={session} />} />
          {userRole === 'admin' && (
            <Route path="/user-management" element={<UserManagementPage />} />
          )}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
      <Toaster position="top-right" />
    </>
  )
}
