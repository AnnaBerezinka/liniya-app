import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";
import { supabase } from "./supabaseClient";
import { saveState, loadState, subscribeToStateChanges, loadAllStates, mergeAllStates, getCurrentUser, signUp, signIn, signOut } from "./supabaseStorage";

/* eslint-disable react-hooks/exhaustive-deps */

const COLORS = {
  bg: "#17140F",
  panel: "#211D16",
  panel2: "#2A2419",
  paper: "#F6EFDF",
  ink: "#F2EADA",
  muted: "#8C8271",
  amber: "#D98E2B",
  amberSoft: "rgba(217,142,43,0.16)",
  green: "#4F9D69",
  greenSoft: "rgba(79,157,105,0.16)",
  red: "#C1503A",
  line: "rgba(242,234,218,0.12)",
};

const FONTS_CSS = `@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');`;
const POLL_MS = 2500;
const AGE_WARN_MS = 6 * 60 * 1000;
const AGE_URGENT_MS = 10 * 60 * 1000;

function emptyState() {
  const today = new Date().toISOString().split("T")[0];
  return {
    menu: [],
    events: { [today]: { name: `Мероприятие ${today}`, orders: [], nextNumber: 101 } },
    currentDate: today,
  };
}

function getEventData(state, date) {
  if (!state.events[date]) {
    state.events[date] = { name: `Мероприятие ${date}`, orders: [], nextNumber: 101 };
  }
  return state.events[date];
}

function fmtMoney(n) { return n.toLocaleString("ru-RU") + " ₽"; }
function fmtDuration(ms) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
function computeCompleted(order) {
  const foodDone = order.hasFood ? order.foodReady : true;
  const drinksDone = order.hasDrinks ? order.drinksReady : true;
  return foodDone && drinksDone;
}

