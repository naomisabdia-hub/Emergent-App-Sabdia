import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios, { AxiosInstance } from "axios";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

export type Role = "admin" | "team";
export type User = {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  property_assignment?: string | null;
  phone?: string | null;
  status?: string;
};

type AuthCtx = {
  user: User | null | undefined; // undefined = loading
  token: string | null;
  api: AxiosInstance;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export const api = axios.create({ baseURL: `${BASE}/api`, timeout: 20000 });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const t = await AsyncStorage.getItem("token");
        if (t) {
          api.defaults.headers.common.Authorization = `Bearer ${t}`;
          const r = await api.get("/auth/me");
          setUser(r.data);
          setToken(t);
        } else {
          setUser(null);
        }
      } catch {
        await AsyncStorage.removeItem("token");
        setUser(null);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const r = await api.post("/auth/login", { email, password });
    const { token: t, user: u } = r.data;
    await AsyncStorage.setItem("token", t);
    api.defaults.headers.common.Authorization = `Bearer ${t}`;
    setToken(t);
    setUser(u);
  };

  const logout = async () => {
    await AsyncStorage.removeItem("token");
    delete api.defaults.headers.common.Authorization;
    setToken(null);
    setUser(null);
  };

  return <Ctx.Provider value={{ user, token, api, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside provider");
  return v;
}
