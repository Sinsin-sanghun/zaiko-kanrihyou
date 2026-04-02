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
