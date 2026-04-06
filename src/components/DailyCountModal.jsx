import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { insertEditLog, confirmEmptyComment } from '../lib/editLogger'

export default function DailyCountModal({ item, onClose, onUpdated, session }) {
  const [counts, setCounts] = useState([])
  const [editLogs, setEditLogs] = useState({})
  const [loading, setLoading] = useState(true)
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0])
  const [newValue, setNewValue] = useState('')
  const [editComment, setEditComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [currentQty, setCurrentQty] = useState(item.quantity ?? 0)

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

    // 棚卸記録に関連する編集ログを取得
    const { data: logs } = await supabase
      .from('edit_logs')
      .select('*')
      .eq('table_name', 'daily_counts')
      .like('record_id', item.id + '%')
      .order('created_at', { ascending: false })

    // record_idごとにログをマッピング
    const logMap = {}
    if (logs) {
      logs.forEach((log) => {
        if (!logMap[log.record_id]) {
          logMap[log.record_id] = []
        }
        logMap[log.record_id].push(log)
      })
    }
    setEditLogs(logMap)
    setLoading(false)
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newDate || newValue === '') return
    const delta = Number(newValue)
    if (isNaN(delta)) return

    // コメント未記入チェック
    if (!confirmEmptyComment(editComment)) return

    setSaving(true)

    // 1. Record the daily count
    const { error: countError } = await supabase.from('daily_counts').upsert({
      item_id: item.id,
      count_date: newDate,
      count_value: delta,
    }, { onConflict: 'item_id,count_date' })

    if (countError) {
      setSaving(false)
      toast.error('保存に失敗しました')
      return
    }

    // 2. Update inventory quantity by delta
    const newQty = currentQty + delta
    const unitPrice = item.unit_price ?? 0
    const { error: updateError } = await supabase
      .from('inventory_items')
      .update({
        quantity: newQty,
        total_price: newQty * unitPrice,
      })
      .eq('id', item.id)

    // 編集ログを記録
    await insertEditLog({
      tableName: 'daily_counts',
      recordId: item.id + '_' + newDate,
      actionType: 'upsert',
      userEmail: session?.user?.email,
      comment: editComment.trim(),
      details: { item_name: item.product_name, date: newDate, delta: delta, qty_before: currentQty, qty_after: newQty },
    })

    setSaving(false)

    if (updateError) {
      toast.error('在庫数の更新に失敗しました')
    } else {
      const sign = delta >= 0 ? '+' : ''
      toast.success('記録しました (' + sign + delta + ' \u2192 在庫: ' + newQty + ')')
      setNewValue('')
      setEditComment('')
      setCurrentQty(newQty)
      loadCounts()
      if (onUpdated) onUpdated()
    }
  }

  const handleDeleteCount = async (count) => {
    if (!confirm('この記録 (数量: ' + count.count_value + ') を削除し、在庫数を元に戻しますか？')) return

    const deleteComment = prompt('削除コメント（任意）:') ?? ''
    if (deleteComment === '' && !confirmEmptyComment('')) return

    const reverseDelta = -(count.count_value ?? 0)
    const newQty = currentQty + reverseDelta
    const unitPrice = item.unit_price ?? 0

    const { error: delError } = await supabase.from('daily_counts').delete().eq('id', count.id)

    if (delError) {
      toast.error('削除に失敗しました')
      return
    }

    await supabase
      .from('inventory_items')
      .update({
        quantity: newQty,
        total_price: newQty * unitPrice,
      })
      .eq('id', item.id)

    // 編集ログを記録
    await insertEditLog({
      tableName: 'daily_counts',
      recordId: item.id + '_' + count.count_date,
      actionType: 'delete',
      userEmail: session?.user?.email,
      comment: deleteComment.trim(),
      details: { item_name: item.product_name, date: count.count_date, deleted_value: count.count_value, qty_before: currentQty, qty_after: newQty },
    })

    toast.success('記録を削除し、在庫数を ' + newQty + ' に戻しました')
    setCurrentQty(newQty)
    loadCounts()
    if (onUpdated) onUpdated()
  }

  const formatDate = (dateStr) => {
    const d = new Date(dateStr)
    const days = ['日', '月', '火', '水', '木', '金', '土']
    return d.getFullYear() + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0') + ' (' + days[d.getDay()] + ')'
  }

  const formatLogInline = (log) => {
    const d = new Date(log.created_at)
    const days = ['日', '月', '火', '水', '木', '金', '土']
    const dayName = days[d.getDay()]
    const dateStr = d.getFullYear() + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0')
    const timeStr = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
    const delta = log.details?.delta
    const isDelete = log.action_type === 'delete'
    let actionStr
    if (isDelete) {
      const delVal = log.details?.deleted_value
      actionStr = '削除' + (delVal !== undefined ? '(' + (delVal >= 0 ? '+' : '') + delVal + ')' : '')
    } else {
      const sign = delta >= 0 ? '+' : ''
      actionStr = delta !== undefined ? sign + delta : log.action_type
    }
    const editor = log.user_email ? log.user_email.split('@')[0] : '不明'
    return actionStr + ' / ' + editor + ' / ' + dayName + ' / ' + dateStr + ' ' + timeStr + (log.comment ? ' / ' + log.comment : '')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden m-4 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800">棚卸履歴</h2>
            <p className="text-sm text-slate-500 truncate max-w-xs">{item.product_name}</p>
            <p className="text-xs text-blue-600 font-medium mt-0.5">現在の在庫数: {new Intl.NumberFormat('ja-JP').format(currentQty)}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleAdd} className="px-6 py-3 border-b border-slate-100 bg-slate-50 flex-shrink-0">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">日付</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="w-28">
              <label className="block text-xs font-medium text-slate-600 mb-1">増減数</label>
              <input
                type="number"
                step="any"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="例: 50, -20"
                className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition disabled:opacity-50"
            >
              記録
            </button>
          </div>
          {/* 編集コメント欄 */}
          <div className="mt-2">
            <input
              type="text"
              value={editComment}
              onChange={(e) => setEditComment(e.target.value)}
              placeholder="コメント（任意）: 変更理由やメモ..."
              className="w-full px-2 py-1.5 border border-amber-300 rounded text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-amber-50"
            />
          </div>
        </form>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : (() => {
            const allEntries = []
            counts.forEach(c => {
              const logKey = item.id + '_' + c.count_date
              const logs = (editLogs[logKey] || []).filter(log => log.action_type !== 'delete')
              if (logs.length > 0) {
                logs.forEach(log => allEntries.push({ log, count: c }))
              } else {
                allEntries.push({ log: null, count: c })
              }
            })
            allEntries.sort((a, b) => {
              const da = a.log ? new Date(a.log.created_at) : new Date(a.count.count_date)
              const db = b.log ? new Date(b.log.created_at) : new Date(b.count.count_date)
              return db - da
            })
            return allEntries.length === 0 ? (
              <div className="text-center text-slate-400 py-12 text-sm">棚卸記録がありません</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 sticky top-0">
                    <th className="text-left px-4 py-2 text-slate-600 font-medium">日時</th>
                    <th className="text-right px-3 py-2 text-slate-600 font-medium">増減数</th>
                    <th className="text-left px-3 py-2 text-slate-600 font-medium">編集者</th>
                    <th className="text-left px-3 py-2 text-slate-600 font-medium">コメント</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {allEntries.map((entry, idx) => {
                    const { log, count: c } = entry
                    const d = log ? new Date(log.created_at) : null
                    const delta = log && log.details?.delta !== undefined ? log.details.delta : c.count_value
                    const dateStr = d
                      ? d.getFullYear() + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + String(d.getDate()).padStart(2,'0') + ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0')
                      : formatDate(c.count_date)
                    const editor = log && log.user_email ? log.user_email.split('@')[0] : '-'
                    const comment = log && log.comment ? log.comment : ''
                    return (
                      <tr key={log ? log.id : c.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-4 py-2 text-slate-700 text-xs whitespace-nowrap">{dateStr}</td>
                        <td className={'px-3 py-2 text-right font-medium ' + (delta >= 0 ? 'text-blue-700' : 'text-red-600')}>
                          {delta >= 0 ? '+' : ''}{new Intl.NumberFormat('ja-JP').format(delta)}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-600">{editor}</td>
                        <td className="px-3 py-2 text-xs text-slate-500 max-w-[120px] truncate">{comment}</td>
                        <td className="pr-2">
                          <button
                            onClick={() => handleDeleteCount(c)}
                            className="p-1 text-slate-300 hover:text-red-500 transition"
                            title="削除"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )
          })()}
          )}
        </div>
      </div>
    </div>
  )
}
