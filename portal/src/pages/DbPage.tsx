import { useState } from 'react';
import { Benchmark } from '../components/Benchmark';

type DbType = 'simple' | 'complex' | 'bulk';

const DESCRIPTIONS: Record<DbType, string> = {
  simple: 'Fetch a single record by primary key.',
  complex: 'Multi-table join (tasks ⋈ projects) with filters, grouping and pagination.',
  bulk: 'Insert 1,000 rows in a single statement (rolled back so the test stays repeatable).',
};

export function DbPage() {
  const [type, setType] = useState<DbType>('simple');
  return (
    <div className="page">
      <Benchmark
        title="Database Query Performance"
        description={`Three sub-tests against the shared Postgres instance. Current: ${DESCRIPTIONS[type]}`}
        controls={
          <div className="control control--row">
            {(['simple', 'complex', 'bulk'] as DbType[]).map((t) => (
              <button
                key={t}
                className={'seg' + (type === t ? ' seg--active' : '')}
                onClick={() => setType(t)}
              >
                {t}
              </button>
            ))}
          </div>
        }
        makeRequest={() => ({ method: 'GET', path: `/bench/db?type=${type}` })}
      />
    </div>
  );
}
