import { useState } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function ItemFormModal({ locationId, item, onClose, onSaved }) {
  const isEdit = !!item
  const [form, setForm] = useState({
    product_name: item?.product_name || '',
    owner: item?.owner || '',
    supplier: item?.supplier || '',
    manufacturer: item?.manufacturer || '',
    location_detail: item?.location_detail || '',
    model: item?.model || '',
    item_no: item?.item_no || '',
    quantity: item?.quantity ?? '',
    unit: item?.unit || '',
    unit_price: item?.unit_price ?? '',
    total_price: item?.total_price ?? '',
    remarks: item?.remarks || '',
  })
  const [saving, setSaving] = useState(false)

  const handleChange = (field, value) => {
    const updated = { ...form, [field]: value }
    if (field === 'quantity' || field === 'unit_price') {
      const qty = field === 'quantity' ? Number(value) || 0 : Number(updated.quantity) || 0
      const price = field === 'unit_price' ? Number(value) || 0 : Number(updated.unit_price) || 0
      updated.total_price = qty * price
    }
    setForm(updated)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.product_name.trim()) {
      toast.error('品名を入力してください')
      return
    }
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
      quantity: Number(form.quantity) || 0,
      unit: form.unit.trim() || null,
      unit_price: Number(form.unit_price) || 0,
      total_price: Number(form.total_price) || 0,
      remarks: form.remarks.trim() || null,
    }

    let error
    if (isEdit) {
      ({ error } = await supabase.from('inventory_items').update(payload).eq('id', item.id))
    } else {
      ({ error } = await supabase.from('inventory_items').insert(payload))
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-4" onClick={(e) => e.stopPropagation()}>
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
            <input type="text" value={form.product_name} onChange={(e) => handleChange('product_name', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">持ち主</label>
              <input type="text" value={form.owner} onChange={(e) => handleChange('owner', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">仕入先</label>
              <input type="text" value={form.supplier} onChange={(e) => handleChange('supplier', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">メーカー</label>
              <input type="text" value={form.manufacturer} onChange={(e) => handleChange('manufacturer', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">型式</label>
              <input type="text" value={form.model} onChange={(e) => handleChange('model', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">場所詳細</label>
            <input type="text" value={form.location_detail} onChange={(e) => handleChange('location_detail', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">数量</label>
              <input type="number" step="any" value={form.quantity} onChange={(e) => handleChange('quantity', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">単位</label>
              <input type="text" value={form.unit} onChange={(e) => handleChange('unit', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">単価</label>
              <input type="number" step="any" value={form.unit_price} onChange={(e) => handleChange('unit_price', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">合計金額</label>
              <input type="number" step="any" value={form.total_price} onChange={(e) => handleChange('total_price', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-slate-50" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">備考</label>
            <textarea value={form.remarks} onChange={(e) => handleChange('remarks', e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition">
              キャンセル
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50">
              {saving ? '保存中...' : isEdit ? '更新する' : '追加する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
      }
