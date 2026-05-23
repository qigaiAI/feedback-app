interface StarRatingProps {
  value: number | undefined;
  onChange: (v: number) => void;
}

export default function StarRating({ value, onChange }: StarRatingProps) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star === value ? 0 : star)}
          className="text-2xl transition-colors"
          style={{ minWidth: 44, minHeight: 44 }}
        >
          {star <= (value || 0) ? '★' : '☆'}
        </button>
      ))}
    </div>
  );
}
