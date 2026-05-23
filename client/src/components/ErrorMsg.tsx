export default function ErrorMsg({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="text-red-400 text-4xl mb-3">!</div>
      <p className="text-sm text-gray-600 text-center mb-4">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-primary">
          重试
        </button>
      )}
    </div>
  );
}
