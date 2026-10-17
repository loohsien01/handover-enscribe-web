/** Shared trash/delete icon (pre-visit summary home, notes cards, etc.). */
export default function IconTrash({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 6h6M10 6l.5-2h3L14 6m-8 0h12l-1 14H7L6 6z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
