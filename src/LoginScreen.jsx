import React, { useState } from "react";
import { auth } from "./firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";

const COLORS = {
  bg: "#17140F",
  panel: "#211D16",
  paper: "#F6EFDF",
  ink: "#F2EADA",
  amber: "#D98E2B",
  amberSoft: "rgba(217,142,43,0.16)",
  green: "#4F9D69",
  greenSoft: "rgba(79,157,105,0.16)",
  muted: "#8C8271",
  line: "rgba(242,234,218,0.12)",
};

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignUp) {
        // Регистрация нового пользователя
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        // Вход существующего пользователя
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      let message = err.message;
      if (message.includes("email-already-in-use")) {
        message = "Email уже используется";
      } else if (message.includes("wrong-password")) {
        message = "Неверный пароль";
      } else if (message.includes("user-not-found")) {
        message = "Пользователь не найден";
      } else if (message.includes("weak-password")) {
        message = "Пароль должен быть минимум 6 символов";
      }
      setError(message);
      setLoading(false);
    }
  };

  return (
    <div style={{
      background: COLORS.bg,
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
      fontFamily: "'IBM Plex Sans', sans-serif",
    }}>
      <div style={{
        background: COLORS.panel,
        border: `1px solid ${COLORS.line}`,
        borderRadius: "8px",
        padding: "40px",
        minWidth: "300px",
        maxWidth: "400px",
      }}>
        <h1 style={{
          fontSize: "24px",
          fontWeight: "600",
          color: COLORS.ink,
          marginBottom: "20px",
          textAlign: "center",
          letterSpacing: "1px",
        }}>
          ЛИНИЯ
        </h1>
        
        <p style={{
          fontSize: "13px",
          color: COLORS.muted,
          textAlign: "center",
          marginBottom: "30px",
        }}>
          {isSignUp ? "Создать аккаунт" : "Вход в систему"}
        </p>

        <form onSubmit={handleAuth}>
          <div style={{ marginBottom: "16px" }}>
            <label style={{
              display: "block",
              fontSize: "12px",
              color: COLORS.muted,
              marginBottom: "6px",
              fontWeight: "500",
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              style={{
                width: "100%",
                padding: "10px",
                fontSize: "13px",
                border: `1px solid ${COLORS.line}`,
                borderRadius: "4px",
                background: COLORS.bg,
                color: COLORS.ink,
                boxSizing: "border-box",
                fontFamily: "'IBM Plex Mono', monospace",
              }}
              required
            />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label style={{
              display: "block",
              fontSize: "12px",
              color: COLORS.muted,
              marginBottom: "6px",
              fontWeight: "500",
            }}>
              Пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: "100%",
                padding: "10px",
                fontSize: "13px",
                border: `1px solid ${COLORS.line}`,
                borderRadius: "4px",
                background: COLORS.bg,
                color: COLORS.ink,
                boxSizing: "border-box",
                fontFamily: "'IBM Plex Mono', monospace",
              }}
              required
            />
          </div>

          {error && (
            <div style={{
              padding: "10px",
              background: "rgba(193,80,58,0.16)",
              border: "1px solid #C1503A",
              borderRadius: "4px",
              fontSize: "12px",
              color: "#F6EFDF",
              marginBottom: "16px",
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              background: COLORS.amber,
              color: "#FFF",
              border: "none",
              borderRadius: "4px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Загрузка..." : (isSignUp ? "Зарегистрироваться" : "Войти")}
          </button>
        </form>

        <button
          onClick={() => {
            setIsSignUp(!isSignUp);
            setError("");
          }}
          style={{
            width: "100%",
            marginTop: "16px",
            padding: "10px",
            background: "transparent",
            color: COLORS.muted,
            border: `1px solid ${COLORS.line}`,
            borderRadius: "4px",
            fontSize: "12px",
            cursor: "pointer",
            fontFamily: "'IBM Plex Sans', sans-serif",
          }}
        >
          {isSignUp ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Зарегистрироваться"}
        </button>
      </div>
    </div>
  );
}
