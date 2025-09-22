"use client";
import React from "react";

export default function Guard({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}