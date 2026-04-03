import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Layout({ session, children, userRole }) {
  const [locations, setLocations] = useState([])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarWidth, setSidebarWidth] = useState(224)
  const [isResizing, setIsResizing] = useState(false)
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

  const sidebarRef = useRef(null)
  const isResizingRef = useRef(false)

  const handleMouseDown = useCallback((e) => {
    e.preventDefault()
    isResizingRef.current = true
    setIsResizing(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizingRef.current) return
      const newWidth = Math.min(Math.max(e.clientX, 160), 480)
      setSidebarWidth(newWidth)
    }
    const handleMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false
        setIsResizing(false)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const fetchLocations = useCallback(() => {
    supabase.from('locations').select('*').order('sort_order').then(({ data }) => {
      if (data) setLocations(data)
    })
  }, [])

  const fetchDeletionRequests = useCallback(() => {
    supabase.from('deletion_requests').select('*').eq('status', 'pending').then(({ data }) => {
      if (data) setDeletionRequests(data)
    })
  }, [])

  useEffect(() => {
    fetchLocations()
    fetchDeletionRequests()
  }, [fetchLocations, fetchDeletionRequests])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const handleAddLocation = async () => {
    const name = newLocationName.trim()
    if (!name) return
    setAdding(true)
    const maxSort = locations.filter(l => !l.is_legacy).reduce((max, l) => Math.max(max, l.sort_order || 0), 0)
    const { error } = await supabase.from('locations').insert({ name, sort_order: maxSort + 1, is_legacy: false, archived: false })
    if (!error) {
      setNewLocationName('')
      setShowAddForm(false)
      fetchLocations()
    }
    setAdding(false)
  }

  const handleRename = async (id) => {
    const name = editName.trim()
    if (!name) { setEditingId(null); return }
    await supabase.from('locations').update({ name }).eq('id', id)
    setEditingId(null)
    fetchLocations()
  }

  const handleDelete = async (id) => {
    if (deleteConfirm === id) {
      await supabase.from('locations').delete().eq('id', id)
      setDeleteConfirm(null)
      fetchLocations()
    } else {
      setDeleteConfirm(id)
      setTimeout(() => setDeleteConfirm(null), 5000)
    }
  }

  const handleRequestDeletion = async (locationId) => {
    setRequestingDeletion(true)
    const { error } = await supabase.from('deletion_requests').insert({
      location_id: locationId,
      requested_by: session?.user?.email || 'unknown'
    })
    if (!error) {
      fetchDeletionRequests()
      alert('削除申請を送信しました。管理者の承認をお待ちください。')
    }
    setRequestingDeletion(false)
  }

  const handleApproveDeletion = async (requestId, locationId) => {
    await supabase.from('deletion_requests').update({
      status: 'approved',
      reviewed_by: session?.user?.email,
      reviewed_at: new Date().toISOString()
    }).eq('id', requestId)
    await supabase.from('locations').delete().eq('id', locationId)
    fetchDeletionRequests()
    fetchLocations()
  }

  const handleRejectDeletion = async (requestId) => {
    await supabase.from('deletion_requests').update({
      status: 'rejected',
      reviewed_by: session?.user?.email,
      reviewed_at: new Date().toISOString()
    }).eq('id', requestId)
    fetchDeletionRequests()
  }

  const pendingRequestForLocation = (locId) => deletionRequests.find(r => r.location_id === locId)

  const handleArchive = async (id, currentArchived) => {
    await supabase.from('locations').update({ archived: !currentArchived }).eq('id', id)
    fetchLocations()
  }

  const handleDragStart = (e, id) => {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, id) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverId(id)
  }

  const handleDrop = async (e, targetId) => {
    e.preventDefault()
    setDragOverId(null)
    if (!dragId || dragId === targetId) { setDragId(null); return }
    const activeLocations = locations.filter(l => !l.is_legacy && !l.archived)
    const dragIndex = activeLocations.findIndex(l => l.id === dragId)
    const targetIndex = activeLocations.findIndex(l => l.id === targetId)
    if (dragIndex === -1 || targetIndex === -1) { setDragId(null); return }
    const reordered = [...activeLocations]
    const [moved] = reordered.splice(dragIndex, 1)
    reordered.splice(targetIndex, 0, moved)
    const updates = reordered.map((loc, i) => supabase.from('locations').update({ sort_order: i + 1 }).eq('id', loc.id))
    await Promise.all(updates)
    setDragId(null)
    fetchLocations()
  }

  const activeLocations = locations.filter(l => !l.is_legacy && !l.archived)
  const archivedLocations = locations.filter(l => !l.is_legacy && l.archived)
  const legacyLocations = locations.filter(l => l.is_legacy)

  return (
    <div className="min-h-screen flex bg-slate-50">
      {sidebarOpen && (
        <aside ref={sidebarRef} style={{ width: sidebarWidth + "px" }} className="bg-white border-r border-slate-200 flex flex-col fixed h-full z-10 overflow-y-auto">
          <Link to="/" className="flex items-center gap-2 px-4 py-4 font-bold text-blue-700 border-b border-slate-100">
            <span>📦</span> 在庫管理データシート
          </Link>

          <nav className="flex-1 px-2 py-2">
            <Link
              to="/"
              className={`block px-3 py-2 rounded text-sm ${location.pathname === '/' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              ダッシュボード
            </Link>

            <div className="px-3 py-2 text-xs text-slate-400 font-semibold mt-2">拠点一覧</div>

            {activeLocations.map((loc) => (
              <div
                key={loc.id}
                className={`relative flex items-center rounded text-sm ${
                  location.pathname === `/location/${loc.id}` ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'
                } ${dragOverId === loc.id ? 'border-t-2 border-blue-400' : ''}`}
                draggable={userRole === 'admin'}
                onDragStart={(e) => handleDragStart(e, loc.id)}
                onDragOver={(e) => handleDragOver(e, loc.id)}
                onDrop={(e) => handleDrop(e, loc.id)}
                onDragLeave={() => setDragOverId(null)}
                onContextMenu={(e) => { e.preventDefault(); setContextMenuId(contextMenuId === loc.id ? null : loc.id) }}
              >
                {userRole === 'admin' && (
                  <span className="cursor-grab pl-1 text-slate-300 hover:text-slate-500 text-xs select-none" title="ドラッグで並び替え">⠿</span>
                )}
                {editingId === loc.id ? (
                  <input
                    className="flex-1 px-2 py-2 text-sm border border-blue-300 rounded bg-white outline-none"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => handleRename(loc.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRename(loc.id); if (e.key === 'Escape') setEditingId(null) }}
                    autoFocus
                  />
                ) : (
                  <Link to={`/location/${loc.id}`} className="flex-1 block px-2 py-2 truncate">
                    {loc.name}
                  </Link>
                )}
                {contextMenuId === loc.id && editingId !== loc.id && (
                  <div className="absolute right-0 top-full z-20 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-36" onClick={(e) => e.stopPropagation()}>
                    {userRole === 'admin' && (
                      <>
                        <button
                          onClick={(e) => { e.preventDefault(); setContextMenuId(null); setEditingId(loc.id); setEditName(loc.name) }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          名前を編集
                        </button>
                        <button
                          onClick={(e) => { e.preventDefault(); setContextMenuId(null); handleArchive(loc.id, loc.archived) }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" /></svg>
                          アーカイブ
                        </button>
                        <div className="border-t border-slate-100 my-1" />
                        <button
                          onClick={(e) => { e.preventDefault(); setContextMenuId(null); handleDelete(loc.id) }}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs ${deleteConfirm === loc.id ? 'text-red-600 font-semibold' : 'text-red-500 hover:bg-red-50'}`}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          {deleteConfirm === loc.id ? 'もう一度クリックで削除' : '拠点を削除'}
                        </button>
                      </>
                    )}
                    {userRole !== 'admin' && (
                      pendingRequestForLocation(loc.id) ? (
                        <div className="px-3 py-1.5 text-xs text-orange-500 flex items-center gap-2">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          削除申請中（承認待ち）
                        </div>
                      ) : (
                        <button
                          onClick={(e) => { e.preventDefault(); setContextMenuId(null); handleRequestDeletion(loc.id) }}
                          disabled={requestingDeletion}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 disabled:opacity-50"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          削除を申請
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            ))}

            {userRole === 'admin' && archivedLocations.length > 0 && (
              <div className="mt-3">
                <div className="px-3 py-1 text-xs text-slate-400 font-semibold flex items-center gap-1">
                  <span>アーカイブ済み</span>
                  <span className="bg-slate-200 text-slate-500 rounded-full px-1.5 text-xs">{archivedLocations.length}</span>
                </div>
                {archivedLocations.map((loc) => (
                  <div
                    key={loc.id}
                    className="relative flex items-center rounded text-sm text-slate-400 italic"
                    onContextMenu={(e) => { e.preventDefault(); setContextMenuId(contextMenuId === loc.id ? null : loc.id) }}
                  >
                    <Link to={`/location/${loc.id}`} className="flex-1 block px-3 py-1.5 truncate">{loc.name}</Link>
                    {contextMenuId === loc.id && (
                      <div className="absolute right-0 top-full z-20 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-36" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => { setContextMenuId(null); handleArchive(loc.id, loc.archived) }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-green-600 hover:bg-green-50"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                          アーカイブ解除
                        </button>
                        <div className="border-t border-slate-100 my-1" />
                        <button
                          onClick={() => { setContextMenuId(null); handleDelete(loc.id) }}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs ${deleteConfirm === loc.id ? 'text-red-600 font-semibold' : 'text-red-500 hover:bg-red-50'}`}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          {deleteConfirm === loc.id ? 'もう一度クリックで削除' : '完全に削除'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {legacyLocations.length > 0 && (
              <div className="mt-4 border-t border-slate-200 pt-2">
                <button
                  onClick={() => setLegacyCollapsed(!legacyCollapsed)}
                  className="w-full flex items-center justify-between px-3 py-1 text-xs text-slate-400 font-semibold hover:text-slate-600"
                >
                  <span>旧在庫管理表</span>
                  <svg className={`w-3 h-3 transition-transform ${legacyCollapsed ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {!legacyCollapsed && legacyLocations.map((loc) => (
                  <Link
                    key={loc.id}
                    to={`/location/${loc.id}`}
                    className={`block px-3 py-1.5 rounded text-sm bg-slate-50 ${
                      location.pathname === `/location/${loc.id}` ? 'text-blue-700 font-semibold' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {loc.name}
                  </Link>
                ))}
              </div>
            )}
          </nav>

          <div className="border-t border-slate-200 p-2">
            {showAddForm ? (
              <div className="flex gap-1">
                <input
                  className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded"
                  placeholder="拠点名を入力"
                  value={newLocationName}
                  onChange={(e) => setNewLocationName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddLocation() }}
                  autoFocus
                />
                <button
                  onClick={handleAddLocation}
                  disabled={adding}
                  className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  追加
                </button>
                <button
                  onClick={() => { setShowAddForm(false); setNewLocationName('') }}
                  className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700"
                >
                  &#x2715;
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAddForm(true)}
                className="w-full px-3 py-2 text-sm text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded text-left"
              >
                ＋ 拠点追加
              </button>
            )}
          </div>

            {/* Resize handle */}
            <div
              onMouseDown={handleMouseDown}
              className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-blue-400 transition-colors"
              style={{ 
                backgroundColor: isResizing ? '#60a5fa' : 'transparent',
              }}
              title="Drag to resize"
            />
        </aside>
      )}

      <div className={`flex-1 flex flex-col`} style={{ marginLeft: sidebarOpen ? sidebarWidth + 'px' : '0' }}>
        <header className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 rounded hover:bg-slate-100 text-slate-500"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-500">{session?.user?.email}</span>
            {userRole === 'admin' && (
              <>
                <Link to="/user-management" className="text-blue-600 hover:text-blue-800 font-medium border border-blue-200 rounded px-2 py-1">
                  ユーザー管理
                </Link>
                {deletionRequests.length > 0 && (
                  <button
                    onClick={() => setShowApprovalPanel(!showApprovalPanel)}
                    className="relative text-orange-600 hover:text-orange-800 font-medium border border-orange-200 rounded px-2 py-1"
                  >
                    削除申請
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{deletionRequests.length}</span>
                  </button>
                )}
              </>
            )}
            <button onClick={handleLogout} className="text-slate-500 hover:text-slate-700">
              ログアウト
            </button>
          </div>
        </header>
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>

      {showApprovalPanel && userRole === 'admin' && deletionRequests.length > 0 && (
        <div className="fixed top-12 right-4 w-80 bg-white border border-slate-200 rounded-lg shadow-xl z-50">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-700">削除申請一覧</span>
            <button onClick={() => setShowApprovalPanel(false)} className="text-slate-400 hover:text-slate-600 text-xs">&#x2715;</button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {deletionRequests.map((req) => {
              const loc = locations.find(l => l.id === req.location_id)
              return (
                <div key={req.id} className="px-4 py-2 border-b border-slate-50 last:border-b-0">
                  <div className="text-sm font-medium text-slate-700">{loc?.name || `ID: ${req.location_id}`}</div>
                  <div className="text-xs text-slate-400 mt-0.5">申請者: {req.requested_by}</div>
                  <div className="text-xs text-slate-400">{new Date(req.requested_at).toLocaleString('ja-JP')}</div>
                  <div className="flex gap-2 mt-1.5">
                    <button
                      onClick={() => handleApproveDeletion(req.id, req.location_id)}
                      className="px-2 py-0.5 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      承認（削除）
                    </button>
                    <button
                      onClick={() => handleRejectDeletion(req.id)}
                      className="px-2 py-0.5 text-xs bg-slate-200 text-slate-600 rounded hover:bg-slate-300"
                    >
                      却下
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 rounded-lg shadow-lg px-4 py-3 text-sm text-red-700 z-50 animate-bounce">
          ⚠️ 削除ボタンをもう一度クリックすると、この拠点とすべてのデータが完全に削除されます。
        </div>
      )}
    </div>
  )
}
