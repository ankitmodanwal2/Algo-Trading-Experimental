import React, { useState, useEffect, useContext, createContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';

import SockJS from 'sockjs-client';
import { Client as StompClient } from '@stomp/stompjs';

/* -----------------------
   CONFIG & ENV (Fixed for Vite)
   ----------------------- */
const API_BASE = 'http://localhost:8080/api/v1';
const WS_ENDPOINT = 'http://localhost:8080/ws';

/* -----------------------
   AUTH CONTEXT
   ----------------------- */
const AuthContext = createContext(null);

export function useAuth() {
    return useContext(AuthContext);
}

function AuthProvider({ children }) {
    const [token, setToken] = useState(() => localStorage.getItem('jwt') || null);
    const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || 'null'));

    useEffect(() => {
        if (token) {
            localStorage.setItem('jwt', token);
        } else {
            localStorage.removeItem('jwt');
        }
    }, [token]);

    useEffect(() => {
        if (user) localStorage.setItem('user', JSON.stringify(user));
        else localStorage.removeItem('user');
    }, [user]);

    const login = async (username, password) => {
        const resp = await axios.post(`${API_BASE}/auth/login`, { username, password });
        const jwt = resp.data.token;
        setToken(jwt);
        setUser({ username });
        return resp;
    };

    const logout = () => {
        setToken(null);
        setUser(null);
    };

    const value = { token, user, login, logout, setUser };
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* -----------------------
   API CLIENT
   ----------------------- */
const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((cfg) => {
    const jwt = localStorage.getItem('jwt');
    if (jwt) cfg.headers.Authorization = `Bearer ${jwt}`;
    return cfg;
});

api.interceptors.response.use(
    r => r,
    err => {
        return Promise.reject(err);
    }
);

/* -----------------------
   Protected Route
   ----------------------- */
function PrivateRoute({ children }) {
    const { token } = useAuth();
    if (!token) return <Navigate to="/login" replace />;
    return children;
}

/* -----------------------
   UI: Auth Pages
   ----------------------- */
function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const auth = useAuth();
    const nav = useNavigate();

    const submit = async (e) => {
        e.preventDefault();
        setError(null);
        try {
            await auth.login(username, password);
            nav('/dashboard');
        } catch (err) {
            setError(err?.response?.data?.error || 'Login failed');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white rounded-xl shadow-md p-6">
                <h2 className="text-2xl font-semibold mb-4">Sign in</h2>
                {error && <div className="text-red-600 mb-2">{error}</div>}
                <form onSubmit={submit} className="space-y-4">
                    <input className="w-full border rounded px-3 py-2" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
                    <input type="password" className="w-full border rounded px-3 py-2" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
                    <button className="w-full bg-emerald-600 text-white rounded py-2">Login</button>
                </form>
                <p className="text-sm text-slate-600 mt-4">Don't have an account? <Link to="/register" className="text-emerald-600">Register</Link></p>
            </div>
        </div>
    );
}

function RegisterPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const nav = useNavigate();

    const submit = async (e) => {
        e.preventDefault();
        setError(null);
        try {
            await api.post('/auth/register', { username, password });
            nav('/login');
        } catch (err) {
            setError(err?.response?.data?.error || 'Registration failed');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white rounded-xl shadow-md p-6">
                <h2 className="text-2xl font-semibold mb-4">Create account</h2>
                {error && <div className="text-red-600 mb-2">{error}</div>}
                <form onSubmit={submit} className="space-y-4">
                    <input className="w-full border rounded px-3 py-2" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
                    <input type="password" className="w-full border rounded px-3 py-2" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
                    <button className="w-full bg-blue-600 text-white rounded py-2">Register</button>
                </form>
                <p className="text-sm text-slate-600 mt-4">Already have an account? <Link to="/login" className="text-blue-600">Login</Link></p>
            </div>
        </div>
    );
}

/* -----------------------
   Main Layout & Nav
   ----------------------- */
