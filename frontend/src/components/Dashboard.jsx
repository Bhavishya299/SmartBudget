import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getTransactions, getStats } from "../api/transactions";
import API from "../api/axios";
import { useSettings } from "../context/SettingsContext";
import { useSearch } from "../context/SearchContext";
import { useSocket } from "../context/SocketContext";
import { PlusCircle, TrendingUp, TrendingDown, Wallet, Activity, CalendarClock, HeartPulse, Banknote, CreditCard, Edit3, X } from "lucide-react";
import { computeWeeklyDigest, computeHealthScore } from "../utils/smartEngine";
import toast from "react-hot-toast";

export default function Dashboard() {
  const navigate = useNavigate();
  const { formatCurrency } = useSettings();
  const { searchQuery } = useSearch();
  const { version } = useSocket();

  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({
    totalBalance: 0,
    totalIncome: 0,
    totalExpenses: 0,
    prediction: { dailyAverage: 0, estimatedDaysRemaining: 0, status: "Stable" }
  });
  const [weeklyDigest, setWeeklyDigest] = useState(null);
  const [healthScore, setHealthScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState({ cashBalance: 0, bankBalance: 0 });
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletForm, setWalletForm] = useState({ cashBalance: "", bankBalance: "" });

  const fetchWallet = async () => {
    try {
      const res = await API.get("/api/wallet");
      setWallet(res.data);
      setWalletForm({ cashBalance: res.data.cashBalance, bankBalance: res.data.bankBalance });
    } catch (err) {
      console.log(err);
    }
  };

  const saveWallet = async (e) => {
    e.preventDefault();
    try {
      const res = await API.put("/api/wallet", {
        cashBalance: Number(walletForm.cashBalance) || 0,
        bankBalance: Number(walletForm.bankBalance) || 0,
      });
      setWallet(res.data);
      setShowWalletModal(false);
      toast.success("Wallet updated");
    } catch (err) {
      toast.error("Failed to update wallet");
    }
  };

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        const [txRes, statsRes, goalsRes] = await Promise.all([ 
          getTransactions(), 
          getStats(),
          API.get("/api/goals").catch(() => ({ data: [] }))
        ]);
        if (cancelled) return;
        setTransactions(txRes.data.slice(0, 4));
        setStats(statsRes.data);
        setWeeklyDigest(computeWeeklyDigest(txRes.data));
        setHealthScore(computeHealthScore(txRes.data, goalsRes.data));
        fetchWallet();
      } catch (err) {
        console.log(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();

    return () => {
      cancelled = true;
    };
  }, [version]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8">
      {/* Quick Actions Row */}
      <div className="flex justify-between items-end">
        <h1 className="text-3xl font-bold text-white tracking-tight">Overview</h1>
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate("/add")}
          className="bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center gap-2"
        >
          <PlusCircle size={18} /> Add Record
        </motion.button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-[#111] border border-white/5 p-6 rounded-3xl relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Wallet size={80} />
          </div>
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-2">
              <p className="text-slate-400 font-medium text-sm">Total Balance</p>
              <button onClick={() => setShowWalletModal(true)} className="text-slate-500 hover:text-white"><Edit3 size={14} /></button>
            </div>
            <h3 className="text-3xl font-bold text-white mb-2 tracking-tight">{formatCurrency(Number(wallet.cashBalance || 0) + Number(wallet.bankBalance || 0))}</h3>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-amber-400 flex items-center gap-1"><Banknote size={12} /> Cash: {formatCurrency(wallet.cashBalance || 0)}</span>
              <span className="text-blue-400 flex items-center gap-1"><CreditCard size={12} /> Bank: {formatCurrency(wallet.bankBalance || 0)}</span>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-[#111] border border-white/5 p-6 rounded-3xl"
        >
          <div className="flex justify-between items-start mb-2">
            <p className="text-slate-400 font-medium text-sm">Income</p>
            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400"><TrendingUp size={18} /></div>
          </div>
          <h3 className="text-3xl font-bold text-white tracking-tight">{formatCurrency(stats.totalIncome)}</h3>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-[#111] border border-white/5 p-6 rounded-3xl"
        >
          <div className="flex justify-between items-start mb-2">
            <p className="text-slate-400 font-medium text-sm">Expenses</p>
            <div className="p-2 bg-rose-500/10 rounded-xl text-rose-400"><TrendingDown size={18} /></div>
          </div>
          <h3 className="text-3xl font-bold text-white tracking-tight">{formatCurrency(stats.totalExpenses)}</h3>
        </motion.div>

        {weeklyDigest && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="bg-[#111] border border-white/5 p-6 rounded-3xl"
          >
            <div className="flex justify-between items-start mb-2">
              <p className="text-slate-400 font-medium text-sm">7-Day Spend</p>
              <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400"><CalendarClock size={18} /></div>
            </div>
            <h3 className="text-3xl font-bold text-white tracking-tight mb-2">{formatCurrency(weeklyDigest.currentWeekSpend)}</h3>
            <div className={`flex items-center gap-2 text-xs w-fit px-2 py-1 rounded-md ${weeklyDigest.isGood ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
              {weeklyDigest.trend === "up" ? <TrendingUp size={14} /> : weeklyDigest.trend === "down" ? <TrendingDown size={14} /> : null}
              {weeklyDigest.trend === "stable" ? "Same as last week" : `${weeklyDigest.percentageChange}% ${weeklyDigest.trend} vs last week`}
            </div>
          </motion.div>
        )}
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Activity */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="lg:col-span-2 bg-[#111] border border-white/5 rounded-3xl p-6"
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
            <button onClick={() => navigate("/transactions")} className="text-sm text-emerald-400 hover:text-emerald-300 font-medium">View All</button>
          </div>
          
          <div className="space-y-4">
            {transactions.filter(t => 
              t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
              t.category.toLowerCase().includes(searchQuery.toLowerCase())
            ).length === 0 ? (
              <p className="text-slate-500 text-sm py-4">No matching transactions found.</p>
            ) : (
              transactions
                .filter(t => 
                  t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                  t.category.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((t) => (
                <div key={t._id} className="flex items-center justify-between p-4 rounded-2xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                      t.type === "income" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                    }`}>
                      {t.type === "income" ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{t.title}</p>
                      <p className="text-xs text-slate-500 mt-1">{t.category} • {new Date(t.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className={`text-right font-bold ${t.type === "income" ? "text-emerald-400" : "text-white"}`}>
                    {t.type === "income" ? "+" : "-"}{formatCurrency(t.amount)}
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Smart Insights Panel */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="bg-gradient-to-b from-indigo-500/10 to-[#111] border border-indigo-500/20 rounded-3xl p-6 relative overflow-hidden flex flex-col"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 blur-[50px] rounded-full pointer-events-none" />
          
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <Activity size={20} className="text-indigo-400" /> AI Analysis
          </h3>
          
          <div className="space-y-6 flex-1">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold mb-1">Health Score</p>
                <div className="flex items-end gap-2">
                  <p className={`text-4xl font-bold ${healthScore >= 80 ? 'text-emerald-400' : healthScore >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                    {healthScore}
                  </p>
                  <p className="text-slate-500 mb-1">/ 100</p>
                </div>
              </div>
              <div className="w-16 h-16 rounded-full border-4 border-white/5 flex items-center justify-center relative">
                <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                  <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="none" className="text-white/5" />
                  <circle 
                    cx="32" cy="32" r="28" 
                    stroke="currentColor" strokeWidth="4" fill="none" 
                    strokeDasharray="175" strokeDashoffset={175 - (175 * healthScore) / 100}
                    className={`transition-all duration-1000 ${healthScore >= 80 ? 'text-emerald-400' : healthScore >= 50 ? 'text-amber-400' : 'text-rose-400'}`} 
                  />
                </svg>
                <HeartPulse size={20} className={healthScore >= 80 ? 'text-emerald-400' : healthScore >= 50 ? 'text-amber-400' : 'text-rose-400'} />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 p-3 rounded-2xl">
                <p className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold mb-1">Avg Daily Spend</p>
                <p className="text-lg font-bold text-white">{formatCurrency(stats.prediction.dailyAverage)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-2xl">
                <p className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold mb-1">Runway</p>
                <p className="text-lg font-bold text-white">{stats.prediction.estimatedDaysRemaining} <span className="text-xs text-slate-500 font-normal">days left</span></p>
              </div>
            </div>

            <div className="mt-auto pt-4 border-t border-white/5">
              <p className="text-sm leading-relaxed text-indigo-200/80">
                Your financial health is currently <span className="text-white font-bold">{healthScore >= 80 ? 'Excellent' : healthScore >= 50 ? 'Fair' : 'Needs Work'}</span>. 
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* WALLET MODAL */}
      {showWalletModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 rounded-3xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Set Cash & Bank Balance</h2>
              <button onClick={() => setShowWalletModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <form onSubmit={saveWallet} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Cash in Hand</label>
                <input type="number" step="0.01" value={walletForm.cashBalance} onChange={(e) => setWalletForm({...walletForm, cashBalance: e.target.value})} className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Bank Balance</label>
                <input type="number" step="0.01" value={walletForm.bankBalance} onChange={(e) => setWalletForm({...walletForm, bankBalance: e.target.value})} className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white" />
              </div>
              <p className="text-xs text-slate-500">Set your current actual amounts. From now on, adding transactions with Cash/Online will auto-adjust these.</p>
              <button type="submit" className="w-full py-3 bg-emerald-500 text-white rounded-xl font-medium">Save</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}