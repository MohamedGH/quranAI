import React from "react";
import { useSelector } from "react-redux";
import { sel } from "../../store.js";

export function AnimatedPage({ children, pageKey }) {
  const enableAnim = useSelector(sel.enableAnimations);
  return (
    <div
      key={pageKey}
      className={`page-container${enableAnim ? " page-anim" : ""}`}
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        minWidth: 0,
        minHeight: 0,
        width: "100%",
        height: "100%",
      }}
    >
      {children}
    </div>
  );
}

export function AnimatedSubmenu({ isOpen, children }) {
  if (!isOpen) return null;
  return <div className="submenu-anim-wrap">{children}</div>;
}
