import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'

const COLORS = ['#2563eb','#16a34a','#d97706','#dc2626','#7c3aed','#0891b2','#be185d','#65a30d','#ea580c','#4f46e5','#059669','#ca8a04']

export default function DashboardCharts() {
  const [monthlyData, setMonthlyData] = useState([])
  const [supplierData, setSupplierData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadChartData()
  }, [])

  const loadChartData = async () => {
    try {
      const { data: items } = await supabase
        .from('inventory_items')
        .select('*, locations(name)')
        .order('created_at', { ascending: true })

      if (!items || items.length === 0) {
        setLoading(false)
        return
      }

      // Monthly trend data
      const monthMap = {}
      items.forEach(item => {
        const date = new Date(item.created_at)
        const key = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0')
        if (!monthMap[key]) monthMap[key] = { month: key, count: 0, quantity: 0 }
        monthMap[key].count += 1
        monthMap[key].quantity += (item.quantity || 0)
      })
      const sortedMonths = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month))
      let cumCount = 0
      let cumQty = 0
      const cumulative = sortedMonths.map(m => {
        cumCount += m.count
        cumQty += m.quantity
        return { month: m.month, items: cumCount, quantity: cumQty }
      })
      setMonthlyData(cumulative)

      // Supplier pie data
      const supplierMap = {}
      items.forEach(item => {
        const supplier = item.supplier || '不明'
        if (!supplierMap[supplier]) supplierMap[supplier] = 0
        supplierMap[supplier] += 1
      })
      const sorted = Object.entries(supplierMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
      const top = sorted.slice(0, 11)
      const rest = sorted.slice(11)
      if (rest.length > 0) {
        top.push({ name: 'Other', value: rest.reduce((s, i) => s + i.value, 0) })
      }
      setSupplierData(top)
    } catch (err) {
      console.error('Chart data error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-slate-500">チャートを読み込み中...</div>
  }

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-700 mb-4">在庫推移</h2>
        {monthlyData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="items" stroke="#2563eb" name="品目数" />
              <Line yAxisId="right" type="monotone" dataKey="quantity" stroke="#16a34a" name="数量" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-slate-400 text-center py-8">データなし</p>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-700 mb-4">サプライヤー別構成</h2>
        {supplierData.length > 0 ? (
          <div className="flex flex-col lg:flex-row items-center gap-4">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={supplierData} cx="50%" cy="50%" innerRadius={60} outerRadius={120}
                  paddingAngle={2} dataKey="value" label={({ name, percent }) =>
                    percent > 0.05 ? name + ' ' + (percent * 100).toFixed(0) + '%' : ''}>
                  {supplierData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-slate-400 text-center py-8">データなし</p>
        )}
      </div>
    </div>
  )
}
