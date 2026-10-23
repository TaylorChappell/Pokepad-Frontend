import { useState } from 'react';
import { Icon } from './UI';

/** Reset on a filter/account change, while keeping live updates at the chosen depth. */
export function useListWindow<T>(items: readonly T[], resetKey = '', pageSize = 12) {
  const [window, setWindow] = useState({ key: resetKey, size: pageSize });
  if (window.key !== resetKey) setWindow({ key: resetKey, size: pageSize });
  const size = window.key === resetKey ? window.size : pageSize;
  return {
    items: items.slice(0, size),
    hasMore: items.length > size,
    loadMore: () => setWindow({ key: resetKey, size: size + pageSize }),
  };
}
export function ListMore({
  hasMore,
  loadMore,
  loading = false,
  label = 'Load more',
}: {
  hasMore: boolean;
  loadMore: () => void;
  loading?: boolean;
  label?: string;
}) {
  if (!hasMore) return null;
  return (
    <div className="list-more">
      <button type="button" disabled={loading} onClick={loadMore} aria-label={label}>
        <Icon name={loading ? 'RefreshCw' : 'ChevronDown'} size={17} />
        {loading ? 'Loading…' : 'Load more'}
      </button>
    </div>
  );
}
