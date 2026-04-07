import { useState, useEffect, useCallback, Fragment } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import ItemFormModal from '../components/ItemFormModal'
import DailyCountModal from '../components/DailyCountModal'
import { insertEditLog, confirmEmptyComment } from '../lib/editLogger'

const ITEM_GROUPS = [
  { name: 'ãã«ããªã¬ã¼', keyword: 'ãã«ããªã¬ã¼' },
  { name: 'é¶ç¸é»å§æ¤åºå¨', keyword: 'é¶ç¸é»å§æ¤åºå¨' },
  { name: 'ãã«ãã¡ã¼ã¿', keyword: 'ãã«ãã¡ã¼ã¿' },
  { name: 'é«éãã©ã³ã¹ãã¥ã¼ãµ', keyword: 'é«éãã©ã³ã¹ãã¥ã¼ãµ' },
  { name: 'å°çµ¡éé»å§ä¿è­·', keyword: 'å°çµ¡éé»å§ä¿è­·' },
  { name: 'æµææå¥å¼è² è·ééå¨', keyword: 'æµææå¥å¼è² è·ééå¨' },
  { name: 'éé»æµç¶é»å¨', keyword: 'éé»æµç¶é»å¨' },
  { name: 'ä¸è¶³é»å§ç¶é»å¨', keyword: 'ä¸è¶³é»å§ç¶é»å¨' },
  { name: 'è©¦é¨ç¨ç«¯å­', keyword: 'è©¦é¨ç¨ç«¯å­' },
  { name: 'é«åãã«ã', keyword: 'é«åãã«ã' },
  { name: 'QC4ã³ãã¯ã¿', keyword: 'QC4ã³ãã¯ã¿' },
]

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
  const [collapsedGroups, setCollapsedGroups] = useState(() => {
    const initial = {}
    ITEM_GROUPS.forEach(g => { initial[g.name] = true })
    initial['ãã®ä»'] = true
    return initial
  })

  const toggleGroup = (groupName) => {
    setCollapsedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }))
  }

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
    if (!confirm(`ã${item.product_name}ããåé¤ãã¾ããï¼`)) return
    const deleteComment = prompt('åé¤ã³ã¡ã³ãï¼ä»»æï¼:') ?? ''
    if (deleteComment === '' && !confirmEmptyComment('')) return
    const { error } = await supabase.from('inventory_items').delete().eq('id', item.id)
    if (error) {
      toast.error('åé¤ã«å¤±æãã¾ãã')
    } else {
      await insertEditLog({
        tableName: 'inventory_items',
        recordId: item.id,
        actionType: 'delete',
        userEmail: session?.user?.email,
        comment: deleteComment.trim(),
        details: {
          deleted_item: {
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: item.unit_price
          }
        },
      })
      toast.success('åé¤ãã¾ãã')
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

  const getGroupedItems = () => {
    if (id !== '5') return [{ name: null, items: filtered }]
    const groups = ITEM_GROUPS.map(g => ({ name: g.name, keyword: g.keyword, items: [] }))
    const other = []
    filtered.forEach(item => {
      const name = item.product_name || ''
      const matched = groups.find(g => name.includes(g.keyword))
      if (matched) {
        matched.items.push(item)
      } else {
        other.push(item)
      }
    })
    const result = groups.filter(g => g.items.length > 0).map(g => ({ name: g.name, items: g.items }))
    if (other.length > 0) {
      result.push({ name: 'ãã®ä»', items: other })
    }
    return result
  }

  const groupedItems = getGroupedItems()

  const formatCurrency = (val) => {
    if (!val && val !== 0) return '-'
    return new Intl.NumberFormat('ja-JP').format(val)
  }

  const isPendingDelete = (itemId) => {
    return pendingRequests.some((r) => r.target_id === itemId)
  }

  const handleRequestDelete = async (item) => {
    if (!confirm(`ã${item.product_name}ãã®åé¤ãç³è«ãã¾ããï¼`)) return
    const { error } = await supabase.from('approval_requests').insert({
      type: 'delete_item',
      target_id: item.id,
      target_name: item.product_name,
      location_id: Number(id),
      requested_by: session?.user?.email,
    })
    if (error) {
      toast.error('ç³è«ã«å¤±æãã¾ãã')
    } else {
      toast.success('åé¤ç³è«ãéä¿¡ãã¾ãã')
      loadPendingRequests()
    }
  }

  const handleExcelDownload = () => {
    const data = filtered.map((item) => ({
      'åå': item.product_name || '',
      'ä¿ç®¡å ´æ': item.location_detail || '',
      'æã¡ä¸»': item.owner || '',
      'ä»å¥å': item.supplier || item.manufacturer || '',
      'å¨åº«æ°': item.quantity ?? 0,
      'åä½': item.unit || '',
      'åä¾¡': item.unit_price ?? 0,
      'åè¨éé¡': item.total_price ?? 0,
      'åè': item.remarks || '',
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, location?.name || 'å¨åº«ä¸è¦§')
    const fileName = `å¨åº«ä¸è¦§_${location?.name || ''}_${new Date().toISOString().slice(0, 10)}.xlsx`
    XLSX.writeFile(wb, fileName)
  }

  const renderItemRow = (item) => (
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
              title="æ£å¸å±¥æ­´"
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
              title="ç·¨é"
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
              title="åé¤"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
          {userRole === 'editor' && (
            isPendingDelete(item.id) ? (
              <span className="p-1.5 text-orange-400" title="åé¤ç³è«ä¸­ï¼æ¿èªå¾ã¡ï¼">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
            ) : (
              <button
                onClick={() => handleRequestDelete(item)}
                className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-red-600 transition"
                title="åé¤ãç³è«"
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
  )

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
            Excelãã¦ã³ã­ã¼ã
          </button>
          {userRole !== 'viewer' && (
            <button
              onClick={() => { setEditItem(null); setShowForm(true) }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              + æ°è¦åç®è¿½å 
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ååã»æã¡ä¸»ã»ä»å¥åã§æ¤ç´¢..."
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <span className="text-sm text-slate-500">{filtered.length} ä»¶</span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="table-container">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-semibold text-slate-600 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('product_name')}>
                  åå<SortIcon field="product_name" />
                </th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('owner')}>
                  æã¡ä¸»<SortIcon field="owner" />
                </th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('supplier')}>
                  ä»å¥å<SortIcon field="supplier" />
                </th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('quantity')}>
                  å¨åº«æ°<SortIcon field="quantity" />
                </th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">åä½</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('unit_price')}>
                  åä¾¡<SortIcon field="unit_price" />
                </th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">åè¨éé¡</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">æä½</th>
              </tr>
            </thead>
            <tbody>
              {groupedItems.map((group) => (
                group.name === null ? (
                  group.items.map(renderItemRow)
                ) : (
                  <Fragment key={'group-' + group.name}>
                    <tr
                      className="bg-slate-100 cursor-pointer select-none hover:bg-slate-200 transition"
                      onClick={() => toggleGroup(group.name)}
                    >
                      <td colSpan={8} className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 text-xs w-4 inline-block">
                            {collapsedGroups[group.name] ? '\u25B6' : '\u25BC'}
                          </span>
                          <span className="font-semibold text-slate-700 text-sm">{group.name}</span>
                          <span className="text-xs text-slate-400 ml-1">({group.items.length}ä»¶)</span>
                        </div>
                      </td>
                    </tr>
                    {!collapsedGroups[group.name] && group.items.map(renderItemRow)}
                  </Fragment>
                )
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    {search ? 'æ¤ç´¢çµæãããã¾ãã' : 'ãã¼ã¿ãããã¾ãã'}
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
          session={session}
        />
      )}
      {showDaily && (
        <DailyCountModal
          item={showDaily}
          onClose={() => setShowDaily(null)}
          onUpdated={loadItems}
          session={session}
        />
      )}
    </div>
  )
}
