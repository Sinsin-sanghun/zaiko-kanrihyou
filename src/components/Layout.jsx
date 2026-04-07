import { useState } from 'react';
import { Link, Outlet, useLocation, useSearchParams } from 'react-router-dom';
import {
  LayoutDashboard,
  MapPin,
  Globe,
  ChevronDown,
  ChevronRight,
  Package,
  FileText
} from 'lucide-react';

const domesticLocations = [
  { id: 5,  name: '東京本社（購買＆設計担当）', hasCategories: true },
  { id: 2,  name: '野田倉庫' },
  { id: 8,  name: '野田倉庫（ゆい・ゆうと管理分）' },
  { id: 3,  name: '小倉営業所' },
  { id: 6,  name: '上和電機' },
  { id: 7,  name: '長沼現場' },
];

const overseasLocations = [
  { id: 4, name: 'DRDRD(練習)' },
];

const tokyoCategories = [
  { key: 'all',       label: '全て' },
  { key: '購買',      label: '購買',       count: 42 },
  { key: '工事',      label: '工事',       count: 31 },
  { key: '設計',      label: '設計',       count: 3  },
  { key: '弱電',      label: '弱電',       count: 38 },
  { key: 'OM',        label: 'OM',         count: 2  },
  { key: 'PPA',       label: 'PPA',        count: 2  },
  { key: 'OM/工事兼用', label: 'OM/工事兼用', count: 5 },
  { key: '所掌不明',   label: '所掌不明',    count: 12 },
];

export default function Layout() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [categoryOpen, setCategoryOpen] = useState(false);

  const currentPath = location.pathname;
  const currentCategory = searchParams.get('category') || 'all';
  const isTokyoPage = currentPath === '/location/5';

  const handleTokyoClick = () => {
    setCategoryOpen(prev => !prev);
  };

  return (
    <div className="app-layout" style={{ display: 'flex', minHeight: '100vh' }}>
      <aside className="sidebar" style={sidebarStyle}>
        <div style={sidebarHeaderStyle}>
          <Package size={20} />
          <span style={{ fontWeight: 700, fontSize: '14px' }}>在庫管理表</span>
        </div>

        <Link to="/" style={navLinkStyle(currentPath === '/')}>
          <LayoutDashboard size={16} />
          <span>ダッシュボード</span>
        </Link>

        <div style={sectionHeaderStyle}>
          <MapPin size={14} color="#3b82f6" />
          <span>日本国内拠点</span>
        </div>

        {domesticLocations.map((loc) => (
          <div key={loc.id}>
            {loc.hasCategories ? (
              <>
                <Link
                  to="/location/5"
                  onClick={handleTokyoClick}
                  style={{
                    ...navLinkStyle(isTokyoPage),
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={14} />
                    <span style={{
                      fontSize: '13px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '160px'
                    }}>
                      {loc.name}
                    </span>
                  </div>
                  {categoryOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </Link>

                {categoryOpen && (
                  <div style={subMenuStyle}>
                    {tokyoCategories.map((cat) => {
                      const isActive = isTokyoPage && currentCategory === cat.key;
                      return (
                        <Link
                          key={cat.key}
                          to={cat.key === 'all'
                            ? '/location/5'
                            : `/location/5?category=${encodeURIComponent(cat.key)}`
                          }
                          style={subMenuItemStyle(isActive)}
                        >
                          <span>{cat.label}</span>
                          {cat.count !== undefined && (
                            <span style={badgeStyle}>{cat.count}</span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <Link
                to={`/location/${loc.id}`}
                style={navLinkStyle(currentPath === `/location/${loc.id}`)}
              >
                <FileText size={14} />
                <span style={{
                  fontSize: '13px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '180px'
                }}>
                  {loc.name}
                </span>
              </Link>
            )}
          </div>
        ))}

        <div style={sectionHeaderStyle}>
          <Globe size={14} color="#10b981" />
          <span>海外拠点</span>
        </div>

        {overseasLocations.map((loc) => (
          <Link
            key={loc.id}
            to={`/location/${loc.id}`}
            style={navLinkStyle(currentPath === `/location/${loc.id}`)}
          >
            <FileText size={14} />
            <span style={{ fontSize: '13px' }}>{loc.name}</span>
          </Link>
        ))}

        <div style={{ borderTop: '1px solid #e5e7eb', marginTop: '16px', paddingTop: '12px' }}>
          
            href="https://docs.google.com/spreadsheets/d/old-sheet-id"
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...navLinkStyle(false), color: '#9ca3af', fontSize: '12px' }}
          >
            <FileText size={14} />
            <span>旧在庫管理表</span>
          </a>
        </div>
      </aside>

      <main style={{ flex: 1, padding: '24px', backgroundColor: '#f9fafb', overflowX: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}

const sidebarStyle = {
  width: '260px',
  minWidth: '260px',
  backgroundColor: '#ffffff',
  borderRight: '1px solid #e5e7eb',
  padding: '16px 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  overflowY: 'auto',
};

const sidebarHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 12px 16px',
  borderBottom: '1px solid #e5e7eb',
  marginBottom: '12px',
};

const sectionHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '12px 12px 4px',
  fontSize: '11px',
  fontWeight: 600,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const navLinkStyle = (isActive) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 12px',
  borderRadius: '6px',
  textDecoration: 'none',
  color: isActive ? '#1d4ed8' : '#374151',
  backgroundColor: isActive ? '#eff6ff' : 'transparent',
  fontWeight: isActive ? 600 : 400,
  fontSize: '13px',
  transition: 'all 0.15s ease',
});

const subMenuStyle = {
  marginLeft: '20px',
  borderLeft: '2px solid #e5e7eb',
  paddingLeft: '0',
  display: 'flex',
  flexDirection: 'column',
  gap: '1px',
};

const subMenuItemStyle = (isActive) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '6px 12px',
  borderRadius: '4px',
  textDecoration: 'none',
  fontSize: '12px',
  color: isActive ? '#1d4ed8' : '#6b7280',
  backgroundColor: isActive ? '#eff6ff' : 'transparent',
  fontWeight: isActive ? 600 : 400,
  transition: 'all 0.15s ease',
  marginLeft: '4px',
});

const badgeStyle = {
  fontSize: '10px',
  backgroundColor: '#f3f4f6',
  color: '#6b7280',
  padding: '1px 6px',
  borderRadius: '10px',
  fontWeight: 500,
};
