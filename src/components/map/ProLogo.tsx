import { initials, logoColor } from "./logo";

// Round logo with a white border; the pro's own color with initials when there's no logo yet.
export default function ProLogo({
  name,
  logoUrl,
  color,
  size,
}: {
  name: string;
  logoUrl: string | null;
  color?: string | null;
  size: number;
}) {
  return (
    <span
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] border-white font-bold text-white shadow-[0_4px_10px_rgba(26,29,36,0.15)]"
      style={{ width: size, height: size, background: logoUrl ? "#fff" : logoColor(name, color), fontSize: size * 0.32 }}
      aria-hidden
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="size-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
