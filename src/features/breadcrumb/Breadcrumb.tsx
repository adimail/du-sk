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
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        background: "rgba(255, 255, 255, 0.04)",
        padding: "3px 8px",
        borderRadius: "20px",
        border: "1px solid rgba(255, 255, 255, 0.06)",
      }}
    >
      {path.map((segment, index) => {
        const isLast = index === path.length - 1;

        return (
          <React.Fragment key={`${segment}-${index}`}>
            {index > 0 && (
              <span
                style={{
                  color: "#52525b",
                  fontSize: "11px",
                  userSelect: "none",
                }}
              >
                /
              </span>
            )}
            {isLast ? (
              <span
                style={{
                  color: "#f4f4f5",
                  fontWeight: 500,
                  fontSize: "12px",
                  padding: "2px 6px",
                  borderRadius: "12px",
                  background: "rgba(255, 255, 255, 0.07)",
                }}
              >
                {segment}
              </span>
            ) : (
              <button
                type="button"
                disabled={disabled}
                onClick={() => onNavigate(index)}
                style={{
                  background: "transparent",
                  border: "none",
                  padding: "2px 6px",
                  color: disabled ? "#52525b" : "#a1a1aa",
                  cursor: disabled ? "default" : "pointer",
                  borderRadius: "12px",
                  fontSize: "12px",
                  fontWeight: 400,
                }}
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
