import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function OutOfStockAlert() {
  const [outOfStock, setOutOfStock] = useState([])
  const [loading, setLoading] = useState(true)

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

      setOutOfStock(data || [])
    } catch (err) {
      console.error('Out of stock error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-4 text-slate-500">読み込み中...</div>
  }

  if (outOfStock.length === 0) {
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
          <p className="text-red-600 text-sm">{outOfStock.length} 件の品目が在庫0です</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-red-200">
              <th className="text-left py-2 px-3 text-red-700">品名</th>
              <th className="text-left py-2 px-3 text-red-700">拠点</th>
              <th className="text-left py-2 px-3 text-red-700">サプライヤー</th>
              <th className="text-left py-2 px-3 text-red-700">担当者</th>
            </tr>
          </thead>
          <tbody>
            {outOfStock.map((item) => (
              <tr key={item.id} className="border-b border-red-100 hover:bg-red-100">
                <td className="py-2 px-3 font-medium text-red-900">{item.product_name}</td>
                <td className="py-2 px-3 text-red-700">{item.locations?.name || '-'}</td>
                <td className="py-2 px-3 text-red-700">{item.supplier || '-'}</td>
                <td className="py-2 px-3 text-red-700">{item.owner || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
                }
