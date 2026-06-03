import { useState } from 'react';
import { Benchmark } from '../components/Benchmark';

// Build a large, deeply nested payload to stress JSON decode + encode.
function buildPayload(count: number) {
  const items = Array.from({ length: count }, (_, i) => ({
    id: i,
    value: i * 3,
    label: `item-${i}`,
    nested: { a: i, b: `text-${i}`, tags: ['x', 'y', 'z'], meta: { deep: { level: i % 7 } } },
  }));
  return { items };
}

export function JsonPage() {
  const [count, setCount] = useState(2000);
  return (
    <div className="page">
      <Benchmark
        title="JSON Serialization / Deserialization"
        description="Sends a large, deeply-nested JSON payload and gets a transformed copy back. Tests how fast each runtime decodes the request and encodes the response."
        controls={
          <label className="control">
            Payload items: <strong>{count.toLocaleString()}</strong>
            <input
              type="range"
              min={100}
              max={20000}
              step={100}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
          </label>
        }
        makeRequest={() => ({ method: 'POST', path: '/bench/json', body: buildPayload(count) })}
      />
    </div>
  );
}
