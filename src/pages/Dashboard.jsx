import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  const [locations, setLocations] = useState([])
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const { data: locs } = await supabase.from('locations').select('*').order('id')
    if (!locs) return

    const statsMap = {}
    for (const loc of locs) {
      const { count } = await supabase
        .from('inventory_items')
        .select('*', { count: 'exact', head: true })
        .eq('location_id', loc.id)

      const { data: sumData } = await supabase
        .from('inventory_items')
        .select('total_price')
        .eq('location_id', loc.id)

      const totalValue = (sumData || []).reduce((sum, item) => sum + (Number(item.total_price) || 0), 0)

      statsMap[loc.id] = { itemCount: count || 0, totalValue }
    }

    setLocations(locs)
    setStats(statsMap)
    setLoading(false)
  }

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(val)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const totalItems = Object.values(stats).reduce((s, v) => s + v.itemCount, 0)
  const totalValue = Object.values(stats).reduce((s, v) => s + v.totalValue, 0)
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">ダッシュボード</h1>
        <Link
          to="/analytics"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-5 rounded-lg transition shadow-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
          </svg>
          分析グラフ
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-sm text-slate-500 mb-1">拠点数</div>
          <div className="text-3xl font-bold text-slate-800">{locations.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-sm text-slate-500 mb-1">総品目数</div>
          <div className="text-3xl font-bold text-slate-800">{totalItems}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-sm text-slate-500 mb-1">総在庫金額</div>
          <div className="text-3xl font-bold text-slate-800">{formatCurrency(totalValue)}</div>
        </div>
      </div>
      <h2 className="text-lg font-semibold text-slate-700 mb-4">拠点一覧</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {locations.map((loc) => {
          const s = stats[loc.id] || { itemCount: 0, totalValue: 0 }
          return (
            <Link
              key={loc.id}
              to={`/location/${loc.id}`}
              className="bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-300 hover:shadow-md transition group"
            >
              <h3 className="font-semibold text-slate-800 group-hover:text-blue-600 transition mb-2">
                {loc.name}
              </h3>
              <div className="text-sm text-slate-500">
                <span>{s.itemCount} 品目</span>
                <span className="mx-2">|</span>
                <span>{formatCurrency(s.totalValue)}</span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
