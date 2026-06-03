// The four API implementations. Flip `enabled` to true once a language's API
// exists and is reachable at its baseUrl — that's all it takes to light up its
// button across every benchmark page.
export interface ApiConfig {
  id: string;
  name: string;
  baseUrl: string;
  enabled: boolean;
  color: string;
}

export const APIS: ApiConfig[] = [
  { id: 'node', name: 'Node / Express', baseUrl: 'http://localhost:3001', enabled: true, color: '#5a9e2f' },
  { id: 'python', name: 'Python / FastAPI', baseUrl: 'http://localhost:3002', enabled: true, color: '#3776ab' },
  { id: 'go', name: 'Go / Gin', baseUrl: 'http://localhost:3003', enabled: true, color: '#00add8' },
  { id: 'rust', name: 'Rust / Axum', baseUrl: 'http://localhost:3004', enabled: false, color: '#b7410e' },
];
