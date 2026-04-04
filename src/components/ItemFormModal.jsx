import { useState } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { insertEditLog, confirmEmptyComment } from '../lib/editLogger'

export default function ItemFormModal({ locationId, item, onClose, onSaved, session }) {
  const isEdit = !!item

  const [form, setForm] = useState({
    product_name: item?.product_name || '',
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
  const [editComment, setEditComment] = useState('')
  const [saving, setSaving] = useState(false)

  const handleChange = (field, value) => {
    setForm({ ...form, [field]: value })
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
          ? { before: { product_name: item.product_name, owner: item.owner, supplier: item.supplier, unit_price: item.unit_price }, after: payload }
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">持ち丳</label>
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
      </div>
    </div>
  )
}
