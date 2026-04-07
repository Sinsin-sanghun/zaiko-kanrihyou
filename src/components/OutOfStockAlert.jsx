import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const GROUPS = [
  { key: 'domestic', label: '🗾 日本国内拠点' },
  { key: 'overseas', label: '🌎 海外拠点' },
  { key: 'legacy', label: '旧在庫管理表' },
]

export default function OutOfStockAlert() {
  const [data, setData] = useState({})
  const [openGroups, setOpenGroups] = useState({})
  const [openLocs, setOpenLocs] = useState({})
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)

  useEffect(() => {
    loadOutOfStock()
  }, [])

  const loadOutOfStock = async () => {
    try {
      const { data: items } = await supabase
        .from('inventory_items')
        .select('*, locations(name, category)')
        .eq('quantity', 0)
        .order('product_name')

      const all = items || []
      setTotalCount(all.length)

      const grouped = {}
      all.forEach(item => {
        const cat = item.locations?.category || 'legacy'
        const locName = item.locations?.name || '不明'
        if (!grouped[cat]) grouped[cat] = {}
        if (!grouped[cat][locName]) grouped[cat][locName] = []
        grouped[cat][locName].push(item)
      })
      setData(grouped)
    } catch (err) {
      console.error('Out of stock error:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleGroup = (key) => {
    setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }))
  }
  const toggleLoc = (key) => {
    setOpenLocs(prev => ({ ...prev, [key]: !prev[key] }))
  }

  if (loading) {
    return <div className="text-center py-4 text-slate-500">読み込み中...</div>
  }

  if (totalCount === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-6">
        <div className="flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <div>
            <h3 className="font-semibold text-green-800">全ての品目が在庫あり</h3>
            <p className="text-green-600 text-sm">在庫数が0の品目はありません。</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">⚠️</span>
        <div>
          <h3 className="font-semibold text-red-800">在庫切れアラーム</h3>
          <p className="text-red-600 text-sm">{totalCount} 件の品目が在庫0です</p>
        </div>
      </div>

      <div className="space-y-3">
        {GROUPS.map(group => {
          const locs = data[group.key]
          if (!locs) return null
          const locNames = Object.keys(locs).sort()
          const groupTotal = locNames.reduce((s, n) => s + locs[n].length, 0)
          const isGroupOpen = openGroups[group.key]

          return (
            <div key={group.key} className="border border-red-200 rounded-lg overflow-hidden bg-white">
              <button
                onClick={() => toggleGroup(group.key)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-red-50 transition text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-red-900">{group.label}</span>
                  <span className="text-xs bg-red-200 text-red-800 px-2 py-0.5 rounded-full">{groupTotal} 件</span>
                </div>
                <svg className={"h-4 w-4 text-red-400 transition-transform " + (isGroupOpen ? "rotate-180" : "")} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
              {isGroupOpen && (
                <div className="border-t border-red-200 px-2 py-2 space-y-1">
                  {locNames.map(locName => {
                    const items = locs[locName]
                    const locKey = group.key + ':' + locName
                    const isLocOpen = openLocs[locKey]
                    return (
                      <div key={locName} className="border border-red-100 rounded overflow-hidden">
                        <button
                          onClick={() => toggleLoc(locKey)}
                          className="w-full flex items-center justify-between px-3 py-2 bg-red-50 hover:bg-red-100 transition text-left"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-red-800">{locName}</span>
                            <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{items.length} 件</span>
                          </div>
                          <svg className={"h-3 w-3 text-red-400 transition-transform " + (isLocOpen ? "rotate-180" : "")} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                        {isLocOpen && (
                          <div className="border-t border-red-100">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-red-200 bg-white">
                                  <th className="text-left py-2 px-3 text-red-700">品名</th>
                                  <th className="text-left py-2 px-3 text-red-700">サプライヤー</th>
                                  <th className="text-left py-2 px-3 text-red-700">担当者</th>
                                </tr>
                              </thead>
                              <tbody>
                                {items.map((item) => (
                                  <tr key={item.id} className="border-b border-red-50 hover:bg-red-50">
                                    <td className="py-1.5 px-3 text-red-900">{item.product_name}</td>
                                    <td className="py-1.5 px-3 text-red-700">{item.supplier || '-'}</td>
                                    <td className="py-1.5 px-3 text-red-700">{item.owner || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
