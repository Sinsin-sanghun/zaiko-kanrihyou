import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import ItemFormModal from '../components/ItemFormModal'
import DailyCountModal from '../components/DailyCountModal'

/* ─── Excel-style Column Filter Dropdown ─── */
function ColumnFilterDropdown({ items, field, displayFn, columnFilters, onApply, onClose, position }) {
  const ref = useRef(null)
  const [filterSearch, setFilterSearch] = useState('')
  const activeSet = columnFilters[field]

  // Collect unique values for this column
  const allValues = [...new Set(items.map((item) => {
    const raw = displayFn ? displayFn(item) : (item[field] ?? '')
    return String(raw)
  }))].sort((a, b) => a.localeCompare(b, 'ja'))

  const filteredValues = allValues.filter((v) =>
    v.toLowerCase().includes(filterSearch.toLowerCase())
  )

  // Local selection state (initially from activeSet, or all selected)
  const [selected, setSelected] = useState(() => {
    if (activeSet) return new Set(activeSet)
    return new Set(allValues)
  })

  const allChecked = filteredValues.every((v) => selected.has(v))

  const toggleAll = () => {
    const next = new Set(selected)
    if (allChecked) {
      filteredValues.forEach((v) => next.delete(v))
    } else {
      filteredValues.forEach((v) => next.add(v))
    }
    setSelected(next)
  }

  const toggle = (val) => {
    const next = new Set(selected)
    if (next.has(val)) next.delete(val)
    else next.add(val)
    setSelected(next)
  }

  const handleApply = () => {
    // If all are selected, remove the filter for this column
    if (selected.size === allValues.length) {
      onApply(field, null)
    } else {
      onApply(field, selected)
    }
  }

  const handleClear = () => {
    onApply(field, null)
  }

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // Close on scroll (reposition would be complex; just close)
  useEffect(() => {
    const handler = () => onClose()
    window.addEventListener('scroll', handler, true)
    window.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('scroll', handler, true)
      window.removeEventListener('resize', handler)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className="bg-white border border-slate-300 rounded-lg shadow-xl w-64"
      style={{
        position: 'fixed',
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        maxHeight: '380px',
        zIndex: 9999,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Search */}
      <div className="p-2 border-b border-slate-200">
        <input
          type="text"
          value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)}
          placeholder="検索..."
          className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-400 outline-none"
          autoFocus
        />
      </div>

      {/* Select All */}
      <div className="px-2 pt-2 pb-1 border-b border-slate-100">
        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 hover:bg-slate-50 px-1 py-1 rounded">
          <input
            type="checkbox"
            checked={allChecked}
            onChange={toggleAll}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          (すべて選択)
        </label>
      </div>

      {/* Value list */}
      <div className="overflow-y-auto" style={{ maxHeight: '220px' }}>
        {filteredValues.map((val) => (
          <label
            key={val}
            className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 hover:bg-blue-50 px-3 py-1.5"
          >
            <input
              type="checkbox"
              checked={selected.has(val)}
              onChange={() => toggle(val)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="truncate">{val || '(空白)'}</span>
          </label>
        ))}
        {filteredValues.length === 0 && (
          <div className="px-3 py-4 text-center text-xs text-slate-400">一致なし</div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 p-2 border-t border-slate-200 bg-slate-50 rounded-b-lg">
        <button
          onClick={handleClear}
          className="flex-1 px-3 py-1.5 text-xs text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-100 transition"
        >
          クリア
        </button>
        <button
          onClick={handleApply}
          className="flex-1 px-3 py-1.5 text-xs text-white bg-blue-600 rounded hover:bg-blue-700 transition"
        >
          適用
        </button>
      </div>
    </div>
  )
}

/* ─── Filter Icon SVG ─── */
function FilterIcon({ active }) {
  return (
    <svg
      className={`w-3.5 h-3.5 ml-1 inline-block ${active ? 'text-blue-600' : 'text-slate-300'}`}
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
      />
    </svg>
  )
}

/* ─── Main Component ─── */
export default function InventoryPage({ userRole, session }) {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
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

  // Excel-style column filters: { field: Set<string> | null }
  const [columnFilters, setColumnFilters] = useState({})
  const [openFilter, setOpenFilter] = useState(null)
  const [filterPosition, setFilterPosition] = useState({ top: 0, left: 0 })

  const loadItems = useCallback(async () => {
    const { data: loc } = await supabase.from('locations').select('*').eq('id', id).single()
    setLocation(loc)

    const category = searchParams.get('category')
    let query = supabase
      .from('inventory_items')
      .select('*')
      .eq('location_id', id)

    if (category && category !== 'all') {
      query = query.eq('category', category)
    }

    const { data } = await query.order(sortField, { ascending: sortDir === 'asc' })
    setItems(data || [])
    setLoading(false)
  }, [id, sortField, sortDir, searchParams])

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

  const isPendingDelete = (itemId) => {
    return pendingRequests.some((r) => r.item_id === itemId)
  }

  const handleRequestDelete = async (item) => {
    if (!confirm(`「${item.product_name}」の削除を申請しますか？`)) return

    const { error } = await supabase.from('approval_requests').insert({
      type: 'delete_item',
      location_id: Number(id),
      item_id: item.id,
      item_name: item.product_name,
      requested_by: session?.user?.email || 'unknown',
      status: 'pending',
    })

    if (error) {
      toast.error('削除申請に失敗しました')
    } else {
      toast.success('削除申請を送信しました')
      loadPendingRequests()
    }
  }

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

  /* ── Column filter logic ── */
  const handleFilterApply = useCallback((field, selectedSet) => {
    setColumnFilters((prev) => {
      const next = { ...prev }
      if (!selectedSet) {
        delete next[field]
      } else {
        next[field] = selectedSet
      }
      return next
    })
    setOpenFilter(null)
  }, [])

  /**
   * Open/close filter dropdown and calculate position based on the filter button.
   * Dropdown is rendered with position:fixed so it escapes the table's overflow:hidden clip.
   */
  const handleFilterToggle = (field, e) => {
    e.stopPropagation()
    if (openFilter === field) {
      setOpenFilter(null)
      return
    }
    const btn = e.currentTarget
    const rect = btn.getBoundingClientRect()
    const DROPDOWN_WIDTH = 256
    const DROPDOWN_MAX_HEIGHT = 380
    const MARGIN = 8
    let top = rect.bottom + 4
    let left = rect.left
    // Prevent horizontal overflow
    if (left + DROPDOWN_WIDTH > window.innerWidth - MARGIN) {
      left = window.innerWidth - DROPDOWN_WIDTH - MARGIN
    }
    if (left < MARGIN) left = MARGIN
    // Flip above if not enough room below
    if (top + DROPDOWN_MAX_HEIGHT > window.innerHeight - MARGIN) {
      const aboveTop = rect.top - DROPDOWN_MAX_HEIGHT - 4
      if (aboveTop >= MARGIN) {
        top = aboveTop
      } else {
        // Neither fits perfectly; align to top margin
        top = MARGIN
      }
    }
    setFilterPosition({ top, left })
    setOpenFilter(field)
  }

  const activeFilterCount = Object.keys(columnFilters).length

  const clearAllFilters = () => {
    setColumnFilters({})
    setSearch('')
  }

  /* ── Display functions for filter value extraction ── */
  const displayFns = {
    supplier: (item) => item.supplier || item.manufacturer || '',
    category: (item) => item.category || '',
    owner: (item) => item.owner || '',
    location_detail: (item) => item.location_detail || '',
    unit: (item) => item.unit || '',
    quantity: (item) => String(item.quantity ?? 0),
    unit_price: (item) => String(item.unit_price ?? 0),
    total_price: (item) => String(item.total_price ?? 0),
  }

  /* ── Filtering pipeline: text search → column filters ── */
  const filtered = items.filter((item) => {
    // Text search
    if (search) {
      const q = search.toLowerCase()
      const match =
        (item.product_name || '').toLowerCase().includes(q) ||
        (item.owner || '').toLowerCase().includes(q) ||
        (item.supplier || '').toLowerCase().includes(q) ||
        (item.manufacturer || '').toLowerCase().includes(q) ||
        (item.remarks || '').toLowerCase().includes(q)
      if (!match) return false
    }

    // Column filters
    for (const [field, allowedSet] of Object.entries(columnFilters)) {
      if (!allowedSet) continue
      const fn = displayFns[field]
      const val = fn ? fn(item) : String(item[field] ?? '')
      if (!allowedSet.has(val)) return false
    }

    return true
  })

  const formatCurrency = (val) => {
    if (!val && val !== 0) return '-'
    return new Intl.NumberFormat('ja-JP').format(val)
  }

  const handleExcelDownload = () => {
    const data = filtered.map((item) => ({
      '品名': item.product_name || '',
      '保管場所': item.location_detail || '',
      'カテゴリ': item.category || '',
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

  /* ── Filterable header cell ── */
  const FilterableHeader = ({ field, label, sortable, align, displayFn }) => {
    const isFilterActive = !!columnFilters[field]

    return (
      <th
        className={`${align === 'right' ? 'text-right' : 'text-left'} px-4 py-3 font-semibold text-slate-600 select-none whitespace-nowrap`}
      >
        <span
          className={sortable ? 'cursor-pointer' : ''}
          onClick={() => sortable && handleSort(field)}
        >
          {label}
          {sortable && <SortIcon field={field} />}
        </span>
        <button
          onClick={(e) => handleFilterToggle(field, e)}
          className={`ml-1 p-0.5 rounded hover:bg-slate-200 transition ${isFilterActive ? 'bg-blue-100' : ''}`}
          title={`${label}でフィルター`}
        >
          <FilterIcon active={isFilterActive} />
        </button>
        {openFilter === field && (
          <ColumnFilterDropdown
            items={items}
            field={field}
            displayFn={displayFn}
            columnFilters={columnFilters}
            onApply={handleFilterApply}
            onClose={() => setOpenFilter(null)}
            position={filterPosition}
          />
        )}
      </th>
    )
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
      </div>

      <div className="flex items-center gap-4 mb-4">
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
        {activeFilterCount > 0 && (
          <button
            onClick={clearAllFilters}
            className="text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            フィルター解除 ({activeFilterCount})
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="table-container" style={{ overflowX: 'auto' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <FilterableHeader field="category" label="カテゴリ" sortable displayFn={displayFns.category} />
                <FilterableHeader field="product_name" label="品名" sortable />
                <FilterableHeader field="owner" label="持ち主" sortable displayFn={displayFns.owner} />
                <FilterableHeader field="supplier" label="仕入先" sortable displayFn={displayFns.supplier} />
                <FilterableHeader field="location_detail" label="場所詳細" sortable={false} displayFn={displayFns.location_detail} />
                <FilterableHeader field="quantity" label="在庫数" sortable align="right" displayFn={displayFns.quantity} />
                <FilterableHeader field="unit" label="単位" sortable={false} displayFn={displayFns.unit} />
                <th className="text-right px-4 py-3 font-semibold text-slate-600 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('unit_price')}>
                  単価<SortIcon field="unit_price" />
                </th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">合計金額</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 hover:bg-blue-50/30 transition">
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {item.category && (
                      <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700">
                        {item.category}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <div className="font-medium text-slate-800 truncate" title={item.product_name}>
                      {item.product_name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{item.owner || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{item.supplier || item.manufacturer || '-'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {item.location_detail ? (
                      <span className="truncate block max-w-[140px]" title={item.location_detail}>{item.location_detail}</span>
                    ) : '-'}
                  </td>
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
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                    {search || activeFilterCount > 0 ? 'フィルター条件に一致するデータがありません' : 'データがありません'}
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
