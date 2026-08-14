import React, { useState, useEffect } from "react";
import { auth } from "./firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import LoginScreen from "./LoginScreen";
import KitchenOrdersApp from "./KitchenOrdersApp";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Слушаем изменения аутентификации
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleLogout = () => {
    if (window.confirm("Вы уверены, что хотите выйти?")) {
      signOut(auth);
    }
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
        Загрузка...
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div>
      {/* Кнопка выхода в верхнем правом углу */}
      <div style={{
        position: "absolute",
        top: "12px",
        right: "12px",
        zIndex: 999,
      }}>
        <span style={{
          fontSize: "11px",
          color: "#8C8271",
          marginRight: "12px",
          fontFamily: "'IBM Plex Mono', monospace",
        }}>
          {user.email}
        </span>
        <button
          onClick={handleLogout}
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "11px",
            padding: "5px 10px",
            borderRadius: "4px",
            border: "1px solid rgba(242,234,218,0.12)",
            background: "transparent",
            color: "#8C8271",
            cursor: "pointer",
          }}
        >
          Выход
        </button>
      </div>

      {/* Основное приложение */}
      <KitchenOrdersApp />
    </div>
  );
}