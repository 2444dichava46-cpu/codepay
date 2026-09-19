export default function Avatar({
  src,
  name,
  size = 40,
}: {
  src?: string | null;
  name: string;
  size?: number;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={`Foto de ${name}`}
        className="avatar"
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className="avatar avatar-fallback"
      style={{ width: size, height: size, fontSize: Math.max(11, size / 2.6) }}
      aria-label={`Foto de ${name}`}
    >
      {initials}
    </div>
  );
}
