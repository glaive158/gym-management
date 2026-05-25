import * as SecureStore from "expo-secure-store";

const KEY = "auth_token";

export const getToken = () => SecureStore.getItemAsync(KEY);
export const setToken = (t: string) => SecureStore.setItemAsync(KEY, t);
export const clearToken = () => SecureStore.deleteItemAsync(KEY);
