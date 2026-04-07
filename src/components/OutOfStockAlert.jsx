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
        const locName = item.locations?.name || '\u4E0D\u660E'
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
    return <div className="text-center py-4 text-slate-500">\u8AAD\u307F\u8FBC\u307F\u4E2D...</div>
  }

  if (totalCount === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-6">
        <div className="flex items-center gap-3">
          <span className="text-2xl">\u2705</span>
          <div>
            <h3 className="font-semibold text-green-800">\u5168\u3066\u306E\u54C1\u76EE\u304C\u5728\u5EAB\u3042\u308A</h3>
            <p className="text-green-600 text-sm">\u5728\u5EAB\u6570\u304C0\u306E\u54C1\u76EE\u306F\u3042\u308A\u307E\u305B\u3093\u3002</p>
          </div>
        </div>
      </div>
    )
  }

  const locNames = Object.keys(grouped).sort()

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">\u26A0\uFE0F</span>
        <div>
          <h3 className="font-semibold text-red-800">\u5728\u5EAB\u5207\u308C\u30A2\u30E9\u30FC\u30E0</h3>
          <p className="text-red-600 text-sm">{totalCount} \u4EF6\u306E\u54C1\u76EE\u304C\u5728\u5EAB0\u3067\u3059\uFF08{locNames.length} \u62E0\u70B9\uFF09</p>
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
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{items.length} \u4EF6</span>
                </div>
                <svg className={"h-4 w-4 text-red-400 transition-transform " + (isOpen ? "rotate-180" : "")} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>              {isOpen && (
                <div className="border-t border-red-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-red-200 bg-red-50">
                        <th className="text-left py-2 px-3 text-red-700">\u54C1\u540D</th>
                        <th className="text-left py-2 px-3 text-red-700">\u30B5\u30D7\u30E9\u30A4\u30E4\u30FC</th>
                        <th className="text-left py-2 px-3 text-red-700">\u62C5\u5F53\u8005</th>
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
