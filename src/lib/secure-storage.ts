// AES-256-GCM encrypted storage for zustand persist ("Data Encryption").
//
// When enabled, the whole persisted blob is encrypted with a per-device key
// before it touches localStorage, so patient/staff/user data at rest is not
// readable plaintext. Format: `enc1:<base64 iv>:<base64 ct>`. Legacy plain
// blobs still load (backward compatible); they are converted on next write.
// The on/off flag lives outside the blob in `medicore-enc-on` because the
// storage layer cannot read the blob to decide how to read the blob.

const FLAG_KEY = "medicore-enc-on";
const DEVICE_KEY = "medicore-enc-key-v1";
const PREFIX = "enc1:";

function lsGet(k: string): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(k);
  } catch {
    return null;
  }
}

function lsSet(k: string, v: string): void {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(k, v);
  } catch {
    // Storage full/blocked: keep running with in-memory state.
  }
}

function lsDel(k: string): void {
  try {
    if (typeof window !== "undefined") window.localStorage.removeItem(k);
  } catch {
    // ignore
  }
}

export function isEncryptionFlagOn(): boolean {
  // Default ON (matches the Security default) — absence of the flag means on.
  return lsGet(FLAG_KEY) !== "0";
}

export function setEncryptionFlag(on: boolean): void {
  lsSet(FLAG_KEY, on ? "1" : "0");
}

const b64 = {
  encode(bytes: Uint8Array): string {
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  },
  decode(s: string): Uint8Array<ArrayBuffer> {
    const bin = atob(s);
    const out = new Uint8Array(new ArrayBuffer(bin.length));
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },
};

function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(new ArrayBuffer(n)));
}

async function deviceKey(): Promise<CryptoKey> {
  let raw = lsGet(DEVICE_KEY);
  if (!raw) {
    raw = b64.encode(randomBytes(32));
    lsSet(DEVICE_KEY, raw);
  }
  const keyBytes = b64.decode(raw);
  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptString(plain: string): Promise<string> {
  const key = await deviceKey();
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain));
  return `${PREFIX}${b64.encode(iv)}:${b64.encode(new Uint8Array(ct))}`;
}

async function decryptString(payload: string): Promise<string> {
  const rest = payload.slice(PREFIX.length);
  const sep = rest.indexOf(":");
  if (sep < 0) throw new Error("bad envelope");
  const iv = b64.decode(rest.slice(0, sep));
  const ct = b64.decode(rest.slice(sep + 1));
  const key = await deviceKey();
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}

export type BlobStatus = "encrypted" | "plain" | "empty" | "broken";

/** What format is the on-device persisted store in right now? */
export function persistedBlobStatus(storageName = "medicore-store-v3"): BlobStatus {
  const raw = lsGet(storageName);
  if (!raw) return "empty";
  if (!raw.startsWith(PREFIX)) {
    try {
      JSON.parse(raw);
      return "plain";
    } catch {
      return "broken";
    }
  }
  return "encrypted";
}

/** Drop-in storage for zustand's createJSONStorage. Async is supported. */
export const secureStorage = {
  async getItem(name: string): Promise<string | null> {
    const raw = lsGet(name);
    if (raw == null) return null;
    if (!raw.startsWith(PREFIX)) return raw; // legacy plain blob
    try {
      return await decryptString(raw);
    } catch {
      try {
        sessionStorage.setItem("medicore-enc-broken", "1");
      } catch {
        // ignore
      }
      return null;
    }
  },
  async setItem(name: string, value: string): Promise<void> {
    if (!isEncryptionFlagOn()) {
      lsSet(name, value);
      return;
    }
    try {
      lsSet(name, await encryptString(value));
    } catch {
      lsSet(name, value);
    }
  },
  async removeItem(name: string): Promise<void> {
    lsDel(name);
  },
};
