"use client";

import { useEffect } from "react";

/** Reveal native scrollbars only when the pointer approaches their edge. */
export function ScrollbarVisibility() {
  useEffect(() => {
    const pointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    let visible: HTMLElement | null = null;
    function reveal(element: HTMLElement | null) {
      if (element === visible) return;
      visible?.removeAttribute("data-scrollbar-visible");
      visible = element;
      visible?.setAttribute("data-scrollbar-visible", "true");
    }
    function onMove(event: PointerEvent) {
      document.documentElement.removeAttribute("data-keyboard-navigation");
      if (!pointer.matches || event.pointerType === "touch") { reveal(null); return; }
      // Preserve visibility while the native scrollbar is being dragged.
      if (event.buttons) return;
      for (const element of event.composedPath()) {
        if (!(element instanceof HTMLElement) || element === document.body || element === document.documentElement) continue;
        const rect = element.getBoundingClientRect();
        const nearRight = event.clientX >= rect.right - 14 && event.clientX <= rect.right;
        const nearBottom = event.clientY >= rect.bottom - 14 && event.clientY <= rect.bottom;
        if (!nearRight && !nearBottom) continue;
        const style = getComputedStyle(element);
        const vertical = element.scrollHeight > element.clientHeight && /auto|scroll/.test(style.overflowY);
        const horizontal = element.scrollWidth > element.clientWidth && /auto|scroll/.test(style.overflowX);
        if ((vertical && nearRight) || (horizontal && nearBottom)) { reveal(element); return; }
      }
      const root = document.documentElement;
      const vertical = root.scrollHeight > root.clientHeight && event.clientX >= root.clientWidth - 14;
      const horizontal = root.scrollWidth > root.clientWidth && event.clientY >= root.clientHeight - 14;
      reveal(vertical || horizontal ? root : null);
    }
    const hide = () => reveal(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (["Tab", "ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End"].includes(event.key)) {
        document.documentElement.setAttribute("data-keyboard-navigation", "true");
      }
    };
    const onPointerDown = () => document.documentElement.removeAttribute("data-keyboard-navigation");
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown, { passive: true });
    document.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", hide);
    window.addEventListener("blur", hide);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      document.documentElement.removeAttribute("data-keyboard-navigation");
      document.documentElement.removeEventListener("pointerleave", hide);
      window.removeEventListener("blur", hide);
      hide();
    };
  }, []);
  return null;
}
