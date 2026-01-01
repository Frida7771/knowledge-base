declare global {
  interface Window {
    __API_BASE__?: string;
  }
}

const viteApiBase =
  typeof import.meta !== "undefined"
    ? ((import.meta as any).env?.VITE_API_BASE as string | undefined)
    : undefined;

const globalApiBase =
  typeof window !== "undefined" ? window.__API_BASE__ : undefined;

export const API_BASE =
  viteApiBase || globalApiBase || "http://127.0.0.1:8000";


