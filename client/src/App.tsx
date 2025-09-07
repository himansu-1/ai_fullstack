import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { Routes, Route, Link, Outlet, useNavigate, useLocation } from 'react-router-dom'
import api, { buildWsUrl, fetchSessions, fetchSessionDetail } from './utility/api';
import ReactFlow, { Background, Controls, MiniMap, Panel, addEdge, useNodesState, useEdgesState, MarkerType, ReactFlowProvider, Handle, Position, ConnectionLineType } from 'reactflow'
import type { Node, Edge, Connection, NodeProps } from 'reactflow'
import 'reactflow/dist/style.css'

const HF_API_KEY = import.meta.env.VITE_HF_API_KEY || '';
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || '';
const SERP_API_KEY = import.meta.env.VITE_SERP_API_KEY || '';

function Navbar() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const user = localStorage.getItem('user');
    setIsLoggedIn(!!user);
  }, [location.pathname]); // re-check on route change

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('stacks');
    Object.keys(localStorage).forEach((k) => { if (k.startsWith('stack:')) localStorage.removeItem(k); });
    navigate('/');
  };
  return (
    <nav className="bg-gradient-to-r from-blue-600 to-indigo-700 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex-shrink-0 text-white font-bold text-xl tracking-wide">
            GenAI Workflow
          </div>
          <div className="flex space-x-6">
            <Link
              to="/stacks"
              className="text-white hover:bg-blue-500 hover:text-yellow-300 px-3 py-2 rounded-md text-md font-medium transition-colors duration-200"
            >
              Home
            </Link>
            {/* <Link
              to="/chatAi"
              className="text-white hover:bg-blue-500 hover:text-yellow-300 px-3 py-2 rounded-md text-md font-medium transition-colors duration-200"
            >
              ChatAi
            </Link> */}
            {isLoggedIn && (
              <button
                onClick={handleLogout}
                className="text-white hover:bg-blue-500 hover:text-yellow-300 px-3 py-2 rounded-md text-md font-medium transition-colors duration-200"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

function Base() {
  return <div>
    <Navbar />
    <Outlet />
  </div>
}

function LoginSignup() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ email: 'test@example.com', password: '123456' });
  const navigate = useNavigate();

  const handleToggle = () => {
    setIsLogin(!isLogin);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/signup';
      const response = await api.post(endpoint, formData);

      const userData = response.data;
      localStorage.setItem('user', JSON.stringify({
        ...userData,
        email: formData.email
      }));

      navigate('/stacks');
    } catch (error: any) {
      console.error('Auth error:', error.response?.data || error.message);
      alert('Authentication failed. Check console for details.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-6 rounded shadow-md w-full max-w-md">
        <h2 className="text-2xl font-semibold mb-4 text-center">
          {isLogin ? 'Login' : 'Sign Up'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            name="email"
            placeholder="Email"
            className="w-full border px-3 py-2 rounded"
            value={formData.email}
            onChange={handleChange}
            required
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            className="w-full border px-3 py-2 rounded"
            value={formData.password}
            onChange={handleChange}
            required
          />
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
          >
            {isLogin ? 'Login' : 'Sign Up'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm">
          {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={handleToggle}
            className="text-blue-600 hover:underline"
          >
            {isLogin ? 'Sign Up' : 'Login'}
          </button>
        </p>
      </div>
    </div>
  );
}

function StacksPage() {
  type Stack = { id: string; name: string; description?: string; sessionId?: number | null; createdAt: number };
  const navigate = useNavigate();
  const [stacks, setStacks] = useState<Stack[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });

  const loadStacks = async () => {
    try {
      const backend = await fetchSessions();
      const mapped = backend.map((s: any) => ({ id: String(s.id), name: s.name || `Session ${s.id}`, description: s.description || '', sessionId: s.id, createdAt: Date.parse(s.created_at) || Date.now() }));
      setStacks(mapped);
    } catch {
      const raw = localStorage.getItem('stacks');
      setStacks(raw ? JSON.parse(raw) : []);
    }
  };

  useEffect(() => { loadStacks(); }, []);

  const createStack = async () => {
    if (!form.name.trim()) { alert('Please provide a name'); return; }
    try {
      const resp = await api.post('/session/create', { name: form.name.trim(), description: form.description.trim(), layout: null });
      const sid = resp.data?.session_id;
      setShowModal(false);
      setForm({ name: '', description: '' });
      await loadStacks();
      if (sid) navigate(`/chatAi?sessionId=${encodeURIComponent(String(sid))}&stackId=${encodeURIComponent(String(sid))}`);
    } catch (e: any) {
      console.error('Create stack error:', e.response?.data || e.message);
      alert(e.response?.data?.detail || 'Failed to create stack');
    }
  };

  console.log(stacks);
  
  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xl font-semibold">Your Stacks</div>
        <button className="px-3 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => setShowModal(true)}>Create Stack</button>
      </div>
      {stacks.length === 0 ? (
        <div className="text-sm text-gray-500">No stacks yet. Create one to get started.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {stacks.map(s => (
            <div key={s.id} className="border rounded p-3 bg-white hover:shadow cursor-pointer" onClick={() => navigate(`/chatAi?sessionId=${encodeURIComponent(String(s.sessionId || ''))}&stackId=${encodeURIComponent(s.id)}`)}>
              <div className="font-semibold">{s.name}</div>
              <div className="text-xs text-gray-500 truncate">{s.description || 'No description'}</div>
              <div className="mt-2 text-[11px] text-gray-600">Session: {s.sessionId || '-'}</div>
              <div className="text-[10px] text-gray-400">{new Date(s.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowModal(false)} />
          <div className="relative bg-white w-[420px] rounded-lg shadow p-4">
            <div className="text-lg font-semibold mb-2">Create Stack</div>
            <div className="space-y-2">
              <input className="w-full border rounded px-2 py-2" placeholder="Name" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
              <textarea className="w-full border rounded px-2 py-2" rows={3} placeholder="Description (optional)" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button className="px-3 py-1.5 rounded border" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="px-3 py-1.5 rounded bg-indigo-600 text-white" onClick={createStack}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChatAi() {
  type NodeKind = 'user' | 'kb' | 'llm' | 'output';

  type KnowledgeBaseConfig = {
    embeddingProvider: 'openai' | 'gemini' | 'huggingface';
    embeddingModel: string;
    apiKey: string;
    includeContext: boolean;
    files: File[];
    kbId?: string;
    built?: boolean;
    userQuery?: string;
    documentIds?: number[];
    fileNames?: string[];
    chromaCollection?: string;
  };

  type LlmConfig = {
    provider: 'openai' | 'gemini' | 'groq';
    model: string;
    apiKey: string;
    temperature: number;
    prompt: string;
    useWebSearch: boolean;
    serpApiKey?: string;
    braveApiKey?: string;
  };

  type FlowNodeData = {
    label: string;
    kind: NodeKind;
    config?: KnowledgeBaseConfig | LlmConfig | Record<string, unknown>;
    status?: string;
    onChange?: (update: any) => void;
  };

  const location = useLocation();
  const search = new URLSearchParams(location.search);
  const stackId = search.get('stackId') || 'default';
  const sessionIdFromUrl = search.get('sessionId') || search.get('session_id');
  console.log(sessionIdFromUrl);
  

  const initialNodesBase: Node<FlowNodeData>[] = [
    { id: 'user-1', type: 'user', position: { x: 50, y: 150 }, width: 152, height: 141, data: { label: 'User Query', kind: 'user' } },
    { id: 'output-1', type: 'output', position: { x: 900, y: 150 }, width: 150, height: 184, data: { label: 'Output', kind: 'output' } },
    { id: 'kb-mf8l85l1-699', type: 'kb', position: { x: 242, y: 220 }, width: 238, height: 242, data: { label: 'Knowledge Base', kind: 'kb', config: { embeddingProvider: 'huggingface', embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2', apiKey: HF_API_KEY, includeContext: true, files: [] } } },
    { id: 'llm-mf8l8bos-164', type: 'llm', position: { x: 550, y: 11 }, width: 309, height: 403, data: { label: 'LLM Engine', kind: 'llm', config: { provider: 'groq', model: 'llama-3.1-8b-instant', apiKey: GROQ_API_KEY, temperature: 0.75, prompt: 'You are a helpful assistant.', useWebSearch: true, serpApiKey: SERP_API_KEY, braveApiKey: '' } } },
  ];

  const initialNodes: Node<FlowNodeData>[] = useMemo(() => (initialNodesBase), []);
  const initialEdges: Edge[] = useMemo(() => ([
    { id: 'reactflow__edge-llm-mf8l8bos-164output-output-1in', source: 'llm-mf8l8bos-164', sourceHandle: 'output', target: 'output-1', targetHandle: 'in', type: 'bezier', animated: false, markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'reactflow__edge-user-1query-kb-mf8l85l1-699query-in', source: 'user-1', sourceHandle: 'query', target: 'kb-mf8l85l1-699', targetHandle: 'query-in', type: 'bezier', animated: false, markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'reactflow__edge-user-1query-llm-mf8l8bos-164query-in', source: 'user-1', sourceHandle: 'query', target: 'llm-mf8l8bos-164', targetHandle: 'query-in', type: 'bezier', animated: false, markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'reactflow__edge-kb-mf8l85l1-699context-out-llm-mf8l8bos-164context-in', source: 'kb-mf8l85l1-699', sourceHandle: 'context-out', target: 'llm-mf8l8bos-164', targetHandle: 'context-in', type: 'bezier', animated: false, markerEnd: { type: MarkerType.ArrowClosed } },
  ]), []);

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNodeData>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildLogs, setBuildLogs] = useState<string[]>([]);
  const [built, setBuilt] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [rfInstance, setRfInstance] = useState<any | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const lastQueryRef = useRef<string>('');
  const lastContextRef = useRef<string>('');

  const stackLayoutKey = `stack:${stackId}:layout`;
  const stackSessionKey = `stack:${stackId}:session_id`;

  const attachNodeMethods = useCallback((arr: Node<FlowNodeData>[]) => (
    arr.map((n) => ({
      ...n,
      data: {
        ...(n.data as FlowNodeData),
        onChange: (update: any) => {
          setNodes((curr) => curr.map((cn) => {
            if (cn.id !== n.id) return cn;
            const prevCfg = (cn.data as FlowNodeData).config || {};
            const nextCfg = typeof update === 'function' ? update(prevCfg) : { ...prevCfg, ...update };
            return { ...cn, data: { ...(cn.data as FlowNodeData), config: nextCfg } };
          }));
          setIsDirty(true);
        },
      }
    }))
  ), [setNodes]);

  // hydrate from localStorage or backend if sessionId provided
  useEffect(() => {
    const hydrate = async () => {
      try {
        if (sessionIdFromUrl) {
          const sid = Number(sessionIdFromUrl);
          if (Number.isFinite(sid)) {
            // set session id immediately and store
            setSessionId(sid);
            localStorage.setItem(`stack:${stackId}:session_id`, String(sid));
            try {
              const detail = await fetchSessionDetail(sid);
              if (detail?.layout && detail?.layout.nodes && detail?.layout.edges) {
                setNodes(attachNodeMethods(detail.layout.nodes));
                setEdges(detail.layout.edges);
              } else {
                const saved = localStorage.getItem(`stack:${stackId}:layout`);
                if (saved) {
                  const parsed = JSON.parse(saved);
                  if (parsed.nodes && parsed.edges) {
                    setNodes(attachNodeMethods(parsed.nodes));
                    setEdges(parsed.edges);
                  }
                } else {
                  setNodes((nds) => attachNodeMethods(nds));
                }
              }
                          // merge attached documents and configs into nodes for display
            try {
              const docIds = (detail.documents || []).map((d: any) => d.id);
              const fileNames = (detail.documents || []).map((d: any) => d.filename);
              setNodes((nds) => attachNodeMethods(nds.map(n => {
                if (n.type === 'kb') {
                  return {
                    ...n,
                    data: {
                      ...(n.data as any),
                      config: {
                        ...(((n.data as any).config) || {}),
                        embeddingProvider: detail?.kb?.embeddingProvider || ((n.data as any).config?.embeddingProvider) || 'huggingface',
                        embeddingModel: detail?.kb?.embeddingModel || ((n.data as any).config?.embeddingModel) || '',
                        includeContext: typeof detail?.kb?.includeContext === 'boolean' ? detail.kb.includeContext : (((n.data as any).config?.includeContext) ?? true),
                        documentIds: docIds.length ? docIds : (((n.data as any).config?.documentIds) || []),
                        fileNames: fileNames.length ? fileNames : (((n.data as any).config?.fileNames) || []),
                      }
                    }
                  };
                }
                if (n.type === 'llm') {
                  return {
                    ...n,
                    data: {
                      ...(n.data as any),
                      config: {
                        ...(((n.data as any).config) || {}),
                        provider: detail?.llm?.provider || ((n.data as any).config?.provider) || 'groq',
                        model: detail?.llm?.model || ((n.data as any).config?.model) || '',
                        apiKey: detail?.llm?.apiKey || ((n.data as any).config?.apiKey) || '',
                        temperature: (typeof detail?.llm?.temperature === 'number' ? detail.llm.temperature : ((n.data as any).config?.temperature)) ?? 0.75,
                        prompt: detail?.llm?.prompt || ((n.data as any).config?.prompt) || '',
                        useWebSearch: typeof detail?.llm?.useWebSearch === 'boolean' ? detail.llm.useWebSearch : (((n.data as any).config?.useWebSearch) ?? false),
                        serpApiKey: detail?.llm?.serpApiKey || ((n.data as any).config?.serpApiKey) || '',
                        braveApiKey: detail?.llm?.braveApiKey || ((n.data as any).config?.braveApiKey) || '',
                      }
                    }
                  };
                }
                return n;
              })));
            } catch {}
            } catch {}
            setBuilt(false);
            setIsLocked(false);
            setIsDirty(false);
            return;
          }
        }
      } catch {}
      // fallback to local
      const saved = localStorage.getItem(`stack:${stackId}:layout`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.nodes && parsed.edges) {
            setNodes(attachNodeMethods(parsed.nodes));
            setEdges(parsed.edges);
          }
        } catch {}
      } else {
        setNodes((nds) => attachNodeMethods(nds));
      }
      const sidLocal = localStorage.getItem(`stack:${stackId}:session_id`);
      if (sidLocal) {
        const n = Number(sidLocal);
        if (Number.isFinite(n)) {
                      setSessionId(n);
            setBuilt(false);
            setIsLocked(false);
            setIsDirty(false);
        }
      }
    };
    hydrate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stackId, sessionIdFromUrl]);

  useEffect(() => {
    if (!isLocked) {
      localStorage.setItem(stackLayoutKey, JSON.stringify({ nodes: nodes.map(n => ({ ...n, data: { ...(n.data as FlowNodeData), onChange: undefined } })), edges }));
      if (sessionId) setIsDirty(true);
    }
  }, [nodes, edges, isLocked, stackLayoutKey, sessionId]);

  // WS connect/disconnect on chat modal open
  useEffect(() => {
    if (!showChat || !sessionId) {
      if (wsRef.current) { try { wsRef.current.close(); } catch {} wsRef.current = null; }
      return;
    }
    const url = buildWsUrl(sessionId);
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onmessage = async (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data?.type === 'message' && typeof data?.content === 'string') {
          if (data.content.startsWith('LLM error') || data.content.startsWith('Unsupported provider')) {
            // Fallback to HTTP
            try {
              const resp = await api.post('/llm/generate', { session_id: sessionId, query: lastQueryRef.current, context: lastContextRef.current, history: messages.slice(-6), layout: null });
              const answer = resp.data?.answer || data.content;
              setMessages((m) => [...m, { role: 'assistant', content: answer }]);
            } catch {
              setMessages((m) => [...m, { role: 'assistant', content: data.content }]);
            }
          } else {
            setMessages((m) => [...m, { role: 'assistant', content: data.content }]);
          }
        }
      } catch {}
    };
    ws.onclose = () => { wsRef.current = null; };
    return () => { try { ws.close(); } catch {} };
  }, [showChat, sessionId, messages]);

  // Load history when opening chat
  useEffect(() => {
    const loadHistory = async () => {
      if (!showChat || !sessionId) return;
      try {
        const resp = await api.get(`/llm/history/${sessionId}`);
        const msgs = resp.data?.messages || [];
        if (Array.isArray(msgs)) {
          setMessages(msgs.map((m: any) => ({ role: m.role, content: m.content })));
        }
      } catch (e) {
        // ignore
      }
    };
    loadHistory();
  }, [showChat, sessionId]);

  const hasType = useCallback((t: NodeKind) => nodes.some(n => n.type === t), [nodes]);

  // DnD helpers
  const onDragStart = (event: React.DragEvent<HTMLDivElement>, nodeType: NodeKind) => {
    if (isLocked) return;
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (event: React.DragEvent) => {
    if (isLocked) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const onDrop = (event: React.DragEvent) => {
    if (isLocked) return;
    event.preventDefault();
    const type = event.dataTransfer.getData('application/reactflow') as NodeKind;
    if (!type) return;

    if (hasType(type)) {
      alert('Only one node of each type is allowed.');
      return;
    }

    const position = rfInstance?.screenToFlowPosition ? rfInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY }) : { x: 0, y: 0 };

    const id = `${type}-${Date.now().toString(36)}-${Math.round(Math.random() * 1000)}`;

    const defaultConfig: Partial<FlowNodeData['config']> = type === 'kb' ? {
      embeddingProvider: 'huggingface',
      embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
      apiKey: '',
      includeContext: true,
      files: [],
    } : type === 'llm' ? {
      provider: 'groq',
      model: 'llama-3.1-8b-instant',
      apiKey: '',
      temperature: 0.75,
      prompt: 'You are a helpful assistant.',
      useWebSearch: false,
      serpApiKey: '',
      braveApiKey: '',
    } : {};

    const newNode: Node<FlowNodeData> = {
      id,
      type,
      position,
      data: {
        label: type === 'user' ? 'User Query' : type === 'kb' ? 'Knowledge Base' : type === 'llm' ? 'LLM Engine' : 'Output',
        kind: type,
        config: defaultConfig,
      },
    };

    setIsDirty(true);
    setNodes((nds) => attachNodeMethods(nds.concat(newNode)));
  };

  // Allowed connections
  const canConnect = (sourceKind: NodeKind, targetKind: NodeKind) => {
    if (sourceKind === 'user' && (targetKind === 'kb' || targetKind === 'llm')) return true;
    if (sourceKind === 'kb' && targetKind === 'llm') return true;
    if (sourceKind === 'llm' && targetKind === 'output') return true;
    return false;
  };

  const onConnect = useCallback((params: Connection) => {
    if (isLocked) return;
    const sourceNode = nodes.find(n => n.id === params.source);
    const targetNode = nodes.find(n => n.id === params.target);
    if (!sourceNode || !targetNode) return;

    if (!canConnect(sourceNode.type as NodeKind, targetNode.type as NodeKind)) {
      alert('Invalid connection. Allowed: User→KB/LLM, KB→LLM, LLM→Output');
      return;
    }

    setEdges((eds) => addEdge({ ...params, type: 'bezier', animated: false, markerEnd: { type: MarkerType.ArrowClosed } }, eds));
  }, [nodes, setEdges]);

  // Node renderers with handles + inline config
  const Card: React.FC<{ title: string; subtitle?: string; status?: string; children?: React.ReactNode; contentClassName?: string }> = ({ title, subtitle, status, children, contentClassName }) => (
    <div className="rounded-md border bg-white shadow-sm overflow-hidden">
      <div className="px-2 py-1 border-b bg-gray-50 rounded-t-md">
        <div className="font-semibold text-[11px]">{title}</div>
        {subtitle && <div className="text-[10px] text-gray-500">{subtitle}</div>}
        {status && <div className="text-[9px] text-indigo-600 mt-1">{status}</div>}
      </div>
      <div className={`p-2 text-[11px] text-gray-700 space-y-1 overflow-auto ${contentClassName || 'max-h-48'}`}>
        {children}
      </div>
    </div>
  );

  const UserNode: React.FC<NodeProps<FlowNodeData>> = ({ id, data }) => {
    const cfg: any = (data.config as any) || {};
    return (
      <div className="relative" onDoubleClick={() => { setIsDirty(true); setNodes((nds) => nds.filter(n => n.id !== id)) }}>
        <Handle type="source" position={Position.Right} id="query" />
        <Card title="User Query" subtitle="Entry point">
          <label className="block text-[11px] text-gray-600">User Query</label>
          <textarea
            className="w-full border rounded px-2 py-1"
            rows={3}
            placeholder="Write your query here"
            value={cfg.userQuery || ''}
            onChange={(e) => data.onChange?.({ userQuery: e.target.value })}
          />
        </Card>
      </div>
    );
  };

  const KBNode: React.FC<NodeProps<FlowNodeData>> = ({ id, data }) => {
    const cfg = (data.config as KnowledgeBaseConfig) || {} as KnowledgeBaseConfig;
    const fileList = (cfg.fileNames || []).length ? cfg.fileNames : (cfg as any).files?.map((f: any) => f.name) || [];
    return (
      <div className="relative" onDoubleClick={() => { setIsDirty(true); setNodes((nds) => nds.filter(n => n.id !== id)) }}>
        <Handle type="target" position={Position.Left} id="query-in" />
        <Handle type="source" position={Position.Right} id="context-out" />
        <Card title="Knowledge Base" subtitle="Docs → Embeddings" status={data.status} contentClassName="min-h-[200px] max-h-none">
          <div>
            <label className="block text-[10px] text-gray-600 mb-1">File for Knowledge Base</label>
            <div className="border rounded-md p-2 bg-gray-50">
              <input
                type="file"
                multiple
                accept="application/pdf"
                className="w-full text-[11px]"
                onChange={async (e) => {
                  const files = e.target.files ? Array.from(e.target.files) : [];
                  if (!files.length) return;
                  try {
                    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...(n.data as any), status: 'Uploading…' } } : n));

                    // use current session id from state or URL, do not create new sessions here
                    const sid = sessionId || Number(sessionIdFromUrl || 0);
                    if (!sid) {
                      alert('Missing session context. Please open the stack from the Sessions page.');
                      setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...(n.data as any), status: undefined } } : n));
                      return;
                    }

                    const form = new FormData();
                    files.forEach((f) => form.append('files', f));
                    form.append('embeddingProvider', cfg.embeddingProvider || 'huggingface');
                    form.append('embeddingModel', cfg.embeddingModel || 'sentence-transformers/all-MiniLM-L6-v2');
                    form.append('apiKey', cfg.apiKey || '');
                    form.append('sessionId', String(sid));

                    const resp = await api.post('/kb/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
                    const docIds: number[] = resp.data?.document_ids || [];
                    const chromaCollection: string = resp.data?.chroma_collection || '';

                    data.onChange?.((prev: any) => ({
                      ...prev,
                      files: [],
                      fileNames: [...(prev?.fileNames || []), ...files.map(f => f.name)],
                      documentIds: [...(prev?.documentIds || []), ...docIds],
                      chromaCollection
                    }));
                    setIsDirty(true);
                    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...(n.data as any), status: 'Indexed' } } : n));
                  } catch (error: any) {
                    console.error('KB upload error:', error.response?.data || error.message);
                    alert(error.response?.data?.detail || 'File upload/embedding failed. See console.');
                    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...(n.data as any), status: 'Error' } } : n));
                  }
                }}
              />
              <div className="text-[10px] text-gray-500 mt-1">{(fileList || []).join(', ')}</div>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Embedding Model</label>
            <input
              className="w-full border rounded px-2 py-1"
              placeholder="sentence-transformers/all-MiniLM-L6-v2"
              value={cfg.embeddingModel || ''}
              onChange={(e) => data.onChange?.({ embeddingModel: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">API Key</label>
            <input
              className="w-full border rounded px-2 py-1"
              placeholder="(optional in dev)"
              value={cfg.apiKey || ''}
              onChange={(e) => data.onChange?.({ apiKey: e.target.value })}
            />
          </div>
        </Card>
      </div>
    );
  };

  const LLMNode: React.FC<NodeProps<FlowNodeData>> = ({ id, data }) => {
    const cfg = (data.config as LlmConfig) || {} as LlmConfig;
    return (
      <div className="relative" onDoubleClick={() => { setIsDirty(true); setNodes((nds) => nds.filter(n => n.id !== id)) }}>
        <Handle type="target" position={Position.Left} id="query-in" style={{ top: 24 }} />
        <Handle type="target" position={Position.Left} id="context-in" style={{ top: 64 }} />
        <Handle type="source" position={Position.Right} id="output" />
        <Card title="LLM Engine" subtitle="OpenAI / Gemini / Groq" status={data.status} contentClassName="max-h-[560px] min-h-[360px]">
          <div className="space-y-1.5">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Provider</label>
              <select
                className="w-full border rounded px-2 py-1"
                value={(cfg.provider || 'groq') as any}
                onChange={(e) => { setIsDirty(true); data.onChange?.({ provider: e.target.value }) }}
              >
                <option value="openai">OpenAI</option>
                <option value="gemini">Gemini</option>
                <option value="groq">Groq</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Model</label>
              <input
                className="w-full border rounded px-2 py-1"
                placeholder="gpt-4o-mini | gemini-1.5-pro | llama-3.1-8b-instant"
                value={cfg.model || ''}
                onChange={(e) => { setIsDirty(true); data.onChange?.({ model: e.target.value }) }}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">API Key</label>
              <input
                className="w-full border rounded px-2 py-1"
                placeholder="(optional in dev)"
                value={cfg.apiKey || ''}
                onChange={(e) => { setIsDirty(true); data.onChange?.({ apiKey: e.target.value }) }}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Temperature (0 - 1)</label>
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                className="w-full border rounded px-2 py-1"
                value={cfg.temperature ?? 0.75}
                onChange={(e) => {
                  const num = Math.min(1, Math.max(0, Number(e.target.value)));
                  setIsDirty(true);
                  data.onChange?.({ temperature: isNaN(num) ? 0.75 : num })
                }}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">System Prompt</label>
              <textarea
                className="w-full border rounded px-2 py-1"
                rows={3}
                placeholder="You are a helpful PDF assistant. Use web search if the PDF lacks context. CONTEXT:{context} User Query:{query}"
                value={cfg.prompt || 'You are a helpful PDF assistant. Use web search if the PDF lacks context. CONTEXT:{context} User Query:{query}'}
                onChange={(e) => { setIsDirty(true); data.onChange?.({ prompt: e.target.value }) }}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="websearch"
                type="checkbox"
                checked={!!cfg.useWebSearch}
                onChange={(e) => { setIsDirty(true); data.onChange?.({ useWebSearch: e.target.checked }) }}
              />
              <label htmlFor="websearch" className="text-xs">Enable Web Search</label>
            </div>
            <div className="flex">
              <input
                className="border rounded px-2 py-1"
                placeholder="SerpAPI key (optional in dev)"
                value={cfg.serpApiKey || ''}
                onChange={(e) => { setIsDirty(true); data.onChange?.({ serpApiKey: e.target.value }) }}
              />
            </div>
          </div>
        </Card>
      </div>
    );
  };

  const OutputNode: React.FC<NodeProps<FlowNodeData>> = ({ id, data }) => (
    <div className="" onDoubleClick={() => { setIsDirty(true); setNodes((nds) => nds.filter(n => n.id !== id)) }}>
      <Handle type="target" position={Position.Left} id="in" />
      <Card title="Output" subtitle="Chat UI" contentClassName="min-h-[120px]">
        <div className="text-gray-700">Final response will appear here.</div>
      </Card>
    </div>
  );

  const nodeTypes = useMemo(() => ({
    user: UserNode,
    kb: KBNode,
    llm: LLMNode,
    output: OutputNode,
  }), []);

  const validateWorkflow = (): { ok: boolean; message: string; } => {
    const userNodes = nodes.filter(n => n.type === 'user');
    const llmNodes = nodes.filter(n => n.type === 'llm');
    const outputNodes = nodes.filter(n => n.type === 'output');

    if (userNodes.length !== 1) return { ok: false, message: 'Exactly one User Query node is required.' };
    if (llmNodes.length !== 1) return { ok: false, message: 'Exactly one LLM Engine node is required.' };
    if (outputNodes.length !== 1) return { ok: false, message: 'Exactly one Output node is required.' };

    const idOf = (t: NodeKind) => nodes.find(n => n.type === t)?.id;
    const userId = idOf('user');
    const llmId = idOf('llm');
    const outputId = idOf('output');

    const nextFrom = (id?: string | null) => edges.find(e => e.source === id)?.target;

    const n1 = nextFrom(userId);
    if (!n1) return { ok: false, message: 'User must connect to KB or LLM.' };
    const n1Kind = nodes.find(n => n.id === n1)?.type as NodeKind;
    if (!(n1Kind === 'kb' || n1Kind === 'llm')) return { ok: false, message: 'User must connect to KB or LLM.' };

    const n2 = nextFrom(n1);
    if (n1Kind === 'kb') {
      if (n2 !== llmId) return { ok: false, message: 'KB must connect to LLM.' };
      const n3 = nextFrom(n2);
      if (n3 !== outputId) return { ok: false, message: 'LLM must connect to Output.' };
    } else {
      if (n1 !== llmId) return { ok: false, message: 'User must connect to LLM.' };
      const n3 = nextFrom(n1);
      if (n3 !== outputId) return { ok: false, message: 'LLM must connect to Output.' };
    }

    return { ok: true, message: 'Workflow is valid.' };
  };

  const log = (m: string) => setBuildLogs(l => [...l, m]);

  const buildStack = async () => {
    if (isLocked) return;
    const v = validateWorkflow();
    if (!v.ok) {
      alert(v.message);
      return;
    }

    setIsBuilding(true);
    setBuildLogs([]);

    const snapshot = { nodes: nodes.map(n => ({ ...n, data: { ...(n.data as FlowNodeData), onChange: undefined } })), edges };
    localStorage.setItem(`stack:${stackId}:built`, JSON.stringify(snapshot));

    const kbNode = nodes.find(n => n.type === 'kb');
    const llmNode = nodes.find(n => n.type === 'llm');
    const kbCfg = kbNode ? (kbNode.data as FlowNodeData).config as KnowledgeBaseConfig : undefined;
    const llmCfg = llmNode ? (llmNode.data as FlowNodeData).config as LlmConfig : undefined;

    const kbPayload = kbCfg ? {
      embeddingProvider: kbCfg.embeddingProvider,
      embeddingModel: kbCfg.embeddingModel,
      includeContext: !!kbCfg.includeContext,
      documentIds: kbCfg.documentIds || [],
      apiKey: kbCfg.apiKey || '',
    } : undefined;

    const llmPayload = llmCfg ? {
      provider: llmCfg.provider,
      model: llmCfg.model,
      apiKey: llmCfg.apiKey,
      temperature: llmCfg.temperature,
      prompt: llmCfg.prompt,
      useWebSearch: !!llmCfg.useWebSearch,
      serpApiKey: llmCfg.serpApiKey || '',
      braveApiKey: llmCfg.braveApiKey || '',
    } : undefined as any;

    try {
      if (!llmPayload) throw new Error('LLM configuration missing');

      if (sessionId) {
        log('Updating session…');
        const resp = await api.patch(`/session/${sessionId}`, { kb: kbPayload, llm: llmPayload });
        const sid = resp.data?.session_id;
        if (sid) {
          setSessionId(sid);
          localStorage.setItem(stackSessionKey, String(sid));
          // update stack registry
          try {
            const raw = localStorage.getItem('stacks');
            const arr = raw ? JSON.parse(raw) : [];
            const idx = arr.findIndex((x: any) => x.id === stackId);
            if (idx >= 0) { arr[idx].sessionId = sid; localStorage.setItem('stacks', JSON.stringify(arr)); }
          } catch {}
        }
        log('Session updated.');
      } else {
        log('Validating and creating session…');
        const resp = await api.post('/session/build', { kb: kbPayload, llm: llmPayload });
        const sid = resp.data?.session_id;
        if (!sid) throw new Error('No session_id returned');
        setSessionId(sid);
        localStorage.setItem(stackSessionKey, String(sid));
        try {
          const raw = localStorage.getItem('stacks');
          const arr = raw ? JSON.parse(raw) : [];
          const idx = arr.findIndex((x: any) => x.id === stackId);
          if (idx >= 0) { arr[idx].sessionId = sid; localStorage.setItem('stacks', JSON.stringify(arr)); }
        } catch {}
        log('Session created.');
      }

      setBuilt(true);
      setIsLocked(true);
      setIsDirty(false);
      log('Build completed. Layout locked. Click Edit to modify.');
    } catch (e: any) {
      console.error('Build error:', e.response?.data || e.message);
      alert(e.response?.data?.detail || 'Build failed. See console.');
    } finally {
      setIsBuilding(false);
    }
  };

  const runWorkflow = async (query: string) => {
    const saved = localStorage.getItem(`stack:${stackId}:built`) || localStorage.getItem(stackLayoutKey);
    let savedLayout: any = null;
    try { savedLayout = saved ? JSON.parse(saved) : null; } catch {}

    let context = '';
    try {
      if (sessionId) {
        const resp = await api.post('/kb/query', { session_id: sessionId, query });
        context = resp.data?.context || '';
      }
    } catch (e: any) {
      console.warn('KB query failed, continuing without context:', e.response?.data || e.message);
    }

    const llmNode = nodes.find(n => n.type === 'llm');
    const lcfg = (llmNode?.data as FlowNodeData)?.config as LlmConfig | undefined;

    const ws = wsRef.current;
    lastQueryRef.current = query;
    lastContextRef.current = context;

    if (ws && ws.readyState === WebSocket.OPEN && sessionId) {
      ws.send(JSON.stringify({ type: 'message', query, context, history: messages.slice(-6) }));
      return;
    }

    const payload = {
      session_id: sessionId,
      query,
      context,
      history: messages.slice(-6),
      layout: savedLayout,
    };

    try {
      const resp = await api.post('/llm/generate', payload);
      const answer = resp.data?.answer || 'No answer generated.';
      setMessages((m) => [...m, { role: 'user', content: query }, { role: 'assistant', content: answer }]);
    } catch (e) {
      const simulated = `Simulated answer (offline).\n\nPrompt: ${(lcfg?.prompt || '(default)')}\nModel: ${(lcfg?.model || '')}\nContext: ${context ? '[provided]' : '[none]'}\n\nLayout saved: ${savedLayout ? 'yes' : 'no'}\n\nResponse: This is a placeholder because the backend endpoint is not reachable.`;
      setMessages((m) => [...m, { role: 'user', content: query }, { role: 'assistant', content: simulated }]);
    }
  };

  const onSend = async () => {
    const q = chatInput.trim();
    if (!q || isSending) return;
    setIsSending(true);
    setChatInput('');
    // push user message immediately so first response is paired properly
    setMessages((m) => [...m, { role: 'user', content: q }]);
    await runWorkflow(q);
    setIsSending(false);
  };

  const resetFlow = () => {
    setNodes(attachNodeMethods(initialNodesBase));
    setEdges([]);
    setBuildLogs([]);
    setBuilt(false);
    setMessages([]);
    setSessionId(null);
    setIsDirty(false);
    if (wsRef.current) { try { wsRef.current.close(); } catch {} wsRef.current = null; }
    localStorage.removeItem(stackLayoutKey);
    localStorage.removeItem(`stack:${stackId}:built`);
    localStorage.removeItem(stackSessionKey);
  };

  const ExportButton = () => (
    <button
      className="px-3 py-1.5 text-sm bg-gray-100 border rounded hover:bg-gray-200"
      onClick={() => {
        const serializableNodes = nodes.map(n => ({ ...n, data: { ...(n.data as FlowNodeData), onChange: undefined } }));
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({ nodes: serializableNodes, edges }, null, 2));
        const a = document.createElement('a');
        a.setAttribute('href', dataStr);
        a.setAttribute('download', 'workflow.json');
        a.click();
      }}
    >
      Export
    </button>
  );

  const ImportButton = () => (
    <label className="px-3 py-1.5 text-sm bg-gray-100 border rounded hover:bg-gray-200 cursor-pointer">
      Import
      <input type="file" accept="application/json" className="hidden" onChange={(e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        f.text().then((t) => {
          try {
            const obj = JSON.parse(t);
            if (obj.nodes && obj.edges) {
              setNodes(attachNodeMethods(obj.nodes));
              setEdges(obj.edges);
              setIsDirty(true);
            } else alert('Invalid workflow file.');
          } catch (err) {
            alert('Invalid JSON.');
          }
        })
      }} />
    </label>
  );

  return (
    <div className="h-[calc(100vh-64px)] flex bg-gray-50">
      <ReactFlowProvider>
        {/* Left Palette */}
        <div className="w-64 border-r bg-white p-3 space-y-1">
          <div className="text-sm font-semibold text-gray-700">Components</div>
          <div
            className="p-1 text-xs border rounded bg-gray-50 cursor-move hover:bg-gray-100"
            draggable
            onDragStart={(e) => onDragStart(e, 'user')}
          >
            User Query
          </div>
          <div
            className="p-1 text-xs border rounded bg-gray-50 cursor-move hover:bg-gray-100"
            draggable
            onDragStart={(e) => onDragStart(e, 'kb')}
          >
            Knowledge Base
          </div>
          <div
            className="p-1 text-xs border rounded bg-gray-50 cursor-move hover:bg-gray-100"
            draggable
            onDragStart={(e) => onDragStart(e, 'llm')}
          >
            LLM Engine
          </div>
          <div
            className="p-1 text-xs border rounded bg-gray-50 cursor-move hover:bg-gray-100"
            draggable
            onDragStart={(e) => onDragStart(e, 'output')}
          >
            Output
          </div>

          <div className="pt-4 space-y-2">
            <button
              className="w-full bg-gray-100 text-gray-800 border rounded py-2 hover:bg-gray-200"
              onClick={resetFlow}
            >
              Reset
            </button>
            <div className="flex gap-2">
              <ExportButton />
              <ImportButton />
            </div>
            <div className="text-xs text-gray-500">Drag items to the canvas. Connect: User→KB/LLM → Output</div>
            <div className="mt-3">
              <div className="text-sm font-semibold text-gray-700 mb-1">Logs</div>
              <div className="h-40 overflow-y-auto bg-gray-50 border rounded p-2 text-[11px] text-gray-700">
                {buildLogs.length ? buildLogs.map((l, i) => <div key={i}>• {l}</div>) : <div className="text-gray-400">No logs yet.</div>}
              </div>
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative" onDrop={onDrop} onDragOver={onDragOver}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={(chs) => { setIsDirty(true); onNodesChange(chs); }}
            onEdgesChange={(chs) => { setIsDirty(true); onEdgesChange(chs); }}
            onConnect={onConnect}
            onEdgeDoubleClick={(_, edge) => { if (!isLocked) { setIsDirty(true); setEdges((eds) => eds.filter(e => e.id !== edge.id)) } }}
            nodeTypes={nodeTypes}
            onInit={(instance) => setRfInstance(instance)}
            nodesDraggable={!isLocked}
            nodesConnectable={!isLocked}
            elementsSelectable={!isLocked}
            fitView
            connectionLineType={ConnectionLineType.Bezier}
            snapToGrid
            snapGrid={[11, 11]}
            panOnScroll
            proOptions={{ hideAttribution: true }}
            className="text-[11px]"
          >
            <Background gap={10} size={0.6} />
            <MiniMap pannable zoomable position="bottom-left" className="!text-[9px]" />
            <Controls showInteractive={false} />
          </ReactFlow>

          {/* Fixed Build/Chat Buttons */}
          <div className="fixed bottom-3 right-3 z-40 flex flex-col gap-1.5">
            <div className="flex gap-1.5">
              <button
                className="px-3 py-1.5 rounded shadow bg-indigo-600 text-white hover:bg-indigo-700 text-[12px] disabled:opacity-60"
                onClick={buildStack}
                disabled={isBuilding || (sessionId ? !isDirty : false)}
              >
                {isBuilding ? 'Building…' : (sessionId ? 'Save Changes' : 'Build Stack')}
              </button>
              <button
                className="px-3 py-1.5 rounded shadow bg-gray-600 text-white hover:bg-gray-700 text-[12px] disabled:opacity-60"
                onClick={() => setIsLocked(false)}
                disabled={!built}
              >
                Edit
              </button>
            </div>
            <button
              className="px-3 py-1.5 rounded shadow bg-blue-600 text-white hover:bg-blue-700 text-[12px] disabled:opacity-60"
              onClick={() => setShowChat(true)}
              disabled={!sessionId || !(nodes.find(n => n.type === 'kb')?.data as any)?.config?.fileNames?.length}
            >
              Chat with Stack
            </button>
          </div>
        </div>

        {/* Chat Modal */}
        {showChat && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30" onClick={() => setShowChat(false)} />
            <div className="relative bg-white w-[900px] h-[600px] rounded-lg shadow-xl flex">
              <div className="flex-1 flex flex-col">
                <div className="px-4 py-2 border-b font-semibold">Chat with Stack</div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.length === 0 && (
                    <div className="text-xs text-gray-500">Start by asking a question. The workflow will run and respond here.</div>
                  )}
                  {messages.map((m, i) => (
                    <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
                      <div className={`inline-block px-3 py-2 rounded-lg text-sm ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                        {m.content}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t p-3 flex gap-2">
                  <input
                    className="flex-1 border rounded px-3 py-2"
                    placeholder="Ask your question..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') onSend(); }}
                  />
                  <button
                    className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                    onClick={onSend}
                    disabled={isSending}
                  >
                    {isSending ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </div>
              <div className="w-64 border-l p-3">
                <div className="text-sm font-semibold mb-2">Run Details</div>
                <div className="text-xs text-gray-600 space-y-1">
                  <div>Flow: User → {(nodes.some(n => n.type === 'kb') ? 'KB → ' : '')}LLM → Output</div>
                  <div>Built: {built ? 'Yes' : 'No'}</div>
                  <div>Messages: {messages.length}</div>
                  <div>Session: {sessionId || '-'}</div>
                </div>
                <div className="mt-4">
                  <button className="w-full px-3 py-2 text-sm bg-gray-100 border rounded hover:bg-gray-200" onClick={() => setMessages([])}>Clear Chat</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </ReactFlowProvider>
    </div>
  )
}

const WithAuth = (WrappedComponent: React.ComponentType<any>) => {
  return (props: any) => {
    const navigate = useNavigate();
    const isAuthenticated = localStorage.getItem('user');

    useEffect(() => {
      if (!isAuthenticated) {
        navigate('/');
      }
    }, [isAuthenticated, navigate]);

    if (!isAuthenticated) {
      return <div>Redirecting...</div>;
    }

    return <WrappedComponent {...props} />;
  };
};

function App() {
  return (
    <div>
      <Routes>
        <Route path="/" element={<Base />}>
          <Route path="/" element={<LoginSignup />} />
          <Route path="stacks" element={React.createElement(WithAuth(StacksPage))} />
          {/* <Route path="chatAi" element={React.createElement(WithAuth(ChatAi))} /> */}
        </Route>
      </Routes>
    </div>
  )
}

export default App