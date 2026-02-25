
import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  ChevronRight, 
  Clock, 
  FileText,
  Upload, 
  BrainCircuit,
  Settings,
  Menu,
  X,
  Copy,
  Check,
  RotateCcw,
  Loader2,
  Sparkles,
  Send,
  MessageSquare
} from 'lucide-react';
import { MeetingRecord, MeetingMetadata, ChatMessage } from './types';
import { INSIGHT_MODULE_CONFIGS } from './constants';
import { geminiService } from './services/geminiService';

const App: React.FC = () => {
  const [records, setRecords] = useState<MeetingRecord[]>([]);
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [chatInputs, setChatInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    const saved = localStorage.getItem('meeting_insights_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const migrated = parsed.map((r: any) => ({
          ...r,
          insightsHistory: r.insightsHistory || {}
        }));
        setRecords(migrated);
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }

    const handleResize = () => {
      if (window.innerWidth > 1024) setIsSidebarOpen(true);
      else setIsSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    localStorage.setItem('meeting_insights_history', JSON.stringify(records));
  }, [records]);

  const activeRecord = records.find(r => r.id === activeRecordId) || null;

  const createNewRecord = () => {
    const newRecord: MeetingRecord = {
      id: Date.now().toString(),
      title: '未命名會議分析',
      createdAt: Date.now(),
      rawTranscript: '',
      metadata: {
        subject: '',
        keywords: '',
        speakers: '',
        terminology: '',
        length: ''
      },
      insights: {},
      insightsHistory: {}
    };
    setRecords([newRecord, ...records]);
    setActiveRecordId(newRecord.id);
    setStep(1);
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  };

  const deleteRecord = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('確定要刪除此筆記錄嗎？')) {
      const filtered = records.filter(r => r.id !== id);
      setRecords(filtered);
      if (activeRecordId === id) {
        setActiveRecordId(filtered.length > 0 ? filtered[0].id : null);
      }
    }
  };

  const renameRecord = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentTitle = records.find(r => r.id === id)?.title || '';
    const newTitle = window.prompt('請輸入新名稱', currentTitle);
    if (newTitle !== null && newTitle.trim() !== '') {
      setRecords(prev => prev.map(r => r.id === id ? { ...r, title: newTitle.trim() } : r));
    }
  };

  const handleMetadataChange = (field: keyof MeetingMetadata, value: string) => {
    if (!activeRecordId) return;
    setRecords(records.map(r => r.id === activeRecordId ? {
      ...r,
      metadata: { ...r.metadata, [field]: value }
    } : r));
  };

  const handleTranscriptChange = (value: string) => {
    if (!activeRecordId) return;
    setRecords(records.map(r => r.id === activeRecordId ? { ...r, rawTranscript: value } : r));
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const runInitialAnalysis = async (moduleId: string) => {
    if (!activeRecord || !activeRecord.correctedTranscript) return;
    const mId = moduleId as keyof typeof INSIGHT_MODULE_CONFIGS;
    const moduleConfig = INSIGHT_MODULE_CONFIGS[mId];
    if (!moduleConfig) return;

    setIsLoading(true);
    setLoadingText(`正在共振解讀模組「${moduleConfig.name}」...`);
    try {
      const result = await geminiService.analyzeTranscript(activeRecord.correctedTranscript, moduleConfig.prompt);
      const firstMessage: ChatMessage = { role: 'model', text: result, timestamp: Date.now() };
      setRecords(records.map(r => r.id === activeRecordId ? {
        ...r,
        insights: { ...r.insights, [moduleId]: result },
        insightsHistory: { ...r.insightsHistory, [moduleId]: [firstMessage] }
      } : r));
      setStep(3);
    } catch (error) {
      alert("分析發生錯誤。");
    } finally {
      setIsLoading(false);
    }
  };

  const sendModuleChat = async (moduleId: string) => {
    const input = chatInputs[moduleId];
    if (!activeRecord || !input?.trim() || isLoading) return;

    const mId = moduleId as keyof typeof INSIGHT_MODULE_CONFIGS;
    const moduleConfig = INSIGHT_MODULE_CONFIGS[mId];
    
    const currentHistory = activeRecord.insightsHistory[moduleId] || [];
    const userMsg: ChatMessage = { role: 'user', text: input, timestamp: Date.now() };
    const updatedHistoryWithUser = [...currentHistory, userMsg];

    setRecords(records.map(r => r.id === activeRecordId ? {
      ...r,
      insightsHistory: { ...r.insightsHistory, [moduleId]: updatedHistoryWithUser }
    } : r));
    setChatInputs(prev => ({ ...prev, [moduleId]: '' }));

    setIsLoading(true);
    setLoadingText(`AI 正在針對「${moduleConfig.name}」進行深度回應...`);

    try {
      const response = await geminiService.analyzeTranscript(
        activeRecord.correctedTranscript || '',
        moduleConfig.prompt,
        updatedHistoryWithUser
      );

      const aiMsg: ChatMessage = { role: 'model', text: response, timestamp: Date.now() };
      const finalHistory = [...updatedHistoryWithUser, aiMsg];

      setRecords(records.map(r => r.id === activeRecordId ? {
        ...r,
        insightsHistory: { ...r.insightsHistory, [moduleId]: finalHistory }
      } : r));
    } catch (error) {
      alert("對話分析發生錯誤。");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 改良的 Markdown 渲染組件，支援表格、清單、粗體與標題
   */
  const MarkdownRenderer = ({ text }: { text: string }) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // 表格偵測 (簡易偵測包含 | 的行，且下一行為分隔行)
      if (line.trim().startsWith('|') && lines[i + 1]?.trim().match(/^\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?$/)) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          tableLines.push(lines[i]);
          i++;
        }
        
        const headerCells = tableLines[0].split('|').filter(c => c.trim()).map(c => c.trim());
        const bodyRows = tableLines.slice(2).map(row => row.split('|').filter(c => c.trim()).map(c => c.trim()));

        elements.push(
          <div key={`table-${i}`} className="table-wrapper">
            <table>
              <thead>
                <tr>
                  {headerCells.map((cell, idx) => <th key={idx}>{cell}</th>)}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, rIdx) => (
                  <tr key={rIdx}>
                    {row.map((cell, cIdx) => <td key={cIdx}>{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }

      // 標題與段落處理
      if (line.startsWith('# ')) {
        elements.push(<h1 key={i}>{line.substring(2)}</h1>);
      } else if (line.startsWith('## ')) {
        elements.push(<h2 key={i}>{line.substring(3)}</h2>);
      } else if (line.startsWith('### ')) {
        elements.push(<h3 key={i}>{line.substring(4)}</h3>);
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        elements.push(<ul key={i}><li>{line.substring(2)}</li></ul>);
      } else if (/^\d+\. /.test(line)) {
        elements.push(<ol key={i}><li>{line.replace(/^\d+\. /, '')}</li></ol>);
      } else if (line.trim() === '') {
        elements.push(<div key={i} className="h-4" />);
      } else {
        // 處理粗體文本
        const parts = line.split(/(\*\*.*?\*\*)/g);
        elements.push(
          <p key={i}>
            {parts.map((part, pIdx) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={pIdx}>{part.slice(2, -2)}</strong>;
              }
              return part;
            })}
          </p>
        );
      }
      i++;
    }

    return <div className="markdown-content">{elements}</div>;
  };

  return (
    <div className="flex h-screen overflow-hidden relative bg-white">
      {isSidebarOpen && window.innerWidth < 1024 && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`fixed lg:relative z-50 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] h-full overflow-hidden flex flex-col bg-[#F2F2F7]/90 lg:bg-[#F2F2F7]/60 backdrop-blur-2xl border-r border-[#D1D1D6] ${isSidebarOpen ? 'w-[85vw] md:w-72' : 'w-0'}`}>
        <div className="p-6 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-black/5 rounded-xl">
              <BrainCircuit className="text-black" size={22} />
            </div>
            <h1 className="text-lg font-extrabold tracking-tighter text-[#1C1C1E] whitespace-nowrap">智會洞察</h1>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="text-[#8E8E93] hover:text-[#1C1C1E] transition-colors active:scale-90">
            <X size={20} />
          </button>
        </div>

        <button onClick={createNewRecord} className="mx-6 mt-4 mb-6 group relative flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-[#1C1C1E] hover:bg-black active:scale-95 transition-all duration-300 shrink-0 shadow-sm">
          <Plus className="text-white" size={18} />
          <span className="text-white font-bold tracking-tight text-sm">新增會議</span>
        </button>

        <div className="flex-1 overflow-y-auto px-4 space-y-1 pb-10">
          <p className="text-[10px] font-bold text-[#8E8E93] tracking-widest uppercase px-3 mb-2">歷史記錄</p>
          {records.map(r => (
            <div 
              key={r.id}
              onClick={() => { 
                setActiveRecordId(r.id); 
                setStep(r.correctedTranscript ? 3 : 1);
                if (window.innerWidth < 1024) setIsSidebarOpen(false);
              }}
              className={`group flex items-center justify-between p-3 px-4 rounded-2xl cursor-pointer transition-all duration-300 ${activeRecordId === r.id ? 'bg-white shadow-sm text-[#1C1C1E]' : 'hover:bg-black/5 text-[#8E8E93]'}`}
            >
              <div className="flex flex-col min-w-0 flex-1">
                <span className={`truncate font-semibold text-sm tracking-tight ${activeRecordId === r.id ? 'text-[#1C1C1E]' : 'text-[#1C1C1E]/70'}`}>{r.title}</span>
                <span className="text-[10px] opacity-60 flex items-center gap-1.5 mt-0.5 font-medium">
                  <Clock size={10} /> {new Date(r.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-1 lg:opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                <button onClick={(e) => renameRecord(r.id, e)} className="p-1.5 hover:bg-black/5 rounded-lg text-[#8E8E93] hover:text-[#1C1C1E] transition-colors"><Edit3 size={14} /></button>
                <button onClick={(e) => deleteRecord(r.id, e)} className="p-1.5 hover:bg-red-50 rounded-lg text-[#8E8E93] hover:text-white transition-colors"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative min-w-0 bg-white">
        <header className="h-16 flex items-center justify-between px-6 md:px-10 sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-[#F2F2F7]">
          <div className="flex items-center gap-4">
            {(!isSidebarOpen || window.innerWidth < 1024) && (
              <button onClick={() => setIsSidebarOpen(true)} className="p-2 bg-[#F2F2F7] rounded-xl hover:bg-[#E5E5EA] transition-all text-[#1C1C1E] active:scale-90">
                <Menu size={20} />
              </button>
            )}
            <h2 className="text-lg font-extrabold tracking-tighter text-[#1C1C1E] truncate max-w-[180px] md:max-w-none">
              {activeRecord ? activeRecord.title : '智會洞察助理'}
            </h2>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            {activeRecord && (
              <div className="flex items-center bg-[#F2F2F7] p-1 rounded-2xl">
                {[1, 2, 3].map((s) => (
                  <button 
                    key={s}
                    disabled={s > 1 && !activeRecord.correctedTranscript}
                    onClick={() => setStep(s as any)}
                    className={`px-4 md:px-6 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-300 ${step === s ? 'bg-white text-[#1C1C1E] shadow-sm' : 'text-[#8E8E93] hover:text-[#1C1C1E] disabled:opacity-30'}`}
                  >
                    {s === 1 ? '輸入' : s === 2 ? '校正' : '解讀'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 md:px-10 pt-4 pb-24 scroll-smooth">
          {!activeRecord ? (
            <div className="h-full flex flex-col items-center justify-center animate-in fade-in zoom-in duration-700">
              <div className="p-12 rounded-[40px] flex flex-col items-center max-w-lg text-center">
                <div className="w-20 h-20 bg-[#F2F2F7] rounded-3xl flex items-center justify-center mb-8">
                  <BrainCircuit size={40} className="text-[#1C1C1E]" />
                </div>
                <h3 className="text-3xl font-extrabold text-[#1C1C1E] mb-4 tracking-tighter">啟動智慧共振</h3>
                <p className="text-[#8E8E93] mb-10 leading-relaxed font-medium">準備好透過 AI 深度解析會議數據了嗎？選擇一筆記錄以啟動系統。</p>
                <button onClick={createNewRecord} className="w-full bg-[#1C1C1E] hover:bg-black text-white py-4 rounded-2xl font-bold tracking-tight transition-all active:scale-95 shadow-lg">立即啟動</button>
              </div>
            </div>
          ) : (
            <div className="max-w-5xl mx-auto">
              {step === 1 && (
                <div className="space-y-6 md:space-y-10 animate-in fade-in slide-in-from-bottom-10 duration-700">
                  <div className="bg-[#F2F2F7] p-6 md:p-10 rounded-[32px] grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                    <div className="md:col-span-2 flex items-center gap-3 mb-2">
                      <Settings className="text-[#1C1C1E]" size={18} />
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#8E8E93]">系統參數初始化</h3>
                    </div>
                    {['subject', 'keywords', 'speakers', 'terminology'].map((field) => (
                      <div key={field} className="space-y-2">
                        <label className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-widest px-1">
                          {field === 'subject' ? '會議主題' : field === 'keywords' ? '核心關鍵字' : field === 'speakers' ? '出席名單' : '專業術語'}
                        </label>
                        <input 
                          type="text"
                          value={(activeRecord.metadata as any)[field]}
                          onChange={(e) => handleMetadataChange(field as any, e.target.value)}
                          placeholder="輸入參數..."
                          className="w-full p-3 md:p-4 bg-white border border-[#D1D1D6] rounded-2xl focus:ring-2 focus:ring-[#1C1C1E] outline-none transition-all text-sm text-[#1C1C1E] placeholder:text-[#C7C7CC]"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="bg-[#F2F2F7] p-6 md:p-10 rounded-[32px]">
                    <div className="flex items-center gap-3 mb-6">
                      <Upload className="text-[#1C1C1E]" size={18} />
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#8E8E93]">原始逐字稿輸入</h3>
                    </div>
                    <textarea 
                      value={activeRecord.rawTranscript}
                      onChange={(e) => handleTranscriptChange(e.target.value)}
                      placeholder="在此貼上您的會議文本數據..."
                      className="w-full min-h-[300px] h-96 p-6 md:p-8 bg-white border border-[#D1D1D6] rounded-[24px] focus:ring-2 focus:ring-[#1C1C1E] outline-none font-sans text-sm leading-relaxed resize-y overflow-auto transition-all text-[#1C1C1E] placeholder:text-[#C7C7CC]"
                    />
                    <div className="mt-8 flex justify-end">
                      <button 
                        disabled={isLoading || !activeRecord.rawTranscript}
                        onClick={async () => {
                          setIsLoading(true);
                          setLoadingText('引擎正在重構文本脈絡...');
                          try {
                            const result = await geminiService.correctTranscript(activeRecord.rawTranscript, activeRecord.metadata);
                            setRecords(records.map(r => r.id === activeRecordId ? { ...r, correctedTranscript: result } : r));
                            setStep(2);
                          } catch (error) {
                            alert("校正發生錯誤。");
                          } finally {
                            setIsLoading(false);
                          }
                        }}
                        className="bg-[#1C1C1E] text-white w-full md:w-auto px-12 py-4 rounded-2xl font-bold tracking-tight transition-all flex items-center justify-center gap-3 disabled:opacity-30 active:scale-95 shadow-lg"
                      >
                        <span>{isLoading ? '校正中...' : '啟動校正引擎'}</span>
                        {!isLoading && <ChevronRight size={20} />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-right-10 duration-700">
                  <div className="bg-[#F2F2F7] p-6 md:p-12 rounded-[40px] relative">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-10 relative z-10 gap-4">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-white rounded-xl shadow-sm">
                          <Sparkles className="text-[#1C1C1E]" size={18} />
                        </div>
                        <h3 className="text-xl font-extrabold text-[#1C1C1E] tracking-tight">校正完成文本</h3>
                      </div>
                      <button 
                        onClick={() => copyToClipboard(activeRecord.correctedTranscript || '', 'corr')}
                        className="w-full md:w-auto flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#1C1C1E] bg-white px-5 py-2.5 rounded-xl transition-all shadow-sm active:scale-95 border border-[#D1D1D6]"
                      >
                        {copiedId === 'corr' ? <Check size={14} /> : <Copy size={14} />}
                        {copiedId === 'corr' ? '已複製' : '複製內容'}
                      </button>
                    </div>
                    <div className="bg-white p-6 md:p-10 rounded-[32px] border border-[#D1D1D6] whitespace-pre-wrap font-sans leading-relaxed text-[#1C1C1E] h-[600px] overflow-auto resize-y text-sm md:text-base tracking-tight shadow-sm">
                      {activeRecord.correctedTranscript}
                    </div>
                    <div className="mt-8 flex justify-end">
                      <button 
                        onClick={() => setStep(3)}
                        className="w-full md:w-auto bg-[#1C1C1E] text-white px-12 py-4 rounded-2xl font-bold tracking-tight transition-all active:scale-95 shadow-lg"
                      >
                        進入解讀矩陣
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-8 md:space-y-12 animate-in fade-in duration-1000 pb-40">
                  {/* Module Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
                    {(Object.values(INSIGHT_MODULE_CONFIGS) as any[]).map((m) => {
                      const isAnalyzing = isLoading && loadingText.includes(m.name);
                      const hasResult = !!activeRecord.insightsHistory[m.id];
                      return (
                        <button
                          key={m.id}
                          onClick={() => runInitialAnalysis(m.id)}
                          disabled={isLoading}
                          className={`flex flex-col items-center justify-center p-4 md:p-6 rounded-3xl transition-all duration-500 relative border active:scale-95 ${hasResult ? 'bg-[#1C1C1E] border-transparent text-white shadow-md' : 'bg-[#F2F2F7] border-transparent text-[#8E8E93] hover:bg-[#E5E5EA] hover:text-[#1C1C1E]'}`}
                        >
                          <div className={`mb-2 md:mb-3 transition-all duration-500 ${hasResult ? 'text-white' : 'text-[#8E8E93]'}`}>{m.icon}</div>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-center">{m.name}</span>
                          {isAnalyzing && (
                            <div className="absolute inset-0 bg-white/80 flex items-center justify-center backdrop-blur-md rounded-3xl">
                              <Loader2 className="animate-spin text-[#1C1C1E]" size={24} />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Results with Discussions */}
                  <div className="space-y-12">
                    {Object.entries(activeRecord.insightsHistory).map(([id, chat]: [string, ChatMessage[]]) => {
                      const m = (INSIGHT_MODULE_CONFIGS as any)[id];
                      const lastAiResponse = chat.filter((msg: ChatMessage) => msg.role === 'model').slice(-1)[0]?.text || "";
                      const copyId = `chat-${id}`;

                      return (
                        <div key={id} className="bg-[#F2F2F7] rounded-[40px] overflow-hidden animate-in slide-in-from-bottom-10 duration-700 border border-[#D1D1D6]">
                          <div className="px-6 md:px-12 py-5 md:py-8 border-b border-[#D1D1D6] bg-white/50 flex flex-col md:flex-row justify-between md:items-center gap-4">
                            <div className="flex items-center gap-3 md:gap-4">
                              <div className="p-2 md:p-3 bg-white text-[#1C1C1E] rounded-2xl shadow-sm shrink-0">{m.icon}</div>
                              <h4 className="text-sm md:text-lg font-extrabold tracking-tighter text-[#1C1C1E] truncate">{m.name}</h4>
                            </div>
                            <button 
                              onClick={() => copyToClipboard(lastAiResponse, copyId)}
                              className="w-full md:w-auto flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#8E8E93] hover:text-[#1C1C1E] transition-all bg-white py-2 px-4 rounded-xl shadow-sm active:scale-95 border border-[#D1D1D6]"
                            >
                              {copiedId === copyId ? <Check size={14} /> : <Copy size={14} />}
                              {copiedId === copyId ? '已複製內容' : '複製最新 Markdown'}
                            </button>
                          </div>

                          <div className="p-6 md:p-12 space-y-8 max-h-[700px] overflow-auto bg-white/30">
                            {chat.map((msg: ChatMessage, index: number) => (
                              <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in duration-500`}>
                                <div className={`max-w-[90%] ${msg.role === 'user' ? 'bg-[#1C1C1E] text-white p-5 rounded-3xl rounded-tr-none shadow-sm' : 'w-full'}`}>
                                  {msg.role === 'user' ? (
                                    <p className="font-medium italic">「{msg.text}」</p>
                                  ) : (
                                    <MarkdownRenderer text={msg.text} />
                                  )}
                                  <div className={`mt-2 text-[10px] flex items-center gap-1 opacity-60 ${msg.role === 'user' ? 'text-white/70' : 'text-[#8E8E93]'}`}>
                                    <Clock size={10} /> {new Date(msg.timestamp).toLocaleTimeString()}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="p-6 md:p-10 bg-white/50 border-t border-[#D1D1D6]">
                            <div className="flex items-center gap-4 group">
                              <div className="p-2 bg-white rounded-xl text-[#8E8E93] shrink-0 shadow-sm"><MessageSquare size={20} /></div>
                              <input 
                                type="text"
                                value={chatInputs[id] || ''}
                                onChange={(e) => setChatInputs(prev => ({ ...prev, [id]: e.target.value }))}
                                onKeyDown={(e) => e.key === 'Enter' && sendModuleChat(id)}
                                placeholder={`針對「${m.name}」提出進一步討論...`}
                                className="flex-1 bg-white border border-[#D1D1D6] rounded-2xl p-4 text-sm md:text-base text-[#1C1C1E] outline-none focus:ring-2 focus:ring-[#1C1C1E]/20 transition-all placeholder:text-[#C7C7CC]"
                              />
                              <button 
                                onClick={() => sendModuleChat(id)}
                                disabled={isLoading || !chatInputs[id]?.trim()}
                                className="p-4 bg-[#1C1C1E] hover:bg-black text-white rounded-2xl transition-all disabled:opacity-20 shadow-md active:scale-95"
                              >
                                {isLoading && loadingText.includes(m.name) ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    
                    {Object.keys(activeRecord.insightsHistory).length === 0 && !isLoading && (
                      <div className="p-20 text-center animate-in fade-in duration-1000">
                        <div className="w-20 h-20 bg-[#F2F2F7] rounded-[40px] flex items-center justify-center mx-auto mb-10">
                          <Sparkles className="text-[#8E8E93]" size={40} />
                        </div>
                        <h4 className="text-2xl font-extrabold text-[#1C1C1E] mb-4 tracking-tighter">解讀矩陣待命中</h4>
                        <p className="text-[#8E8E93] max-w-md mx-auto leading-relaxed font-medium">點擊模組標籤，啟動對特定內容的深度分析。</p>
                      </div>
                    )}

                    {isLoading && (
                      <div className="p-24 text-center bg-[#F2F2F7] rounded-[48px] relative overflow-hidden">
                        <div className="relative z-10 flex flex-col items-center">
                          <Loader2 className="animate-spin text-[#1C1C1E] mb-8" size={56} />
                          <p className="text-2xl font-extrabold text-[#1C1C1E] tracking-tighter mb-2 px-4">{loadingText}</p>
                          <p className="text-[#8E8E93] text-[10px] font-bold uppercase tracking-widest">Processing Insight Matrix</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Global Loading Overlay */}
      {isLoading && step !== 3 && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-md z-[100] flex items-center justify-center pointer-events-none animate-in fade-in duration-500">
          <div className="bg-[#F2F2F7] p-10 rounded-[40px] flex flex-col items-center shadow-2xl scale-110 border border-[#D1D1D6]">
            <Loader2 className="animate-spin text-[#1C1C1E] mb-6" size={48} />
            <p className="text-sm font-bold tracking-widest uppercase text-[#1C1C1E]">{loadingText}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
