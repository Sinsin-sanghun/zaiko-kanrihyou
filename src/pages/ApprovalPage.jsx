import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function ApprovalPage({ session }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')

  const fetchRequests = useCallback(async () => {
    let query = supabase
      .from('approval_requests')
      .select('*')
      .order('created_at', { ascending: false })
    if (filter !== 'all') {
      query = query.eq('status', filter)
    }
    const { data, error } = await query
    if (error) {
      toast.error('申請一覧の取得に失敗しました')
    } else {
      setRequests(data || [])
    }
    setLoading(false)
  }, [filter])

  useEffect(() => {
    setLoading(true)
    fetchRequests()
  }, [fetchRequests])

  const handleApprove = async (req) => {
    try {
      if (req.type === 'delete_item') {
        const { error: delError } = await supabase
          .from('inventory_items')
          .delete()
          .eq('id', req.target_id)
        if (delError) {
          toast.error('品目の削除に失敗しました')
          return
        }
      } else if (req.type === 'rename_location') {
        const { error: renError } = await supabase
          .from('locations')
          .update({ name: req.new_value })
          .eq('id', req.target_id)
        if (renError) {
          toast.error('拠点名の変更に失敗しました')
          return
        }
      }

      await supabase
        .from('approval_requests')
        .update({
          status: 'approved',
          reviewed_by: session?.user?.email,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', req.id)

      toast.success('承認しました')
      fetchRequests()
    } catch (e) {
      toast.error('承認処理に失敗しました')
    }
  }

  const handleReject = async (req) => {
    await supabase
      .from('approval_requests')
      .update({
        status: 'rejected',
        reviewed_by: session?.user?.email,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', req.id)
    toast.success('却下しました')
    fetchRequests()
  }

  const typeLabel = (type) => {
    switch (type) {
      case 'delete_item': return '品目削除'
      case 'rename_location': return '拠点名変更'
      default: return type
    }
  }

  const typeBadgeColor = (type) => {
    switch (type) {
      case 'delete_item': return 'bg-red-100 text-red-700'
      case 'rename_location': return 'bg-blue-100 text-blue-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const statusLabel = (status) => {
    switch (status) {
      case 'pending': return '承認待ち'
      case 'approved': return '承誎済み'
      case 'rejected': return '却下済み'
      default: return status
    }
  }

  const statusBadgeColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-orange-100 text-orange-700'
      case 'approved': return 'bg-green-100 text-green-700'
      case 'rejected': return 'bg-slate-100 text-slate-500'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">承認管理</h1>

      <div className="flex gap-2 mb-4">
        {[
          { key: 'pending', label: '承認待ち' },
          { key: 'approved', label: '承認済み' },
          { key: 'rejected', label: '却下済み' },
          { key: 'all', label: 'すべて' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 text-sm rounded-lg transition ${
              filter === f.key
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {requests.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center text-slate-400">
          {filter === 'pending' ? '承認待ちの申請はありません' : '該当する申請はありません'}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-semibold text-slate-600">種別</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">対象</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">詳細</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">申請者</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">申請日時</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">状態</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.id} className="border-b border-slate-100 hover:bg-blue-50/30">
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${typeBadgeColor(req.type)}`}>
                      {typeLabel(req.type)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {req.target_name || `ID: ${req.target_id}`}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {req.type === 'rename_location' && req.new_value && (
                      <span>新しい名前: <span className="font-medium">{req.new_value}</span></span>
                    )}
                    {req.type === 'delete_item' && (
                      <span className="text-red-500">削除リクエスト</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{req.requested_by}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {new Date(req.created_at).toLocaleString('ja-JP')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeColor(req.status)}`}>
                      {statusLabel(req.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {req.status === 'pending' ? (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleApprove(req)}
                          className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                        >
                          承認
                        </button>
                        <button
                          onClick={() => handleReject(req)}
                          className="px-3 py-1 text-xs bg-slate-200 text-slate-600 rounded hover:bg-slate-300 transition"
                        >
                          却下
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 text-center">
                        {req.reviewed_by && (
                          <div>{req.reviewed_by}</div>
                        )}
                        {req.reviewed_at && (
                          <div>{new Date(req.reviewed_at).toLocaleString('ja-JP')}</div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
