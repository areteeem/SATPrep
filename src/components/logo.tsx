export const Logo = ({ className, iconOnly }: { className?: string; iconOnly?: boolean }) => (
  <div className={`text-2xl font-bold text-primary flex justify-center items-center ${className ?? ""}`}>
    SAT Prep
  </div>
);
