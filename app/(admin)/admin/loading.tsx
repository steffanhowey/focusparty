export default function AdminLoading() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div
        className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent"
        style={{ color: "var(--sg-shell-500)" }}
      />
    </div>
  );
}
