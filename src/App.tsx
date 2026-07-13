import {
  Bot, Boxes, CheckCircle2, ChevronRight, Code2, Download, ExternalLink,
  FileText, Filter, GitBranch, Github, MountainSnow, Search, ShieldCheck,
  Sparkles, Store, Terminal, Wrench
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type EntryType = "skill" | "mcp" | "tool" | "agent";
interface Entry {
  id: string; type: EntryType; title: string; description: string; version: string;
  tags: string[]; resource: string; downloadUrl: string; artifactUrl: string;
  sha256: string; permissions: string[]; runtime: string; source: "local" | "remote";
}

const icons = { skill: Sparkles, mcp: Boxes, tool: Wrench, agent: Bot };
const manifestExample = "---\ntype: skill\ntitle: Workspace Researcher\nresource: github.com/...\nmarket:\n  id: workspace-researcher\n  version: 1.0.0\n  runtime: skill-v1\n  permissions:\n    - filesystem:workspace-read\n---";

export function App() {
  const [items, setItems] = useState<Entry[]>([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"all" | EntryType>("all");
  const [selected, setSelected] = useState<Entry>();
  const [error, setError] = useState("");
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}api/catalog.json`).then((response) => {
      if (!response.ok) throw new Error(`Catalog ${response.status}`);
      return response.json();
    }).then((value: { items: Entry[] }) => setItems(value.items)).catch((reason: Error) => setError(reason.message));
  }, []);
  const filtered = useMemo(() => items.filter((item) => (type === "all" || item.type === type) && `${item.title} ${item.description} ${item.tags.join(" ")}`.toLowerCase().includes(search.toLowerCase())), [items, search, type]);

  return <div className="site">
    <header className="nav"><a className="logo" href={import.meta.env.BASE_URL}><span><MountainSnow size={22} /></span><div><strong>雪山 Market</strong><small>Agent capability registry</small></div></a><nav><a href="#catalog">Catalog</a><a href="#protocol">Protocol</a><a href="#safety">Safety</a></nav><a className="github" href="https://github.com/Xiamu-ssr/snowmountain-market" target="_blank" rel="noreferrer"><Github size={16} />GitHub</a></header>
    <main>
      <section className="hero"><div className="hero-copy"><span className="kicker"><Store size={14} />Git is the source of truth</span><h1>给 Agent 一个<br /><em>可验证的能力市场</em></h1><p>收纳 Skill、MCP、Tool 与 Agent 的通用 Manifest。我们不代安装、不代持凭证；只提供来源、哈希、权限、依赖和下载端点，让 Agent 在自己的边界里完成安装。</p><div className="hero-actions"><a className="primary" href="#catalog">浏览 Catalog <ChevronRight size={16} /></a><a className="secondary" href={`${import.meta.env.BASE_URL}api/catalog.json`} target="_blank" rel="noreferrer"><Code2 size={16} />Catalog JSON</a></div><div className="proofs"><span><CheckCircle2 size={14} />OKF 0.1 compatible</span><span><CheckCircle2 size={14} />SHA-256 artifacts</span><span><CheckCircle2 size={14} />Static deploy</span></div></div><div className="manifest-window"><header><span /><span /><span /><small>catalog/skills/workspace-researcher.md</small></header><pre>{manifestExample}</pre><div className="manifest-status"><GitBranch size={14} /><span>reviewed in Git</span><strong>✓ valid</strong></div></div></section>

      <section className="stats"><div><strong>{items.length || 4}</strong><span>Capabilities</span></div><div><strong>{new Set(items.map((item) => item.runtime)).size || 4}</strong><span>Runtime schemas</span></div><div><strong>0</strong><span>Stored credentials</span></div><div><strong>100%</strong><span>Static endpoints</span></div></section>

      <section className="catalog" id="catalog"><div className="section-head"><div><span className="eyebrow">CAPABILITY CATALOG</span><h2>一个入口，四类能力</h2><p>Agent 创建页消费同一 catalog endpoint；每条能力都可以追到 Git concept 和不可变制品。</p></div><div className="filters"><label><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索能力、标签、权限" /></label><div><Filter size={15} />{(["all","skill","mcp","tool","agent"] as const).map((item) => <button key={item} onClick={() => setType(item)} className={type === item ? "active" : ""}>{item}</button>)}</div></div></div>{error && <div className="error">Catalog 加载失败：{error}</div>}<div className="grid">{filtered.map((item) => { const Icon = icons[item.type]; return <article key={item.id} onClick={() => setSelected(item)}><header><span className={`type-icon ${item.type}`}><Icon size={18} /></span><span className="type-label">{item.type}</span><span className="version">v{item.version}</span></header><h3>{item.title}</h3><p>{item.description}</p><div className="tags">{item.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><div className="permission"><ShieldCheck size={15} /><span>{item.permissions.join(" · ") || "no extra permissions"}</span></div><footer><span><Terminal size={14} />{item.runtime}</span><button>查看详情 <ChevronRight size={14} /></button></footer></article>; })}</div></section>

      <section className="protocol" id="protocol"><div><span className="eyebrow">OPEN FORMAT</span><h2>OKF 管知识，Manifest 管执行</h2><p>Markdown 正文让人和 Agent 理解用途；结构化 `market` 字段让控制面验证版本、权限、运行时和制品哈希。网站只是 Git 的只读投影。</p></div><div className="flow"><div><FileText size={20} /><strong>OKF Concept</strong><span>Markdown + YAML</span></div><ChevronRight /><div><GitBranch size={20} /><strong>Git Review</strong><span>history + provenance</span></div><ChevronRight /><div><Code2 size={20} /><strong>Static API</strong><span>catalog + detail</span></div><ChevronRight /><div><Bot size={20} /><strong>Your Agent</strong><span>inspect + install</span></div></div></section>

      <section className="safety" id="safety"><div className="safety-card"><ShieldCheck size={30} /><h2>Market 不是远程执行器</h2><p>远程来源可以在安装后改变，工具返回也可能携带 prompt injection。雪山 Market 因而拒绝“点一下就把陌生代码塞进生产 Agent”。</p><ul><li>Catalog 展示本地/远程来源差异</li><li>制品固定版本并计算 SHA-256</li><li>权限和副作用在安装前显式展示</li><li>凭证始终由雪山方舟 Vault 管理</li></ul></div></section>
    </main>

    <footer className="footer"><div><MountainSnow size={18} /><strong>雪山 Market</strong><span>Format, not platform.</span></div><a href={`${import.meta.env.BASE_URL}api/catalog.json`}>API</a><a href="https://github.com/Xiamu-ssr/snowmountain-market">Source</a></footer>

    {selected && <div className="drawer-mask" onClick={() => setSelected(undefined)}><aside className="drawer" onClick={(event) => event.stopPropagation()}><button className="close" onClick={() => setSelected(undefined)}>×</button><span className={`type-icon large ${selected.type}`}>{(() => { const Icon = icons[selected.type]; return <Icon size={22} />; })()}</span><span className="eyebrow">{selected.type} · V{selected.version}</span><h2>{selected.title}</h2><p>{selected.description}</p><dl><div><dt>ID</dt><dd>{selected.id}</dd></div><div><dt>Runtime</dt><dd>{selected.runtime}</dd></div><div><dt>Source</dt><dd>{selected.source}</dd></div><div><dt>SHA-256</dt><dd className="hash">{selected.sha256}</dd></div></dl><h3>权限声明</h3><div className="drawer-permissions">{selected.permissions.map((value) => <span key={value}><ShieldCheck size={14} />{value}</span>)}</div><div className="notice"><ShieldCheck size={18} /><div><strong>不会自动安装</strong><p>先下载详情、验证哈希并审查 Manifest，再让你的 Agent 按运行时说明安装。</p></div></div><a className="primary wide" href={selected.downloadUrl} target="_blank" rel="noreferrer"><Download size={16} />下载详情 JSON</a><a className="secondary wide" href={selected.resource} target="_blank" rel="noreferrer"><ExternalLink size={16} />查看上游来源</a></aside></div>}
  </div>;
}
