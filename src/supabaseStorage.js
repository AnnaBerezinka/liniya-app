import { supabase } from './supabaseClient';

const SHARED_ID = 'shared';

// Сохранить состояние (общее для всех)
export const saveState = async (state) => {
  try {
    const { error } = await supabase
      .from('app_state')
      .upsert(
        {
          id: SHARED_ID,
          state: state,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
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

// Загрузить состояние (одно для всех)
export const loadState = async () => {
  try {
    const { data, error } = await supabase
      .from('app_state')
      .select('state')
      .eq('id', SHARED_ID)
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

// Real-time подписка на изменения (все видят!)
export const subscribeToStateChanges = (callback) => {
  const subscription = supabase
    .from('app_state')
    .on('*', (payload) => {
      console.log('State changed:', payload);
      // Загружаем обновленное состояние
      loadState().then((state) => {
        if (state) callback(state);
      });
    })
    .subscribe();

  return subscription;
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