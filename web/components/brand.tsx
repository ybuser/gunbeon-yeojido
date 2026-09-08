export default function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand-lockup">
      <svg
        className="brand-mark"
        width="34"
        height="34"
        viewBox="0 0 40 40"
        aria-hidden="true"
      >
        <path
          d="M9 8h15a8 8 0 0 1 8 8v15H17a9 9 0 0 1-9-9V9"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
        <path
          d="M13 26l7-12 7 12M16 21h8"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="31"
          cy="9"
          r="5"
          fill="#2c68e8"
          stroke="white"
          strokeWidth="2"
        />
      </svg>
      {!compact && (
        <span>
          군번여지도<small>강원</small>
        </span>
      )}
    </span>
  );
}
