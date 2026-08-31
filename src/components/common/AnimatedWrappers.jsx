import React from "react";
import { useSelector } from "react-redux";
import { sel } from "../../store.js";

export function AnimatedPage({ children, pageKey }) {
  const enableAnim = useSelector(sel.enableAnimations);
  return <div key={pageKey} className={enableAnim ? "page-anim" : undefined}>{children}</div>;
}

export function AnimatedSubmenu({ isOpen, children }) {
  if (!isOpen) return null;
  return <div className="submenu-anim-wrap">{children}</div>;
}
