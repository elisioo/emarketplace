"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

export function CategorySelect({ value, onChange, categories }: { value: string; onChange: (value: string) => void; categories: readonly string[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const options = categories.filter(category => category.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    input.current?.setCustomValidity(categories.includes(value) ? "" : "Please choose a category from the list.");
  }, [value, categories]);

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

  function choose(category: string) {
    onChange(category);
    setQuery("");
    setOpen(false);
    input.current?.focus();
  }

  return <div ref={root} className={`category-select ${open ? "is-open" : ""}`} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <div className="category-select-control">
      {open && <Search size={16} className="category-search-icon" aria-hidden="true"/>}
      <input ref={input} id="listing-category" role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
        autoComplete="off" required placeholder={open ? "Search categories..." : "Choose a category"}
        value={open ? query : value}
        onClick={() => { if (!open) { setQuery(""); setActive(0); setOpen(true); } }}
        onChange={event => { setQuery(event.target.value); setActive(0); setOpen(true); onChange(""); }}
        onInvalid={() => { setOpen(true); setQuery(""); setActive(0); }}
        onKeyDown={event => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) { setOpen(true); setQuery(""); setActive(0); }
            else setActive(current => Math.max(0, Math.min(options.length - 1, current + (event.key === "ArrowDown" ? 1 : -1))));
          } else if (event.key === "Enter" && open) {
            event.preventDefault();
            if (options[active]) choose(options[active]);
          } else if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
        }}/>
      <button type="button" tabIndex={-1} aria-label={open ? "Close categories" : "Open categories"} onClick={() => {
        setOpen(!open); setQuery(""); setActive(0); input.current?.focus();
      }}><ChevronDown size={18} aria-hidden="true"/></button>
    </div>
    {open && <div className="category-select-menu">
      <div className="category-select-caption">SELECT A CATEGORY</div>
      <ul id={listId} role="listbox" aria-label="Categories">
        {options.map((category, index) => <li key={category} id={`${listId}-${index}`} role="option" aria-selected={category === value}
          className={`${index === active ? "highlighted" : ""} ${category === value ? "chosen" : ""}`}
          onPointerMove={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(category)}>
          <span>{category}</span>{category === value && <Check size={17} aria-hidden="true"/>}
        </li>)}
      </ul>
      {options.length === 0 && <p className="category-select-empty" role="status">No categories found. Try another keyword.</p>}
    </div>}
  </div>;
}
