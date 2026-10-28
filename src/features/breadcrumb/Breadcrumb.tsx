import React from "react";

interface BreadcrumbProps {
  path: string[];
  onNavigate: (index: number) => void;
  disabled: boolean;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  path,
  onNavigate,
  disabled,
}) => {
  return (
    <nav className="flex items-center gap-1 bg-white/5 py-1 px-2 rounded-full border border-white/5">
      {path.map((segment, index) => {
        const isLast = index === path.length - 1;

        return (
          <React.Fragment key={`${segment}-${index}`}>
            {index > 0 && (
              <span className="text-zinc-600 text-[11px] select-none">
                /
              </span>
            )}
            {isLast ? (
              <span className="text-zinc-100 font-medium text-xs py-0.5 px-1.5 rounded-full bg-white/10">
                {segment}
              </span>
            ) : (
              <button
                type="button"
                disabled={disabled}
                onClick={() => onNavigate(index)}
                className="bg-transparent border-none py-0.5 px-1.5 text-xs rounded-full transition-colors disabled:text-zinc-600 disabled:cursor-default text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                {segment}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
