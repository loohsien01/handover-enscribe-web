import React, { createContext, useContext, useState } from "react"

const SidebarContext = createContext(null)

export function SidebarProvider({ children }) {
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  return (
    <SidebarContext.Provider value={{ sidebarExpanded, setSidebarExpanded }}>{children}</SidebarContext.Provider>
  )
}

export function useSidebar() {
  const ctx = useContext(SidebarContext)
  if (!ctx) {
    throw new Error("useSidebar must be used within SidebarProvider")
  }
  return ctx
}
