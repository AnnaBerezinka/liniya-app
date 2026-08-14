import { db, auth } from "./firebase";
import { doc, setDoc, getDoc, onSnapshot } from "firebase/firestore";

// Загрузить состояние из Firebase
export async function loadState() {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) return null;
    
    const docRef = doc(db, "users", userId, "data", "state");
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data().state;
    }
    return null;
  } catch (e) {
    console.error("Ошибка загрузки:", e);
    return null;
  }
}

// Сохранить состояние в Firebase
export async function saveState(state) {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("Пользователь не авторизован");
    
    const docRef = doc(db, "users", userId, "data", "state");
    await setDoc(docRef, { state, updatedAt: new Date() });
  } catch (e) {
    console.error("Ошибка сохранения:", e);
  }
}

// Real-time синхронизация (подписка на изменения)
export function subscribeToState(callback) {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) return () => {};
    
    const docRef = doc(db, "users", userId, "data", "state");
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data().state);
      }
    });
  } catch (e) {
    console.error("Ошибка подписки:", e);
    return () => {};
  }
}