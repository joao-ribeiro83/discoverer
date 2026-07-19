# Frontend Code Guide

Overview of React/TypeScript frontend structure and patterns.

## Directory Structure

```
frontend/src/
├── App.tsx                 # Root component, routing
├── pages/                  # Route-level components
│   ├── LoginPage.tsx
│   ├── DashboardPage.tsx
│   ├── MapBuilderPage.tsx
│   ├── MapViewerPage.tsx
│   └── ...
├── components/             # Reusable components
│   ├── admin/              # Admin pages
│   ├── auth/               # Login/logout forms
│   ├── map-builder/        # Map editor UI
│   ├── data-table/         # Result table
│   ├── layout/             # Nav, sidebar
│   └── ui/                 # Primitives (Button, Modal, etc.)
├── hooks/                  # Custom React hooks
│   ├── useAuth.ts
│   ├── useMapExecution.ts
│   └── ...
├── lib/                    # Utilities
│   ├── api.ts              # Axios client
│   ├── formatters.ts       # Date, number formatting
│   └── ...
├── store/                  # Zustand state
│   ├── auth.ts
│   ├── maps.ts
│   └── ...
├── __tests__/              # Component tests
└── vite.config.ts
```

## Key Concepts

### Routing

React Router setup in `App.tsx`:

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/maps/:id/builder" element={<MapBuilderPage />} />
        <Route path="/maps/:id/execute" element={<MapViewerPage />} />
        {/* ... */}
      </Routes>
    </BrowserRouter>
  );
}
```

### State Management

Zustand stores in `frontend/src/store/`:

```typescript
// store/auth.ts
import { create } from 'zustand';

interface AuthState {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  
  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    set({ token: data.token, user: data.user });
  },
  
  logout: () => {
    localStorage.removeItem('token');
    set({ token: null, user: null });
  }
}));

// Usage
const { user, login } = useAuthStore();
```

### API Client

Axios client in `lib/api.ts`:

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api'
});

// Auto-add JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 (refresh token)
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      // Attempt refresh
      const token = localStorage.getItem('token');
      const { data } = await api.post('/auth/refresh', { token });
      localStorage.setItem('token', data.token);
      return api.request(err.config);
    }
    throw err;
  }
);

export default api;
```

### Custom Hooks

Reusable logic in hooks:

```typescript
// hooks/useMapExecution.ts
export function useMapExecution(mapId: string) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(async (parameters: Record<string, any>) => {
    setLoading(true);
    try {
      const { data } = await api.post(`/maps/${mapId}/execute`, { parameters });
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [mapId]);

  return { result, loading, error, execute };
}

// Usage
function MapExecutor() {
  const { result, loading, execute } = useMapExecution(mapId);
  
  const handleRun = () => execute({ startDate: '2026-01-01' });
  
  return <>{loading ? 'Running...' : <ResultsTable data={result} />}</>;
}
```

## Component Patterns

### Page Component

```typescript
// pages/MapsPage.tsx
export default function MapsPage() {
  const [maps, setMaps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMaps = async () => {
      try {
        const { data } = await api.get('/maps');
        setMaps(data.data);
      } finally {
        setLoading(false);
      }
    };
    loadMaps();
  }, []);

  return (
    <div>
      <h1>My Maps</h1>
      {loading ? (
        <Spinner />
      ) : (
        <table>
          {maps.map((map) => (
            <tr key={map.id}>
              <td>{map.name}</td>
              <td>
                <Link to={`/maps/${map.id}`}>Edit</Link>
              </td>
            </tr>
          ))}
        </table>
      )}
    </div>
  );
}
```

### Form Component

```typescript
// components/MapForm.tsx
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1),
  mapType: z.enum(['TABLE', 'CROSSTAB', 'PAGE_DETAIL', 'CHART']),
  description: z.string().optional()
});

export default function MapForm({ onSubmit }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema)
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('name')} placeholder="Map name" />
      {errors.name && <p>{errors.name.message}</p>}
      
      <select {...register('mapType')}>
        <option value="TABLE">Table</option>
        <option value="CROSSTAB">Crosstab</option>
      </select>
      
      <button type="submit">Create</button>
    </form>
  );
}
```

### Modal Component

```typescript
// components/ui/Modal.tsx
export function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button onClick={onClose}>×</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
```

## Styling

**Tailwind CSS** with utility classes:

```tsx
export function Button({ children, variant = 'primary' }) {
  const baseClasses = 'px-4 py-2 rounded font-medium';
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300'
  };

  return (
    <button className={`${baseClasses} ${variantClasses[variant]}`}>
      {children}
    </button>
  );
}
```

## TypeScript Patterns

### Type Definitions

```typescript
// types/map.ts
export interface Map {
  id: string;
  businessAreaId: string;
  name: string;
  mapType: 'TABLE' | 'CROSSTAB' | 'PAGE_DETAIL' | 'CHART';
  items: MapItem[];
  conditions: MapCondition[];
  parameters: MapParameter[];
}

export interface MapItem {
  itemId: string;
  displayName?: string;
  sortDirection?: 'ASC' | 'DESC';
  aggregation?: string;
}
```

### API Response Types

```typescript
// types/api.ts
export interface ApiResponse<T> {
  data: T;
  error?: string;
}

// Usage
const response = await api.get<ApiResponse<Map[]>>('/maps');
const maps = response.data.data; // Typed as Map[]
```

## Testing

See [Testing Guide](testing.md).

Example component test:

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from './LoginPage';

describe('LoginPage', () => {
  it('should log in user', async () => {
    render(<LoginPage />);
    
    const emailInput = screen.getByRole('textbox', { name: /email/i });
    await userEvent.type(emailInput, 'user@example.com');
    
    const passwordInput = screen.getByLabelText(/password/i);
    await userEvent.type(passwordInput, 'password123');
    
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });
});
```

## Performance

### Code Splitting

Routes are lazy-loaded:

```typescript
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const MapBuilderPage = lazy(() => import('./pages/MapBuilderPage'));

<Suspense fallback={<Spinner />}>
  <Routes>
    <Route path="/dashboard" element={<DashboardPage />} />
    <Route path="/maps/builder" element={<MapBuilderPage />} />
  </Routes>
</Suspense>
```

### Memoization

Avoid unnecessary re-renders:

```typescript
export const MapItem = memo(({ item, onSelect }) => {
  return <div onClick={() => onSelect(item)}>{item.name}</div>;
});
```

### Query Caching

Use React Query for API caching:

```typescript
import { useQuery } from '@tanstack/react-query';

function MapsList() {
  const { data: maps } = useQuery({
    queryKey: ['maps'],
    queryFn: () => api.get('/maps').then(r => r.data.data),
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  return <>{/* render */}</>;
}
```

## What's Next?

- **[Testing](testing.md)** — Write and run tests
- **[Contributing](contributing.md)** — Submit changes
- **[Backend Code Guide](backend.md)** — API integration

---

**See Also:** [Architecture](architecture.md), [Development Setup](development.md)
