import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const locationNames = {
  2: '野田倉庫',
  3: '小倉営業所',
  4: 'DRDRD(練習)',
  5: '東京本社（購買＆設計担当）',
  6: '上和電機',
  7: '長沼現場',
  8: '野田倉庫（ゆい・ゆうと管理分）',
};

export default function InventoryPage() {
  const { locationId } = useParams();
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [searchText, setSearchText] = useState('');

  const locId = Number(locationId);
  const category = searchParams.get('category') || 'all';
  const locationName = locationNames[locId] || `拠点 ${locId}`;

  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true);
      setError(null);

      try {
        let query = supabase
          .from('inventory_items')
          .select('*')
          .eq('location_id', locId)
          .order('id', { ascending: true });

        if (locId === 5 && category !== 'all') {
          query = query.eq('category', category);
        }

        const { data, error: fetchError } = await query;
        if (fetchError) throw fetchError;
        setItems(data || []);
      } catch (err) {
        console.error('Fetch error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, [locId, category]);

  const filteredItems = useMemo(() => {
    if (!searchText.trim()) return items;
    const lower = searchText.toLowerCase();
    return items.filter((item) =>
      Object.values(item).some(
        (val) => val && String(val).toLowerCase().includes(lower)
      )
    );
  }, [items, searchText]);

  const sortedItems = useMemo(() => {
    if (!sortConfig.key) return filteredItems;
    return [...filteredItems].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const cmp = String(aVal).localeCompare(String(bVal), 'ja');
      return sortConfig.direction === 'asc' ? cmp : -cmp;
    });
  }, [filteredItems, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const pageTitle = useMemo(() => {
    if (locId === 5 && category !== 'all') {
      return `${locationName} - ${category}`;
    }
    return locationName;
  }, [locId, category, locationName]);

  if (loading) {
    return (
      <div style={loadingStyle}>
        <div style={spinnerStyle} />
        <p style={{ color: '#6b7280', marginTop: '12px' }}>データを読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={errorStyle}>
        <p>エラーが発生しました: {error}</p>
        <button onClick={() => window.location.reload()} style={retryBtnStyle}>
          再読み込み
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={headerStyle}>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#111827' }}>
            {pageTitle}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
            {sortedItems.length}件の品目
            {category !== 'all' && locId === 5 && (
              <span style={categoryTagStyle}>{category}</span>
            )}
          </p>
        </div>

        <div style={searchBoxStyle}>
          <input
            type="text"
            placeholder="品名・仕入先・持ち主で検索..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={searchInputStyle}
          />
          {searchText && (
            <button onClick={() => setSearchText('')} style={clearBtnStyle}>✕</button>
          )}
        </div>
      </div>

      <div style={tableWrapperStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <Th label="#" sortKey="id" sortConfig={sortConfig} onSort={handleSort} width="50px" />
              <Th label="品名" sortKey="product_name" sortConfig={sortConfig} onSort={handleSort} />
              {locId === 5 && category === 'all' && (
                <Th label="カテゴリ" sortKey="category" sortConfig={sortConfig} onSort={handleSort} width="110px" />
              )}
              <Th label="数量" sortKey="quantity" sortConfig={sortConfig} onSort={handleSort} width="80px" />
              <Th label="単位" sortKey="unit" sortConfig={sortConfig} onSort={handleSort} width="60px" />
              <Th label="単価" sortKey="unit_price" sortConfig={sortConfig} onSort={handleSort} width="100px" />
              <Th label="合計金額" sortKey="total_price" sortConfig={sortConfig} onSort={handleSort} width="110px" />
              <Th label="持ち主" sortKey="owner" sortConfig={sortConfig} onSort={handleSort} width="100px" />
              <Th label="仕入先" sortKey="supplier" sortConfig={sortConfig} onSort={handleSort} width="120px" />
              <Th label="備考" sortKey="note" sortConfig={sortConfig} onSort={handleSort} />
            </tr>
          </thead>
          <tbody>
            {sortedItems.length === 0 ? (
              <tr>
                <td colSpan={locId === 5 && category === 'all' ? 10 : 9} style={emptyCellStyle}>
                  該当する品目がありません
                </td>
              </tr>
            ) : (
              sortedItems.map((item, idx) => (
                <tr key={item.id} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f9fafb' }}>
                  <td style={cellStyle}>{item.id}</td>
                  <td style={{ ...cellStyle, fontWeight: 500, maxWidth: '300px' }}>
                    {item.product_name}
                  </td>
                  {locId === 5 && category === 'all' && (
                    <td style={cellStyle}>
                      <span style={{
                        ...categoryTagStyle,
                        fontSize: '11px',
                        backgroundColor: getCategoryColor(item.category),
                      }}>
                        {item.category || '-'}
                      </span>
                    </td>
                  )}
                  <td style={{ ...cellStyle, textAlign: 'right' }}>
                    {item.quantity != null ? item.quantity.toLocaleString() : '-'}
                  </td>
                  <td style={cellStyle}>{item.unit || '-'}</td>
                  <td style={{ ...cellStyle, textAlign: 'right' }}>
                    {item.unit_price != null ? `¥${item.unit_price.toLocaleString()}` : '-'}
                  </td>
                  <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 500 }}>
                    {item.total_price != null ? `¥${item.total_price.toLocaleString()}` : '-'}
                  </td>
                  <td style={cellStyle}>{item.owner || '-'}</td>
                  <td style={cellStyle}>{item.supplier || '-'}</td>
                  <td style={{ ...cellStyle, color: '#9ca3af', maxWidth: '200px' }}>
                    {item.note || ''}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ label, sortKey, sortConfig, onSort, width }) {
  const isActive = sortConfig.key === sortKey;
  const arrow = isActive ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : '';
  return (
    <th
      onClick={() => onSort(sortKey)}
      style={{ ...thStyle, width: width || 'auto', cursor: 'pointer', userSelect: 'none' }}
    >
      {label}{arrow}
    </th>
  );
}

function getCategoryColor(category) {
  const colors = {
    '購買':       '#dbeafe',
    '工事':       '#fef3c7',
    '設計':       '#d1fae5',
    '弱電':       '#ede9fe',
    'OM':         '#fce7f3',
    'PPA':        '#ffedd5',
    'OM/工事兼用': '#e0e7ff',
    '所掌不明':    '#f3f4f6',
  };
  return colors[category] || '#f3f4f6';
}

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: '20px',
  flexWrap: 'wrap',
  gap: '12px',
};

const searchBoxStyle = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
};

const searchInputStyle = {
  padding: '8px 32px 8px 12px',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  fontSize: '13px',
  width: '260px',
  outline: 'none',
};

const clearBtnStyle = {
  position: 'absolute',
  right: '8px',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: '#9ca3af',
  fontSize: '14px',
};

const tableWrapperStyle = {
  overflowX: 'auto',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  backgroundColor: '#fff',
};

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '13px',
};

const thStyle = {
  padding: '10px 12px',
  textAlign: 'left',
  fontSize: '11px',
  fontWeight: 600,
  color: '#6b7280',
  backgroundColor: '#f9fafb',
  borderBottom: '2px solid #e5e7eb',
  whiteSpace: 'nowrap',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
};

const cellStyle = {
  padding: '8px 12px',
  borderBottom: '1px solid #f3f4f6',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const emptyCellStyle = {
  padding: '40px',
  textAlign: 'center',
  color: '#9ca3af',
};

const categoryTagStyle = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: '10px',
  fontSize: '12px',
  backgroundColor: '#eff6ff',
  color: '#1d4ed8',
  marginLeft: '8px',
  fontWeight: 500,
};

const loadingStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '80px 0',
};

const spinnerStyle = {
  width: '32px',
  height: '32px',
  border: '3px solid #e5e7eb',
  borderTop: '3px solid #3b82f6',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
};

const errorStyle = {
  padding: '40px',
  textAlign: 'center',
  color: '#dc2626',
};

const retryBtnStyle = {
  marginTop: '12px',
  padding: '8px 20px',
  backgroundColor: '#3b82f6',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '13px',
};
