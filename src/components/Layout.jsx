import { useState, useEffect, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'


export default function Layout({ session, children, userRole }) {
  const [locations, setLocations] = useState([])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newLocationName, setNewLocationName] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [dragOverId, setDragOverId] = useState(null)
  const [dragId, setDragId] = useState(null)
  const [legacyCollapsed, setLegacyCollapsed] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [contextMenuId, setContextMenuId] = useState(null)
  const [deletionRequests, setDeletionRequests] = useState([])
  const [requestingDeletion, setRequestingDeletion] = useState(false)
  const [showApprovalPanel, setShowApprovalPanel] = useState(false)
  const location = useLocation()


  useEffect(() => {
    const handleClick = () => setContextMenuId(null)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])


  const fetchLocations = useCallback(() => {
    supabase.from('locations').select('*').order('sort_order').then(({ data }) => {
      if (data) setLocations(data)
    })
  }, [])


  const fetchDeletionRequests = useCallback(() => {
    supabase.from('deletion_requests').select('*').eq('status', 'pending').then(({ data }) => {
