"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };
type SelectProps = {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly Option[];
  label: string;
  className?: string;
};

export function Select({ id, value, onValueChange, options, label, className }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const typed = useRef({ text: "", time: 0 });
  const listId = useId();
  const selected = options.findIndex(option => option.value === value);

  useEffect(() => {
    function close(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  useEffect(() => {
    if (open) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, listId]);

  function choose(option: Option) {
    onValueChange(option.value);
    setOpen(false);
    trigger.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
      if (event.key === "Home") setActive(0);
      else if (event.key === "End") setActive(options.length - 1);
      else if (!open) setActive(Math.max(0, selected));
      else setActive(current => Math.max(0, Math.min(options.length - 1, current + (event.key === "ArrowDown" ? 1 : -1))));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open && options[active]) choose(options[active]);
      else { setActive(Math.max(0, selected)); setOpen(true); }
    } else if (event.key === "Escape") {
      event.preventDefault(); setOpen(false);
    } else if (event.key === "Tab") setOpen(false);
    else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      typed.current = { text: (now - typed.current.time < 700 ? typed.current.text : "") + event.key.toLowerCase(), time: now };
      const match = options.findIndex(option => option.label.toLowerCase().startsWith(typed.current.text));
      if (match >= 0) { setOpen(true); setActive(match); }
    }
  }

  return <div ref={root} className={cn("category-select modern-select", open && "is-open", className)} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <button ref={trigger} id={id} type="button" role="combobox" aria-label={label} aria-expanded={open} aria-controls={listId}
      aria-haspopup="listbox" aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
      className="modern-select-trigger" onKeyDown={onKeyDown} onClick={() => { setActive(Math.max(0, selected)); setOpen(!open); }}>
      <span>{options[selected]?.label ?? "Choose an option"}</span><ChevronDown size={17} aria-hidden="true"/>
    </button>
    {open && <div className="category-select-menu">
      <ul id={listId} role="listbox" aria-label={label}>
        {options.map((option, index) => <li key={option.value} id={`${listId}-${index}`} role="option" aria-selected={option.value === value}
          className={`${index === active ? "highlighted" : ""} ${option.value === value ? "chosen" : ""}`}
          onPointerMove={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(option)}>
          <span>{option.label}</span>{option.value === value && <Check size={17} aria-hidden="true"/>}
        </li>)}
      </ul>
    </div>}
  </div>;
}