export default function KitchenOrdersApp() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState(() => emptyState());
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("cashier");
  const [tick, setTick] = useState(Date.now());
  const [showDateModal, setShowDateModal] = useState(false);
  const [newDateInput, setNewDateInput] = useState(new Date().toISOString().split("T")[0]);
  const lastSyncRef = useRef(0);
  const stateRef = useRef(state);
  const subscriptionRef = useRef(null);
  stateRef.current = state;

  // Проверить текущего пользователя
  useEffect(() => {
    getCurrentUser().then((u) => {
      setUser(u);
      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  // Загрузить состояние и подписаться на изменения
  useEffect(() => {
    if (!user) return;

    let mounted = true;

    const init = async () => {
      // Загружаем текущее состояние
      const currentState = await loadState();
      if (mounted) {
        setState(currentState || emptyState());
        setLoaded(true);
      }

      // Подписываемся на real-time изменения
      const handleStateChange = async () => {
        const allStates = await loadAllStates();
        const merged = mergeAllStates(allStates);
        if (mounted && merged) {
          setState(merged);
        }
      };

      subscriptionRef.current = subscribeToStateChanges(handleStateChange);
    };

    init();

    // Опциональный poll для синхронизации
    const poll = setInterval(async () => {
      const allStates = await loadAllStates();
      const merged = mergeAllStates(allStates);
      if (mounted && merged) {
        setState(merged);
      }
    }, POLL_MS);

    const clock = setInterval(() => setTick(Date.now()), 1000);

    return () => {
      mounted = false;
      clearInterval(poll);
      clearInterval(clock);
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [user]);

  const mutate = useCallback(async (fn) => {
    const fresh = (await loadState()) || emptyState();
    const next = fn(fresh);
    setState(next);
    await saveState(next);
  }, []);

  const switchDate = useCallback((newDate) => {
    if (!newDate) return;
    mutate((s) => {
      if (!s.events[newDate]) {
        s.events[newDate] = { name: `Мероприятие ${newDate}`, orders: [], nextNumber: 101 };
      }
      return { ...s, currentDate: newDate };
    });
  }, [mutate]);

  const createNewDate = useCallback((dateStr) => {
    if (!dateStr) return;
    const validDate = new Date(dateStr).toISOString().split("T")[0];
    mutate((s) => {
      if (!s.events[validDate]) {
        s.events[validDate] = { name: `Мероприятие ${validDate}`, orders: [], nextNumber: 101 };
      }
      s.currentDate = validDate;
      return s;
    });
    setShowDateModal(false);
  }, [mutate]);

  const currentEvent = state?.events?.[state?.currentDate] || { orders: [], nextNumber: 101 };
  const currentMenu = state?.menu || [];
  const currentOrders = currentEvent?.orders || [];

  const addMenuItem = useCallback((name, category, price) => {
    const trimmedName = name.trim();
    const numPrice = parseFloat(price);
    if (!trimmedName || numPrice <= 0 || isNaN(numPrice) || trimmedName.length > 50) return;
    mutate((s) => {
      const id = `${category}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
      s.menu = [...s.menu, { id, name: trimmedName, category, price: numPrice }];
      return s;
    });
  }, [mutate]);

  const removeMenuItem = useCallback((id) => {
    mutate((s) => { s.menu = s.menu.filter((m) => m.id !== id); return s; });
  }, [mutate]);

  const clearMenu = useCallback(() => {
    if (!window.confirm("⚠️ Очистить ВСЁ меню для ВСЕХ дат?")) return;
    mutate((s) => { s.menu = []; return s; });
  }, [mutate]);

  const addOrder = useCallback((cart) => {
    mutate((s) => {
      const evt = getEventData(s, s.currentDate);
      const items = Object.entries(cart)
        .filter(([, qty]) => qty > 0)
        .map(([id, qty]) => {
          const m = currentMenu.find((x) => x.id === id);
          if (!m) return null;
          return { id: m.id, name: m.name, price: m.price, category: m.category, qty };
        })
        .filter((item) => item !== null);
      if (items.length === 0) return s;
      const hasFood = items.some((i) => i.category === "food");
      const hasDrinks = items.some((i) => i.category === "bar");
      const order = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        number: evt.nextNumber,
        createdAt: Date.now(),
        items,
        hasFood,
        hasDrinks,
        foodReady: !hasFood,
        drinksReady: !hasDrinks,
        foodReadyAt: null,
        drinksReadyAt: null,
        completed: !hasFood && !hasDrinks,
        completedAt: null,
      };
      evt.orders = [...evt.orders, order];
      evt.nextNumber++;
      return s;
    });
  }, [mutate, currentMenu]);

  const markReady = useCallback((orderId, type) => {
    mutate((s) => {
      const evt = s.events[s.currentDate];
      const order = evt.orders.find((o) => o.id === orderId);
      if (!order) return s;
      if (type === "food") {
        order.foodReady = true;
        order.foodReadyAt = Date.now();
      } else if (type === "drinks") {
        order.drinksReady = true;
        order.drinksReadyAt = Date.now();
      }
      if (computeCompleted(order)) {
        order.completed = true;
        order.completedAt = Date.now();
      }
      return s;
    });
  }, [mutate]);

  const resetDemo = useCallback(() => {
    if (!window.confirm("Сбросить ВСЕ данные?")) return;
    mutate((s) => emptyState());
  }, [mutate]);

  const handleLogout = async () => {
    await signOut();
    setUser(null);
    setState(emptyState());
  };

  if (loading) {
    return (
      <div style={{
        background: "#17140F",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#8C8271",
        fontFamily: "'IBM Plex Sans', sans-serif",
      }}>
        <style>{FONTS_CSS}</style>
        Загрузка…
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onSignUp={signUp} onSignIn={signIn} />;
  }

  if (!loaded) {
    return (
      <div style={{
        background: "#17140F",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#8C8271",
        fontFamily: "'IBM Plex Sans', sans-serif",
      }}>
        <style>{FONTS_CSS}</style>
        Загрузка линии…
      </div>
    );
  }

  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh", fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.ink }}>
      <style>{FONTS_CSS}</style>
      <Header 
        tab={tab} setTab={setTab} onReset={resetDemo} orders={currentOrders}
        currentDate={state.currentDate} eventDates={Object.keys(state.events).sort().reverse()}
        onSwitchDate={switchDate} onShowDateModal={() => setShowDateModal(true)}
        showDateModal={showDateModal} onCloseModal={() => setShowDateModal(false)}
        newDateInput={newDateInput} setNewDateInput={setNewDateInput} onCreateNewDate={createNewDate}
        user={user} onLogout={handleLogout}
      />
      <div style={{ padding: "0 0 24px 0" }}>
        {tab === "menu" && <MenuScreen menu={currentMenu} onAdd={addMenuItem} onRemove={removeMenuItem} onClear={clearMenu} />}
        {tab === "cashier" && <CashierScreen onSubmit={addOrder} orders={currentOrders} menu={currentMenu} now={tick} />}
        {tab === "kitchen" && <KitchenScreen orders={currentOrders} onReady={markReady} now={tick} />}
        {tab === "analytics" && <AnalyticsScreen state={state} />}
      </div>
    </div>
  );
}

function LoginScreen({ onSignUp, onSignIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: err } = isSignUp
      ? await onSignUp(email, password)
      : await onSignIn(email, password);

    if (err) {
      setError(err.message);
    } else if (!isSignUp) {
      // Для регистрации нужно подтверждение email
      setError("Проверьте email для подтверждения");
    }

    setLoading(false);
  };

  return (
    <div style={{
      background: COLORS.bg,
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'IBM Plex Sans', sans-serif",
      padding: "20px",
    }}>
      <style>{FONTS_CSS}</style>
      <div style={{
        background: COLORS.panel,
        border: `1px solid ${COLORS.line}`,
        borderRadius: 12,
        padding: 40,
        maxWidth: 400,
        width: "100%",
      }}>
        <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 30, textAlign: "center", color: COLORS.ink }}>
          ЛИНИЯ
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              padding: "12px",
              fontSize: "14px",
              border: `1px solid ${COLORS.line}`,
              borderRadius: 6,
              background: COLORS.bg,
              color: COLORS.ink,
              fontFamily: "'IBM Plex Sans', sans-serif",
            }}
            required
          />

          <input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              padding: "12px",
              fontSize: "14px",
              border: `1px solid ${COLORS.line}`,
              borderRadius: 6,
              background: COLORS.bg,
              color: COLORS.ink,
              fontFamily: "'IBM Plex Sans', sans-serif",
            }}
            required
          />

          {error && (
            <div style={{ color: COLORS.red, fontSize: 13, textAlign: "center" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "12px",
              background: COLORS.amber,
              color: "#FFF",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 600,
              fontFamily: "'IBM Plex Mono', monospace",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Загрузка..." : isSignUp ? "Создать аккаунт" : "Войти"}
          </button>

          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            style={{
              padding: "12px",
              background: "transparent",
              color: COLORS.amber,
              border: `1px solid ${COLORS.amber}`,
              borderRadius: 6,
              cursor: "pointer",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 13,
            }}
          >
            {isSignUp ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Создать"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Header({ tab, setTab, onReset, orders, currentDate, eventDates, onSwitchDate, onShowDateModal, showDateModal, onCloseModal, newDateInput, setNewDateInput, onCreateNewDate, user, onLogout }) {
  const active = orders.filter((o) => !o.completed).length;
  const tabs = [
    { id: "menu", label: "Меню", mark: "00" },
    { id: "cashier", label: "Касса", mark: "01" },
    { id: "kitchen", label: "Кухня / Бар", mark: "02" },
    { id: "analytics", label: "Аналитика", mark: "03" },
  ];
  
  return (
    <div style={{ borderBottom: `1px solid ${COLORS.line}`, padding: "18px 22px 0 22px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 20, letterSpacing: 1 }}>ЛИНИЯ</span>
          <span style={{ fontSize: 12, color: COLORS.muted, letterSpacing: 0.5 }}>приём и выполнение заказов</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 11, color: COLORS.muted }}>👤 {user?.email?.split("@")[0]}</span>
          <select value={currentDate} onChange={(e) => onSwitchDate(e.target.value)} style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, padding: "6px 10px", borderRadius: 4,
            border: `1px solid ${COLORS.line}`, background: COLORS.panel, color: COLORS.ink, cursor: "pointer",
          }}>
            {eventDates.map((d) => (<option key={d} value={d}>{d}</option>))}
          </select>
          <button onClick={onShowDateModal} style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, padding: "6px 10px", borderRadius: 4,
            border: `1px solid ${COLORS.amber}`, background: COLORS.amberSoft, color: COLORS.ink, cursor: "pointer",
          }}>+ новая дата</button>
          {showDateModal && (
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
              <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: "20px", minWidth: "300px" }}>
                <h3 style={{ marginTop: 0 }}>Новая дата</h3>
                <input type="date" value={newDateInput} onChange={(e) => setNewDateInput(e.target.value)} style={{
                  width: "100%", padding: "8px", marginBottom: "16px", fontSize: "13px", border: `1px solid ${COLORS.line}`,
                  borderRadius: 4, background: COLORS.bg, color: COLORS.ink, boxSizing: "border-box",
                }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => onCreateNewDate(newDateInput)} style={{
                    flex: 1, padding: "8px", background: COLORS.amber, color: "#FFF", border: "none", borderRadius: 4, cursor: "pointer",
                  }}>Создать</button>
                  <button onClick={onCloseModal} style={{
                    flex: 1, padding: "8px", background: COLORS.panel2, color: COLORS.ink, border: `1px solid ${COLORS.line}`, borderRadius: 4, cursor: "pointer",
                  }}>Отмена</button>
                </div>
              </div>
            </div>
          )}
          <span style={{ fontSize: 11, color: active > 0 ? COLORS.amber : COLORS.muted, fontWeight: 600 }}>в очереди: {active}</span>
          <button onClick={onReset} style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, padding: "6px 10px", borderRadius: 4,
            border: `1px solid ${COLORS.line}`, background: "transparent", color: COLORS.muted, cursor: "pointer",
          }}>сбросить всё</button>
          <button onClick={onLogout} style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, padding: "6px 10px", borderRadius: 4,
            border: `1px solid ${COLORS.red}`, background: "transparent", color: COLORS.red, cursor: "pointer",
          }}>выход</button>
        </div>
      </div>
      <div style={{ display: "flex", gap: 2, borderBottom: `1px solid ${COLORS.line}` }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "12px 16px", borderBottom: tab === t.id ? `2px solid ${COLORS.amber}` : "none", background: "transparent",
            color: tab === t.id ? COLORS.amber : COLORS.muted, cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11,
          }}>
            <span style={{ opacity: 0.6 }}>{t.mark}</span> {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MenuScreen({ menu, onAdd, onRemove, onClear }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("food");
  const [price, setPrice] = useState("");

  const handleAdd = () => {
    onAdd(name, category, price);
    setName(""); setPrice("");
  };

  const food = menu.filter((m) => m.category === "food");
  const bar = menu.filter((m) => m.category === "bar");

  return (
    <div style={{ padding: "0 22px" }}>
      <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: 16, marginBottom: 20 }}>
        <h3 style={{ marginTop: 0, color: COLORS.ink }}>Добавить позицию</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 12, alignItems: "end" }}>
          <input type="text" placeholder="Название" value={name} onChange={(e) => setName(e.target.value)}
            style={{ padding: "8px", fontSize: "13px", border: `1px solid ${COLORS.line}`, borderRadius: 4, background: COLORS.bg, color: COLORS.ink }} />
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            style={{ padding: "8px", fontSize: "13px", border: `1px solid ${COLORS.line}`, borderRadius: 4, background: COLORS.bg, color: COLORS.ink }}>
            <option value="food">Еда</option>
            <option value="bar">Бар</option>
          </select>
          <input type="number" placeholder="Цена" value={price} onChange={(e) => setPrice(e.target.value)} step="0.01"
            style={{ padding: "8px", fontSize: "13px", border: `1px solid ${COLORS.line}`, borderRadius: 4, background: COLORS.bg, color: COLORS.ink }} />
          <button onClick={handleAdd} style={{ padding: "8px 16px", background: COLORS.amber, color: "#FFF", border: "none", borderRadius: 4, cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace" }}>Добавить</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div>
          <h4 style={{ color: COLORS.amber, marginBottom: 12 }}>Еда</h4>
          {food.length === 0 ? <p style={{ color: COLORS.muted, fontSize: 12 }}>Нет позиций</p> : food.map((m) => (
            <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${COLORS.line}` }}>
              <div><span style={{ fontWeight: 600 }}>{m.name}</span> <span style={{ color: COLORS.muted }}>— {fmtMoney(m.price)}</span></div>
              <button onClick={() => onRemove(m.id)} style={{ background: "none", border: "none", color: COLORS.red, cursor: "pointer", fontSize: 14 }}>×</button>
            </div>
          ))}
        </div>
        <div>
          <h4 style={{ color: COLORS.green, marginBottom: 12 }}>Бар</h4>
          {bar.length === 0 ? <p style={{ color: COLORS.muted, fontSize: 12 }}>Нет позиций</p> : bar.map((m) => (
            <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${COLORS.line}` }}>
              <div><span style={{ fontWeight: 600 }}>{m.name}</span> <span style={{ color: COLORS.muted }}>— {fmtMoney(m.price)}</span></div>
              <button onClick={() => onRemove(m.id)} style={{ background: "none", border: "none", color: COLORS.red, cursor: "pointer", fontSize: 14 }}>×</button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <button onClick={onClear} style={{ padding: "8px 16px", background: COLORS.red + "20", color: COLORS.red, border: `1px solid ${COLORS.red}`, borderRadius: 4, cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>Очистить всё меню</button>
      </div>
    </div>
  );
}

function CashierScreen({ menu, onSubmit, orders, now }) {
  const [cart, setCart] = useState({});

  const setQty = (id, qty) => {
    setCart((c) => ({ ...c, [id]: Math.max(0, qty) }));
  };

  const handleSubmit = () => {
    onSubmit(cart);
    setCart({});
  };

  if (menu.length === 0) {
    return <div style={{ padding: "0 22px", color: COLORS.muted, fontSize: 13, marginTop: 20 }}>Добавьте позиции в меню</div>;
  }

  const food = menu.filter((m) => m.category === "food");
  const bar = menu.filter((m) => m.category === "bar");

  return (
    <div style={{ padding: "0 22px", display: "grid", gridTemplateColumns: "1fr 350px", gap: 20 }}>
      <div>
        {food.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ color: COLORS.amber, marginBottom: 12 }}>Еда</h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
              {food.map((m) => {
                const qty = cart[m.id] || 0;
                return (
                  <div key={m.id} style={{ background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 4, padding: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>{m.name}</div>
                    <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 8 }}>{fmtMoney(m.price)}</div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => setQty(m.id, qty - 1)} style={{ flex: 1, padding: "4px", background: COLORS.panel2, border: `1px solid ${COLORS.line}`, borderRadius: 2, color: COLORS.ink, cursor: "pointer" }}>−</button>
                      <div style={{ flex: 1, textAlign: "center", padding: "4px" }}>{qty}</div>
                      <button onClick={() => setQty(m.id, qty + 1)} style={{ flex: 1, padding: "4px", background: COLORS.panel2, border: `1px solid ${COLORS.line}`, borderRadius: 2, color: COLORS.ink, cursor: "pointer" }}>+</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {bar.length > 0 && (
          <div>
            <h4 style={{ color: COLORS.green, marginBottom: 12 }}>Бар</h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
              {bar.map((m) => {
                const qty = cart[m.id] || 0;
                return (
                  <div key={m.id} style={{ background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 4, padding: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>{m.name}</div>
                    <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 8 }}>{fmtMoney(m.price)}</div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => setQty(m.id, qty - 1)} style={{ flex: 1, padding: "4px", background: COLORS.panel2, border: `1px solid ${COLORS.line}`, borderRadius: 2, color: COLORS.ink, cursor: "pointer" }}>−</button>
                      <div style={{ flex: 1, textAlign: "center", padding: "4px" }}>{qty}</div>
                      <button onClick={() => setQty(m.id, qty + 1)} style={{ flex: 1, padding: "4px", background: COLORS.panel2, border: `1px solid ${COLORS.line}`, borderRadius: 2, color: COLORS.ink, cursor: "pointer" }}>+</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: 16, height: "fit-content", position: "sticky", top: 20 }}>
        <h4 style={{ marginTop: 0, marginBottom: 12 }}>Заказ</h4>
        <div style={{ fontSize: 12, borderBottom: `1px solid ${COLORS.line}`, paddingBottom: 12, marginBottom: 12, maxHeight: 200, overflowY: "auto" }}>
          {Object.entries(cart).filter(([, qty]) => qty > 0).map(([id, qty]) => {
            const item = menu.find((m) => m.id === id);
            return <div key={id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span>{item.name}</span> <span>{qty}x {fmtMoney(item.price * qty)}</span></div>;
          })}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, textAlign: "right" }}>
          Итого: {fmtMoney(Object.entries(cart).reduce((s, [id, qty]) => s + (menu.find((m) => m.id === id)?.price || 0) * qty, 0))}
        </div>
        <button onClick={handleSubmit} disabled={Object.values(cart).every((q) => q === 0)} style={{
          width: "100%", padding: "12px", background: COLORS.amber, color: "#FFF", border: "none", borderRadius: 4, cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600, opacity: Object.values(cart).every((q) => q === 0) ? 0.5 : 1,
        }}>Пробить заказ</button>
      </div>
    </div>
  );
}

function KitchenScreen({ orders, onReady, now }) {
  const food = orders.filter((o) => o.hasFood && !o.foodReady);
  const drinks = orders.filter((o) => o.hasDrinks && !o.drinksReady);

  return (
    <div style={{ padding: "0 22px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      <div>
        <h3 style={{ color: COLORS.amber, marginBottom: 12 }}>Кухня</h3>
        {food.length === 0 ? <p style={{ color: COLORS.muted }}>Нет заказов</p> : food.map((o) => (
          <OrderCard key={o.id} order={o} now={now} onReady={() => onReady(o.id, "food")} type="food" />
        ))}
      </div>
      <div>
        <h3 style={{ color: COLORS.green, marginBottom: 12 }}>Бар</h3>
        {drinks.length === 0 ? <p style={{ color: COLORS.muted }}>Нет заказов</p> : drinks.map((o) => (
          <OrderCard key={o.id} order={o} now={now} onReady={() => onReady(o.id, "drinks")} type="bar" />
        ))}
      </div>
    </div>
  );
}

function OrderCard({ order, now, onReady, type }) {
  const age = now - order.createdAt;
  const color = age > AGE_URGENT_MS ? COLORS.red : age > AGE_WARN_MS ? COLORS.amber : type === "food" ? COLORS.amber : COLORS.green;

  return (
    <div style={{ background: COLORS.panel, border: `2px solid ${color}`, borderRadius: 6, padding: 12, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 16 }}>{order.number}</span>
        <span style={{ color, fontWeight: 600 }}>{fmtDuration(age)}</span>
      </div>
      <div style={{ fontSize: 12, marginBottom: 8 }}>
        {order.items.map((i) => <div key={i.id}>{i.qty}x {i.name}</div>)}
      </div>
      <button onClick={onReady} style={{ width: "100%", padding: "8px", background: color, color: "#FFF", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 600 }}>Готово</button>
    </div>
  );
}

const AnalyticsScreen = React.memo(function AnalyticsScreen({ state }) {
  const allDates = Object.keys(state.events).sort().reverse();
  const [selectedDates, setSelectedDates] = useState([state.currentDate]);
  const [sortOrder, setSortOrder] = useState('category-revenue');

  // ✅ Вычисляем статистику для ВСЕХ ВЫБРАННЫХ дат
  let allCompleted = [];
  for (const date of selectedDates) {
    const evt = state.events[date];
    if (evt) {
      allCompleted = [...allCompleted, ...evt.orders.filter((o) => o.completed)];
    }
  }
  const currentRevenue = allCompleted.reduce((s, o) => s + o.items.reduce((sum, i) => sum + i.price * i.qty, 0), 0);
  const avgReadyMs = allCompleted.length > 0 ? allCompleted.reduce((s, o) => s + (o.completedAt - o.createdAt), 0) / allCompleted.length : 0;

  const filteredData = useMemo(() => {
    const data = {};
    for (const date of selectedDates) {
      const evt = state.events[date];
      if (!evt) continue;
      const completed = evt.orders.filter((o) => o.completed);
      const perItem = {};
      for (const o of completed) {
        for (const i of o.items) {
          if (!perItem[i.id]) perItem[i.id] = { name: i.name, category: i.category, dates: {} };
          if (!perItem[i.id].dates[date]) perItem[i.id].dates[date] = { qty: 0, revenue: 0 };
          perItem[i.id].dates[date].qty += i.qty;
          perItem[i.id].dates[date].revenue += i.qty * i.price;
        }
      }
      Object.assign(data, perItem);
    }
    return data;
  }, [selectedDates, state.events]);

  const rows = useMemo(() => {
    return Object.values(filteredData).sort((a, b) => {
      const sumA = Object.values(a.dates).reduce((s, d) => s + d.revenue, 0);
      const sumB = Object.values(b.dates).reduce((s, d) => s + d.revenue, 0);
      if (sortOrder === 'none') return 0;
      if (sortOrder === 'category-revenue') {
        if (a.category !== b.category) return a.category === 'food' ? -1 : 1;
        return sumB - sumA;
      }
      return sumB - sumA;
    });
  }, [filteredData, sortOrder]);

  const qtyChartData = useMemo(() => {
    return rows.map((r) => {
      const obj = { name: r.name.length > 14 ? r.name.slice(0, 13) + "…" : r.name, category: r.category };
      if (selectedDates.length === 1) {
        obj[`qty_`] = r.dates[selectedDates[0]]?.qty || 0;
      } else {
        for (const date of selectedDates) {
          obj[`qty_${date}`] = r.dates[date]?.qty || 0;
        }
      }
      return obj;
    });
  }, [rows, selectedDates]);

  const revenueChartData = useMemo(() => {
    return rows.map((r) => {
      const obj = { name: r.name.length > 14 ? r.name.slice(0, 13) + "…" : r.name, category: r.category };
      if (selectedDates.length === 1) {
        obj[`rev_`] = r.dates[selectedDates[0]]?.revenue || 0;
      } else {
        for (const date of selectedDates) {
          obj[`rev_${date}`] = r.dates[date]?.revenue || 0;
        }
      }
      return obj;
    });
  }, [rows, selectedDates]);

  return (
    <div style={{ padding: "0 22px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 22 }}>
        <StatCard label="Выручка" value={fmtMoney(currentRevenue)} />
        <StatCard label="Готовых заказов, шт" value={allCompleted.length} />
        <StatCard label="Среднее время готовности заказа, мин" value={allCompleted.length ? fmtDuration(avgReadyMs) : "—"} />
      </div>

      <div style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: COLORS.muted, fontWeight: 500 }}>Выбрать даты:</span>
        {allDates.map((d) => (
          <button key={d} onClick={() => {
            if (selectedDates.includes(d)) {
              if (selectedDates.length > 1) setSelectedDates(selectedDates.filter((x) => x !== d));
            } else {
              setSelectedDates([...selectedDates, d].sort().reverse());
            }
          }} style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, padding: "5px 10px", borderRadius: 4,
            border: `1px solid ${selectedDates.includes(d) ? COLORS.amber : COLORS.line}`,
            background: selectedDates.includes(d) ? COLORS.amberSoft : "transparent",
            color: selectedDates.includes(d) ? COLORS.ink : COLORS.muted, cursor: "pointer",
          }}>
            {d}
          </button>
        ))}
      </div>

      {selectedDates.length === 1 && (
        <div style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: COLORS.muted, fontWeight: 500 }}>Сортировка:</span>
          {["none", "category-revenue", "default"].map((mode) => (
            <button key={mode} onClick={() => setSortOrder(mode)} style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, padding: "5px 10px", borderRadius: 4,
              border: `1px solid ${sortOrder === mode ? COLORS.amber : COLORS.line}`,
              background: sortOrder === mode ? COLORS.amberSoft : "transparent",
              color: sortOrder === mode ? COLORS.ink : COLORS.muted, cursor: "pointer",
            }}>
              {mode === "none" ? "✕ без сортировки" : mode === "category-revenue" ? "По категориям + выручке" : "По выручке"}
            </button>
          ))}
        </div>
      )}

      {selectedDates.length === 1 && qtyChartData.length > 0 && (
        <>
          <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: 16, marginBottom: 20 }}>
            <h4 style={{ marginTop: 0, color: COLORS.muted, textTransform: "uppercase", fontSize: 12 }}>Продано по позициям, шт</h4>
            <ResponsiveContainer width="100%" height={Math.max(350, qtyChartData.length * 50)}>
              <BarChart data={qtyChartData} layout="vertical" margin={{ left: 200, right: 60, top: 4, bottom: 4 }}>
                <CartesianGrid stroke={COLORS.line} horizontal={false} />
                <XAxis type="number" stroke={COLORS.muted} tick={{ fontSize: 13, fill: COLORS.muted }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" stroke={COLORS.muted} tick={{ fontSize: 14, fill: COLORS.ink }} width={190} />
                <Tooltip contentStyle={{ background: COLORS.panel2, border: `1px solid ${COLORS.line}`, borderRadius: 6, fontSize: 12 }} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Bar dataKey="qty_" label={{ position: "right", formatter: (v) => v > 0 ? v : "", fill: COLORS.ink, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace" }}>
                  {qtyChartData.map((item, idx) => (
                    <Cell key={`cell-${idx}`} fill={item.category === "food" ? COLORS.amber : COLORS.green} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: 16, marginBottom: 20 }}>
            <h4 style={{ marginTop: 0, color: COLORS.muted, textTransform: "uppercase", fontSize: 12 }}>Выручка по позициям, тыс. ₽</h4>
            <ResponsiveContainer width="100%" height={Math.max(350, revenueChartData.length * 50)}>
              <BarChart data={revenueChartData} layout="vertical" margin={{ left: 200, right: 80, top: 4, bottom: 4 }}>
                <CartesianGrid stroke={COLORS.line} horizontal={false} />
                <XAxis type="number" stroke={COLORS.muted} tick={{ fontSize: 13, fill: COLORS.muted }} />
                <YAxis type="category" dataKey="name" stroke={COLORS.muted} tick={{ fontSize: 14, fill: COLORS.ink }} width={190} />
                <Tooltip contentStyle={{ background: COLORS.panel2, border: `1px solid ${COLORS.line}`, borderRadius: 6, fontSize: 12 }} formatter={(val) => fmtMoney(val)} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Bar dataKey="rev_" label={{ position: "center", formatter: (v) => v > 0 ? (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`) : "", fill: COLORS.paper, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>
                  {revenueChartData.map((item, idx) => (
                    <Cell key={`cell-${idx}`} fill={item.category === "food" ? COLORS.amber : COLORS.green} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: 16 }}>
        <h4 style={{ marginTop: 0, color: COLORS.muted, textTransform: "uppercase", fontSize: 12 }}>{selectedDates.length === 1 ? "Таблица выручки" : "Сравнение по датам — Позиции"}</h4>
        {rows.length === 0 ? <p style={{ color: COLORS.muted }}>Нет данных</p> : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "6px 8px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: COLORS.muted, borderBottom: `1px solid ${COLORS.line}`, textTransform: "uppercase" }}>Позиция</th>
                <th style={{ textAlign: "left", padding: "6px 8px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: COLORS.muted, borderBottom: `1px solid ${COLORS.line}`, textTransform: "uppercase" }}>Категория</th>
                {selectedDates.map((d) => (
                  <th key={`qty_${d}`} style={{ textAlign: "right", padding: "6px 8px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: COLORS.muted, borderBottom: `1px solid ${COLORS.line}`, textTransform: "uppercase" }}>Шт {d}</th>
                ))}
                {selectedDates.map((d) => (
                  <th key={`rev_${d}`} style={{ textAlign: "right", padding: "6px 8px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: COLORS.muted, borderBottom: `1px solid ${COLORS.line}`, textTransform: "uppercase" }}>₽ {d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name}>
                  <td style={{ padding: "8px", borderBottom: `1px solid ${COLORS.line}` }}>{r.name}</td>
                  <td style={{ padding: "8px", borderBottom: `1px solid ${COLORS.line}`, color: r.category === "food" ? COLORS.amber : COLORS.green }}>{r.category === "food" ? "Еда" : "Бар"}</td>
                  {selectedDates.map((d) => (
                    <td key={`qty_${r.name}_${d}`} style={{ padding: "8px", borderBottom: `1px solid ${COLORS.line}`, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}>{r.dates[d]?.qty || "—"}</td>
                  ))}
                  {selectedDates.map((d) => (
                    <td key={`rev_${r.name}_${d}`} style={{ padding: "8px", borderBottom: `1px solid ${COLORS.line}`, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}>{r.dates[d]?.revenue ? fmtMoney(r.dates[d].revenue) : "—"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
});

function StatCard({ label, value }) {
  return (
    <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: "14px 16px" }}>
      <div style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 20, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
