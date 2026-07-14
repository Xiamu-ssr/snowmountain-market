import {
  AlertTriangle, BadgeCheck, Bot, Boxes, CheckCircle2, ChevronRight, Code2,
  Download, ExternalLink, FileText, Filter, GitBranch, Github, Layers3,
  MountainSnow, Search, ShieldCheck, Sparkles, Store, Tag, Terminal, Wrench
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type EntryType = "skill" | "mcp" | "tool" | "agent";
interface Entry {
  id: string;
  type: EntryType;
  title: string;
  description: string;
  version: string;
  category: string;
  tags: string[];
  provider: string;
  registry: string;
  resource: string;
  downloadUrl: string;
  artifactUrl?: string;
  sha256?: string;
  permissions: string[];
  runtime: string;
  source: "local" | "remote";
  verification: string;
  license: string;
  access: string;
  risk: string[];
  popularity?: { downloads?: number; installs?: number; stars?: number };
}

interface RegistrySource {
  id: string;
  name: string;
  type: string;
  url: string;
  status: string;
  itemCount: number;
  strategy: string;
  note: string;
  syncedAt?: string;
}

interface Catalog {
  items: Entry[];
  sources: RegistrySource[];
  importedAt: string;
  summary: {
    entries: number;
    types: Record<EntryType, number>;
    categories: Record<string, number>;
  };
}

const icons = { skill: Sparkles, mcp: Boxes, tool: Wrench, agent: Bot };
const typeLabels = { skill: "Skill", mcp: "MCP", tool: "Tool", agent: "Agent" };
const verificationLabels: Record<string, string> = {
  "snowmountain-reviewed": "雪山已审查",
  "publisher-listed": "发布方条目",
  "namespace-verified": "命名空间已验证",
  "registry-listed": "Registry 收录"
};
const manifestExample = "---\ntype: skill\ntitle: Workspace Researcher\ncategory: 数据与知识\nregistry: snowmountain\nverification: snowmountain-reviewed\npermissions:\n  - filesystem:workspace-read\n---";

function formatCount(value = 0) {
  return new Intl.NumberFormat("zh-CN", { notation: value >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
}

export function App() {
  const [catalog, setCatalog] = useState<Catalog>();
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"all" | EntryType>("all");
  const [category, setCategory] = useState("all");
  const [registry, setRegistry] = useState("all");
  const [visible, setVisible] = useState(60);
  const [selected, setSelected] = useState<Entry>();
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}api/catalog.json`).then((response) => {
      if (!response.ok) throw new Error(`Catalog ${response.status}`);
      return response.json();
    }).then((value: Catalog) => setCatalog(value)).catch((reason: Error) => setError(reason.message));
  }, []);

  const items = catalog?.items ?? [];
  const categories = useMemo(() => Object.entries(catalog?.summary.categories ?? {}).sort((left, right) => right[1] - left[1]), [catalog]);
  const filtered = useMemo(() => items.filter((item) => {
    const haystack = `${item.title} ${item.description} ${item.category} ${item.provider} ${item.registry} ${item.tags.join(" ")}`.toLowerCase();
    return (type === "all" || item.type === type)
      && (category === "all" || item.category === category)
      && (registry === "all" || item.registry === registry)
      && haystack.includes(search.toLowerCase());
  }), [items, search, type, category, registry]);

  useEffect(() => setVisible(60), [search, type, category, registry]);

  return <div className="site">
    <header className="nav">
      <a className="logo" href={import.meta.env.BASE_URL}><span><MountainSnow size={22} /></span><div><strong>雪山 Market</strong><small>Agent 能力注册表</small></div></a>
      <nav><a href="#sources">来源</a><a href="#catalog">目录</a><a href="#protocol">协议</a><a href="#safety">安全</a></nav>
      <a className="github" href="https://github.com/Xiamu-ssr/snowmountain-market" target="_blank" rel="noreferrer"><Github size={16} />GitHub</a>
    </header>

    <main>
      <section className="hero">
        <div className="hero-copy">
          <span className="kicker"><Store size={14} />Git 是最终事实源</span>
          <h1>从 4 条样例<br /><em>扩展为 {catalog?.summary.entries ?? "…"} 条能力</em></h1>
          <p>聚合 Skill、MCP、Tool 与 Agent 的公开元数据。同步动作显式执行，快照进入 Git；构建和部署不依赖上游在线，也不会把“被 Registry 收录”误写成“已经安全审查”。</p>
          <div className="hero-actions"><a className="primary" href="#catalog">浏览 {catalog?.summary.entries ?? "…"} 条能力 <ChevronRight size={16} /></a><a className="secondary" href={`${import.meta.env.BASE_URL}api/catalog.json`} target="_blank" rel="noreferrer"><Code2 size={16} />Catalog JSON</a></div>
          <div className="proofs"><span><CheckCircle2 size={14} />Git 快照</span><span><CheckCircle2 size={14} />来源可追溯</span><span><CheckCircle2 size={14} />不代安装</span></div>
        </div>
        <div className="manifest-window"><header><span /><span /><span /><small>snowmountain.market/v2</small></header><pre>{manifestExample}</pre><div className="manifest-status"><GitBranch size={14} /><span>来源、分类、风险均可查询</span><strong>✓ valid</strong></div></div>
      </section>

      <section className="stats">
        <div><strong>{formatCount(catalog?.summary.entries)}</strong><span>目录能力</span></div>
        <div><strong>{formatCount(catalog?.summary.types.skill)}</strong><span>Skills</span></div>
        <div><strong>{formatCount(catalog?.summary.types.mcp)}</strong><span>MCP Servers</span></div>
        <div><strong>{catalog?.sources.filter((source) => source.status === "synced").length ?? 0}</strong><span>已同步来源</span></div>
      </section>

      <section className="sources-section" id="sources">
        <div className="section-head"><div><span className="eyebrow">REGISTRY SOURCES</span><h2>来源不是信任等级</h2><p>每个适配器只同步允许公开复用的元数据。私有 Codex Connector、本机 MCP 配置和登录凭证不会发布到公共 Market。</p></div></div>
        <div className="source-grid">{catalog?.sources.map((source) => <a href={source.url} target="_blank" rel="noreferrer" className={`source-card ${source.status}`} key={source.id}>
          <header><span><Layers3 size={17} /></span><small>{source.type}</small><ExternalLink size={14} /></header>
          <h3>{source.name}</h3><strong>{formatCount(source.itemCount)} <small>条已缓存</small></strong>
          <p>{source.note}</p><footer><span className={source.status === "synced" ? "source-ok" : "source-hold"}>{source.status === "synced" ? <BadgeCheck size={13} /> : <AlertTriangle size={13} />}{source.status}</span><code>{source.strategy}</code></footer>
        </a>)}</div>
      </section>

      <section className="catalog" id="catalog">
        <div className="section-head"><div><span className="eyebrow">CAPABILITY CATALOG</span><h2>按类型、分类和来源筛选</h2><p>当前显示 {Math.min(visible, filtered.length)} / {filtered.length} 条；分类和标签来自上游，再归一到雪山分类体系。</p></div></div>
        <div className="catalog-layout">
          <aside className="category-panel"><strong><Tag size={15} />分类</strong><button className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}><span>全部</span><b>{items.length}</b></button>{categories.map(([name, count]) => <button className={category === name ? "active" : ""} onClick={() => setCategory(name)} key={name}><span>{name}</span><b>{count}</b></button>)}</aside>
          <div className="catalog-content">
            <div className="filters">
              <label><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索能力、分类、标签、发布方" /></label>
              <div><Filter size={15} />{(["all", "skill", "mcp", "tool", "agent"] as const).map((item) => <button key={item} onClick={() => setType(item)} className={type === item ? "active" : ""}>{item === "all" ? "全部" : typeLabels[item]}</button>)}</div>
              <select aria-label="来源" value={registry} onChange={(event) => setRegistry(event.target.value)}><option value="all">全部来源</option>{catalog?.sources.filter((source) => source.itemCount > 0).map((source) => <option value={source.id} key={source.id}>{source.name} · {source.itemCount}</option>)}</select>
            </div>
            {error && <div className="error">Catalog 加载失败：{error}</div>}
            <div className="grid">{filtered.slice(0, visible).map((item) => { const Icon = icons[item.type]; return <article key={item.id} onClick={() => setSelected(item)}>
              <header><span className={`type-icon ${item.type}`}><Icon size={18} /></span><span className="type-label">{typeLabels[item.type]}</span><span className="version">v{item.version}</span></header>
              <div className="card-meta"><span>{item.category}</span><span>{item.provider}</span></div>
              <h3>{item.title}</h3><p>{item.description}</p>
              <div className="tags">{item.tags.slice(0, 5).map((tag) => <span key={tag}>{tag}</span>)}</div>
              <div className={`verification ${item.verification}`}><ShieldCheck size={14} /><span>{verificationLabels[item.verification] ?? item.verification}</span>{item.risk.length > 0 && <small>{item.risk.length} 项风险提示</small>}</div>
              <footer><span><Terminal size={14} />{item.runtime}</span><button>查看详情 <ChevronRight size={14} /></button></footer>
            </article>; })}</div>
            {visible < filtered.length && <button className="load-more" onClick={() => setVisible((value) => value + 60)}>再显示 60 条 · 尚有 {filtered.length - visible} 条</button>}
          </div>
        </div>
      </section>

      <section className="protocol" id="protocol"><div><span className="eyebrow">OPEN FORMAT</span><h2>OKF 管知识，Manifest 管执行</h2><p>Markdown 解释用途；结构化字段定义来源、分类、权限、风险和运行时。远端同步只更新 Git 快照，网站仍是只读投影。</p></div><div className="flow"><div><FileText size={20} /><strong>Upstream metadata</strong><span>public APIs</span></div><ChevronRight /><div><GitBranch size={20} /><strong>Git snapshot</strong><span>review + history</span></div><ChevronRight /><div><Code2 size={20} /><strong>Static API</strong><span>catalog + detail</span></div><ChevronRight /><div><Bot size={20} /><strong>Your Agent</strong><span>inspect, then install</span></div></div></section>

      <section className="safety" id="safety"><div className="safety-card"><ShieldCheck size={30} /><h2>发现不等于安装，收录不等于可信</h2><p>ClawHub、官方 MCP Registry 和 Wind 的验证含义不同。雪山 Market 保留各自验证层级，不把命名空间、热度或发布方身份包装成代码安全。</p><ul><li>所有远端条目默认要求人工审查</li><li>权限、凭证和访问条件在安装前展示</li><li>未经审计的 Skill 标记供应链与 prompt injection 风险</li><li>凭证只在雪山方舟显式绑定，不进入 Market</li></ul></div></section>
    </main>

    <footer className="footer"><div><MountainSnow size={18} /><strong>雪山 Market</strong><span>索引，不是安装器。</span></div><a href={`${import.meta.env.BASE_URL}api/catalog.json`}>API</a><a href="https://github.com/Xiamu-ssr/snowmountain-market">Source</a></footer>

    {selected && <div className="drawer-mask" onClick={() => setSelected(undefined)}><aside className="drawer" onClick={(event) => event.stopPropagation()}><button className="close" onClick={() => setSelected(undefined)}>×</button><span className={`type-icon large ${selected.type}`}>{(() => { const Icon = icons[selected.type]; return <Icon size={22} />; })()}</span><span className="eyebrow">{typeLabels[selected.type]} · V{selected.version}</span><h2>{selected.title}</h2><p>{selected.description}</p><dl><div><dt>分类</dt><dd>{selected.category}</dd></div><div><dt>发布方</dt><dd>{selected.provider}</dd></div><div><dt>来源</dt><dd>{selected.registry}</dd></div><div><dt>验证层级</dt><dd>{verificationLabels[selected.verification] ?? selected.verification}</dd></div><div><dt>访问条件</dt><dd>{selected.access}</dd></div><div><dt>许可证</dt><dd>{selected.license}</dd></div><div><dt>Runtime</dt><dd>{selected.runtime}</dd></div>{selected.sha256 && <div><dt>SHA-256</dt><dd className="hash">{selected.sha256}</dd></div>}</dl><h3>权限声明</h3><div className="drawer-permissions">{selected.permissions.map((value) => <span key={value}><ShieldCheck size={14} />{value}</span>)}</div>{selected.risk.length > 0 && <><h3>风险提示</h3><div className="drawer-risks">{selected.risk.map((value) => <span key={value}><AlertTriangle size={14} />{value}</span>)}</div></>}<div className="notice"><ShieldCheck size={18} /><div><strong>不会自动安装</strong><p>先核对上游、许可证、版本和权限，再让 Agent 按运行时说明安装。</p></div></div><a className="primary wide" href={selected.downloadUrl} target="_blank" rel="noreferrer"><Download size={16} />查看标准化详情</a><a className="secondary wide" href={selected.resource} target="_blank" rel="noreferrer"><ExternalLink size={16} />查看上游来源</a></aside></div>}
  </div>;
}
