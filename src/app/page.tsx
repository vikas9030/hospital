"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";

function SuppressExtensionErrors() {
  useEffect(() => {
    const handler = (e: PromiseRejectionEvent) => {
      if (e.reason?.stack?.includes("chrome-extension://")) {
        e.preventDefault();
      }
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);
  return null;
}

const HomeClient = dynamic(() => import("./home-client"), { ssr: false });

export default function Home() {
  return (
    <>
      <SuppressExtensionErrors />
      <HomeClient />
    </>
  );
}
