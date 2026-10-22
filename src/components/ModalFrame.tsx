// On laptops, phone-style screens (react, sign-up, profile…) show as a centered window.
// On phones it does nothing.
export default function ModalFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="lg:flex lg:min-h-dvh lg:items-center lg:justify-center lg:bg-field lg:p-8">
      <div className="modal-frame lg:max-h-[calc(100dvh-4rem)] lg:w-[440px] lg:overflow-y-auto lg:rounded-[18px] lg:bg-surface lg:shadow-float">
        {children}
      </div>
    </div>
  );
}
