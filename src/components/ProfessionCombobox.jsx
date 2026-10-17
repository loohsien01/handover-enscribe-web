import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { AUTH_INPUT_CLASSNAME } from "@/components/auth/PasswordInput";
import {
  MEDICAL_PROFESSIONS,
  PROFESSION_OTHER_VALUE,
} from "@/constants/medicalProfessions";

function IconChevronDown({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={16}
      height={16}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/**
 * Searchable medical-profession combobox shared by sign-up and account settings.
 * Owns the search query + open state; the parent owns the selected value and the
 * free-text "Other" description.
 *
 * @param {object} props
 * @param {string} props.professionValue — selected profession slug (`""` when none)
 * @param {string} props.professionOther — free text when `professionValue === "other"`
 * @param {(value: string) => void} props.onProfessionValueChange
 * @param {(value: string) => void} props.onProfessionOtherChange
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.required=true]
 * @param {string} [props.id]
 * @param {string} [props.label="Medical profession"]
 * @param {string} [props.otherLabel="Describe your profession"]
 * @param {string} [props.placeholder="Search or select…"]
 * @param {string} [props.otherPlaceholder="e.g. Chiropractor"]
 * @param {string} [props.labelClassName]
 * @param {string} [props.inputClassName]
 * @param {string} [props.otherInputClassName]
 * @param {string} [props.groupClassName]
 */
export default function ProfessionCombobox({
  professionValue,
  professionOther,
  onProfessionValueChange,
  onProfessionOtherChange,
  disabled = false,
  required = true,
  id,
  label = "Medical profession",
  otherLabel = "Describe your profession",
  placeholder = "Search or select…",
  otherPlaceholder = "e.g. Chiropractor",
  labelClassName = "text-sm font-medium text-slate-700",
  inputClassName = `${AUTH_INPUT_CLASSNAME} pr-10`,
  otherInputClassName = AUTH_INPUT_CLASSNAME,
  groupClassName = "space-y-2",
}) {
  const reactId = useId();
  const inputId = id ?? `${reactId}-profession`;
  const otherId = `${reactId}-profession-other`;
  const listboxId = `${reactId}-profession-listbox`;

  const [query, setQuery] = useState(
    () =>
      MEDICAL_PROFESSIONS.find((p) => p.value === professionValue)?.label ?? "",
  );
  const [listOpen, setListOpen] = useState(false);
  // False until the user types, so focusing a filled field shows the full list
  // (instead of just the one option matching the selected label).
  const [filtering, setFiltering] = useState(false);
  const blurCloseTimer = useRef(null);

  const selectedProfession = useMemo(
    () => MEDICAL_PROFESSIONS.find((p) => p.value === professionValue),
    [professionValue],
  );

  // Reflect an externally set value (e.g. loaded profile) in the input text,
  // without clobbering what the user is actively typing (value === "" while typing).
  useEffect(() => {
    if (!professionValue) return;
    const selected = MEDICAL_PROFESSIONS.find((p) => p.value === professionValue);
    if (!selected) return;
    setQuery((prev) => (prev === selected.label ? prev : selected.label));
  }, [professionValue]);

  const filteredProfessions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const other = MEDICAL_PROFESSIONS.find(
      (p) => p.value === PROFESSION_OTHER_VALUE,
    );
    const list =
      !filtering || !q
        ? MEDICAL_PROFESSIONS
        : MEDICAL_PROFESSIONS.filter((p) =>
            p.label.toLowerCase().includes(q),
          );
    if (other && !list.some((p) => p.value === PROFESSION_OTHER_VALUE)) {
      return [...list, other];
    }
    return list;
  }, [query, filtering]);

  const clearBlurTimer = () => {
    if (blurCloseTimer.current) {
      window.clearTimeout(blurCloseTimer.current);
      blurCloseTimer.current = null;
    }
  };

  useEffect(() => clearBlurTimer, []);

  const handleInputChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    setListOpen(true);
    setFiltering(true);
    if (selectedProfession && v !== selectedProfession.label) {
      onProfessionValueChange("");
    }
  };

  const handleFocus = (e) => {
    clearBlurTimer();
    setListOpen(true);
    setFiltering(false);
    // Highlight existing text so typing immediately replaces the selected label.
    e.target.select();
  };

  const handleBlur = () => {
    blurCloseTimer.current = window.setTimeout(() => {
      setListOpen(false);
      setFiltering(false);
    }, 150);
  };

  const pickProfession = (p) => {
    clearBlurTimer();
    onProfessionValueChange(p.value);
    setQuery(p.label);
    setListOpen(false);
    setFiltering(false);
    if (p.value !== PROFESSION_OTHER_VALUE) {
      onProfessionOtherChange("");
    }
  };

  return (
    <>
      <div className={groupClassName}>
        <label htmlFor={inputId} className={labelClassName}>
          {label}
        </label>
        <div className="relative">
          <div className="relative">
            <input
              id={inputId}
              type="text"
              placeholder={placeholder}
              required={required}
              value={query}
              onChange={handleInputChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              disabled={disabled}
              autoComplete="off"
              aria-autocomplete="list"
              aria-expanded={listOpen}
              aria-controls={listboxId}
              role="combobox"
              className={inputClassName}
            />
            <span
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            >
              <IconChevronDown className="" />
            </span>
          </div>
          {listOpen && filteredProfessions.length > 0 ? (
            <div
              id={listboxId}
              role="listbox"
              className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
            >
              {filteredProfessions.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  role="option"
                  aria-selected={professionValue === p.value}
                  onMouseDown={(ev) => ev.preventDefault()}
                  onClick={() => pickProfession(p)}
                  className="w-full px-3 py-2 text-left text-sm text-slate-900 transition hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                >
                  {p.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {professionValue === PROFESSION_OTHER_VALUE ? (
        <div className={groupClassName}>
          <label htmlFor={otherId} className={labelClassName}>
            {otherLabel}
          </label>
          <input
            id={otherId}
            type="text"
            placeholder={otherPlaceholder}
            required={required}
            minLength={1}
            value={professionOther}
            onChange={(e) => onProfessionOtherChange(e.target.value)}
            disabled={disabled}
            className={otherInputClassName}
          />
        </div>
      ) : null}
    </>
  );
}
