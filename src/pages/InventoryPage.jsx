import { useState, useEffect, useCallback } from 'react'

import { useParams } from 'react-router-dom'

import { supabase } from '../lib/supabase'

import toast from 'react-hot-toast'

import * as XLSX from 'xlsx'

import ItemFormModal from '../components/ItemFormModal'

import DailyCountModal from '../components/DailyCountModal'

export default function InventoryPage({ userRole, session }) {

  const { id } = useParams()

  const [location, setLocation] = useState(null)

  const [items, setItems] = useState([])

  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')

  const [showForm, setShowForm] = useState(false)

  const [editItem, setEditItem] = useState(null)

  const [showDaily, setShowDaily] = useState(null)

  const [sortField, setSortField] = useState('product_name')

  const [sortDir, setSortDir] = useState('asc')

  const [pendingRequests, setPendingRequests] = useState([])

  const loadItems = useCallback(async () => {

    const { data: loc } = await supabase.from('locations').select('*').eq('id', id).single()

    setLocation(loc)

    const { data } = await supabase

      .from('inventory_items')

      .select('*')

      .eq('location_id', id)

      .order(sortField, { ascending: sortDir === 'asc' })

    setItems(data || [])

    setLoading(false)

  }, [id, sortField, sortDir])

  const loadPendingRequests = useCallback(async () => {

    const { data } = await supabase

      .from('approval_requests')

      .select('*')

      .eq('type', 'delete_item')

      .eq('location_id', Number(id))

      .eq('status', 'pending')

    setPendingRequests(data || [])

  }, [id])

  useEffect(() => {

    setLoading(true)

    loadItems()

    loadPendingRequests()

  }, [loadItems, loadPendingRequests])

  const handleDelete = async (item) => {

    if (!confirm(`「${item.product_name}」を削除しますか？`)) return

    const { error } = await supabase.from('inventory_items').delete().eq('id', item.id)

    if (error) {

      toast.error('削除に失敗しました')

    } else {

      toast.success('削除しました')

      loadItems()

    }

  }

  const handleSort = (field) => {

    if (sortField === field) {

      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')

    } else {

      setSortField(field)

      setSortDir('asc')

    }

  }

  const SortIcon = ({ field }) => {

    if (sortField !== field) return <span className="text-slate-300 ml-1">&#x2195;</span>

    return <span className="text-blue-500 ml-1">{sortDir === 'asc' ? '\u25B2' : '\u25BC'}</span>

  }

  const filtered = items.filter((item) => {

    if (!search) return true

    const q = search.toLowerCase()

    return (

      (item.product_name || '').toLowerCase().includes(q) ||

      (item.owner || '').toLowerCase().includes(q) ||

      (item.supplier || '').toLowerCase().includes(q) ||

      (item.manufacturer || '').toLowerCase().includes(q) ||

      (item.remarks || '').toLowerCase().includes(q)

    )

  })

  const formatCurrency = (val) => {

    if (!val && val !== 0) return '-'

    return new Intl.NumberFormat('ja-JP').format(val)

  }

  const handleExcelDownload = () => {

    const data = filtered.map((item) => ({

      '品名': item.product_name || '',

      '保管場所': item.location_detail || '',

      '持ち主': item.owner || '',

      '仕入先': item.supplier || item.manufacturer || '',

      '在庫数': item.quantity ?? 0,

      '単位': item.unit || '',

      '単価': item.unit_price ?? 0,

      '合計金額': item.total_price ?? 0,

      '備考': item.remarks || '',

    }))

    const ws = XLSX.utils.json_to_sheet(data)

    const wb = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(wb, ws, location?.name || '在庫一覧')

    const fileName = `在庫一覧_${location?.name || ''}_${new Date().toISOString().slice(0, 10)}.xlsx`

    XLSX.writeFile(wb, fileName)

  }

  if (loading) {

    return (

      <div className="flex items-center justify-center h-64">

        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>

      </div>

    )

  }

  return (

    <div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">

        <div>

          <h1 className="text-2xl font-bold text-slate-800">{location?.name}</h1>

          {location?.description && (

            <p className="text-sm text-slate-500 mt-1">{location.description}</p>

          )}

        </div>

        <div className="flex items-center gap-2 flex-shrink-0">

          <button

            onClick={handleExcelDownload}

            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5"

          >

            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />

            </svg>

            Excelダウンロード

          </button>

          {userRole !== 'viewer' && (

          <button

            onClick={() => { setEditItem(null); setShowForm(true) }}

            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"

          >

            + 新規品目追加

          </button>

          )}

        </div>

      </div>      <div className="flex items-center gap-4 mb-4">

        <div className="relative flex-1 max-w-md">

          <input

            type="text"

            value={search}

            onChange={(e) => setSearch(e.target.value)}

            placeholder="品名・持ち主・仕入先で検索..."

            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"

          />

          <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">

            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />

          </svg>

        </div>

        <span className="text-sm text-slate-500">{filtered.length} 件</span>

      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">

        <div className="table-container">

          <table className="w-full text-sm">

            <thead>

              <tr className="bg-slate-50 border-b border-slate-200">

                <th className="text-left px-4 py-3 font-semibold text-slate-600 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('product_name')}>

                  品名<SortIcon field="product_name" />

                </th>

                <th className="text-left px-4 py-3 font-semibold text-slate-600 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('owner')}>

                  持ち主<SortIcon field="owner" />

                </th>

                <th className="text-left px-4 py-3 font-semibold text-slate-600 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('supplier')}>

                  仕入先<SortIcon field="supplier" />

                </th>

                <th className="text-right px-4 py-3 font-semibold text-slate-600 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('quantity')}>

                  在庫数<SortIcon field="quantity" />

                </th>

                <th className="text-left px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">単位</th>

                <th className="text-right px-4 py-3 font-semibold text-slate-600 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('unit_price')}>

                  単価<SortIcon field="unit_price" />

                </th>

                <th className="text-right px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">合計金額</th>

                <th className="text-center px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">操作</th>

              </tr>

            </thead>            <tbody>

              {filtered.map((item) => (

                <tr key={item.id} className="border-b border-slate-100 hover:bg-blue-50/30 transition">

                  <td className="px-4 py-3 max-w-xs">

                    <div className="font-medium text-slate-800 truncate" title={item.product_name}>

                      {item.product_name}

                    </div>

                    {item.location_detail && (

                      <div className="text-xs text-slate-400 truncate">{item.location_detail}</div>

                    )}

                  </td>

                  <td className="px-4 py-3 text-slate-600">{item.owner || '-'}</td>

                  <td className="px-4 py-3 text-slate-600">{item.supplier || item.manufacturer || '-'}</td>

                  <td className="px-4 py-3 text-right font-medium text-slate-800">{formatCurrency(item.quantity)}</td>

                  <td className="px-4 py-3 text-slate-600">{item.unit || '-'}</td>

                  <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(item.unit_price)}</td>

                  <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(item.total_price)}</td>

                  <td className="px-4 py-3">

                    <div className="flex items-center justify-center gap-1">

                      {userRole !== 'viewer' && (

                      <button

                        onClick={() => setShowDaily(item)}

                        className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition"

                        title="棚卸履歴"

                      >

                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />

                        </svg>

                      </button>

                      )}

                      {userRole !== 'viewer' && (

                      <button

                        onClick={() => { setEditItem(item); setShowForm(true) }}

                        className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-amber-600 transition"

                        title="編集"

                      >

                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />

                        </svg>

                      </button>

                      )}

                      {userRole === 'admin' && (

                        <button

                          onClick={() => handleDelete(item)}

                          className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-red-600 transition"

                          title="削除"

                        >

                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />

                          </svg>

                        </button>

                      )}

                      {userRole === 'editor' && (

                        isPendingDelete(item.id) ? (

                          <span className="p-1.5 text-orange-400" title="削除申請中（承認待ち）">

                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />

                            </svg>

                          </span>

                        ) : (

                          <button

                            onClick={() => handleRequestDelete(item)}

                            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-red-600 transition"

                            title="削除を申請"

                          >

                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />

                            </svg>

                          </button>

                        )

                      )}

                    </div>

                  </td>

                </tr>

              ))}              {filtered.length === 0 && (

                <tr>

                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">

                    {search ? '検索結果がありません' : 'データがありません'}

                  </td>

                </tr>

              )}

            </tbody>

          </table>

        </div>

      </div>

      {showForm && (

        <ItemFormModal

          locationId={Number(id)}

          item={editItem}

          onClose={() => { setShowForm(false); setEditItem(null) }}

          onSaved={() => { setShowForm(false); setEditItem(null); loadItems() }}

        />

      )}

      {showDaily && (

        <DailyCountModal

          item={showDaily}

          onClose={() => setShowDaily(null)}

          onUpdated={loadItems}

        />

      )}

    </div>

  )

}
