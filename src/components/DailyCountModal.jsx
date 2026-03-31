import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function DailyCountModal({ item, onClose }) {
  const [counts, setCounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0])
  const [newValue, setNewValue] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadCounts()
  }, [item.id])

  const loadCounts = async () => {
    const { data } = await supabase
      .from('daily_counts')
      .select('*')
      .eq('item_id', item.id)
      .order('count_date', { ascending: false })
      .limit(60)
    setCounts(data || [])
    setLoading(false)
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newDate || newValue === '') return
    setSaving(true)

    const { error } = await supabase.from('daily_counts').upsert({
      item_id: item.id,
      count_date: newDate,
      count_value: Number(newValue),
    }, { onConflict: 'item_id,count_date' })

    setSaving(false)
    if (error) {
      toast.error('保存に失敗しました')
    } else {
      toast.success('記録しました')
      setNewValue('')
      loadCounts()
    }
  }

  const handleDeleteCount = async (countId) => {
    const { error } = await supabase.from('daily_counts').delete().eq('id', countId)
    if (!error) {
      toast.success('削除しました')
      loadCounts()
    }
  }

  const formatDate = (dateStr) => {
    const d = new Date(dateStr)
    const days = ['日', '月', '火', '水', '木', '金', '土']
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} (${days[d.getDay()]})`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden m-4 flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800">棚卸履歴</h2>
            <p className="text-sm text-slate-500 truncate max-w-xs">{item.product_name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleAdd} className="px-6 py-3 border-b border-slate-100 bg-slate-50 flex gap-2 items-end flex-shrink-0">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">日付</label>
            <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)}
              className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div className="w-24">
            <label className="block text-xs font-medium text-slate-600 mb-1">数量</label>
            <input type="number" step="any" value={newValue} onChange={(e) => setNewValue(e.target.value)}
              placeholder="0"
              className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <button type="submit" disabled={saving}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition disabled:opacity-50">
            記録
          </button>
        </form>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : counts.length === 0 ? (
            <div className="text-center text-slate-400 py-12 text-sm">棚卸記録がありません</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 sticky top-0">
                  <th className="text-left px-6 py-2 text-slate-600 font-medium">日付</th>
                  <th className="text-right px-6 py-2 text-slate-600 font-medium">数量</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {counts.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-6 py-2 text-slate-700">{formatDate(c.count_date)}</td>
                    <td className="px-6 py-2 text-right font-medium text-slate-800">
                      {new Intl.NumberFormat('ja-JP').format(c.count_value)}
                    </td>
                    <td className="pr-4">
                      <button onClick={() => handleDeleteCount(c.id)}
                        className="p-1 text-slate-300 hover:text-red-500 transition">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
            }
