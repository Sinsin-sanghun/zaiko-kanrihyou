import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function OutOfStockAlert() {
  const [grouped, setGrouped] = useState({})
  const [openLocs, setOpenLocs] = useState({})
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)

  useEffect(() => {
    loadOutOfStock()
  }, [])

  const loadOutOfStock = async () => {
    try {
      const { data } = await supabase
        .from('inventory_items')
        .select('*, locations(name)')
        .eq('quantity', 0)
        .order('product_name')

      const items = data || []
      setTotalCount(items.length)

      const groups = {}
      items.forEach(item => {
        const locName = item.locations?.name || '不明'
        if (!groups[locName]) groups[locName] = []
        groups[locName].push(item)
      })
      setGrouped(groups)
    } catch (err) {
      console.error('Out of stock error:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleLoc = (locName) => {
    setOpenLocs(prev => ({ ...prev, [locName]: !prev[locName] }))
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

  const locNames = Object.keys(grouped).sort()

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">⚠️</span>
        <div>
          <h3 className="font-semibold text-red-800">在庫切れアラーム</h3>
          <p className="text-red-600 text-sm">{totalCount} 件の品目が在庫0です（{locNames.length} 拠点）</p>
        </div>
      </div>

      <div className="space-y-2">
        {locNames.map(locName => {
          const items = grouped[locName]
          const isOpen = openLocs[locName]
          return (
            <div key={locName} className="border border-red-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleLoc(locName)}
                className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-red-50 transition text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-red-800">{locName}</span>
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{items.length} 件</span>
                </div>
                <svg className={"h-4 w-4 text-red-400 transition-transform " + (isOpen ? "rotate-180" : "")} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
              {isOpen && (
                <div className="border-t border-red-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-red-200 bg-red-50">
                        <th className="text-left py-2 px-3 text-red-700">品名</th>
                        <th className="text-left py-2 px-3 text-red-700">サプライヤー</th>
                        <th className="text-left py-2 px-3 text-red-700">担当者</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id} className="border-b border-red-100 hover:bg-red-100">
                          <td className="py-2 px-3 font-medium text-red-900">{item.product_name}</td>
                          <td className="py-2 px-3 text-red-700">{item.supplier || '-'}</td>
                          <td className="py-2 px-3 text-red-700">{item.owner || '-'}</td>
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
    </div>
  )
}
