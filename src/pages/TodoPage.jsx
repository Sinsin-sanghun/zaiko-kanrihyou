import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

const CATEGORIES = ['開発', 'デザイン', '運用', 'その他']
const STATUSES = ['未着手', '進行中', '完了']
const PRIORITIES = [
  { value: 1, label: '最高', color: 'bg-red-500' },
  { value: 2, label: '高', color: 'bg-orange-400' },
  { value: 3, label: '中', color: 'bg-yellow-400' },
  { value: 4, label: '低', color: 'bg-blue-400' },
  { value: 5, label: '最低', color: 'bg-slate-400' },
]
const STATUS_COLORS = { '未着手': '#94a3b8', '進行中': '#3b82f6', '完了': '#22c55e' }
const CAT_COLORS = { '開発': '#6366f1', 'デザイン': '#ec4899', '運用': '#f59e0b', 'その他': '#64748b' }

export default function TodoPage({ session }) {
  const [todos, setTodos] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editingTodo, setEditingTodo] = useState(null)
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [viewImage, setViewImage] = useState(null)
  const [form, setForm] = useState({
    title: '', description: '', solution: '', category: 'その他', priority: 3, status: '未着手', deadline: ''
  })
  const dropRef = useRef(null)

  const fetchTodos = useCallback(async () => {
    const { data } = await supabase.from('todos').select('*').order('priority').order('deadline')
    if (data) setTodos(data)
  }, [])

  useEffect(() => { fetchTodos() }, [fetchTodos])

  const handleImageFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setImagePreview(e.target.result)
    reader.readAsDataURL(file)
  }

  const handlePaste = (e) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        handleImageFile(item.getAsFile())
        break
      }
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const file = e.dataTransfer?.files?.[0]
    if (file) handleImageFile(file)
  }

  const uploadImage = async (file) => {
    const ext = file.name?.split('.').pop() || 'png'
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('todo-images').upload(fileName, file)
    if (error) { alert('画像アップロードに失敗しました: ' + error.message); return null }
    const { data: urlData } = supabase.storage.from('todo-images').getPublicUrl(fileName)
    return urlData?.publicUrl || null
  }

  const openAdd = () => {
    setEditingTodo(null)
    setForm({ title: '', description: '', solution: '', category: 'その他', priority: 3, status: '未着手', deadline: '' })
    setImageFile(null)
    setImagePreview(null)
    setShowModal(true)
  }

  const openEdit = (todo) => {
    setEditingTodo(todo)
    setForm({
      title: todo.title, description: todo.description || '', solution: todo.solution || '',
      category: todo.category, priority: todo.priority, status: todo.status,
      deadline: todo.deadline || ''
    })
    setImageFile(null)
    setImagePreview(todo.image_url || null)
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) { alert('課題名を入力してください'); return }
    setUploading(true)
    let imageUrl = editingTodo?.image_url || null
    if (imageFile) {
      imageUrl = await uploadImage(imageFile)
    }
    const payload = {
      ...form,
      image_url: imageUrl,
      updated_at: new Date().toISOString()
    }
    if (editingTodo) {
      await supabase.from('todos').update(payload).eq('id', editingTodo.id)
    } else {
      payload.created_by = session?.user?.email || 'unknown'
      await supabase.from('todos').insert(payload)
    }
    setUploading(false)
    setShowModal(false)
    fetchTodos()
  }

  const handleDelete = async (id) => {
    if (!window.confirm('このタスクを削除しますか？')) return
    await supabase.from('todos').delete().eq('id', id)
    fetchTodos()
  }

  const quickStatus = async (id, newStatus) => {
    await supabase.from('todos').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id)
    fetchTodos()
  }

  const filtered = todos.filter(t =>
    (filterCategory === 'all' || t.category === filterCategory) &&
    (filterStatus === 'all' || t.status === filterStatus)
  )

  const statusCounts = STATUSES.map(s => ({ name: s, count: todos.filter(t => t.status === s).length }))
  const total = todos.length || 1
  const catProgress = CATEGORIES.map(c => {
    const catTodos = todos.filter(t => t.category === c)
    const done = catTodos.filter(t => t.status === '完了').length
    return { name: c, total: catTodos.length, done, rate: catTodos.length ? Math.round((done / catTodos.length) * 100) : 0 }
  }).filter(c => c.total > 0)

  const pieData = statusCounts.filter(s => s.count > 0)
  let cumAngle = 0
  const pieSlices = pieData.map((d) => {
    const angle = (d.count / total) * 360
    const startAngle = cumAngle
    cumAngle += angle
    const midAngle = startAngle + angle / 2
    const large = angle > 180 ? 1 : 0
    const rad = (a) => (a - 90) * Math.PI / 180
    const x1 = 50 + 40 * Math.cos(rad(startAngle))
    const y1 = 50 + 40 * Math.sin(rad(startAngle))
    const x2 = 50 + 40 * Math.cos(rad(startAngle + angle))
    const y2 = 50 + 40 * Math.sin(rad(startAngle + angle))
    const lx = 50 + 25 * Math.cos(rad(midAngle))
    const ly = 50 + 25 * Math.sin(rad(midAngle))
    return { ...d, path: `M50,50 L${x1},${y1} A40,40 0 ${large},1 ${x2},${y2} Z`, lx, ly, pct: Math.round((d.count / total) * 100) }
  })

  const priorityInfo = (p) => PRIORITIES.find(x => x.value === p) || PRIORITIES[2]

  const isOverdue = (deadline) => {
    if (!deadline) return false
    return new Date(deadline) < new Date(new Date().toDateString())
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <span>📋</span> 課題管理ボード
        </h1>
        <button onClick={openAdd} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 shadow-sm flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          新規課題
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-600 mb-3">ステータス割合</h3>
          <div className="flex items-center justify-center gap-6">
            <svg viewBox="0 0 100 100" className="w-32 h-32">
              {todos.length === 0 ? (
                <circle cx="50" cy="50" r="40" fill="#e2e8f0" />
              ) : pieSlices.length === 1 ? (
                <circle cx="50" cy="50" r="40" fill={STATUS_COLORS[pieSlices[0].name]} />
              ) : (
                pieSlices.map((s, i) => (
                  <path key={i} d={s.path} fill={STATUS_COLORS[s.name]} stroke="white" strokeWidth="0.5" />
                ))
              )}
              <text x="50" y="48" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#334155">{todos.length}</text>
              <text x="50" y="58" textAnchor="middle" fontSize="5" fill="#94a3b8">件</text>
            </svg>
            <div className="flex flex-col gap-2">
              {statusCounts.map(s => (
                <div key={s.name} className="flex items-center gap-2 text-xs">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[s.name] }} />
                  <span className="text-slate-600">{s.name}</span>
                  <span className="font-bold text-slate-800">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 棒グラフ: カテゴリ別進捗率 */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-600 mb-3">カテゴリ別 進捗率</h3>
          {catProgress.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-slate-400">データなし</div>
          ) : (
            <div className="space-y-3">
              {catProgress.map(c => (
                <div key={c.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium" style={{ color: CAT_COLORS[c.name] }}>{c.name}</span>
                    <span className="text-slate-500">{c.done}/{c.total} ({c.rate}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${c.rate}%`, backgroundColor: CAT_COLORS[c.name] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* フィルター */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-xs text-slate-500 font-medium">フィルター:</span>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
          className="text-xs border border-slate-200 rounded px-2 py-1 bg-white text-slate-600">
          <option value="all">全カテゴリ</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="text-xs border border-slate-200 rounded px-2 py-1 bg-white text-slate-600">
          <option value="all">全ステータス</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-xs text-slate-400 ml-auto">{filtered.length} 件</span>
      </div>

      {/* タスクリスト */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
            課題がありません。「新規課題」ボタンから追加してください。
          </div>
        ) : filtered.map(todo => {
          const pri = priorityInfo(todo.priority)
          const overdue = todo.status !== '完了' && isOverdue(todo.deadline)
          return (
            <div key={todo.id} className={`bg-white rounded-lg border ${overdue ? 'border-red-300 bg-red-50' : 'border-slate-200'} p-3 shadow-sm hover:shadow-md transition-shadow`}>
              <div className="flex items-start gap-3">
                {/* 優先度バッジ */}
                <div className={`${pri.color} text-white text-xs font-bold w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5`}>
                  P{todo.priority}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-slate-800">{todo.title}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: CAT_COLORS[todo.category] + '20', color: CAT_COLORS[todo.category] }}>{todo.category}</span>
                    {overdue && <span className="text-xs text-red-500 font-medium">⚠ 期限超過</span>}
                  </div>
                  {todo.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{todo.description}</p>}
                  {todo.solution && (
                    <p className="text-xs text-blue-600 mt-1 line-clamp-1">
                      <span className="font-medium">解決策:</span> {todo.solution}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                    {todo.deadline && (
                      <span className={overdue ? 'text-red-500 font-medium' : ''}>📅 {todo.deadline}</span>
                    )}
                    {todo.image_url && (
                      <button onClick={() => setViewImage(todo.image_url)} className="text-blue-500 hover:text-blue-700 flex items-center gap-0.5">
                        🖼 画像あり
                      </button>
                    )}
                    <span>作成: {todo.created_by?.split('@')[0]}</span>
                  </div>
                </div>
                {/* ステータス切替 & アクション */}
                <div className="flex items-center gap-1 shrink-0">
                  <select
                    value={todo.status}
                    onChange={(e) => quickStatus(todo.id, e.target.value)}
                    className="text-xs border rounded px-1.5 py-1 font-medium"
                    style={{ color: STATUS_COLORS[todo.status], borderColor: STATUS_COLORS[todo.status] }}
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={() => openEdit(todo)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600" title="編集">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                  <button onClick={() => handleDelete(todo.id)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500" title="削除">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 追加/編集モーダル */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <h2 className="font-bold text-slate-800">{editingTodo ? '課題を編集' : '新規課題'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
            </div>
            <div className="p-5 space-y-4" onPaste={handlePaste}>
              {/* 課題名 */}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">課題名 *</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="課題のタイトル" />
              </div>
              {/* 課題内容 */}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">何の課題があるか？</label>
                <textarea className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                  rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="課題の詳細を記入..." />
              </div>
              {/* 解決イメージ */}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">解決のイメージ</label>
                <textarea className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                  rows={2} value={form.solution} onChange={e => setForm({...form, solution: e.target.value})} placeholder="どう解決するか記入..." />
              </div>
              {/* カテゴリ & 優先度 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">カテゴリ</label>
                  <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                    value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">優先度</label>
                  <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                    value={form.priority} onChange={e => setForm({...form, priority: Number(e.target.value)})}>
                    {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label} (P{p.value})</option>)}
                  </select>
                </div>
              </div>
              {/* ステータス & 納期 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">ステータス</label>
                  <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                    value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">納期</label>
                  <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                    value={form.deadline} onChange={e => setForm({...form, deadline: e.target.value})} />
                </div>
              </div>
              {/* 画像アップロード */}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">スクリーンショット / 画像</label>
                <div
                  ref={dropRef}
                  onDrop={handleDrop}
                  onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
                  className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center hover:border-blue-300 transition-colors cursor-pointer"
                  onClick={() => document.getElementById('todo-file-input').click()}
                >
                  {imagePreview ? (
                    <div className="relative">
                      <img src={imagePreview} alt="preview" className="max-h-40 mx-auto rounded" />
                      <button
                        onClick={(e) => { e.stopPropagation(); setImageFile(null); setImagePreview(null) }}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center hover:bg-red-600"
                      >✕</button>
                    </div>
                  ) : (
                    <div className="text-slate-400 text-sm">
                      <div className="text-2xl mb-1">📎</div>
                      <div>ドラッグ&ドロップ / クリックで選択</div>
                      <div className="text-xs mt-1">または <kbd className="bg-slate-100 px-1 rounded">Ctrl+V</kbd> でペースト</div>
                    </div>
                  )}
                </div>
                <input id="todo-file-input" type="file" accept="image/*" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleImageFile(e.target.files[0]) }} />
              </div>
            </div>
            {/* フッター */}
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50 rounded-b-xl">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 rounded-lg">キャンセル</button>
              <button onClick={handleSave} disabled={uploading}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1">
                {uploading ? '保存中...' : (editingTodo ? '更新' : '追加')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 画像ビューア */}
      {viewImage && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setViewImage(null)}>
          <div className="relative max-w-3xl max-h-[90vh]">
            <img src={viewImage} alt="detail" className="max-w-full max-h-[85vh] rounded-lg shadow-2xl" />
            <button onClick={() => setViewImage(null)}
              className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-black/70 text-lg">✕</button>
          </div>
        </div>
      )}
    </div>
  )
}
