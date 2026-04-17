import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { insertEditLog, confirmEmptyComment } from '../lib/editLogger'

const PRESET_CATEGORIES = ['購買', '工事', '設計', '弱電', 'OM', 'PPA', 'OM/工事兼用', '所掌不明']

export default function ItemFormModal({ locationId, item, onClose, onSaved, session }) {
  const isEdit = !!item
  const initialIsCustomCategory = !!(item?.category && !PRESET_CATEGORIES.includes(item.category))

  const [form, setForm] = useState({
    product_name: item?.product_name || '',
    category: item?.category || '',
    owner: item?.owner || '',
    supplier: item?.supplier || '',
    manufacturer: item?.manufacturer || '',
    location_detail: item?.location_detail || '',
    model: item?.model || '',
    item_no: item?.item_no || '',
    unit: item?.unit || '',
    unit_price: item?.unit_price ?? '',
    remarks: item?.remarks || '',
  })
  const [categoryMode, setCategoryMode] = useState(initialIsCustomCategory ? 'custom' : 'preset')
  const [editComment, setEditComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [editLogs, setEditLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(false)

  useEffect(() => {
    if (isEdit && item?.id) {
      setLogsLoading(true)
      supabase
        .from('edit_logs')
        .select('*')
        .eq('table_name', 'inventory_items')
        .eq('record_id', String(item.id))
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          setEditLogs(data || [])
          setLogsLoading(false)
        })
    }
  }, [item?.id])

  const fieldLabels = { product_name: '品名', category: 'カテゴリ', owner: '持ち主', supplier: '仕入先', manufacturer: 'メーカー', model: '型式', location_detail: '場所詳細', unit: '単位', unit_price: '単価', remarks: '備考' }

  const getChanges = (log) => {
    if (!log.details?.before || !log.details?.after) return []
    const changes = []
    Object.keys(fieldLabels).forEach(key => {
      const bVal = log.details.before[key] ?? ''
      const aVal = log.details.after[key] ?? ''
      if (String(bVal) !== String(aVal)) {
        changes.push({ field: fieldLabels[key], before: bVal || '(空)', after: aVal || '(空)' })
      }
    })
    return changes
  }

  const handleChange = (field, value) => {
    setForm({ ...form, [field]: value })
  }

  const handleCategorySelect = (val) => {
    if (val === '__custom__') {
      setCategoryMode('custom')
      setForm({ ...form, category: '' })
    } else {
      setCategoryMode('preset')
      setForm({ ...form, category: val })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.product_name.trim()) {
      toast.error('品名を入力してください')
      return
    }
    // コメント未記入チェック
    if (!confirmEmptyComment(editComment)) return

    setSaving(true)
    const payload = {
      location_id: locationId,
      product_name: form.product_name.trim(),
      category: form.category.trim() || null,
      owner: form.owner.trim() || null,
      supplier: form.supplier.trim() || null,
      manufacturer: form.manufacturer.trim() || null,
      location_detail: form.location_detail.trim() || null,
      model: form.model.trim() || null,
      item_no: form.item_no.trim() || null,
      unit: form.unit.trim() || null,
      unit_price: Number(form.unit_price) || 0,
      remarks: form.remarks.trim() || null,
    }
    // For new items, initialize quantity and total_price
    if (!isEdit) {
      payload.quantity = 0
      payload.total_price = 0
    }

    let error
    let resultData
    if (isEdit) {
      const res = await supabase.from('inventory_items').update(payload).eq('id', item.id).select()
      error = res.error
      resultData = res.data
    } else {
      const res = await supabase.from('inventory_items').insert(payload).select()
      error = res.error
      resultData = res.data
    }

    // 編集ログを記録
    if (!error) {
      const recordId = isEdit ? item.id : resultData?.[0]?.id
      await insertEditLog({
        tableName: 'inventory_items',
        recordId: recordId || 'unknown',
        actionType: isEdit ? 'update' : 'create',
        userEmail: session?.user?.email,
        comment: editComment.trim(),
        details: isEdit
          ? { before: { product_name: item.product_name, category: item.category, owner: item.owner, supplier: item.supplier, manufacturer: item.manufacturer, model: item.model, location_detail: item.location_detail, unit: item.unit, unit_price: item.unit_price, remarks: item.remarks }, after: payload }
          : { created: payload },
      })
    }

    setSaving(false)
    if (error) {
      toast.error('保存に失敗しました: ' + error.message)
    } else {
      toast.success(isEdit ? '更新しました' : '追加しました')
      onSaved()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">
            {isEdit ? '品目を編集' : '新規品目追加'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">品名 <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.product_name}
              onChange={(e) => handleChange('product_name', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">カテゴリ</label>
            <select
              value={categoryMode === 'custom' ? '__custom__' : form.category}
              onChange={(e) => handleCategorySelect(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
            >
              <option value="">(未分類)</option>
              {PRESET_CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value="__custom__">その他（直接入力）</option>
            </select>
            {categoryMode === 'custom' && (
              <input
                type="text"
                value={form.category}
                onChange={(e) => handleChange('category', e.target.value)}
                placeholder="カテゴリ名を入力..."
                className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">持ち主</label>
              <input
                type="text"
                value={form.owner}
                onChange={(e) => handleChange('owner', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">仕入先</label>
              <input
                type="text"
                value={form.supplier}
                onChange={(e) => handleChange('supplier', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">メーカー</label>
              <input
                type="text"
                value={form.manufacturer}
                onChange={(e) => handleChange('manufacturer', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">型式</label>
              <input
                type="text"
                value={form.model}
                onChange={(e) => handleChange('model', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">場所詳細</label>
            <input
              type="text"
              value={form.location_detail}
              onChange={(e) => handleChange('location_detail', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">単位</label>
              <input
                type="text"
                value={form.unit}
                onChange={(e) => handleChange('unit', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">単価</label>
              <input
                type="number"
                step="any"
                value={form.unit_price}
                onChange={(e) => handleChange('unit_price', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {isEdit && (
            <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600">
              <span className="font-medium">在庫数:</span> {new Intl.NumberFormat('ja-JP').format(item.quantity ?? 0)} {item.unit || ''}
              <span className="text-xs text-slate-400 ml-2">(棚卸履歴から変更できます)</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">備考</label>
            <textarea
              value={form.remarks}
              onChange={(e) => handleChange('remarks', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
            />
          </div>

          {/* 編集コメント欄 */}
          <div className="border-t border-slate-200 pt-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              編集コメント <span className="text-xs text-slate-400">(任意)</span>
            </label>
            <input
              type="text"
              value={editComment}
              onChange={(e) => setEditComment(e.target.value)}
              placeholder="変更理由やメモを入力..."
              className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none bg-amber-50"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50"
            >
              {saving ? '保存中...' : isEdit ? '更新する' : '追加する'}
            </button>
          </div>
        </form>

        {isEdit && (
          <div className="px-6 pb-4 border-t border-slate-200 max-h-[35vh] overflow-y-auto">
            <h3 className="text-sm font-bold text-slate-700 pt-3 pb-2 sticky top-0 bg-white">編集履歴</h3>
            {logsLoading ? (
              <div className="flex items-center justify-center h-16">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              </div>
            ) : editLogs.length === 0 ? (
              <p className="text-xs text-slate-400 py-3">編集履歴はありません</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-1.5 px-1 text-slate-500 font-medium">日時</th>
                    <th className="text-left py-1.5 px-1 text-slate-500 font-medium">編集者</th>
                    <th className="text-left py-1.5 px-1 text-slate-500 font-medium">変更内容</th>
                  </tr>
                </thead>
                <tbody>
                  {editLogs.map(log => {
                    const d = new Date(log.created_at)
                    const dateStr = d.getFullYear() + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + String(d.getDate()).padStart(2,'0') + ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0')
                    const editor = log.user_email ? log.user_email.split('@')[0] : '-'
                    const isCreate = log.action_type === 'create'
                    const changes = getChanges(log)
                    return (
                      <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="py-1.5 px-1 text-slate-600 whitespace-nowrap align-top">{dateStr}</td>
                        <td className="py-1.5 px-1 text-slate-600 align-top">{editor}</td>
                        <td className="py-1.5 px-1 text-slate-700">
                          {isCreate ? (
                            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-800">新規作成</span>
                          ) : changes.length > 0 ? (
                            <div>
                              {changes.map((c, ci) => (
                                <div key={ci}><span className="font-medium text-amber-700">{c.field}</span>: <span className="text-slate-400">{c.before}</span> → <span className="text-blue-700">{c.after}</span></div>
                              ))}
                              {log.comment && <div className="text-slate-400 mt-0.5">{log.comment}</div>}
                            </div>
                          ) : (
                            <span className="text-slate-400">{log.comment || '-'}</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
