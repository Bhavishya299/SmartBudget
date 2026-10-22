import { useEffect, useState, useRef } from "react";
import API from "../api/axios";
import { useSettings } from "../context/SettingsContext";
import { Users, Plus, Trash2, ArrowLeft, CheckCircle, Clock, Camera, UserPlus, UsersRound, Bell, Receipt, X, ListPlus } from "lucide-react";
import toast from "react-hot-toast";

const SOURCES = [
  { id: "offline", label: "Offline" },
  { id: "zepto", label: "Zepto" },
  { id: "blinkit", label: "Blinkit" },
  { id: "flipkart minutes", label: "Flipkart Minutes" },
  { id: "instamart", label: "Swiggy Instamart" },
];

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7", "#ec4899", "#14b8a6"];

export default function Splits() {
  const { formatCurrency } = useSettings();
  const [tab, setTab] = useState("new");
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState([]);
  const [groups, setGroups] = useState([]);
  const [splits, setSplits] = useState([]);
  const [summary, setSummary] = useState({ totalOwed: 0, byPerson: [], items: [] });

  // New split form
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [splitCount, setSplitCount] = useState(4);
  const [selectedPeople, setSelectedPeople] = useState([]); // person objects
  const [source, setSource] = useState("offline");
  const [category, setCategory] = useState("Food");
  const [notes, setNotes] = useState("");
  const [alsoAddToTransactions, setAlsoAddToTransactions] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState("unspecified");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  // Item-wise splitting
  const [splitMode, setSplitMode] = useState("equal"); // equal | items
  const [items, setItems] = useState([{ id: Date.now(), name: "", amount: "", splitMode: "all", participantIds: [], paidByOnlyId: "" }]);

  // People management
  const [showPersonModal, setShowPersonModal] = useState(false);
  const [personForm, setPersonForm] = useState({ name: "", phone: "" });

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [p, g, s, sum] = await Promise.all([
        API.get("/api/splits/people"),
        API.get("/api/splits/groups"),
        API.get("/api/splits"),
        API.get("/api/splits/summary"),
      ]);
      setPeople(p.data);
      setGroups(g.data);
      setSplits(s.data);
      setSummary(sum.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const addPerson = async (e) => {
    e.preventDefault();
    if (!personForm.name.trim()) return;
    try {
      const res = await API.post("/api/splits/people", {
        name: personForm.name,
        phone: personForm.phone,
        color: COLORS[people.length % COLORS.length],
      });
      setPeople([res.data, ...people]);
      setPersonForm({ name: "", phone: "" });
      setShowPersonModal(false);
      toast.success(`${res.data.name} added`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add");
    }
  };

  const togglePerson = (person) => {
    setSelectedPeople((prev) => {
      const exists = prev.find((p) => p._id === person._id);
      if (exists) return prev.filter((p) => p._id !== person._id);
      return [...prev, person];
    });
  };

  const useGroup = (group) => {
    const members = people.filter((p) => (group.memberIds || []).includes(p._id));
    setSelectedPeople(members);
    // Auto-suggest split count = 1 (you) + members
    if (members.length > 0) setSplitCount(members.length + 1);
    toast.success(`Loaded group "${group.name}"`);
  };

  const addItem = () => {
    setItems([...items, { id: Date.now(), name: "", amount: "", splitMode: "all", participantIds: [], paidByOnlyId: "" }]);
  };

  const removeItem = (id) => {
    if (items.length === 1) return;
    setItems(items.filter(i => i.id !== id));
  };

  const updateItem = (id, field, value) => {
    setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const toggleItemParticipant = (itemId, personId) => {
    setItems(items.map(i => {
      if (i.id !== itemId) return i;
      const current = i.participantIds || [];
      if (current.includes(personId)) {
        return { ...i, participantIds: current.filter(pid => pid !== personId) };
      }
      return { ...i, participantIds: [...current, personId] };
    }));
  };

  const itemsTotal = items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  const calculateItemPreview = () => {
    if (!items.length) return { myShare: 0, owed: {} };
    const owed = { you: 0 };
    selectedPeople.forEach(p => { owed[p._id] = 0; });
    
    for (const item of items) {
      const amt = Number(item.amount) || 0;
      if (amt <= 0) continue;
      
      if (item.splitMode === "all") {
        const everyone = ["you", ...selectedPeople.map(p => p._id)];
        const base = Math.floor((amt * 100) / everyone.length) / 100;
        const shares = everyone.map((_, idx) => base + (idx < ((amt * 100) % everyone.length) ? 0.01 : 0));
        everyone.forEach((id, idx) => { owed[id] += shares[idx]; });
      } else if (item.splitMode === "single") {
        const who = item.paidByOnlyId || "you";
        if (owed[who] !== undefined) owed[who] += amt;
        else owed[who] = amt;
      } else if (item.splitMode === "custom") {
        const participants = item.participantIds || [];
        if (participants.length === 0) continue;
        const base = Math.floor((amt * 100) / participants.length) / 100;
        const shares = participants.map((_, idx) => Math.round((base + (idx < ((amt * 100) % participants.length) ? 0.01 : 0)) * 100) / 100);
        participants.forEach((pid, idx) => { 
          if (owed[pid] !== undefined) owed[pid] += shares[idx];
          else owed[pid] = shares[idx];
        });
      }
    }
    return { myShare: owed.you, owed };
  };

  const itemPreview = splitMode === "items" ? calculateItemPreview() : null;

  const uploadReceipt = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("receipt", file);
    setUploading(true);
    try {
      const res = await API.post("/api/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setReceiptUrl(res.data.url);
      toast.success("Receipt uploaded");
    } catch (err) {
      toast.error(err.response?.data?.message || "Upload failed. Check Cloudinary env vars.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const createSplit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return toast.error("Add a title");

    try {
      const others = selectedPeople.map((p) => ({ name: p.name, personId: p._id }));

      if (splitMode === "items") {
        if (items.length === 0 || items.some(i => !i.name.trim() || !i.amount)) {
          return toast.error("Add all items with names and amounts");
        }
        if (selectedPeople.length === 0) {
          return toast.error("Select at least one person to split with");
        }
        // Validate custom/single
        for (const item of items) {
          if (item.splitMode === "custom" && (!item.participantIds || item.participantIds.length === 0)) {
            return toast.error(`Item "${item.name}" needs participants selected`);
          }
          if (item.splitMode === "single" && !item.paidByOnlyId) {
            return toast.error(`Item "${item.name}" needs someone to pay for it`);
          }
        }

        const cleanItems = items.map(i => ({
          name: i.name.trim(),
          amount: Number(i.amount),
          splitMode: i.splitMode,
          participantIds: i.splitMode === "custom" ? i.participantIds : [],
          paidByOnlyId: i.splitMode === "single" ? i.paidByOnlyId : null,
        }));

        await API.post("/api/splits", {
          title,
          amount: itemsTotal,
          splitCount: selectedPeople.length + 1,
          others,
          source,
          category,
          notes,
          alsoAddToTransactions,
          paymentMethod,
          receiptUrl,
          date: new Date().toISOString(),
          splitType: "items",
          items: cleanItems,
        });
      } else {
        if (!amount) return toast.error("Add a total amount");
        if (splitCount < 2) return toast.error("Split in at least 2");
        if (selectedPeople.length !== splitCount - 1) {
          return toast.error(`Select ${splitCount - 1} people for a ${splitCount}-way split (including you)`);
        }

        await API.post("/api/splits", {
          title,
          amount: Number(amount),
          splitCount: Number(splitCount),
          others,
          source,
          category,
          notes,
          alsoAddToTransactions,
          paymentMethod,
          receiptUrl,
          date: new Date().toISOString(),
          splitType: "equal",
        });
      }

      toast.success("Split created");
      // Reset
      setTitle("");
      setAmount("");
      setSelectedPeople([]);
      setNotes("");
      setReceiptUrl("");
      setItems([{ id: Date.now(), name: "", amount: "", splitMode: "all", participantIds: [], paidByOnlyId: "" }]);
      fetchAll();
      setTab("pending");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create split");
    }
  };

  const markReceived = async (shareId) => {
    try {
      await API.patch(`/api/splits/shares/${shareId}/settle`, { settled: true, settledMethod: "unspecified" });
      toast.success("Marked as received");
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed");
    }
  };

  const markUnreceived = async (shareId) => {
    try {
      await API.patch(`/api/splits/shares/${shareId}/settle`, { settled: false });
      toast.success("Marked as pending again");
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed");
    }
  };

  const perPerson = splitCount - 1;
  const sharePreview = amount ? (Number(amount) / splitCount).toFixed(2) : "0.00";

  return (
    <div className="p-6 md:p-10 transition-colors duration-200">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* HEADER */}
        <div className="flex justify-between items-end flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400 rounded-lg">
              <Users size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Split Expenses</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Divide bills with flatmates & track who owes you</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            <button onClick={() => setTab("new")} className={`px-3 py-1.5 text-sm rounded-md ${tab === "new" ? "bg-white dark:bg-slate-900 shadow" : "text-slate-500"}`}>New Split</button>
            <button onClick={() => setTab("pending")} className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-1 ${tab === "pending" ? "bg-white dark:bg-slate-900 shadow" : "text-slate-500"}`}>
              Pending <span className="bg-rose-500 text-white text-[10px] px-1.5 rounded-full">{summary.totalOwed > 0 ? summary.items.length : 0}</span>
            </button>
            <button onClick={() => setTab("history")} className={`px-3 py-1.5 text-sm rounded-md ${tab === "history" ? "bg-white dark:bg-slate-900 shadow" : "text-slate-500"}`}>History</button>
            <button onClick={() => setTab("people")} className={`px-3 py-1.5 text-sm rounded-md ${tab === "people" ? "bg-white dark:bg-slate-900 shadow" : "text-slate-500"}`}>People</button>
          </div>
        </div>

        {/* PENDING TAB */}
        {tab === "pending" && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-rose-500 to-orange-500 text-white p-6 rounded-2xl flex justify-between items-center">
              <div>
                <p className="text-sm opacity-90">Total money owed to you</p>
                <p className="text-3xl font-bold">{formatCurrency(summary.totalOwed)}</p>
              </div>
              <Clock size={40} className="opacity-80" />
            </div>
            {summary.items.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 p-12 text-center rounded-2xl border border-slate-100 dark:border-slate-800">
                <CheckCircle size={40} className="mx-auto text-emerald-500 mb-3" />
                <p className="text-slate-500 dark:text-slate-400">All caught up — nothing pending!</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="p-4">Person</th>
                      <th className="p-4">For</th>
                      <th className="p-4">Source</th>
                      <th className="p-4 hidden md:table-cell">Date</th>
                      <th className="p-4 text-right">Amount</th>
                      <th className="p-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {summary.items.map((item) => (
                      <tr key={item.shareId}>
                        <td className="p-4 font-medium text-slate-900 dark:text-white">{item.personName}</td>
                        <td className="p-4 text-slate-600 dark:text-slate-300">{item.title}</td>
                        <td className="p-4 text-slate-500 capitalize">{item.source}</td>
                        <td className="p-4 text-slate-500 hidden md:table-cell">{item.date ? new Date(item.date).toLocaleDateString() : "-"}</td>
                        <td className="p-4 text-right font-bold text-rose-500">{formatCurrency(item.amount)}</td>
                        <td className="p-4 text-center">
                          <button onClick={() => markReceived(item.shareId)} className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 px-3 py-1.5 rounded-lg hover:bg-emerald-200">Mark Received</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* NEW SPLIT TAB */}
        {tab === "new" && (
          <form onSubmit={createSplit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="font-bold text-lg text-slate-900 dark:text-white">Bill Details</h2>
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                    <button type="button" onClick={() => setSplitMode("equal")} className={`px-3 py-1 text-sm rounded-md ${splitMode === "equal" ? "bg-white dark:bg-slate-900 shadow" : "text-slate-500"}`}>Split Equally</button>
                    <button type="button" onClick={() => setSplitMode("items")} className={`px-3 py-1 text-sm rounded-md ${splitMode === "items" ? "bg-white dark:bg-slate-900 shadow" : "text-slate-500"}`}>Item-wise Split</button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What was it? (e.g. Zepto order)" className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent dark:text-white" />
                  {splitMode === "equal" ? (
                    <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Total bill amount" className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent dark:text-white" />
                  ) : (
                    <div className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex justify-between items-center">
                      <span className="text-slate-500">Total</span>
                      <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(itemsTotal)}</span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-sm text-slate-500 mb-2 block">Where did you buy from?</label>
                  <div className="flex flex-wrap gap-2">
                    {SOURCES.map((s) => (
                      <button type="button" key={s.id} onClick={() => setSource(s.id)} className={`px-3 py-1.5 text-sm rounded-lg ${source === s.id ? "bg-violet-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"}`}>{s.label}</button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <input ref={fileRef} type="file" accept="image/*" onChange={uploadReceipt} className="hidden" />
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    <Camera size={18} /> {uploading ? "Uploading..." : receiptUrl ? "Change receipt" : "Upload receipt (SS)"}
                  </button>
                  {receiptUrl && (
                    <div className="flex items-center gap-2 text-sm text-emerald-500">
                      <Receipt size={16} /> Uploaded <button type="button" onClick={() => setReceiptUrl("")}><X size={14} /></button>
                    </div>
                  )}
                </div>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent dark:text-white" />
              </div>

              {splitMode === "items" && (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="font-bold text-lg text-slate-900 dark:text-white">Items</h2>
                    <button type="button" onClick={addItem} className="flex items-center gap-2 text-sm text-violet-600"><ListPlus size={16} /> Add Item</button>
                  </div>
                  <div className="space-y-3">
                    {items.map((item, idx) => (
                      <div key={item.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                        <div className="flex gap-2">
                          <input value={item.name} onChange={(e) => updateItem(item.id, "name", e.target.value)} placeholder="Item name (e.g. Potato, Curd)" className="flex-1 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent dark:text-white text-sm" />
                          <input type="number" step="0.01" value={item.amount} onChange={(e) => updateItem(item.id, "amount", e.target.value)} placeholder="₹" className="w-28 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent dark:text-white text-sm" />
                          {items.length > 1 && <button type="button" onClick={() => removeItem(item.id)} className="text-rose-500"><Trash2 size={16} /></button>}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => updateItem(item.id, "splitMode", "all")} className={`px-2 py-1 text-xs rounded-lg ${item.splitMode === "all" ? "bg-violet-600 text-white" : "bg-slate-100 dark:bg-slate-800"}`}>Split with everyone</button>
                          <button type="button" onClick={() => updateItem(item.id, "splitMode", "custom")} className={`px-2 py-1 text-xs rounded-lg ${item.splitMode === "custom" ? "bg-violet-600 text-white" : "bg-slate-100 dark:bg-slate-800"}`}>Split between specific</button>
                          <button type="button" onClick={() => updateItem(item.id, "splitMode", "single")} className={`px-2 py-1 text-xs rounded-lg ${item.splitMode === "single" ? "bg-violet-600 text-white" : "bg-slate-100 dark:bg-slate-800"}`}>Only one person pays</button>
                        </div>
                        {item.splitMode === "custom" && (
                          <div className="flex flex-wrap gap-2">
                            {selectedPeople.map(p => (
                              <button type="button" key={p._id} onClick={() => toggleItemParticipant(item.id, p._id)} className={`px-2 py-1 text-xs rounded-lg flex items-center gap-1 ${item.participantIds?.includes(p._id) ? "bg-violet-100 text-violet-600" : "bg-slate-100 dark:bg-slate-800"}`}>
                                {p.name}
                              </button>
                            ))}
                            <button type="button" onClick={() => updateItem(item.id, "paidByOnlyId", "you")} className={`px-2 py-1 text-xs rounded-lg ${item.participantIds?.includes("you") ? "bg-violet-100 text-violet-600" : "bg-slate-100 dark:bg-slate-800"}`}>Include me</button>
                          </div>
                        )}
                        {item.splitMode === "single" && (
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => updateItem(item.id, "paidByOnlyId", "you")} className={`px-2 py-1 text-xs rounded-lg ${item.paidByOnlyId === "you" ? "bg-violet-600 text-white" : "bg-slate-100 dark:bg-slate-800"}`}>Only me</button>
                            {selectedPeople.map(p => (
                              <button type="button" key={p._id} onClick={() => updateItem(item.id, "paidByOnlyId", p._id)} className={`px-2 py-1 text-xs rounded-lg ${item.paidByOnlyId === p._id ? "bg-violet-600 text-white" : "bg-slate-100 dark:bg-slate-800"}`}>Only {p.name}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="font-bold text-lg text-slate-900 dark:text-white">Split Between</h2>
                  {splitMode === "equal" && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500">Divide in</span>
                      {[2,3,4,5,6].map((n) => (
                        <button type="button" key={n} onClick={() => setSplitCount(n)} className={`w-9 h-9 rounded-lg ${splitCount === n ? "bg-violet-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600"}`}>{n}</button>
                      ))}
                    </div>
                  )}
                </div>

                {groups.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {groups.map((g) => (
                      <button type="button" key={g._id} onClick={() => useGroup(g)} className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center gap-2"><UsersRound size={14} /> {g.name}</button>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {people.map((p) => {
                    const sel = selectedPeople.find((x) => x._id === p._id);
                    return (
                      <button type="button" key={p._id} onClick={() => togglePerson(p)} className={`p-3 rounded-xl border text-left ${sel ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20" : "border-slate-200 dark:border-slate-700"}`}>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm" style={{ background: p.color }}>{p.name[0]}</div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{p.name}</p>
                        </div>
                      </button>
                    );
                  })}
                  <button type="button" onClick={() => setShowPersonModal(true)} className="p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center gap-2 text-slate-500"><UserPlus size={18} /> Add</button>
                </div>
                <p className="text-sm text-slate-500">You + {perPerson} people = {splitCount} ways. Selected: {selectedPeople.length}/{perPerson}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
                <h2 className="font-bold text-lg text-slate-900 dark:text-white">Split Summary</h2>
                {splitMode === "equal" ? (
                  <>
                    <div className="flex justify-between text-sm"><span className="text-slate-500">Total bill</span><span className="font-medium text-slate-900 dark:text-white">{formatCurrency(amount || 0)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-slate-500">Your share</span><span className="font-bold text-violet-600">{formatCurrency(sharePreview)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-slate-500">Each person owes</span><span className="font-medium text-slate-900 dark:text-white">{formatCurrency(sharePreview)}</span></div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between text-sm"><span className="text-slate-500">Total bill</span><span className="font-medium text-slate-900 dark:text-white">{formatCurrency(itemsTotal)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-slate-500">Your share</span><span className="font-bold text-violet-600">{formatCurrency(itemPreview?.myShare || 0)}</span></div>
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
                      {selectedPeople.map(p => (
                        <div key={p._id} className="flex justify-between text-sm">
                          <span className="text-slate-500">{p.name} owes</span>
                          <span className="font-medium text-slate-900 dark:text-white">{formatCurrency(itemPreview?.owed?.[p._id] || 0)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                  <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><input type="checkbox" checked={alsoAddToTransactions} onChange={(e) => setAlsoAddToTransactions(e.target.checked)} /> Add your share to Transactions</label>
                </div>
                <button type="submit" className="w-full py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium">Create Split</button>
              </div>
              {receiptUrl && <img src={receiptUrl} alt="receipt" className="w-full rounded-2xl border border-slate-100 dark:border-slate-800" />}
            </div>
          </form>
        )}

        {/* HISTORY TAB */}
        {tab === "history" && (
          <div className="space-y-3">
            {splits.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 p-12 text-center rounded-2xl border border-slate-100 dark:border-slate-800 text-slate-500">No splits yet</div>
            ) : splits.map((sp) => (
              <div key={sp._id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-violet-100 dark:bg-violet-900/30 text-violet-600 rounded-lg"><Receipt size={20} /></div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">{sp.title}</p>
                    <p className="text-sm text-slate-500 capitalize">{sp.source} • {sp.splitCount}-way • {new Date(sp.date).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(sp.amount)}</p>
                  <p className="text-sm text-slate-500">Your share {formatCurrency(sp.myShare)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PEOPLE TAB */}
        {tab === "people" && (
          <div className="space-y-4">
            <div className="flex justify-between">
              <h2 className="font-bold text-lg text-slate-900 dark:text-white">Flatmates</h2>
              <button onClick={() => setShowPersonModal(true)} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg"><UserPlus size={18} /> Add Person</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {people.filter((p) => !p.archived).map((p) => (
                <div key={p._id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white" style={{ background: p.color }}>{p.name[0]}</div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">{p.name}</p>
                    <p className="text-sm text-slate-500">{p.phone || "No number"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ADD PERSON MODAL */}
      {showPersonModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Add Flatmate</h2>
              <button onClick={() => setShowPersonModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <form onSubmit={addPerson} className="space-y-4">
              <input required value={personForm.name} onChange={(e) => setPersonForm({...personForm, name: e.target.value})} placeholder="Name (e.g. Yash)" className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent dark:text-white" />
              <input value={personForm.phone} onChange={(e) => setPersonForm({...personForm, phone: e.target.value})} placeholder="WhatsApp number (optional)" className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent dark:text-white" />
              <p className="text-xs text-slate-500"><Bell size={12} className="inline" /> Number needed for direct WhatsApp reminders (otherwise you'll get the digest on your own number).</p>
              <button type="submit" className="w-full py-3 bg-violet-600 text-white rounded-lg">Add</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