function TopNav() {
    const auth = useAuth();
    const nav = useNavigate();
    return (
        <header className="bg-white shadow p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <Link to="/dashboard" className="text-xl font-bold">TradingApp</Link>
                <nav className="hidden md:flex gap-3">
                    <Link to="/brokers" className="text-slate-600 hover:text-slate-900">Brokers</Link>
                    <Link to="/orders" className="text-slate-600 hover:text-slate-900">Orders</Link>
                    <Link to="/market" className="text-slate-600 hover:text-slate-900">Market</Link>
                </nav>
            </div>
            <div className="flex items-center gap-4">
                {auth.user ? (
                    <>
                        <span className="text-slate-700">{auth.user.username}</span>
                        <button onClick={() => { auth.logout(); nav('/login'); }} className="text-red-600">Logout</button>
                    </>
                ) : (
                    <Link to="/login" className="text-emerald-600">Sign in</Link>
                )}
            </div>
        </header>
    );
}

function Layout({ children }) {
    return (
        <div className="min-h-screen bg-slate-50">
            <TopNav />
            <main className="p-6 max-w-6xl mx-auto">{children}</main>
        </div>
    );
}

/* -----------------------
   Brokers Page
   ----------------------- */
function BrokersPage() {
    const [available, setAvailable] = useState([]);
    const [linked, setLinked] = useState([]);
    const [credentialsJson, setCredentialsJson] = useState('');
    const [brokerId, setBrokerId] = useState('dhan');

    const load = async () => {
        try {
            const av = await api.get('/brokers/available');
            setAvailable(Object.keys(av.data || {}));
            const linkedResp = await api.get('/brokers/linked');
            setLinked(linkedResp.data || []);
        } catch(e) { console.error("API Error", e); }
    };

    useEffect(() => { load(); }, []);

    const link = async () => {
        await api.post('/brokers/link', { brokerId, credentialsJson, metadataJson: '{}' });
        await load();
    };

    const unlink = async (id) => {
        await api.delete(`/brokers/${id}`);
        await load();
    };

    return (
        <Layout>
            <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white p-4 rounded shadow">
                    <h3 className="font-semibold mb-2">Link a Broker</h3>
                    <label className="block text-sm">Broker</label>
                    <select value={brokerId} onChange={e => setBrokerId(e.target.value)} className="w-full border rounded px-2 py-2 mb-2">
                        {available.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <label className="block text-sm">Credentials (JSON)</label>
                    <textarea value={credentialsJson} onChange={e=>setCredentialsJson(e.target.value)} rows={6} className="w-full border rounded p-2 mb-2" placeholder='{"apiKey":"...","secret":"..."}'></textarea>
                    <div className="flex gap-2">
                        <button className="bg-emerald-600 text-white px-3 py-2 rounded" onClick={link}>Link</button>
                    </div>
                </div>

                <div className="bg-white p-4 rounded shadow">
                    <h3 className="font-semibold mb-2">Linked Accounts</h3>
                    <ul className="space-y-2">
                        {linked.map(acc => (
                            <li key={acc.id} className="flex items-center justify-between border p-2 rounded">
                                <div>
                                    <div className="font-medium">{acc.brokerId}</div>
                                    <div className="text-sm text-slate-500">{acc.metadataJson || ''}</div>
                                </div>
                                <div className="flex gap-2">
                                    <button className="text-red-600" onClick={() => unlink(acc.id)}>Unlink</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </Layout>
    );
}

/* -----------------------
   Orders Page
   ----------------------- */
function OrdersPage() {
    const [orders, setOrders] = useState([]);
    const [form, setForm] = useState({ brokerAccountId: '', symbol: '', side: 'BUY', quantity: 1, price: 0, orderType: 'MARKET' });

    const load = async () => {
        try {
            const r = await api.get('/orders');
            setOrders(r.data || []);
        } catch(e) { console.error("API Error", e); }
    };

    useEffect(() => { load(); }, []);

    const place = async () => {
        await api.post('/orders/place', form);
        await load();
    };

    return (
        <Layout>
            <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white p-4 rounded shadow">
                    <h3 className="font-semibold mb-2">Place Order</h3>
                    <div className="space-y-2">
                        <input placeholder="brokerAccountId" value={form.brokerAccountId} onChange={e=>setForm({...form, brokerAccountId: e.target.value})} className="w-full border rounded p-2"/>
                        <input placeholder="symbol" value={form.symbol} onChange={e=>setForm({...form, symbol: e.target.value})} className="w-full border rounded p-2"/>
                        <select value={form.side} onChange={e=>setForm({...form, side: e.target.value})} className="w-full border rounded p-2">
                            <option>BUY</option>
                            <option>SELL</option>
                        </select>
                        <input type="number" step="0.0001" placeholder="quantity" value={form.quantity} onChange={e=>setForm({...form, quantity: e.target.value})} className="w-full border rounded p-2"/>
                        <input type="number" step="0.0001" placeholder="price (0 for market)" value={form.price} onChange={e=>setForm({...form, price: e.target.value})} className="w-full border rounded p-2"/>
                        <select value={form.orderType} onChange={e=>setForm({...form, orderType: e.target.value})} className="w-full border rounded p-2">
                            <option>MARKET</option>
                            <option>LIMIT</option>
                        </select>
                        <div className="flex gap-2">
                            <button className="bg-emerald-600 text-white px-3 py-2 rounded" onClick={place}>Place</button>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-4 rounded shadow">
                    <h3 className="font-semibold mb-2">Your Orders</h3>
                    <table className="w-full text-sm">
                        <thead className="text-left text-slate-600">
                        <tr><th>Id</th><th>Symbol</th><th>Side</th><th>Qty</th><th>Price</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                        {orders.map(o => (
                            <tr key={o.id} className="border-t">
                                <td className="py-2">{o.id}</td>
                                <td>{o.symbol}</td>
                                <td>{o.side}</td>
                                <td>{o.quantity}</td>
                                <td>{o.price}</td>
                                <td>{o.status}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </Layout>
    );
}

/* -----------------------
   Market Page (WebSocket STOMP)
   ----------------------- */
function MarketPage() {
    const [token, setToken] = useState('RELIANCE');
    const [ticks, setTicks] = useState([]);
    const [stomp, setStomp] = useState(null);

    useEffect(() => {
        // UNCOMMENT THIS BLOCK IN YOUR LOCAL PROJECT to enable WebSockets
        /*
        const socket = new SockJS(WS_ENDPOINT);
        const client = new StompClient({
            webSocketFactory: () => socket,
            debug: () => {},
            onConnect: () => {
                client.subscribe(`/topic/market/${token}`, msg => {
                    try {
                        const body = JSON.parse(msg.body);
                        setTicks(prev => [body, ...prev].slice(0, 100));
                    } catch (e) {}
                });
            }
        });
        client.activate();
        setStomp(client);
        return () => client.deactivate();
        */
        console.log("WebSocket disabled in preview mode. Uncomment in local code.");
    }, [token]);

    return (
        <Layout>
            <div className="bg-white p-4 rounded shadow">
                <h3 className="font-semibold mb-2">Market Stream</h3>
                <div className="flex gap-2 mb-3">
                    <input value={token} onChange={e=>setToken(e.target.value)} className="border rounded p-2" />
                </div>
                <div className="space-y-2 max-h-[60vh] overflow-auto">
                    {ticks.map((t, i) => (
                        <div key={i} className="flex items-center justify-between border-b py-2">
                            <div>
                                <div className="font-medium">{t.symbol || token}</div>
                                <div className="text-sm text-slate-500">price: {t.price}  qty: {t.quantity}</div>
                            </div>
                            <div className="text-xs text-slate-400">{t.time || ''}</div>
                        </div>
                    ))}
                    {ticks.length === 0 && <div className="text-gray-500 italic">No live data (WebSocket disabled in preview)</div>}
                </div>
            </div>
        </Layout>
    );
}

/* -----------------------
   Dashboard
   ----------------------- */
function Dashboard() {
    return (
        <Layout>
            <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded shadow"> <h4 className="font-semibold">Portfolio (placeholder)</h4></div>
                <div className="bg-white p-4 rounded shadow"> <h4 className="font-semibold">Active Orders (placeholder)</h4></div>
                <div className="bg-white p-4 rounded shadow"> <h4 className="font-semibold">Notifications (placeholder)</h4></div>
            </div>
        </Layout>
    );
}

/* -----------------------
   App & Routes
   ----------------------- */
export default function App() {
    return (
        <AuthProvider>
            <Router>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />

                    <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                    <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                    <Route path="/brokers" element={<PrivateRoute><BrokersPage /></PrivateRoute>} />
                    <Route path="/orders" element={<PrivateRoute><OrdersPage /></PrivateRoute>} />
                    <Route path="/market" element={<PrivateRoute><MarketPage /></PrivateRoute>} />

                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
            </Router>
        </AuthProvider>
    );
}