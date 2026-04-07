import { Link } from 'react-router-dom'
import DashboardCharts from '../components/DashboardCharts'
import OutOfStockAlert from '../components/OutOfStockAlert'

export default function AnalyticsPage() {
  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-slate-500 hover:text-blue-600 transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          戻る
        </Link>
        <h1 className="text-2xl font-bold text-slate-800">詳細分析</h1>
      </div>

      <div className="space-y-8">
        <DashboardCharts />
        <OutOfStockAlert />
      </div>
    </div>
  )
}
