import { supabase } from './supabaseClient';

// Сохранить состояние в Supabase
export const saveState = async (state) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from('app_state')
      .upsert(
        {
          user_id: user.id,
          state: state,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('Save error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Save exception:', err);
    return false;
  }
};

// Загрузить состояние из Supabase
export const loadState = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('app_state')
      .select('state')
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Load error:', error);
      return null;
    }

    return data?.state || null;
  } catch (err) {
    console.error('Load exception:', err);
    return null;
  }
};

// Real-time подписка на изменения состояния от ВСЕХ пользователей
export const subscribeToStateChanges = (callback) => {
  const subscription = supabase
    .from('app_state')
    .on('*', (payload) => {
      console.log('State changed:', payload);
      // Загружаем ВСЕ состояния чтобы получить актуальные данные
      loadAllStates().then(callback);
    })
    .subscribe();

  return subscription;
};

// Загрузить ВСЕ состояния от ВСЕХ пользователей (для синхронизации)
export const loadAllStates = async () => {
  try {
    const { data, error } = await supabase
      .from('app_state')
      .select('state');

    if (error) {
      console.error('Load all error:', error);
      return [];
    }

    return data?.map((item) => item.state) || [];
  } catch (err) {
    console.error('Load all exception:', err);
    return [];
  }
};

// Объединить все состояния в одно (меню и заказы должны быть общими)
export const mergeAllStates = (states) => {
  if (!states || states.length === 0) return null;

  // Берём первое состояние как базу
  const merged = JSON.parse(JSON.stringify(states[0]));

  // Объединяем меню (берём из всех состояний)
  const allMenuItems = new Map();
  states.forEach((state) => {
    if (state.menu) {
      state.menu.forEach((item) => {
        allMenuItems.set(item.id, item);
      });
    }
  });
  merged.menu = Array.from(allMenuItems.values());

  // Объединяем события/заказы
  const allEvents = {};
  states.forEach((state) => {
    if (state.events) {
      Object.keys(state.events).forEach((date) => {
        if (!allEvents[date]) {
          allEvents[date] = { ...state.events[date], orders: [] };
        }
        // Объединяем заказы для каждой даты
        const ordersMap = new Map();
        allEvents[date].orders.forEach((order) => {
          ordersMap.set(order.id, order);
        });
        state.events[date].orders.forEach((order) => {
          ordersMap.set(order.id, order);
        });
        allEvents[date].orders = Array.from(ordersMap.values());
      });
    }
  });
  merged.events = allEvents;

  return merged;
};

// Получить пользователя
export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

// Регистрация
export const signUp = async (email, password) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  return { data, error };
};

// Логин
export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

// Логаут
export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return error;
};
